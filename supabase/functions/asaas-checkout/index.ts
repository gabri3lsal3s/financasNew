import { createClient } from "jsr:@supabase/supabase-js@2";
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
} from "../_shared/asaas.ts";
import {
  ASAAS_PLAN_CATALOG,
  calculateCumulativePriceServer,
  addCivilMonthsServer,
} from "../_shared/asaas-plans.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import { renderTrialCardScheduledEmail } from "../_shared/email-templates.ts";

declare const Deno: {
  env?: {
    get(key: string): string | undefined;
  };
  serve?: (handler: (req: Request) => Promise<Response> | Response) => void;
} | undefined;

const CONFIRMED_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "CONFIRMED"]);

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
    // O checkout exige sessão ativa previamente confirmada por e-mail.
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

    // 2. Busca perfil e dados da assinatura atual
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, cpf, phone, postal_code, address_number")
      .eq("id", user.id)
      .single();

    const cleanCpf = (cpf || profile?.cpf || "").replace(/\D/g, "");
    if (!cleanCpf || !isValidCPF(cleanCpf)) {
      return jsonResponse(req, { error: "CPF inválido ou não informado. Verifique o número digitado." }, 400);
    }

    const cleanPhone = (phone || card?.phone || profile?.phone || "").replace(/\D/g, "");
    const cleanPostalCode = (postalCode || card?.postalCode || profile?.postal_code || "").replace(/\D/g, "");
    const cleanAddressNumber = String(addressNumber || card?.addressNumber || profile?.address_number || "").trim();

    // Atualiza dados cadastrais em profiles caso tenham sido informados
    const profileUpdates: Record<string, string> = {};
    if (cleanCpf && cleanCpf !== profile?.cpf) profileUpdates.cpf = cleanCpf;
    if (cleanPhone && cleanPhone !== profile?.phone) profileUpdates.phone = cleanPhone;
    if (cleanPostalCode && cleanPostalCode !== profile?.postal_code) profileUpdates.postal_code = cleanPostalCode;
    if (cleanAddressNumber && cleanAddressNumber !== profile?.address_number) profileUpdates.address_number = cleanAddressNumber;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
    }

    const customerName = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    const customerEmail = profile?.email || user.email || "";

    let { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const customer = await findOrCreateAsaasCustomer({
      existingCustomerId: userSub?.asaas_customer_id,
      name: customerName,
      email: customerEmail,
      cpfCnpj: cleanCpf,
      phone: cleanPhone || undefined,
    });

    // Salva o asaas_customer_id na assinatura se ainda não estiver salvo
    if (userSub && userSub.asaas_customer_id !== customer.id) {
      await supabase
        .from("user_subscriptions")
        .update({ asaas_customer_id: customer.id })
        .eq("id", userSub.id);
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

      // Validação de teto máximo: não permite acumular além de 11 meses no futuro (F-13)
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

      // Reutiliza cobrança Pix recente (< 1 hora) se já existir uma intenção pendente idêntica
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
          console.warn("[asaas-checkout] Falha ao consultar cobrança acumulativa anterior:", reuseErr);
        }
      }

      // Cria a intenção de cobrança no banco (billing_intents)
      const { data: intent, error: intentErr } = await supabase
        .from("billing_intents")
        .insert({
          user_id: user.id,
          kind: "cumulative_renewal",
          plan_id: "pro_monthly",
          months_count: monthsCount,
          amount_cents: pricing.totalCents,
          method: "pix",
          status: "pending",
          provider: "asaas",
          metadata: {
            months: monthsCount,
            discount_percentage: pricing.discountPercentage,
            monthly_equivalent_cents: pricing.monthlyEquivalentCents,
            previous_period_end: userSub.current_period_end,
          },
        })
        .select("id")
        .single();

      if (intentErr || !intent) {
        console.error("[asaas-checkout] Falha ao criar billing_intent:", intentErr);
        return safeErrorResponse(req, 500, "Falha ao registrar intenção de cobrança.");
      }

      const payment = await createAsaasPixCharge({
        customerId: customer.id,
        value: pricing.totalReais,
        description: `Axir Pro — Antecipação de ${monthsCount} meses (${pricing.discountPercentage}% OFF)`,
        externalReference: intent.id,
      });

      const qrCode = await getAsaasPixQrCode(payment.id);

      await supabase
        .from("billing_intents")
        .update({
          provider_payment_id: payment.id,
          external_reference: intent.id,
        })
        .eq("id", intent.id);

      return jsonResponse(req, {
        ok: true,
        method: "pix",
        kind: "cumulative_months",
        intentId: intent.id,
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

    // Garante que o registro de user_subscriptions exista
    if (!userSub) {
      const defaultTrialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { data: upsertedSub } = await supabase
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
          },
          { onConflict: "user_id" },
        )
        .select()
        .maybeSingle();

      if (upsertedSub) {
        userSub = upsertedSub;
      }
    }

    // Autoridade do Servidor sobre Trial e Primeira Cobrança:
    // O período de teste é único por usuário. Usuários com histórico de cobrança,
    // com status cancelado/read_only_expired/past_due, ou cujo trial expirou
    // são cobrados imediatamente no ato.
    const hasAlreadyConsumedTrial = Boolean(
      userSub?.trial_consumed_at ||
      userSub?.billing_start_at ||
      userSub?.tier === "read_only" ||
      userSub?.status === "canceled" ||
      userSub?.status === "read_only_expired" ||
      userSub?.status === "past_due" ||
      (userSub && userSub.tier !== "trial")
    );

    const trialEndsDate = userSub?.trial_ends_at ? new Date(userSub.trial_ends_at) : null;
    const isTrialActive =
      !hasAlreadyConsumedTrial &&
      userSub?.tier === "trial" &&
      userSub?.status === "trialing" &&
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

      // Reaproveitamento de cobrança Pix pendente recente (< 1 hora)
      if (userSub?.asaas_payment_id && userSub.status !== "active") {
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
          console.warn("[asaas-checkout] Falha ao consultar cobrança Pix prévia, gerando nova:", err);
        }
      }

      const isUpgradeFromMonthly =
        userSub?.tier === "pro_monthly" && userSub?.status === "active";

      const { data: intent } = await supabase
        .from("billing_intents")
        .insert({
          user_id: user.id,
          kind: isUpgradeFromMonthly ? "plan_change" : "subscription_start",
          plan_id: planMeta.planId,
          amount_cents: planMeta.valueCents,
          method: "pix",
          status: "pending",
        })
        .select("id")
        .single();

      const payment = await createAsaasPixCharge({
        customerId: customer.id,
        value: planMeta.value,
        description: "Axir — Plano Pro Anual",
        externalReference: intent?.id,
      });

      const qrCode = await getAsaasPixQrCode(payment.id);

      await supabase
        .from("user_subscriptions")
        .update({
          asaas_customer_id: customer.id,
          asaas_payment_id: payment.id,
          trial_consumed_at: userSub?.trial_consumed_at || now.toISOString(),
          scheduled_plan_id: null,
          scheduled_first_charge_at: null,
        })
        .eq("user_id", user.id);

      if (intent?.id) {
        await supabase
          .from("billing_intents")
          .update({
            provider_payment_id: payment.id,
            external_reference: intent.id,
          })
          .eq("id", intent.id);
      }

      return jsonResponse(req, {
        ok: true,
        method: "pix",
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

    // Cancelamento preventivo de assinatura recorrente anterior no Asaas (F-03)
    if (userSub?.asaas_subscription_id) {
      await ensurePreviousSubscriptionCanceled(userSub.asaas_subscription_id);
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const nextDueDate = isDelayedByTrial && serverTrialEnds
      ? serverTrialEnds.toISOString().slice(0, 10)
      : undefined;

    const subscription = await createAsaasCreditCardSubscription({
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
      remoteIp: clientIp,
    });

    const statusUpper = (subscription.status || "").toUpperCase();
    const confirmed = CONFIRMED_SUBSCRIPTION_STATUSES.has(statusUpper);
    const rawCardNum = String(card.number).replace(/\D/g, "");
    const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

    // Cenário 1: Cartão agendado para o fim dos 30 dias grátis de Trial
    if (isDelayedByTrial && serverTrialEnds) {
      await supabase
        .from("user_subscriptions")
        .update({
          scheduled_plan_id: planMeta.planId,
          scheduled_first_charge_at: serverTrialEnds.toISOString(),
          payment_method: "credit_card",
          card_last4: cardLast4,
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscription.id,
        })
        .eq("user_id", user.id);

      // Disparo de e-mail transacional via Resend: Cartão cadastrado no Trial (Renovação Agendada)
      try {
        const appUrl = Deno.env?.get?.("PUBLIC_APP_URL") || "https://axir.com.br";
        const emailContent = renderTrialCardScheduledEmail({
          name: customerName,
          cardLast4,
          firstChargeDateFormatted: serverTrialEnds.toLocaleDateString("pt-BR"),
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
        console.warn("[asaas-checkout] Aviso ao disparar e-mail de cartão agendado:", emailErr);
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

    // Cenário 2: Cobrança imediata
    let firstPaymentId: string | undefined;
    let isFirstPaymentConfirmed = confirmed;

    try {
      const payments = await getAsaasSubscriptionPayments(subscription.id);
      if (payments && payments.length > 0) {
        firstPaymentId = payments[0]!.id;
        const pStatus = (payments[0]!.status || "").toUpperCase();
        if (CONFIRMED_SUBSCRIPTION_STATUSES.has(pStatus) || pStatus === "RECEIVED") {
          isFirstPaymentConfirmed = true;
        }
      }
    } catch {
      // Tolera erro de consulta da primeira fatura
    }

    const currentPeriodBase = userSub?.current_period_end && new Date(userSub.current_period_end) > now
      ? new Date(userSub.current_period_end)
      : now;
    const periodEnd = addCivilMonthsServer(currentPeriodBase, planKey === "annual" ? 12 : 1);

    await supabase
      .from("user_subscriptions")
      .update({
        tier: planMeta.planId,
        plan_id: planMeta.planId,
        status: isFirstPaymentConfirmed ? "active" : "incomplete",
        starts_at: userSub?.starts_at || now.toISOString(),
        billing_start_at: now.toISOString(),
        trial_consumed_at: userSub?.trial_consumed_at || now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        scheduled_plan_id: null,
        scheduled_first_charge_at: null,
        pending_plan_id: null,
        pending_plan_effective_at: null,
        payment_method: "credit_card",
        card_last4: cardLast4,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        ...(firstPaymentId ? { asaas_payment_id: firstPaymentId } : {}),
      })
      .eq("user_id", user.id);

    if (firstPaymentId && isFirstPaymentConfirmed) {
      await supabase.from("billing_processed_payments").upsert(
        {
          provider: "asaas",
          provider_payment_id: firstPaymentId,
          user_id: user.id,
          kind: "subscription_first_charge",
          amount_cents: planMeta.valueCents,
          period_end_applied: periodEnd.toISOString(),
          metadata: { subscription_id: subscription.id, tier: planMeta.planId },
        },
        { onConflict: "provider,provider_payment_id" },
      );
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
    console.error("[asaas-checkout] Falha ao processar pagamento:", sanitizePaymentLog(rawMsg));

    const friendlyError = mapAsaasCardErrorMessage(rawMsg);
    if (friendlyError) {
      return jsonResponse(req, { error: friendlyError }, 400);
    }

    return safeErrorResponse(req, 500, "Falha ao processar pagamento. Tente novamente.", err);
  }
});
