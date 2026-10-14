import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  findOrCreateAsaasCustomer,
  createAsaasCreditCardSubscription,
  createAsaasPixCharge,
  getAsaasPixQrCode,
} from "../_shared/asaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Sessão não informada" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Valida o token JWT do usuário
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Sessão inválida ou expirada" }, 401);
    }

    const payload = await req.json();
    const { plan, method, cpf, card, phone } = payload;

    if (!plan || !["monthly", "annual"].includes(plan)) {
      return json({ error: "Plano inválido (mensal ou anual)" }, 400);
    }

    if (!method || !["credit_card", "pix"].includes(method)) {
      return json({ error: "Método de pagamento inválido" }, 400);
    }

    const cleanCpf = (cpf || "").replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return json({ error: "CPF deve conter exatamente 11 dígitos" }, 400);
    }

    // 2. Salva o CPF no perfil do usuário
    await supabase
      .from("profiles")
      .update({ cpf: cleanCpf })
      .eq("id", user.id);

    // Obtém dados atuais do perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", user.id)
      .single();

    const customerName = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Cliente";
    const customerEmail = profile?.email || user.email || "";

    // 3. Localiza ou cria cliente no Asaas
    const customer = await findOrCreateAsaasCustomer({
      name: customerName,
      email: customerEmail,
      cpfCnpj: cleanCpf,
      phone,
    });

    // 4. Fluxo PIX (Restrito ao Plano Anual conforme decisão de negócio)
    if (method === "pix") {
      if (plan !== "annual") {
        return json({ error: "Pagamento via PIX está disponível exclusivamente para o Plano Anual." }, 400);
      }

      const payment = await createAsaasPixCharge({
        customerId: customer.id,
        value: 178.8,
        description: "Plano Pro Anual (1 Ano) - Guia Financeiro",
      });

      const qrCode = await getAsaasPixQrCode(payment.id);

      // Registra o ID de pagamento pendente na assinatura
      await supabase
        .from("user_subscriptions")
        .update({
          asaas_customer_id: customer.id,
          asaas_payment_id: payment.id,
        })
        .eq("user_id", user.id);

      return json({
        ok: true,
        method: "pix",
        paymentId: payment.id,
        qrCodeBase64: qrCode.encodedImage,
        copyPasteKey: qrCode.payload,
        expirationDate: qrCode.expirationDate,
      });
    }

    // 5. Fluxo Cartão de Crédito (Recorrência Mensal ou Anual)
    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      return json({ error: "Dados do cartão de crédito incompletos" }, 400);
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

    const subscription = await createAsaasCreditCardSubscription({
      customerId: customer.id,
      plan,
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

    // Calcula período de vigência
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan === "annual") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const targetTier = plan === "annual" ? "pro_annual" : "pro_monthly";

    // Ativa imediatamente a assinatura Pro
    await supabase
      .from("user_subscriptions")
      .update({
        tier: targetTier,
        plan_id: targetTier,
        status: "active",
        starts_at: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
      })
      .eq("user_id", user.id);

    return json({
      ok: true,
      method: "credit_card",
      subscriptionId: subscription.id,
      tier: targetTier,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno no checkout";
    return json({ error: message }, 500);
  }
});
