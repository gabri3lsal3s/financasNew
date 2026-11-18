import { createClient } from "jsr:@supabase/supabase-js@2";
import { decideWebhookAction } from "../_shared/asaas-webhook-logic.ts";
import { timingSafeEqualString } from "../_shared/http.ts";
import { buildTelegramSaleMessage, sendTelegramNotification } from "../_shared/telegram.ts";
import {
  postponeAsaasSubscriptionAfterPrepayment,
  ensurePreviousSubscriptionCanceled,
} from "../_shared/asaas.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import {
  renderProActivationEmail,
  renderPaymentFailedEmail,
} from "../_shared/email-templates.ts";

declare const Deno: {
  env?: {
    get(key: string): string | undefined;
  };
  serve?: (handler: (req: Request) => Promise<Response> | Response) => void;
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
    const eventId: string | undefined = event?.id;
    const payment = event?.payment;

    if (!eventType || !payment) {
      return json({ received: true, ignored: true });
    }

    const customerId: string = payment.customer;
    const paymentId: string = payment.id;
    const subscriptionId: string | null = payment.subscription || null;
    const externalReference: string | null = payment.externalReference || null;

    const supabaseUrl = Deno?.env?.get ? Deno.env.get("SUPABASE_URL") : undefined;
    const supabaseServiceKey = Deno?.env?.get ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[asaas-webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes");
      return json({ error: "Serviço indisponível" }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca da intenção de cobrança vinculada (se houver)
    let intentQuery = supabase
      .from("billing_intents")
      .select("id, user_id, kind, plan_id, months_count, amount_cents, status, metadata");
    if (paymentId) {
      intentQuery = intentQuery.eq("provider_payment_id", paymentId);
    } else if (externalReference) {
      intentQuery = intentQuery.eq("external_reference", externalReference);
    }

    const { data: intent } = await intentQuery.maybeSingle();

    // 2. Busca da assinatura do usuário
    let subQuery = supabase
      .from("user_subscriptions")
      .select(
        "id, user_id, tier, plan_id, status, asaas_payment_id, asaas_subscription_id, current_period_end, trial_ends_at, cancel_at_period_end, billing_start_at, trial_consumed_at",
      );

    if (intent?.user_id) {
      subQuery = subQuery.eq("user_id", intent.user_id);
    } else if (subscriptionId) {
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

    // 3. Log de auditoria desduplicado por provider_event_id
    try {
      await supabase.from("billing_webhook_logs").insert({
        provider: "asaas",
        provider_event_id: eventId || `${eventType}_${paymentId}_${Date.now()}`,
        event_type: eventType,
        payment_id: paymentId,
        subscription_id: subscriptionId,
        customer_id: customerId,
        payload: event,
      });
    } catch (logErr) {
      console.warn("[asaas-webhook] Log de auditoria já gravado ou erro de dedup:", logErr);
    }

    // Checagem prévia se este payment já foi liquidado no billing_processed_payments
    let isPaymentAlreadyProcessed = false;
    if (paymentId) {
      const { data: processed } = await supabase
        .from("billing_processed_payments")
        .select("id")
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (processed) {
        isPaymentAlreadyProcessed = true;
      }
    }

    const decision = decideWebhookAction({
      eventType,
      payment,
      currentSub: userSub,
      intent,
      isPaymentAlreadyProcessed,
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

    // =========================================================================
    // CASO A: APLICAR RENOVAÇÃO ACUMULATIVA (2 A 11 MESES VIA PIX)
    // =========================================================================
    if (decision.action === "apply_cumulative_renewal") {
      const { data: updatedIntent } = await supabase
        .from("billing_intents")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
          metadata: {
            ...(intent?.metadata || {}),
            applied_new_period_end: decision.newPeriodEnd,
          },
        })
        .eq("id", decision.intentId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (!updatedIntent) {
        return json({ received: true, duplicate: true, reason: "concurrency_handled" });
      }

      // Registra liquidação idempotente em billing_processed_payments
      await supabase.from("billing_processed_payments").upsert(
        {
          provider: "asaas",
          provider_payment_id: paymentId,
          user_id: userSub.user_id,
          kind: "cumulative_renewal",
          amount_cents: Math.round((payment.value || 0) * 100),
          period_end_applied: decision.newPeriodEnd,
          metadata: {
            months: decision.monthsCount,
            event_type: eventType,
            subscription_id: subscriptionId,
          },
        },
        { onConflict: "provider,provider_payment_id" },
      );

      let asaasSyncSuccess = false;

      // Adia o vencimento da assinatura recorrente e remove as cobranças PENDING intermediárias
      if (userSub.asaas_subscription_id) {
        try {
          const postponeRes = await postponeAsaasSubscriptionAfterPrepayment(
            userSub.asaas_subscription_id,
            decision.newPeriodEnd,
          );
          asaasSyncSuccess = postponeRes.success;
        } catch (subErr) {
          console.error("[asaas-webhook] Falha ao adiar assinatura recorrente após antecipação Pix:", subErr);
        }
      }

      await supabase
        .from("user_subscriptions")
        .update({
          current_period_end: decision.newPeriodEnd,
          asaas_sync_status: asaasSyncSuccess || !userSub.asaas_subscription_id ? "synced" : "pending_resync",
        })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "cumulative_renewal_applied",
        payload: {
          gateway: "asaas",
          payment_id: paymentId,
          months: decision.monthsCount,
          new_period_end: decision.newPeriodEnd,
          asaas_sync_success: asaasSyncSuccess,
        },
      });

      // Notificação Telegram
      try {
        const botToken = Deno?.env?.get ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
        const chatId = Deno?.env?.get ? Deno.env.get("TELEGRAM_CHAT_ID") : undefined;
        if (botToken && chatId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", userSub.user_id)
            .maybeSingle();

          const text = [
            `<b>[AXIR] ANTECIPAÇÃO ACUMULATIVA CONFIRMADA</b>`,
            `<b>Cliente:</b> ${profile?.name || "Assinante"} (${profile?.email || "—"})`,
            `<b>Meses Antecipados:</b> +${decision.monthsCount} meses`,
            `<b>Valor Pago:</b> R$ ${payment.value?.toFixed(2)} (${payment.billingType})`,
            `<b>Novo Vencimento:</b> ${new Date(decision.newPeriodEnd).toLocaleDateString("pt-BR")}`,
            `<b>Sincronizado no Asaas:</b> ${asaasSyncSuccess ? "SIM" : "PENDENTE RECONCILIAÇÃO"}`,
          ].join("\n");

          await sendTelegramNotification({ botToken, chatId, text });
        }
      } catch (tgErr) {
        console.warn("[asaas-webhook] Falha ao notificar Telegram sobre acumulativo:", tgErr);
      }

      return json({
        received: true,
        event: eventType,
        action: "cumulative_renewal_applied",
        months: decision.monthsCount,
        newPeriodEnd: decision.newPeriodEnd,
      });
    }

    // =========================================================================
    // CASO B: ATIVAR OU RENOVAR ASSINATURA NORMAL
    // =========================================================================
    if (decision.action === "activate") {
      const nowIso = new Date().toISOString();
      const isFirstPaidCharge = !userSub.billing_start_at || userSub.tier === "trial";

      // Se for upgrade de Mensal para Anual via Pix, cancela a assinatura recorrente mensal anterior no Asaas
      if (decision.isUpgradeFromMonthly && userSub.asaas_subscription_id) {
        try {
          await ensurePreviousSubscriptionCanceled(userSub.asaas_subscription_id);
        } catch (cancelErr) {
          console.warn("[asaas-webhook] Falha ao cancelar assinatura mensal anterior no Asaas pós-Pix Anual:", cancelErr);
        }
      }

      // Registra liquidação em billing_processed_payments
      await supabase.from("billing_processed_payments").upsert(
        {
          provider: "asaas",
          provider_payment_id: paymentId,
          user_id: userSub.user_id,
          kind: isFirstPaidCharge ? "subscription_first_charge" : "subscription_renewal",
          amount_cents: Math.round((payment.value || 0) * 100),
          period_end_applied: decision.currentPeriodEnd,
          metadata: {
            event_type: eventType,
            tier: decision.targetTier,
            subscription_id: subscriptionId,
            billing_type: payment.billingType,
          },
        },
        { onConflict: "provider,provider_payment_id" },
      );

      const updatePayload: Record<string, unknown> = {
        tier: decision.targetTier,
        plan_id: decision.targetTier,
        status: "active",
        current_period_end: decision.currentPeriodEnd,
        cancel_at_period_end: false,
        asaas_payment_id: paymentId,
        asaas_customer_id: customerId,
        scheduled_plan_id: null,
        scheduled_first_charge_at: null,
        pending_plan_id: null,
        pending_plan_effective_at: null,
      };

      if (subscriptionId) {
        updatePayload.asaas_subscription_id = subscriptionId;
      }

      if (isFirstPaidCharge) {
        updatePayload.billing_start_at = nowIso;
        updatePayload.trial_consumed_at = userSub.trial_consumed_at || nowIso;
      }

      await supabase
        .from("user_subscriptions")
        .update(updatePayload)
        .eq("id", userSub.id);

      if (intent?.id) {
        await supabase
          .from("billing_intents")
          .update({ status: "paid", updated_at: nowIso })
          .eq("id", intent.id);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: isFirstPaidCharge ? "subscription_activated" : "subscription_renewed",
        payload: {
          gateway: "asaas",
          event: eventType,
          tier: decision.targetTier,
          payment_id: paymentId,
          subscription_id: subscriptionId,
          current_period_end: decision.currentPeriodEnd,
        },
      });

      // Notificação Telegram
      try {
        const botToken = Deno?.env?.get ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
        const chatId = Deno?.env?.get ? Deno.env.get("TELEGRAM_CHAT_ID") : undefined;
        if (botToken && chatId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", userSub.user_id)
            .maybeSingle();

          const msg = buildTelegramSaleMessage({
            plan: decision.targetTier,
            amount: payment.value || 0,
            paymentMethod: payment.billingType === "PIX" ? "pix" : "credit_card",
            userName: profile?.name,
            userEmail: profile?.email,
            paymentId: paymentId,
          });
          await sendTelegramNotification({ botToken, chatId, text: msg });
        }
      } catch (tgErr) {
        console.error("[asaas-webhook] Erro ao notificar Telegram", tgErr);
      }

      // Disparo de e-mail transacional via Resend: Confirmação de Assinatura Pro
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const recipientEmail = profile?.email;
        if (recipientEmail) {
          const appUrl = Deno?.env?.get ? Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br" : "https://axir.com.br";
          const planDisplayName = decision.targetTier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal";
          const emailData = renderProActivationEmail({
            name: profile?.name || "Cliente",
            planName: planDisplayName,
            periodEndFormatted: new Date(decision.currentPeriodEnd).toLocaleDateString("pt-BR"),
            invoiceValueFormatted: `R$ ${(payment.value || 0).toFixed(2).replace(".", ",")}`,
            invoicePdfUrl: payment.bankSlipUrl || payment.invoiceUrl || undefined,
            appUrl,
          });

          await sendTransactionalEmail(supabase, {
            to: recipientEmail,
            subject: emailData.subject,
            template: "pro_activation",
            html: emailData.html,
            text: emailData.text,
            userId: userSub.user_id,
            idempotencyKey: `pro_activation_${paymentId}`,
          });
        }
      } catch (emailErr) {
        console.warn("[asaas-webhook] Aviso ao enviar e-mail de ativação Pro:", emailErr);
      }

      return json({ received: true, event: eventType, tier: decision.targetTier, status: "active" });
    }

    // =========================================================================
    // CASO C: INADIMPLÊNCIA (PAYMENT_OVERDUE)
    // =========================================================================
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
        payload: { payment_id: paymentId, subscription_id: subscriptionId },
      });

      // Disparo de e-mail transacional via Resend: Falha de Pagamento
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        if (profile?.email) {
          const appUrl = Deno?.env?.get ? Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br" : "https://axir.com.br";
          const emailData = renderPaymentFailedEmail({
            name: profile.name || "Cliente",
            planName: userSub.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal",
            updateCardUrl: `${appUrl}/assinatura`,
          });

          await sendTransactionalEmail(supabase, {
            to: profile.email,
            subject: emailData.subject,
            template: "payment_failed",
            html: emailData.html,
            text: emailData.text,
            userId: userSub.user_id,
            idempotencyKey: `payment_failed_${paymentId || userSub.id}_${new Date().toISOString().slice(0, 10)}`,
          });
        }
      } catch (emailErr) {
        console.warn("[asaas-webhook] Aviso ao enviar e-mail de falha no pagamento:", emailErr);
      }

      return json({ received: true, event: eventType, status: "past_due" });
    }

    // =========================================================================
    // CASO D: EXCLUSÃO DE COBRANÇA AVULSA / PIX PENDENTE (PAYMENT_DELETED)
    // =========================================================================
    if (decision.action === "delete_pending_payment") {
      if (paymentId) {
        await supabase
          .from("billing_intents")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("provider_payment_id", paymentId)
          .eq("status", "pending");
      }
      return json({ received: true, event: eventType, action: "pending_payment_deleted", paymentId });
    }

    // =========================================================================
    // CASO E: CANCELAMENTO DE ASSINATURA RECORRENTE (SUBSCRIPTION_DELETED)
    // =========================================================================
    if (decision.action === "mark_cancelled") {
      await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", userSub.id);

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "marked_cancelled_at_period_end",
        payload: { subscription_id: subscriptionId },
      });

      return json({ received: true, event: eventType, status: "canceled_at_period_end" });
    }

    // =========================================================================
    // CASO F: REVERSÃO / ESTORNO / CHARGEBACK (PAYMENT_REFUNDED / CHARGEBACK)
    // =========================================================================
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
        action: "marked_refunded",
        payload: { payment_id: paymentId },
      });

      return json({ received: true, event: eventType, status: "refunded" });
    }

    return json({ received: true, ignored: true, reason: decision.action });
  } catch (err: unknown) {
    console.error("[asaas-webhook] Erro não tratado:", err);
    return json({ error: "Erro interno no processamento do webhook" }, 500);
  }
});
