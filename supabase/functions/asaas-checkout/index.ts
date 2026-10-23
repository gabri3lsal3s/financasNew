import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  findOrCreateAsaasCustomer,
  createAsaasCreditCardSubscription,
  createAsaasPixCharge,
  getAsaasPixQrCode,
} from "../_shared/asaas.ts";
import { ASAAS_PLAN_CATALOG } from "../_shared/asaas-plans.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

const CONFIRMED_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "CONFIRMED"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Sessão não informada" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Serviço de pagamento indisponível.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fail-closed: nunca usar service_role como chave do cliente de usuário.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(req, { error: "Sessão inválida ou expirada" }, 401);
    }

    const payload = await req.json();
    const { plan, method, cpf, card, phone } = payload;

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return jsonResponse(req, { error: "Plano inválido (mensal ou anual)" }, 400);
    }

    if (!method || !["credit_card", "pix"].includes(method)) {
      return jsonResponse(req, { error: "Método de pagamento inválido" }, 400);
    }

    const cleanCpf = (cpf || "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return jsonResponse(req, { error: "CPF deve conter exatamente 11 dígitos" }, 400);
    }

    await supabase.from("profiles").update({ cpf: cleanCpf }).eq("id", user.id);

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

      const payment = await createAsaasPixCharge({
        customerId: customer.id,
        value: planMeta.value,
        description: "Plano Pro Anual (1 Ano) - Guia Financeiro",
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
      });
    }

    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return jsonResponse(req, { error: "Dados do cartão de crédito incompletos" }, 400);
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

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
      remoteIp: clientIp,
    });

    const statusUpper = (subscription.status || "").toUpperCase();
    const confirmed = CONFIRMED_SUBSCRIPTION_STATUSES.has(statusUpper);

    const now = new Date();
    const periodEnd = new Date(now);
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
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
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
    });
  } catch (err: unknown) {
    return safeErrorResponse(req, 500, "Falha ao processar pagamento. Tente novamente.", err);
  }
});
