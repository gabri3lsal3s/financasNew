import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  findOrCreateAsaasCustomer,
  createAsaasCreditCardSubscription,
  createAsaasPixCharge,
  getAsaasPixQrCode,
  getAsaasPayment,
  shouldReusePendingPixCharge,
  isValidCPF,
} from "../_shared/asaas.ts";
import { ASAAS_PLAN_CATALOG } from "../_shared/asaas-plans.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Serviço de pagamento indisponível.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();
    const { plan, method, cpf, card, phone, registration, firstBillingDate } = payload;

    let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    let isRegistration = false;

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

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return jsonResponse(req, { error: "Plano inválido (mensal ou anual)" }, 400);
    }

    if (!method || !["credit_card", "pix"].includes(method)) {
      return jsonResponse(req, { error: "Método de pagamento inválido" }, 400);
    }

    const cleanCpf = (cpf || "").replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) {
      return jsonResponse(req, { error: "CPF inválido. Verifique os dígitos informados." }, 400);
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ cpf: cleanCpf })
      .eq("id", user.id);

    if (profileUpdateError) {
      console.error("[asaas-checkout] Falha ao atualizar CPF do perfil:", profileUpdateError.message);
      return jsonResponse(req, { error: "Falha ao salvar dados cadastrais. Tente novamente." }, 400);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", user.id)
      .single();

    const customerName =
      profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    const customerEmail = profile?.email || user.email || "";

    const customer = await findOrCreateAsaasCustomer({
      name: customerName,
      email: customerEmail,
      cpfCnpj: cleanCpf,
      phone,
    });

    const planKey = plan === "annual" ? "annual" : "monthly";
    const planMeta = ASAAS_PLAN_CATALOG[planKey];

    if (method === "pix") {
      if (plan !== "annual") {
        return jsonResponse(
          req,
          { error: "Pagamento via PIX está disponível exclusivamente para o Plano Anual." },
          400,
        );
      }

      // 1. Tenta reaproveitar cobrança Pix existente pendente há menos de 1 hora
      const { data: userSub } = await supabase
        .from("user_subscriptions")
        .select("asaas_payment_id, status, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (userSub?.asaas_payment_id && userSub.status !== "active") {
        try {
          const existingPayment = await getAsaasPayment(userSub.asaas_payment_id);
          const createdAtMillis = existingPayment.dateCreated
            ? new Date(existingPayment.dateCreated).getTime()
            : userSub.updated_at
              ? new Date(userSub.updated_at).getTime()
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
          console.warn("[asaas-checkout] Falha ao verificar cobrança Pix pendente prévia, criando nova:", err);
        }
      }

      // 2. Cria nova cobrança Pix caso não haja cobrança pendente recente reaproveitável
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
        })
        .eq("user_id", user.id);

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

    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return jsonResponse(req, { error: "Dados do cartão de crédito incompletos" }, 400);
    }

    if (!isValidLuhn(card.number)) {
      return jsonResponse(req, { error: "Número do cartão de crédito inválido" }, 400);
    }

    if (!isValidCardExpiry(card.expiryMonth, card.expiryYear)) {
      return jsonResponse(
        req,
        { error: "Cartão de crédito com data de validade vencida ou incorreta" },
        400,
      );
    }

    const cleanCcv = (card.ccv || "").replace(/\D/g, "");
    if (cleanCcv.length < 3 || cleanCcv.length > 4) {
      return jsonResponse(req, { error: "Código de segurança (CVV) inválido" }, 400);
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const now = new Date();
    const firstChargeDate = firstBillingDate ? new Date(firstBillingDate) : now;
    const isFutureBilling = !isNaN(firstChargeDate.getTime()) && firstChargeDate > now;
    const baseDate = isFutureBilling ? firstChargeDate : now;

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
        postalCode: card.postalCode,
        addressNumber: card.addressNumber,
        phone,
      },
      nextDueDate: isFutureBilling ? baseDate.toISOString().slice(0, 10) : undefined,
      remoteIp: clientIp,
    });

    const statusUpper = (subscription.status || "").toUpperCase();
    const confirmed = CONFIRMED_SUBSCRIPTION_STATUSES.has(statusUpper);

    const periodEnd = new Date(baseDate);
    if (planKey === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await supabase
      .from("user_subscriptions")
      .update({
        tier: planMeta.planId,
        plan_id: planMeta.planId,
        status: confirmed ? "active" : "incomplete",
        starts_at: now.toISOString(),
        trial_ends_at: isFutureBilling ? baseDate.toISOString() : null,
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
      })
      .eq("user_id", user.id);

    const rawCardNum = String(card.number).replace(/\D/g, "");
    const cardLast4 = rawCardNum.length >= 4 ? rawCardNum.slice(-4) : "••••";

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
