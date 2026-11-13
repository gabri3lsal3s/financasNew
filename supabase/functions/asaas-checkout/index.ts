import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  findOrCreateAsaasCustomer,
  createAsaasCreditCardSubscription,
  createAsaasPixCharge,
  getAsaasPixQrCode,
  getAsaasPayment,
  shouldReusePendingPixCharge,
  isValidCPF,
  isValidLuhn,
  isValidCardExpiry,
  sanitizePaymentLog,
} from "../_shared/asaas.ts";
import {
  ASAAS_PLAN_CATALOG,
  calculateCumulativePriceServer,
  addCivilMonthsServer,
} from "../_shared/asaas-plans.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    const { kind, months, plan, method, cpf, card, phone, registration } = payload;

    let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    let isRegistration = false;

    // 1. Resolução do usuário (Registro novo ou Sessão autenticada)
    if (registration && registration.email && registration.password) {
      isRegistration = true;
      const cleanEmail = String(registration.email).trim().toLowerCase();
      const cleanName = String(registration.name || "").trim();

      const userClient = createClient(supabaseUrl, anonKey);
      const { data: signUpData, error: signUpError } = await userClient.auth.signUp({
        email: cleanEmail,
        password: String(registration.password),
        options: {
          data: {
            name: cleanName,
            app_mode: "investor",
          },
        },
      });

      if (signUpError) {
        return jsonResponse(req, { error: signUpError.message }, 400);
      }

      if (
        signUpData.user &&
        Array.isArray(signUpData.user.identities) &&
        signUpData.user.identities.length === 0
      ) {
        return jsonResponse(
          req,
          { error: "Este endereço de e-mail já está cadastrado. Faça login para continuar." },
          400,
        );
      }

      if (!signUpData.user) {
        return jsonResponse(req, { error: "Não foi possível criar a conta. Tente novamente." }, 400);
      }

      user = signUpData.user;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse(req, { error: "Sessão não informada" }, 401);
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const {
        data: { user: authUser },
        error: authError,
      } = await userClient.auth.getUser();

      if (authError || !authUser) {
        return jsonResponse(req, { error: "Sessão inválida ou expirada" }, 401);
      }

      user = authUser;
    }

    // 2. Busca cadastro do usuário e dados de assinatura atuais
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email, cpf")
      .eq("id", user.id)
      .single();

    const cleanCpf = (cpf || profile?.cpf || "").replace(/\D/g, "");
    if (cleanCpf && isValidCPF(cleanCpf) && cleanCpf !== profile?.cpf) {
      await supabase.from("profiles").update({ cpf: cleanCpf }).eq("id", user.id);
    }

    const customerName =
      profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    const customerEmail = profile?.email || user.email || "";

    const customer = await findOrCreateAsaasCustomer({
      name: customerName,
      email: customerEmail,
      cpfCnpj: cleanCpf || "00000000000",
      phone,
    });

    const { data: userSub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

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
            error: "Limite de 11 meses para antecipação. Para 12 meses, migre para o Plano Anual por R$ 143,88 (40% OFF)!",
            suggestAnnual: true,
          },
          400,
        );
      }

      if (!userSub || userSub.tier !== "pro_monthly" || userSub.status !== "active") {
        return jsonResponse(
          req,
          { error: "A antecipação de mensalidades com desconto é exclusiva para assinantes ativos do Plano Pro Mensal." },
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

      const pricing = calculateCumulativePriceServer(monthsCount);

      // Cria a intenção de cobrança no banco (billing_intents)
      const { data: intent, error: intentErr } = await supabase
        .from("billing_intents")
        .insert({
          user_id: user.id,
          kind: "cumulative_renewal",
          plan_id: "pro_monthly",
          months_count: monthsCount,
          amount_cents: pricing.totalCents,
          method: method === "pix" ? "pix" : "credit_card",
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

      if (method === "pix") {
        const payment = await createAsaasPixCharge({
          customerId: customer.id,
          value: pricing.totalReais,
          description: `Axir Pro — Antecipação de ${monthsCount} meses (${pricing.discountPercentage}% OFF)`,
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

      return jsonResponse(req, { error: "Método de pagamento para antecipação não suportado no momento." }, 400);
    }

    // =========================================================================
    // FLUXO B: CONTRATAÇÃO NORMAL (MENSAL OU ANUAL COM AUTORIDADE DO SERVIDOR)
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

    // Autoridade do Servidor sobre Trial e Primeira Cobrança:
    // O período de teste de 30 dias é estritamente único por usuário/conta.
    // Qualquer usuário em modo somente leitura (read_only), com status cancelado/expirado/past_due,
    // com histórico prévio de cobrança (billing_start_at), com trial já consumido (trial_consumed_at),
    // ou cujo período de teste de 30 dias já se encerrou no tempo NUNCA terá cobrança agendada para 30 dias depois.
    // Para esses usuários, a cobrança no cartão DEVE ser imediata no ato.
    const hasAlreadyConsumedTrial = Boolean(
      userSub?.trial_consumed_at ||
      userSub?.billing_start_at ||
      userSub?.tier === "read_only" ||
      userSub?.status === "canceled" ||
      userSub?.status === "expired" ||
      userSub?.status === "past_due" ||
      (userSub && userSub.tier !== "trial" && !isRegistration)
    );

    const isTrialActive =
      !hasAlreadyConsumedTrial &&
      (isRegistration || userSub?.tier === "trial") &&
      (isRegistration || userSub?.status === "trialing") &&
      Boolean(userSub?.trial_ends_at) &&
      new Date(userSub!.trial_ends_at).getTime() > now.getTime();

    const serverTrialEnds = isTrialActive ? new Date(userSub!.trial_ends_at) : null;
    const isDelayedByTrial = Boolean(serverTrialEnds);

    if (method === "pix") {
      if (plan !== "annual") {
        return jsonResponse(
          req,
          { error: "Pagamento via PIX está disponível exclusivamente para o Plano Anual." },
          400,
        );
      }

      if (isDelayedByTrial) {
        return jsonResponse(
          req,
          { error: "Durante o período de teste gratuito não há valor a pagar hoje. Cadastre seu cartão para agendar a primeira cobrança para o término do teste." },
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

      const payment = await createAsaasPixCharge({
        customerId: customer.id,
        value: planMeta.value,
        description: "Axir — Plano Pro Anual",
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

      await supabase.from("billing_intents").insert({
        user_id: user.id,
        kind: "subscription_start",
        plan_id: planMeta.planId,
        amount_cents: planMeta.valueCents,
        method: "pix",
        status: "pending",
        provider_payment_id: payment.id,
      });

      return jsonResponse(req, {
        ok: true,
        method: "pix",
        paymentId: payment.id,
        qrCodeBase64: qrCode.encodedImage,
        copyPasteKey: qrCode.payload,
        expirationDate: qrCode.expirationDate,
        needsEmailConfirmation: isRegistration,
        email: customerEmail,
      });
    }

    // Validação de Cartão de Crédito
    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return jsonResponse(req, { error: "Dados do cartão de crédito incompletos" }, 400);
    }

    if (!isValidLuhn(card.number)) {
      return jsonResponse(req, { error: "Número do cartão de crédito inválido" }, 400);
    }

    if (!isValidCardExpiry(card.expiryMonth, card.expiryYear)) {
      return jsonResponse(req, { error: "Cartão de crédito com data de validade vencida ou incorreta" }, 400);
    }

    const cleanCcv = (card.ccv || "").replace(/\D/g, "");
    if (cleanCcv.length < 3 || cleanCcv.length > 4) {
      return jsonResponse(req, { error: "Código de segurança (CVV) inválido" }, 400);
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
        cpfCnpj: cleanCpf || "00000000000",
        postalCode: card.postalCode,
        addressNumber: card.addressNumber,
        phone,
      },
      nextDueDate,
      remoteIp: clientIp,
    });

    const statusUpper = (subscription.status || "").toUpperCase();
    const confirmed = CONFIRMED_SUBSCRIPTION_STATUSES.has(statusUpper);
    const rawCardNum = String(card.number).replace(/\D/g, "");
    const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

    if (isDelayedByTrial && serverTrialEnds) {
      // Mantém tier = 'trial' e status = 'trialing', registrando a cobrança agendada
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

      return jsonResponse(req, {
        ok: true,
        method: "credit_card",
        phase: "trial_scheduled",
        subscriptionId: subscription.id,
        firstChargeAt: serverTrialEnds.toISOString(),
        needsEmailConfirmation: isRegistration,
        email: customerEmail,
        cardLast4,
      });
    }

    // Cobrança imediata
    const periodEnd = addCivilMonthsServer(now, planKey === "annual" ? 12 : 1);

    await supabase
      .from("user_subscriptions")
      .update({
        tier: planMeta.planId,
        plan_id: planMeta.planId,
        status: confirmed ? "active" : "incomplete",
        starts_at: userSub?.starts_at || now.toISOString(),
        billing_start_at: now.toISOString(),
        trial_consumed_at: userSub?.trial_consumed_at || now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        scheduled_plan_id: null,
        scheduled_first_charge_at: null,
        payment_method: "credit_card",
        card_last4: cardLast4,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
      })
      .eq("user_id", user.id);

    return jsonResponse(req, {
      ok: true,
      method: "credit_card",
      subscriptionId: subscription.id,
      tier: planMeta.planId,
      status: confirmed ? "active" : "incomplete",
      needsEmailConfirmation: isRegistration,
      email: customerEmail,
      cardLast4,
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error("[asaas-checkout] Falha ao processar pagamento:", sanitizePaymentLog(rawMsg));
    return safeErrorResponse(req, 500, "Falha ao processar pagamento. Tente novamente.", err);
  }
});
