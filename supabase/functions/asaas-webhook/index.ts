import { createClient } from "jsr:@supabase/supabase-js@2";
import { decideWebhookAction } from "../_shared/asaas-webhook-logic.ts";
import { timingSafeEqualString } from "../_shared/http.ts";
import { buildTelegramSaleMessage, sendTelegramNotification } from "../_shared/telegram.ts";

declare const Deno: {
  env?: {
    get(key: string): string | undefined;
  };
} | undefined;

/** Webhook é server-to-server — sem CORS de browser. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const expectedToken = Deno?.env?.get?.("ASAAS_WEBHOOK_TOKEN");
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

    const supabaseUrl = Deno?.env?.get ? Deno.env.get("SUPABASE_URL") : undefined;
    const supabaseServiceKey = Deno?.env?.get ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[asaas-webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes");
      return json({ error: "Serviço indisponível" }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let subQuery = supabase
      .from("user_subscriptions")
      .select(
        "id, user_id, tier, plan_id, status, asaas_payment_id, asaas_subscription_id, current_period_end, cancel_at_period_end",
      );
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


    // Gravar log de auditoria do evento no banco
    try {
      await supabase.from("billing_webhook_logs").insert({
        provider: "asaas",
        event_type: eventType,
        payment_id: paymentId,
        subscription_id: subscriptionId,
        customer_id: customerId,
        payload: event,
      });
    } catch (logErr) {
      console.error("[asaas-webhook] Erro ao gravar log de auditoria", logErr);
    }

    const decision = decideWebhookAction({
      eventType,
      payment,
      currentSub: userSub,
    });

    if (decision.action === "ignore_duplicate") {
      return json({
        received: true,
        duplicate: true,
        ignored: true,
        reason: decision.reason,
        event: eventType,
      });
    }

    if (decision.action === "ignore_unknown_plan") {
      console.error("[asaas-webhook] pagamento com valor/tipo fora do catálogo", {
        paymentId,
        value: payment.value,
        billingType: payment.billingType,
      });
      return json({ received: true, ignored: true, reason: "unknown_plan" });
    }

    if (decision.action === "activate") {
      await supabase
        .from("user_subscriptions")
        .update({
          tier: decision.targetTier,
          plan_id: decision.targetTier,
          status: "active",
          current_period_end: decision.currentPeriodEnd,
          cancel_at_period_end: false,
          asaas_payment_id: paymentId,
          asaas_customer_id: customerId,
          ...(subscriptionId ? { asaas_subscription_id: subscriptionId } : {}),
        })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "activated",
        payload: {
          gateway: "asaas",
          event: eventType,
          tier: decision.targetTier,
          payment_id: paymentId,
          subscription_id: subscriptionId,
        },
      });

      // Disparar notificação de venda via Telegram se configurado
      try {
        const botToken = Deno?.env?.get ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
        const chatId = Deno?.env?.get ? Deno.env.get("TELEGRAM_CHAT_ID") : undefined;
        if (botToken && chatId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", userSub.user_id)
            .maybeSingle();

          const msg = buildTelegramSaleMessage({
            plan: decision.targetTier,
            amount: payment.value || 0,
            paymentMethod: payment.billingType === "PIX" ? "pix" : "credit_card",
            userName: profile?.full_name,
            userEmail: profile?.email,
            paymentId: paymentId,
          });
          await sendTelegramNotification({ botToken, chatId, text: msg });
        }
      } catch (tgErr) {
        console.error("[asaas-webhook] Erro ao notificar Telegram", tgErr);
      }

      return json({ received: true, event: eventType, tier: decision.targetTier, status: "active" });
    }

    if (decision.action === "mark_past_due") {
      await supabase
        .from("user_subscriptions")
        .update({ status: "past_due" })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "marked_past_due",
        payload: { gateway: "asaas", event: eventType, payment_id: paymentId },
      });

      return json({ received: true, event: eventType, status: "past_due" });
    }

    if (decision.action === "mark_cancelled") {
      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "cancelled",
        payload: {
          gateway: "asaas",
          event: eventType,
          payment_id: paymentId,
          subscription_id: subscriptionId,
        },
      });

      return json({ received: true, event: eventType, cancel_at_period_end: true });
    }

    if (decision.action === "mark_refunded") {
      await supabase
        .from("user_subscriptions")
        .update({
          tier: "read_only",
          status: "canceled",
          cancel_at_period_end: false,
          current_period_end: new Date().toISOString(),
        })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "refunded",
        payload: { gateway: "asaas", event: eventType, payment_id: paymentId },
      });

      return json({ received: true, event: eventType, tier: "read_only", status: "canceled" });
    }

    return json({ received: true, event: eventType, ignored: true, reason: "unsupported_event" });
  } catch (err: unknown) {
    console.error("[asaas-webhook] falha interna", err instanceof Error ? err.message : err);
    return json({ error: "Falha ao processar webhook" }, 500);
  }
});
