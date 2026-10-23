import { createClient } from "jsr:@supabase/supabase-js@2";
import { resolveTierFromPayment } from "../_shared/asaas-plans.ts";
import { timingSafeEqualString } from "../_shared/http.ts";

/** Webhook é server-to-server — sem CORS de browser. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token") ?? "";

    if (!expectedToken || !(await timingSafeEqualString(receivedToken, expectedToken))) {
      return json({ error: "Não autorizado" }, 403);
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

    let subQuery = supabase
      .from("user_subscriptions")
      .select("id, user_id, tier, plan_id, status");
    if (subscriptionId) {
      subQuery = subQuery.eq("asaas_subscription_id", subscriptionId);
    } else if (paymentId) {
      subQuery = subQuery.eq("asaas_payment_id", paymentId);
    } else if (customerId) {
      subQuery = subQuery.eq("asaas_customer_id", customerId);
    }

    const { data: userSub } = await subQuery.maybeSingle();

    if (!userSub) {
      return json({ received: true, unlinked: true });
    }

    const now = new Date();

    if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(eventType)) {
      const targetTier = resolveTierFromPayment(payment);
      if (!targetTier) {
        console.error("[asaas-webhook] pagamento com valor/tipo fora do catálogo", {
          paymentId,
          value: payment.value,
          billingType: payment.billingType,
        });
        return json({ received: true, ignored: true, reason: "unknown_plan" });
      }

      const nextPeriod = new Date(now);
      if (targetTier === "pro_annual") {
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

    if (["PAYMENT_OVERDUE"].includes(eventType)) {
      await supabase
        .from("user_subscriptions")
        .update({ status: "past_due" })
        .eq("id", userSub.id);
    }

    if (["SUBSCRIPTION_DELETED", "PAYMENT_DELETED"].includes(eventType)) {
      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", userSub.id);
    }

    return json({ received: true, event: eventType });
  } catch (err: unknown) {
    console.error("[asaas-webhook] falha interna", err instanceof Error ? err.message : err);
    return json({ error: "Falha ao processar webhook" }, 500);
  }
});
