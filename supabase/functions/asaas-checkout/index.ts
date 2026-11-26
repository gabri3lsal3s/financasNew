import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  findOrCreateAsaasCustomer,
  createAsaasCreditCardSubscription,
  createAsaasPixCharge,
  getAsaasPixQrCode,
  getAsaasPayment,
  getAsaasSubscriptionPayments,
  ensurePreviousSubscriptionCanceled,
  shouldReusePendingPixCharge,
  isValidCPF,
  isValidLuhn,
  isValidCardExpiry,
  sanitizePaymentLog,
  mapAsaasCardErrorMessage,
  formatBrtIsoDate,
  formatBrtDisplayDate,
} from "../_shared/asaas.ts";
import {
  ASAAS_PLAN_CATALOG,
  calculateCumulativePriceServer,
  addCivilMonthsServer,
} from "../_shared/asaas-plans.ts";
import {
  buildCorsHeaders,
  extractClientIp,
  isProductionEnvironment,
  jsonResponse,
  safeErrorResponse,
} from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import { renderTrialCardScheduledEmail } from "../_shared/email-templates.ts";

declare const Deno: {
  env?: {
    get(key: string): string | undefined;
  };
  serve?: (handler: (req: Request) => Promise<Response> | Response) => void;
} | undefined;

const CONFIRMED_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

