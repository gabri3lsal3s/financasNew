import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    // 1. Validação de token de autenticidade do webhook do Asaas
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");

    if (!expectedToken || receivedToken !== expectedToken) {
      return json({ error: "Token de webhook inválido ou não configurado" }, 403);
    }

    const event = await req.json();
    const eventType: string = event?.event;
    const payment = event?.payment;

    if (!eventType || !payment) {
      return json({ received: true, ignored: true });
    }

    const customerId: string = payment.customer;
    const paymentId: string = payment.id;
    const subscriptionId: string | null = payment.subscription || null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Localiza a assinatura do usuário no Supabase
    // Pode casar por asaas_subscription_id, asaas_payment_id ou asaas_customer_id
    let subQuery = supabase.from("user_subscriptions").select("*");
    if (subscriptionId) {
      subQuery = subQuery.eq("asaas_subscription_id", subscriptionId);
    } else if (paymentId) {
      subQuery = subQuery.eq("asaas_payment_id", paymentId);
    } else if (customerId) {
      subQuery = subQuery.eq("asaas_customer_id", customerId);
    }

    const { data: userSub } = await subQuery.maybeSingle();

    if (!userSub) {
      // Cliente não encontrado no banco (pode ser cobrança externa/avulsa)
      return json({ received: true, unlinked: true });
    }

    const now = new Date();

    // 3. Processa eventos de confirmação de pagamento (Cartão ou PIX)
    if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(eventType)) {
      const isAnnual = payment.billingType === "PIX" || payment.value > 50 || userSub.tier === "pro_annual";
      const targetTier = isAnnual ? "pro_annual" : "pro_monthly";

      const nextPeriod = new Date(now);
      if (isAnnual) {
        nextPeriod.setFullYear(nextPeriod.getFullYear() + 1);
      } else {
        nextPeriod.setMonth(nextPeriod.getMonth() + 1);
      }

      await supabase
        .from("user_subscriptions")
        .update({
          tier: targetTier,
          plan_id: targetTier,
          status: "active",
          current_period_end: nextPeriod.toISOString(),
          cancel_at_period_end: false,
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId,
        })
        .eq("id", userSub.id);
    }

    // 4. Processa inadimplência / atraso
    if (["PAYMENT_OVERDUE"].includes(eventType)) {
      await supabase
        .from("user_subscriptions")
        .update({
          status: "past_due",
        })
        .eq("id", userSub.id);
    }

    // 5. Processa cancelamento
    if (["SUBSCRIPTION_DELETED", "PAYMENT_DELETED"].includes(eventType)) {
      await supabase
        .from("user_subscriptions")
        .update({
          cancel_at_period_end: true,
        })
        .eq("id", userSub.id);
    }

    return json({ received: true, event: eventType });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno no webhook";
    return json({ error: message }, 500);
  }
});