async function enforceBillingRateLimit(
  req: Request,
  supabase: SupabaseClient,
  userId: string,
  clientIp: string,
  isCreditCard: boolean,
): Promise<Response | null> {
  const checks = isCreditCard
    ? [
        { action: "checkout_card_15m", max: 5, window: 900 },
        { action: "checkout_card_24h", max: 10, window: 86400 },
      ]
    : [{ action: "checkout_pix_15m", max: 10, window: 900 }];

  for (const check of checks) {
    const { data, error } = await supabase.rpc("check_billing_rate_limit", {
      p_user_id: userId,
      p_ip: clientIp || null,
      p_action: check.action,
      p_max_attempts: check.max,
      p_window_seconds: check.window,
    });

    if (error) {
      console.error("[asaas-checkout] Erro ao validar check_billing_rate_limit:", error);
      return jsonResponse(
        req,
        { error: "Serviço de proteção contra abuso indisponível. Tente novamente em instantes." },
        503,
      );
    }

    if (!data?.allowed) {
      const retryAfter = String(data?.retry_after_seconds ?? 60);
      return jsonResponse(
        req,
        {
          error:
            "Muitas tentativas de pagamento em um curto intervalo. Aguarde alguns minutos antes de tentar novamente.",
        },
        429,
        { "Retry-After": retryAfter },
      );
    }
  }

  return null;
}

Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno?.env?.get("SUPABASE_URL");
    const supabaseServiceKey = Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno?.env?.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Serviço de pagamento indisponível.");
    }

    // 1. Autenticação obrigatória com sessão JWT (D-04 / F-05)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Sessão não informada. Faça login para continuar." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: authUser },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !authUser) {
      return jsonResponse(req, { error: "Sessão inválida ou expirada. Faça login para continuar." }, 401);
    }

    if (!authUser.email_confirmed_at) {
      return jsonResponse(
        req,
        { error: "Por favor, confirme seu endereço de e-mail antes de contratar uma assinatura." },
        403,
      );
    }

    const user = authUser;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    const { kind, months, plan, method, cpf, card, phone, postalCode, addressNumber } = payload;

    const realClientIp = extractClientIp(req);
    const asaasRemoteIp = realClientIp || "127.0.0.1";
    const isCardAttempt = kind !== "cumulative_months" && method === "credit_card";

    // 2. Busca assinatura atual e valida restrição por chargeback (D-06)
    const { data: initialUserSub, error: userSubFetchErr } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let userSub = initialUserSub;

    if (userSubFetchErr) {
      console.error("[asaas-checkout] Erro ao consultar user_subscriptions:", userSubFetchErr);
      return safeErrorResponse(req, 500, "Falha ao consultar dados da assinatura.");
    }

    if (userSub?.chargeback_flagged_at) {
      return jsonResponse(
        req,
        {
          error:
            "Sua conta possui restrição de faturamento devido a contestação de pagamento anterior. Entre em contato com o suporte.",
        },
        403,
      );
    }

    // 3. Rate limit anti-card-testing e anti-spam (D-04)
    const rateLimitRes = await enforceBillingRateLimit(
      req,
      supabase,
      user.id,
      realClientIp,
      isCardAttempt,
    );
    if (rateLimitRes) return rateLimitRes;

    // 4. Busca perfil e normaliza dados do titular
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("name, email, cpf, phone, postal_code, address_number")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return safeErrorResponse(req, 500, "Perfil de usuário não encontrado para faturamento.");
    }

    const cleanCpf = (cpf || profile.cpf || "").replace(/\D/g, "");
    if (!cleanCpf || !isValidCPF(cleanCpf)) {
      return jsonResponse(req, { error: "CPF inválido ou não informado. Verifique o número digitado." }, 400);
    }

    const cleanPhone = (phone || card?.phone || profile.phone || "").replace(/\D/g, "");
    const cleanPostalCode = (postalCode || card?.postalCode || profile.postal_code || "").replace(/\D/g, "");
    const cleanAddressNumber = String(addressNumber || card?.addressNumber || profile.address_number || "").trim();

    const profileUpdates: Record<string, string> = {};
    if (cleanCpf && cleanCpf !== profile.cpf) profileUpdates.cpf = cleanCpf;
    if (cleanPhone && cleanPhone !== profile.phone) profileUpdates.phone = cleanPhone;
    if (cleanPostalCode && cleanPostalCode !== profile.postal_code) profileUpdates.postal_code = cleanPostalCode;
    if (cleanAddressNumber && cleanAddressNumber !== profile.address_number) {
      profileUpdates.address_number = cleanAddressNumber;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateErr } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);
      if (profileUpdateErr) {
        console.error("[asaas-checkout] Erro ao atualizar dados cadastrais em profiles:", profileUpdateErr);
        return safeErrorResponse(req, 500, "Falha ao atualizar dados cadastrais do titular.");
      }
    }

    const customerName = profile.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    const customerEmail = profile.email || user.email || "";

    const customer = await findOrCreateAsaasCustomer({
      existingCustomerId: userSub?.asaas_customer_id,
      name: customerName,
      email: customerEmail,
      cpfCnpj: cleanCpf,
      phone: cleanPhone || undefined,
    });

    if (userSub && userSub.asaas_customer_id !== customer.id) {
      const { error: custSyncErr } = await supabase
        .from("user_subscriptions")
        .update({ asaas_customer_id: customer.id })
        .eq("id", userSub.id);
      if (custSyncErr) {
        console.error("[asaas-checkout] Erro ao salvar asaas_customer_id:", custSyncErr);
        return safeErrorResponse(req, 500, "Falha ao vincular cadastro de cliente no gateway.");
      }
    }

    // =========================================================================
    // FLUXO A: PAGAMENTO ACUMULATIVO DE 2 A 11 MESES (EXCLUSIVO PRO MENSAL)
    // =========================================================================
    if (kind === "cumulative_months") {
      const monthsCount = Number(months);

      if (!Number.isInteger(monthsCount) || monthsCount < 2) {
        return jsonResponse(
          req,
          { error: "A antecipação acumulativa exige um mínimo de 2 meses." },
          400,
        );
      }

      if (monthsCount >= 12) {
        return jsonResponse(
          req,
          {
            error: "Limite de 11 meses para antecipação. Para 12 meses, aproveite o Plano Anual com 40% OFF!",
            suggestAnnual: true,
          },
          400,
        );
      }

      if (!userSub || userSub.tier !== "pro_monthly" || userSub.status !== "active") {
        return jsonResponse(
          req,
          { error: "A antecipação com desconto é exclusiva para assinantes ativos do Plano Pro Mensal." },
          403,
        );
      }

      if (userSub.pending_plan_id) {
        return jsonResponse(
          req,
          { error: "Você possui uma migração de plano agendada. Cancele-a antes de antecipar mensalidades." },
          400,
        );
      }

      const now = new Date();
      const currentEnd = userSub.current_period_end ? new Date(userSub.current_period_end) : now;
      const targetEnd = addCivilMonthsServer(currentEnd > now ? currentEnd : now, monthsCount);
      const maxAllowedFuture = addCivilMonthsServer(now, 11);

      if (targetEnd > maxAllowedFuture) {
        return jsonResponse(
          req,
          {
            error: "Sua vigência já está antecipada. A soma total de meses acumulados não pode ultrapassar 11 meses no futuro.",
          },
          400,
        );
      }

      const pricing = calculateCumulativePriceServer(monthsCount);

      const { data: existingIntent } = await supabase
        .from("billing_intents")
        .select("id, provider_payment_id, created_at, amount_cents")
        .eq("user_id", user.id)
        .eq("kind", "cumulative_renewal")
        .eq("months_count", monthsCount)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingIntent?.provider_payment_id) {
        try {
          const existingPayment = await getAsaasPayment(existingIntent.provider_payment_id);
          const createdAtMillis = existingPayment.dateCreated
            ? new Date(existingPayment.dateCreated).getTime()
            : new Date(existingIntent.created_at).getTime();

          const canReuse = shouldReusePendingPixCharge({
            paymentStatus: existingPayment.status,
            paymentValue: existingPayment.value,
            expectedValue: pricing.totalReais,
            createdAtMillis,
          });

          if (canReuse) {
            const qrCode = await getAsaasPixQrCode(existingPayment.id);
            return jsonResponse(req, {
              ok: true,
              method: "pix",
              kind: "cumulative_months",
              intentId: existingIntent.id,
              paymentId: existingPayment.id,
              months: monthsCount,
              totalCents: pricing.totalCents,
              discountPercentage: pricing.discountPercentage,
              qrCodeBase64: qrCode.encodedImage,
              copyPasteKey: qrCode.payload,
              expirationDate: qrCode.expirationDate,
              reused: true,
            });
          }
        } catch (reuseErr) {
          console.warn("[asaas-checkout] Falha ao consultar cobrança acumulativa anterior:", sanitizePaymentLog(reuseErr));
        }
      }

      const intentId = crypto.randomUUID();
      const { error: intentErr } = await supabase
        .from("billing_intents")
        .insert({
          id: intentId,
          user_id: user.id,
          kind: "cumulative_renewal",
          plan_id: "pro_monthly",
          months_count: monthsCount,
          amount_cents: pricing.totalCents,
          method: "pix",
          status: "pending",
          provider: "asaas",
          external_reference: intentId,
          metadata: {
            months: monthsCount,
            discount_percentage: pricing.discountPercentage,
            monthly_equivalent_cents: pricing.monthlyEquivalentCents,
            previous_period_end: userSub.current_period_end,
          },
        });

      if (intentErr) {
        console.error("[asaas-checkout] Falha ao criar billing_intent acumulativa:", intentErr);
        return safeErrorResponse(req, 500, "Falha ao registrar intenção de cobrança.");
      }

      let payment: { id: string; status: string; value: number };
      try {
        payment = await createAsaasPixCharge({
          customerId: customer.id,
          value: pricing.totalReais,
          description: `Axir Pro — Antecipação de ${monthsCount} meses (${pricing.discountPercentage}% OFF)`,
          externalReference: intentId,
        });
      } catch (asaasPixErr) {
        await supabase
          .from("billing_intents")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", intentId);
        throw asaasPixErr;
      }

      const qrCode = await getAsaasPixQrCode(payment.id);

      const { error: intentUpdateErr } = await supabase
        .from("billing_intents")
        .update({
          provider_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intentId);

      if (intentUpdateErr) {
        console.error("[asaas-checkout] Falha ao vincular provider_payment_id na intent acumulativa:", intentUpdateErr);
        return safeErrorResponse(req, 500, "Falha ao concluir registro do pagamento PIX.");
      }

      return jsonResponse(req, {
        ok: true,
        method: "pix",
        kind: "cumulative_months",
        intentId,
        paymentId: payment.id,
        months: monthsCount,
        totalCents: pricing.totalCents,
        discountPercentage: pricing.discountPercentage,
        qrCodeBase64: qrCode.encodedImage,
        copyPasteKey: qrCode.payload,
        expirationDate: qrCode.expirationDate,
      });
    }

    // =========================================================================
    // FLUXO B: CONTRATAÇÃO MENSAL OU ANUAL (COM AUTORIDADE DO SERVIDOR)
    // =========================================================================
    if (!plan || !["monthly", "annual"].includes(plan)) {
      return jsonResponse(req, { error: "Plano inválido (mensal ou anual)" }, 400);
    }

    if (!method || !["credit_card", "pix"].includes(method)) {
      return jsonResponse(req, { error: "Método de pagamento inválido" }, 400);
    }

    const planKey = plan === "annual" ? "annual" : "monthly";
    const planMeta = ASAAS_PLAN_CATALOG[planKey];
    const now = new Date();

    if (!userSub) {
      const defaultTrialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { data: upsertedSub, error: subCreateErr } = await supabase
        .from("user_subscriptions")
        .upsert(
          {
            user_id: user.id,
            plan_id: "trial",
            tier: "trial",
            status: "trialing",
            starts_at: now.toISOString(),
            trial_started_at: now.toISOString(),
            trial_ends_at: defaultTrialEnds.toISOString(),
            asaas_customer_id: customer.id,
          },
          { onConflict: "user_id" },
        )
        .select()
        .maybeSingle();

      if (subCreateErr || !upsertedSub) {
        console.error("[asaas-checkout] Erro ao criar registro inicial de assinatura:", subCreateErr);
        return safeErrorResponse(req, 500, "Falha ao inicializar assinatura do usuário.");
      }
      userSub = upsertedSub;
    }

    const hasAlreadyConsumedTrial = Boolean(
      userSub.trial_consumed_at ||
      userSub.billing_start_at ||
      userSub.tier === "read_only" ||
      userSub.status === "canceled" ||
      userSub.status === "read_only_expired" ||
      userSub.status === "past_due" ||
      userSub.tier !== "trial"
    );

    const trialEndsDate = userSub.trial_ends_at ? new Date(userSub.trial_ends_at) : null;
    const isTrialActive =
      !hasAlreadyConsumedTrial &&
      userSub.tier === "trial" &&
      userSub.status === "trialing" &&
      trialEndsDate !== null &&
      trialEndsDate.getTime() > now.getTime();

    const serverTrialEnds = isTrialActive ? trialEndsDate : null;
    const isDelayedByTrial = Boolean(serverTrialEnds);

    // =========================================================================
    // PIX (DISPONÍVEL EXCLUSIVAMENTE NO PLANO ANUAL)
    // =========================================================================
    if (method === "pix") {
      if (plan !== "annual") {
        return jsonResponse(
          req,
          { error: "Pagamento via PIX está disponível exclusivamente para o Plano Anual." },
          400,
        );
      }

      if (userSub.asaas_payment_id && userSub.status !== "active") {
        try {
          const existingPayment = await getAsaasPayment(userSub.asaas_payment_id);
          const createdAtMillis = existingPayment.dateCreated
            ? new Date(existingPayment.dateCreated).getTime()
            : 0;

          const canReuse = shouldReusePendingPixCharge({
            paymentStatus: existingPayment.status,
            paymentValue: existingPayment.value,
            expectedValue: planMeta.value,
            createdAtMillis,
          });

          if (canReuse) {
            const qrCode = await getAsaasPixQrCode(existingPayment.id);
            return jsonResponse(req, {
              ok: true,
              method: "pix",
              paymentId: existingPayment.id,
              qrCodeBase64: qrCode.encodedImage,
              copyPasteKey: qrCode.payload,
              expirationDate: qrCode.expirationDate,
              reused: true,
            });
          }
        } catch (err: unknown) {
          console.warn("[asaas-checkout] Falha ao consultar cobrança Pix prévia, gerando nova:", sanitizePaymentLog(err));
        }
      }

      const isUpgradeFromMonthly =
        userSub.tier === "pro_monthly" && userSub.status === "active";

      const intentId = crypto.randomUUID();
      const { error: intentErr } = await supabase
        .from("billing_intents")
        .insert({
          id: intentId,
          user_id: user.id,
          kind: isUpgradeFromMonthly ? "plan_change" : "subscription_start",
          plan_id: planMeta.planId,
          amount_cents: planMeta.valueCents,
          method: "pix",
          status: "pending",
          provider: "asaas",
          external_reference: intentId,
        });

      if (intentErr) {
        console.error("[asaas-checkout] Falha ao registrar billing_intent PIX:", intentErr);
        return safeErrorResponse(req, 500, "Falha ao registrar intenção de pagamento PIX.");
      }

      let payment: { id: string; status: string; value: number };
      try {
        payment = await createAsaasPixCharge({
          customerId: customer.id,
          value: planMeta.value,
          description: "Axir — Plano Pro Anual",
          externalReference: intentId,
        });
      } catch (asaasPixErr) {
        await supabase
          .from("billing_intents")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", intentId);
        throw asaasPixErr;
      }

      const qrCode = await getAsaasPixQrCode(payment.id);

      // [A-04 / W01] NÃO marcar trial_consumed_at nem limpar scheduled_plan_id na geração de PIX pendente
      const { error: subPixErr } = await supabase
        .from("user_subscriptions")
        .update({
          asaas_customer_id: customer.id,
          asaas_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (subPixErr) {
        console.error("[asaas-checkout] Falha ao atualizar user_subscriptions com payment_id PIX:", subPixErr);
        return safeErrorResponse(req, 500, "Falha ao registrar pagamento PIX na assinatura.");
      }

      const { error: intentPixErr } = await supabase
        .from("billing_intents")
        .update({
          provider_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intentId);

      if (intentPixErr) {
        console.error("[asaas-checkout] Falha ao vincular provider_payment_id PIX:", intentPixErr);
        return safeErrorResponse(req, 500, "Falha ao vincular cobrança PIX.");
      }

      return jsonResponse(req, {
        ok: true,
        method: "pix",
        intentId,
        paymentId: payment.id,
        qrCodeBase64: qrCode.encodedImage,
        copyPasteKey: qrCode.payload,
        expirationDate: qrCode.expirationDate,
        email: customerEmail,
      });
    }

    // =========================================================================
    // CARTÃO DE CRÉDITO (MENSAL OU ANUAL)
    // =========================================================================
    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return jsonResponse(req, { error: "Dados do cartão de crédito incompletos." }, 400);
    }

    if (!isValidLuhn(card.number)) {
      return jsonResponse(req, { error: "Número do cartão de crédito inválido." }, 400);
    }

    if (!isValidCardExpiry(card.expiryMonth, card.expiryYear)) {
      return jsonResponse(req, { error: "Cartão de crédito com data de validade vencida ou incorreta." }, 400);
    }

    const cleanCcv = (card.ccv || "").replace(/\D/g, "");
    if (cleanCcv.length < 3 || cleanCcv.length > 4) {
      return jsonResponse(req, { error: "Código de segurança (CVV) inválido." }, 400);
    }

    if (isProductionEnvironment()) {
      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
        return jsonResponse(
          req,
          { error: "Informe um telefone celular válido com DDD para validação antifraude do cartão." },
          400,
        );
      }
      if (cleanPostalCode.length !== 8) {
        return jsonResponse(
          req,
          { error: "Informe um CEP válido com 8 dígitos do titular do cartão." },
          400,
        );
      }
      if (!cleanAddressNumber) {
        return jsonResponse(
          req,
          { error: "Informe o número do endereço do titular do cartão." },
          400,
        );
      }
    }

    // [B-08] Lock anti-double-submit em processamento concorrente (< 90s)
    const lockCutoffIso = new Date(now.getTime() - 90_000).toISOString();
    const { data: activeProcessingIntent } = await supabase
      .from("billing_intents")
      .select("id")
      .eq("user_id", user.id)
      .eq("method", "credit_card")
      .eq("status", "processing")
      .gte("created_at", lockCutoffIso)
      .limit(1)
      .maybeSingle();

    if (activeProcessingIntent) {
      return jsonResponse(
        req,
        { error: "Já existe um pagamento com cartão em processamento. Aguarde alguns instantes." },
        409,
      );
    }

    const cardIntentKind =
      userSub.status === "active"
        ? "plan_change"
        : userSub.status === "canceled" || userSub.status === "read_only_expired"
          ? "reactivation"
          : "subscription_start";

    const intentId = crypto.randomUUID();
    const { error: cardIntentInsertErr } = await supabase
      .from("billing_intents")
      .insert({
        id: intentId,
        user_id: user.id,
        kind: cardIntentKind,
        plan_id: planMeta.planId,
        amount_cents: planMeta.valueCents,
        method: "credit_card",
        status: "processing",
        provider: "asaas",
        external_reference: intentId,
      });

    if (cardIntentInsertErr) {
      console.error("[asaas-checkout] Falha ao criar lock de intenção de cartão:", cardIntentInsertErr);
      return safeErrorResponse(req, 500, "Falha ao iniciar processamento do pagamento.");
    }

    const previousSubscriptionId = userSub.asaas_subscription_id || null;
    const nextDueDate =
      isDelayedByTrial && serverTrialEnds ? formatBrtIsoDate(serverTrialEnds) : undefined;

    let subscription: { id: string; status: string };
    try {
      subscription = await createAsaasCreditCardSubscription({
        customerId: customer.id,
        plan: planKey,
        creditCard: {
          holderName: card.holderName,
          number: card.number,
          expiryMonth: card.expiryMonth,
          expiryYear: card.expiryYear,
          ccv: card.ccv,
        },
        holderInfo: {
          name: customerName,
          email: customerEmail,
          cpfCnpj: cleanCpf,
          postalCode: cleanPostalCode || card.postalCode,
          addressNumber: cleanAddressNumber || card.addressNumber,
          phone: cleanPhone || phone,
        },
        nextDueDate,
        remoteIp: asaasRemoteIp,
        externalReference: intentId,
      });
    } catch (cardErr) {
      await supabase
        .from("billing_intents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", intentId);
      throw cardErr;
    }

    const rawCardNum = String(card.number).replace(/\D/g, "");
    const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

    // Cenário 1: Cartão agendado para o fim dos 30 dias grátis de Trial
    if (isDelayedByTrial && serverTrialEnds) {
      // [B-08] Cancela assinatura anterior somente APÓS aprovação da nova
      if (previousSubscriptionId && previousSubscriptionId !== subscription.id) {
        await ensurePreviousSubscriptionCanceled(previousSubscriptionId);
      }

      const { error: schedUpdateErr } = await supabase
        .from("user_subscriptions")
        .update({
          scheduled_plan_id: planMeta.planId,
          scheduled_first_charge_at: serverTrialEnds.toISOString(),
          payment_method: "credit_card",
          card_last4: cardLast4,
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (schedUpdateErr) {
        await ensurePreviousSubscriptionCanceled(subscription.id);
        console.error("[asaas-checkout] Falha ao salvar agendamento de cartão no trial:", schedUpdateErr);
        return safeErrorResponse(req, 500, "Falha ao registrar agendamento do cartão na assinatura.");
      }

      await supabase
        .from("billing_intents")
        .update({
          status: "pending",
          provider_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", intentId);

      // [A-03 / D-07] Usa planMeta.name e formatBrtDisplayDate
      try {
        const appUrl = Deno.env?.get?.("PUBLIC_APP_URL") || "https://axir.com.br";
        const emailContent = renderTrialCardScheduledEmail({
          name: customerName,
          cardLast4,
          firstChargeDateFormatted: formatBrtDisplayDate(serverTrialEnds),
          planName: planMeta.name,
          planValueFormatted: `R$ ${planMeta.value.toFixed(2).replace(".", ",")}`,
          appUrl,
        });

        await sendTransactionalEmail(supabase, {
          to: customerEmail,
          subject: emailContent.subject,
          template: "trial_card_scheduled",
          html: emailContent.html,
          text: emailContent.text,
          userId: user.id,
          idempotencyKey: `trial_card_scheduled_${user.id}_${subscription.id}`,
        });
      } catch (emailErr) {
        console.warn("[asaas-checkout] Aviso ao disparar e-mail de cartão agendado:", sanitizePaymentLog(emailErr));
      }

      return jsonResponse(req, {
        ok: true,
        method: "credit_card",
        phase: "trial_scheduled",
        subscriptionId: subscription.id,
        firstChargeAt: serverTrialEnds.toISOString(),
        email: customerEmail,
        cardLast4,
      });
    }

    // Cenário 2: Cobrança imediata ([B-05] nunca assume pagamento confirmado via subscription.status)
    let firstPaymentId: string | undefined;
    let isFirstPaymentConfirmed = false;

    try {
      const payments = await getAsaasSubscriptionPayments(subscription.id);
      if (payments && payments.length > 0) {
        firstPaymentId = payments[0]!.id;
        const pStatus = (payments[0]!.status || "").toUpperCase();
        if (CONFIRMED_PAYMENT_STATUSES.has(pStatus)) {
          isFirstPaymentConfirmed = true;
        }
      }
    } catch (pollErr) {
      console.warn("[asaas-checkout] Aviso ao consultar primeira fatura da assinatura:", sanitizePaymentLog(pollErr));
    }

    // [B-08] Cancela assinatura anterior somente APÓS sucesso da criação da nova
    if (previousSubscriptionId && previousSubscriptionId !== subscription.id) {
      await ensurePreviousSubscriptionCanceled(previousSubscriptionId);
    }

    const nowIso = now.toISOString();

    if (isFirstPaymentConfirmed) {
      const currentPeriodBase =
        userSub.current_period_end && new Date(userSub.current_period_end) > now
          ? new Date(userSub.current_period_end)
          : now;
      const periodEnd = addCivilMonthsServer(currentPeriodBase, planKey === "annual" ? 12 : 1);
      const isReactivation =
        userSub.status === "canceled" ||
        userSub.status === "read_only_expired" ||
        userSub.tier === "read_only";

      const { error: atomicErr } = await supabase.rpc("activate_subscription_from_payment", {
        p_user_id: user.id,
        p_subscription_row_id: userSub.id,
        p_provider_payment_id: firstPaymentId ?? null,
        p_kind: "subscription_first_charge",
        p_amount_cents: planMeta.valueCents,
        p_target_tier: planMeta.planId,
        p_current_period_end: periodEnd.toISOString(),
        p_asaas_customer_id: customer.id,
        p_asaas_subscription_id: subscription.id,
        p_clear_asaas_subscription: false,
        p_asaas_sync_status: "synced",
        p_set_billing_start_at: isReactivation || !userSub.billing_start_at,
        p_billing_start_at: nowIso,
        p_trial_consumed_at: userSub.trial_consumed_at || nowIso,
        p_payment_method: "credit_card",
        p_card_last4: cardLast4,
        p_intent_id: intentId,
        p_metadata: { subscription_id: subscription.id, tier: planMeta.planId },
      });

      if (atomicErr) {
        console.error("[asaas-checkout] Falha atômica ao ativar assinatura:", atomicErr);
        return safeErrorResponse(req, 500, "Falha ao registrar confirmação e ativar assinatura.");
      }
    } else {
      // [B-05] Pagamento ainda não confirmado: NÃO altera current_period_end nem consome período
      const nextStatus = userSub.status === "active" ? "active" : "incomplete";
      const { error: incUpdateErr } = await supabase
        .from("user_subscriptions")
        .update({
          status: nextStatus,
          payment_method: "credit_card",
          card_last4: cardLast4,
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscription.id,
          updated_at: nowIso,
          ...(firstPaymentId ? { asaas_payment_id: firstPaymentId } : {}),
        })
        .eq("user_id", user.id);

      if (incUpdateErr) {
        console.error("[asaas-checkout] Falha ao gravar status pendente em user_subscriptions:", incUpdateErr);
        return safeErrorResponse(req, 500, "Falha ao registrar assinatura pendente.");
      }

      await supabase
        .from("billing_intents")
        .update({
          status: "pending",
          provider_subscription_id: subscription.id,
          provider_payment_id: firstPaymentId ?? null,
          updated_at: nowIso,
        })
        .eq("id", intentId);
    }

    return jsonResponse(req, {
      ok: true,
      method: "credit_card",
      subscriptionId: subscription.id,
      tier: planMeta.planId,
      status: isFirstPaymentConfirmed ? "active" : "incomplete",
      email: customerEmail,
      cardLast4,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const sanitizedMsg = sanitizePaymentLog(rawMsg);
    console.error("[asaas-checkout] Falha ao processar pagamento:", sanitizedMsg);

    const friendlyError = mapAsaasCardErrorMessage(rawMsg);
    if (friendlyError) {
      return jsonResponse(req, { error: friendlyError }, 400);
    }

    return safeErrorResponse(req, 500, "Falha ao processar pagamento. Tente novamente.");
  }
});
