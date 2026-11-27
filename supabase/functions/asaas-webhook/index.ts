import { createClient } from "jsr:@supabase/supabase-js@2";
import { decideWebhookAction } from "../_shared/asaas-webhook-logic.ts";
import { maskEmailForLog, timingSafeEqualString } from "../_shared/http.ts";
import {
  buildTelegramSaleMessage,
  escapeTelegramHtml,
  sendTelegramNotification,
} from "../_shared/telegram.ts";
import {
  cancelAsaasSubscription,
  formatBrtDisplayDate,
  isAsaasAlreadyCanceledError,
  postponeAsaasSubscriptionAfterPrepayment,
  sanitizePaymentLog,
  updateAsaasSubscriptionNextDueDate,
} from "../_shared/asaas.ts";
import {
  cleanupPendingPixBestEffort,
  type PixIntentsSupabaseClient,
} from "../_shared/pix-intents.ts";
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

async function sendAdminTelegramAlert(text: string): Promise<void> {
  const botToken = Deno?.env?.get ? Deno.env.get("TELEGRAM_BOT_TOKEN") : undefined;
  const chatId = Deno?.env?.get ? Deno.env.get("TELEGRAM_CHAT_ID") : undefined;
  if (!botToken || !chatId) return;
  await sendTelegramNotification({ botToken, chatId, text });
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
    const payment = event?.payment ?? null;
    const subscriptionObj = event?.subscription ?? null;

    if (!eventType || (!payment && !subscriptionObj)) {
      return json({ received: true, ignored: true });
    }

    const customerId: string = payment?.customer || subscriptionObj?.customer || "";
    const paymentId: string = payment?.id || "";
    const subscriptionId: string | null = subscriptionObj?.id || payment?.subscription || null;
    const externalReference: string | null =
      payment?.externalReference || subscriptionObj?.externalReference || null;

    const supabaseUrl = Deno?.env?.get ? Deno.env.get("SUPABASE_URL") : undefined;
    const supabaseServiceKey = Deno?.env?.get ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : undefined;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[asaas-webhook] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes");
      return json({ error: "Serviço indisponível" }, 500);
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Busca em cascata real da intenção de cobrança vinculada (sem else-if morto)
    let intent: {
      id: string;
      user_id: string;
      kind: "subscription_start" | "plan_change" | "cumulative_renewal" | "reactivation";
      plan_id?: string | null;
      months_count?: number | null;
      amount_cents: number;
      status: string;
      metadata?: Record<string, unknown>;
    } | null = null;

    const intentSelect = "id, user_id, kind, plan_id, months_count, amount_cents, status, metadata";

    if (paymentId) {
      const { data } = await supabase
        .from("billing_intents")
        .select(intentSelect)
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (data) intent = data;
    }

    if (!intent && externalReference) {
      const { data } = await supabase
        .from("billing_intents")
        .select(intentSelect)
        .eq("external_reference", externalReference)
        .maybeSingle();
      if (data) intent = data;
    }

    if (!intent && subscriptionId) {
      const { data } = await supabase
        .from("billing_intents")
        .select(intentSelect)
        .eq("provider_subscription_id", subscriptionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) intent = data;
    }

    // 2. Checagem prévia se este payment já foi liquidado no billing_processed_payments
    let processedPayment: {
      id: string;
      user_id: string | null;
      kind: string;
      metadata?: Record<string, unknown>;
    } | null = null;

    if (paymentId) {
      const { data } = await supabase
        .from("billing_processed_payments")
        .select("id, user_id, kind, metadata")
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (data) processedPayment = data;
    }

    // 3. Busca em cascata real da assinatura do usuário (cobre pagamentos/estornos antigos)
    const subSelect =
      "id, user_id, tier, plan_id, status, asaas_payment_id, asaas_subscription_id, current_period_end, trial_ends_at, cancel_at_period_end, billing_start_at, trial_consumed_at, chargeback_flagged_at";

    let userSub: {
      id: string;
      user_id: string;
      tier: string;
      plan_id: string;
      status: string;
      asaas_payment_id: string | null;
      asaas_subscription_id: string | null;
      current_period_end: string | null;
      trial_ends_at: string | null;
      cancel_at_period_end: boolean;
      billing_start_at: string | null;
      trial_consumed_at: string | null;
      chargeback_flagged_at: string | null;
    } | null = null;

    if (intent?.user_id) {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(subSelect)
        .eq("user_id", intent.user_id)
        .maybeSingle();
      if (data) userSub = data;
    }

    if (!userSub && subscriptionId) {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(subSelect)
        .eq("asaas_subscription_id", subscriptionId)
        .maybeSingle();
      if (data) userSub = data;
    }

    if (!userSub && paymentId) {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(subSelect)
        .eq("asaas_payment_id", paymentId)
        .maybeSingle();
      if (data) userSub = data;
    }

    if (!userSub && processedPayment?.user_id) {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(subSelect)
        .eq("user_id", processedPayment.user_id)
        .maybeSingle();
      if (data) userSub = data;
    }

    if (!userSub && customerId) {
      const { data } = await supabase
        .from("user_subscriptions")
        .select(subSelect)
        .eq("asaas_customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) userSub = data;
    }

    if (!userSub) {
      return json({ received: true, unlinked: true });
    }

    // 4. Log de auditoria sanitizado e desduplicado por provider_event_id (W03)
    const effectiveEventId = eventId || `${eventType}_${paymentId || subscriptionId}_${Date.now()}`;
    const { data: logInserted, error: logInsertErr } = await supabase
      .from("billing_webhook_logs")
      .insert({
        provider: "asaas",
        provider_event_id: effectiveEventId,
        event_type: eventType,
        payment_id: paymentId || null,
        subscription_id: subscriptionId,
        customer_id: customerId || null,
        payload: sanitizePaymentLog(event),
      })
      .select("id")
      .maybeSingle();

    let webhookLogId: string | null = logInserted?.id ?? null;
    if (logInsertErr) {
      if (logInsertErr.code === "23505" && eventId) {
        const { data: existingLog } = await supabase
          .from("billing_webhook_logs")
          .select("id, processed_at")
          .eq("provider", "asaas")
          .eq("provider_event_id", eventId)
          .maybeSingle();

        if (existingLog?.processed_at) {
          return json({
            received: true,
            duplicate: true,
            ignored: true,
            reason: "webhook_event_already_processed",
            event: eventType,
          });
        }
        webhookLogId = existingLog?.id ?? null;
      } else {
        console.error("[asaas-webhook] Erro ao gravar billing_webhook_logs:", sanitizePaymentLog(logInsertErr));
        return json({ error: "Erro ao registrar evento de webhook" }, 500);
      }
    }

    const markWebhookProcessed = async () => {
      if (!webhookLogId) return;
      await supabase
        .from("billing_webhook_logs")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", webhookLogId);
    };

    const decision = decideWebhookAction({
      eventType,
      payment,
      subscription: subscriptionObj,
      currentSub: userSub,
      intent,
      isPaymentAlreadyProcessed: Boolean(processedPayment),
      processedPaymentKind: processedPayment?.kind ?? null,
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

    if (decision.action === "ignore_unrelated_payment") {
      return json({
        received: true,
        ignored: true,
        reason: decision.reason,
        event: eventType,
      });
    }

    if (decision.action === "ignore_unknown_plan") {
      console.error("[asaas-webhook] pagamento com valor/tipo fora do catálogo", {
        paymentId,
        value: payment?.value,
        billingType: payment?.billingType,
      });
      return json({ received: true, ignored: true, reason: "unknown_plan" });
    }

    const nowIso = new Date().toISOString();

    if (decision.action === "flag_canceled_intent_paid") {
      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "canceled_intent_payment_received",
        payload: {
          payment_id: paymentId,
          intent_id: decision.intentId,
          intent_kind: decision.intentKind,
          intent_status: decision.intentStatus,
          value: payment?.value ?? null,
        },
      });

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const safeEmail = escapeTelegramHtml(
          profile?.email ? maskEmailForLog(String(profile.email)) : "—",
        );
        const safeValue = escapeTelegramHtml(
          String(payment?.value?.toFixed?.(2) ?? payment?.value ?? "0.00"),
        );

        const text = [
          `<b>[AXIR] ALERTA CRÍTICO: PAGAMENTO RECEBIDO EM PIX CANCELADO/EXPIRADO</b>`,
          `<b>Usuário:</b> <code>${escapeTelegramHtml(userSub.user_id)}</code> (${safeEmail})`,
          `<b>ID Pagamento:</b> <code>${escapeTelegramHtml(paymentId || "—")}</code>`,
          `<b>Intent ID:</b> <code>${escapeTelegramHtml(decision.intentId)}</code>`,
          `<b>Tipo/Status anterior:</b> ${escapeTelegramHtml(decision.intentKind)} / ${escapeTelegramHtml(decision.intentStatus)}`,
          `<b>Valor Pago:</b> R$ ${safeValue}`,
          `<b>Ação:</b> Não aplicado automaticamente. Avaliar aplicação manual ou estorno no painel Asaas.`,
        ].join("\n");

        await sendAdminTelegramAlert(text);
      } catch (tgErr) {
        console.warn(
          "[asaas-webhook] Falha ao notificar Telegram sobre pagamento em intent cancelada:",
          sanitizePaymentLog(tgErr),
        );
      }

      await markWebhookProcessed();

      return json({
        received: true,
        event: eventType,
        status: "flagged_for_review",
        intentId: decision.intentId,
      });
    }

    // =========================================================================
    // CASO A: APLICAR RENOVAÇÃO ACUMULATIVA (2 A 11 MESES VIA PIX)
    // =========================================================================
    if (decision.action === "apply_cumulative_renewal") {
      const { data: updatedIntent, error: intentClaimErr } = await supabase
        .from("billing_intents")
        .update({
          status: "paid",
          updated_at: nowIso,
          metadata: {
            ...(intent?.metadata || {}),
            applied_new_period_end: decision.newPeriodEnd,
          },
        })
        .eq("id", decision.intentId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (intentClaimErr) {
        console.error("[asaas-webhook] Erro ao reivindicar billing_intent acumulativa:", intentClaimErr);
        return json({ error: "Erro transitório ao reivindicar intenção de cobrança" }, 500);
      }

      if (!updatedIntent) {
        return json({ received: true, duplicate: true, reason: "concurrency_handled" });
      }

      // Lock atômico em billing_processed_payments antes de alterar user_subscriptions
      const { data: lockedRow, error: lockErr } = await supabase
        .from("billing_processed_payments")
        .upsert(
          {
            provider: "asaas",
            provider_payment_id: paymentId,
            user_id: userSub.user_id,
            kind: "cumulative_renewal",
            amount_cents: Math.round((payment?.value || 0) * 100),
            period_end_applied: decision.newPeriodEnd,
            metadata: {
              months: decision.monthsCount,
              event_type: eventType,
              subscription_id: subscriptionId,
            },
          },
          { onConflict: "provider,provider_payment_id", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();

      if (lockErr) {
        await supabase
          .from("billing_intents")
          .update({ status: "pending", updated_at: nowIso, metadata: intent?.metadata || {} })
          .eq("id", decision.intentId);
        console.error("[asaas-webhook] Erro ao registrar lock em billing_processed_payments:", lockErr);
        return json({ error: "Erro ao registrar pagamento processado" }, 500);
      }

      if (!lockedRow) {
        return json({ received: true, duplicate: true, reason: "atomic_payment_lock" });
      }

      let asaasSyncSuccess = false;

      if (userSub.asaas_subscription_id) {
        try {
          const postponeRes = await postponeAsaasSubscriptionAfterPrepayment(
            userSub.asaas_subscription_id,
            decision.newPeriodEnd,
          );
          asaasSyncSuccess = postponeRes.success;
        } catch (subErr) {
          console.error(
            "[asaas-webhook] Falha ao adiar assinatura recorrente após antecipação Pix:",
            sanitizePaymentLog(subErr),
          );
        }
      }

      const { error: subUpdateErr } = await supabase
        .from("user_subscriptions")
        .update({
          current_period_end: decision.newPeriodEnd,
          asaas_sync_status: asaasSyncSuccess || !userSub.asaas_subscription_id ? "synced" : "pending_resync",
          past_due_since: null,
          past_due_block_at: null,
          past_due_last_reminded_at: null,
          past_due_reminder_count: 0,
          updated_at: nowIso,
        })
        .eq("id", userSub.id);

      if (subUpdateErr) {
        // Compensação atômica para permitir retry seguro do Asaas
        await supabase.from("billing_processed_payments").delete().eq("id", lockedRow.id);
        await supabase
          .from("billing_intents")
          .update({ status: "pending", updated_at: nowIso, metadata: intent?.metadata || {} })
          .eq("id", decision.intentId);
        console.error("[asaas-webhook] Falha ao atualizar vigência acumulativa em user_subscriptions:", subUpdateErr);
        return json({ error: "Erro ao atualizar assinatura" }, 500);
      }

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

      const periodEndFormatted = formatBrtDisplayDate(decision.newPeriodEnd);

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const safeCustomerName = escapeTelegramHtml(String(profile?.name || "Assinante"));
        const safeCustomerEmail = escapeTelegramHtml(
          profile?.email ? maskEmailForLog(String(profile.email)) : "—",
        );
        const safeAmount = escapeTelegramHtml(String(payment?.value?.toFixed(2) ?? "0.00"));
        const safeBillingType = escapeTelegramHtml(String(payment?.billingType || "—"));

        const text = [
          `<b>[AXIR] ANTECIPAÇÃO ACUMULATIVA CONFIRMADA</b>`,
          `<b>Cliente:</b> ${safeCustomerName} (${safeCustomerEmail})`,
          `<b>Meses Antecipados:</b> +${decision.monthsCount} meses`,
          `<b>Valor Pago:</b> R$ ${safeAmount} (${safeBillingType})`,
          `<b>Novo Vencimento:</b> ${escapeTelegramHtml(periodEndFormatted)}`,
          `<b>Sincronizado no Asaas:</b> ${asaasSyncSuccess ? "SIM" : "PENDENTE RECONCILIAÇÃO"}`,
        ].join("\n");

        await sendAdminTelegramAlert(text);

        const recipientEmail = profile?.email;
        if (recipientEmail) {
          const appUrl = Deno?.env?.get ? Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br" : "https://axir.com.br";
          const planDisplayName = userSub.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal";
          const emailData = renderProActivationEmail({
            name: profile?.name || "Cliente",
            planName: planDisplayName,
            periodEndFormatted,
            invoiceValueFormatted: `R$ ${(payment?.value || 0).toFixed(2).replace(".", ",")}`,
            invoicePdfUrl: payment?.bankSlipUrl || payment?.invoiceUrl || undefined,
            appUrl,
            isFirstActivation: false,
            cumulativeMonths: decision.monthsCount,
          });

          await sendTransactionalEmail(supabase, {
            to: recipientEmail,
            subject: emailData.subject,
            template: "pro_cumulative_renewal",
            html: emailData.html,
            text: emailData.text,
            userId: userSub.user_id,
            idempotencyKey: `pro_cumulative_${paymentId}`,
          });
        }
      } catch (notifyErr) {
        console.warn("[asaas-webhook] Aviso ao notificar antecipação acumulativa:", sanitizePaymentLog(notifyErr));
      }

      await cleanupPendingPixBestEffort({
        supabase: supabase as unknown as PixIntentsSupabaseClient,
        userId: userSub.user_id,
        excludeIntentId: intent?.id,
        cancelReason: "superseded_by_paid_webhook",
        logPrefix: "[asaas-webhook]",
      });

      await markWebhookProcessed();

      return json({
        received: true,
        event: eventType,
        action: "cumulative_renewal_applied",
        months: decision.monthsCount,
        newPeriodEnd: decision.newPeriodEnd,
      });
    }

    // =========================================================================
    // CASO B: ATIVAR OU RENOVAR ASSINATURA NORMAL (COM LOCK ATÔMICO B-04)
    // =========================================================================
    if (decision.action === "activate") {
      const isFirstPaidCharge = !userSub.billing_start_at || userSub.tier === "trial";
      const isReactivation =
        userSub.status === "canceled" ||
        userSub.status === "read_only_expired" ||
        userSub.tier === "read_only";

      // W01: Ao ativar pagamento avulso/PIX ou nova assinatura diferente da recorrência prévia no Asaas,
      // cancela a recorrência anterior. Nunca cancela quando o pagamento pertence à mesma assinatura (troca de ciclo in-place).
      let syncStatus = "synced";
      let previousSubCanceled = false;
      const shouldCancelPreviousSub =
        Boolean(userSub.asaas_subscription_id) &&
        userSub.asaas_subscription_id !== subscriptionId &&
        (decision.isUpgradeFromMonthly || !subscriptionId);

      if (shouldCancelPreviousSub && userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
          previousSubCanceled = true;
        } catch (cancelErr) {
          if (isAsaasAlreadyCanceledError(cancelErr)) {
            previousSubCanceled = true;
          } else {
            syncStatus = "pending_resync";
            console.warn(
              "[asaas-webhook] Falha ao cancelar assinatura anterior no Asaas:",
              sanitizePaymentLog(cancelErr),
            );
            await sendAdminTelegramAlert(
              [
                `<b>[AXIR] FALHA AO CANCELAR ASSINATURA ANTERIOR NO ASAAS</b>`,
                `<b>Usuário:</b> <code>${escapeTelegramHtml(userSub.user_id)}</code>`,
                `<b>Sub antiga:</b> <code>${escapeTelegramHtml(userSub.asaas_subscription_id)}</code>`,
                `<b>Ação:</b> Marcada como <code>pending_resync</code> para retentativa automática.`,
              ].join("\n"),
            );
          }
        }
      }

      // W02 + W04: Ativação atômica via RPC transacional (lock + user_subscriptions + billing_intents)
      const { data: atomicResult, error: atomicErr } = await supabase.rpc(
        "activate_subscription_from_payment",
        {
          p_user_id: userSub.user_id,
          p_subscription_row_id: userSub.id,
          p_provider_payment_id: paymentId,
          p_kind: isFirstPaidCharge ? "subscription_first_charge" : "subscription_renewal",
          p_amount_cents: Math.round((payment?.value || 0) * 100),
          p_target_tier: decision.targetTier,
          p_current_period_end: decision.currentPeriodEnd,
          p_asaas_customer_id: customerId || null,
          p_asaas_subscription_id: subscriptionId || null,
          p_clear_asaas_subscription: !subscriptionId && shouldCancelPreviousSub && previousSubCanceled,
          p_asaas_sync_status: syncStatus,
          p_set_billing_start_at: isFirstPaidCharge || isReactivation,
          p_billing_start_at: nowIso,
          p_trial_consumed_at: userSub.trial_consumed_at || nowIso,
          p_payment_method: payment?.billingType === "PIX" ? "pix" : "credit_card",
          p_intent_id: intent?.id ?? null,
          p_metadata: {
            event_type: eventType,
            tier: decision.targetTier,
            subscription_id: subscriptionId,
            billing_type: payment?.billingType,
          },
        },
      );

      if (atomicErr) {
        console.error("[asaas-webhook] Erro na ativação atômica da assinatura:", atomicErr);
        return json({ error: "Erro ao ativar assinatura no banco" }, 500);
      }

      if (atomicResult?.duplicate) {
        return json({
          received: true,
          duplicate: true,
          ignored: true,
          reason: "atomic_payment_lock",
          event: eventType,
        });
      }

      await markWebhookProcessed();

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

      const periodEndFormatted = formatBrtDisplayDate(decision.currentPeriodEnd);

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const msg = buildTelegramSaleMessage({
          plan: decision.targetTier,
          amount: payment?.value || 0,
          paymentMethod: payment?.billingType === "PIX" ? "pix" : "credit_card",
          userName: profile?.name,
          userEmail: profile?.email ? maskEmailForLog(profile.email) : undefined,
          paymentId,
        });
        await sendAdminTelegramAlert(msg);

        const recipientEmail = profile?.email;
        if (recipientEmail) {
          const appUrl = Deno?.env?.get ? Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br" : "https://axir.com.br";
          const planDisplayName = decision.targetTier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal";
          const emailData = renderProActivationEmail({
            name: profile?.name || "Cliente",
            planName: planDisplayName,
            periodEndFormatted,
            invoiceValueFormatted: `R$ ${(payment?.value || 0).toFixed(2).replace(".", ",")}`,
            invoicePdfUrl: payment?.bankSlipUrl || payment?.invoiceUrl || undefined,
            appUrl,
            isFirstActivation: isFirstPaidCharge,
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
      } catch (notifyErr) {
        console.warn("[asaas-webhook] Aviso ao notificar ativação Pro:", sanitizePaymentLog(notifyErr));
      }

      await cleanupPendingPixBestEffort({
        supabase: supabase as unknown as PixIntentsSupabaseClient,
        userId: userSub.user_id,
        excludeIntentId: intent?.id,
        cancelReason: "superseded_by_paid_webhook",
        logPrefix: "[asaas-webhook]",
      });

      return json({ received: true, event: eventType, tier: decision.targetTier, status: "active" });
    }

    // =========================================================================
    // CASO C: INADIMPLÊNCIA (PAYMENT_OVERDUE DA ASSINATURA ATIVA)
    // =========================================================================
    if (decision.action === "mark_past_due") {
      const graceMode = userSub.billing_start_at ? "manual" : "auto";
      const { error: pastDueErr } = await supabase
        .from("user_subscriptions")
        .update({
          status: "past_due",
          past_due_since: nowIso,
          past_due_grace_mode: graceMode,
          past_due_block_at: null,
          past_due_reminders_enabled: true,
          past_due_last_reminded_at: nowIso,
          past_due_reminder_count: 0,
          updated_at: nowIso,
        })
        .eq("id", userSub.id);

      if (pastDueErr) {
        console.error("[asaas-webhook] Falha ao marcar past_due:", pastDueErr);
        return json({ error: "Erro ao atualizar inadimplência" }, 500);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "marked_past_due",
        payload: { payment_id: paymentId, subscription_id: subscriptionId, grace_mode: graceMode },
      });

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const appUrl = Deno?.env?.get ? Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br" : "https://axir.com.br";
        const safeName = escapeTelegramHtml(String(profile?.name || "Assinante"));
        const safeEmail = escapeTelegramHtml(
          profile?.email ? maskEmailForLog(String(profile.email)) : "—",
        );
        const safePlan = escapeTelegramHtml(
          userSub.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal",
        );
        const graceLabel =
          graceMode === "manual"
            ? "Tolerância manual ativa (sem bloqueio automático)"
            : "Carência automática de 3 dias (falha na 1ª cobrança do trial)";
        const tgText = [
          `<b>[AXIR] ASSINATURA EM ATRASO (PAST DUE)</b>`,
          `<b>Cliente:</b> ${safeName} (${safeEmail})`,
          `<b>Plano:</b> ${safePlan}`,
          `<b>Status:</b> ${graceLabel}`,
          `<b>Gerenciar:</b> ${escapeTelegramHtml(appUrl)}/admin/faturamento`,
        ].join("\n");
        await sendAdminTelegramAlert(tgText);

        if (profile?.email) {
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
            idempotencyKey: `payment_failed_${paymentId || userSub.id}_${nowIso.slice(0, 10)}`,
          });
        }
      } catch (emailErr) {
        console.warn("[asaas-webhook] Aviso ao notificar inadimplência:", sanitizePaymentLog(emailErr));
      }

      await markWebhookProcessed();

      return json({ received: true, event: eventType, status: "past_due" });
    }

    // =========================================================================
    // CASO D: EXCLUSÃO DE COBRANÇA AVULSA / PIX PENDENTE (PAYMENT_DELETED)
    // =========================================================================
    if (decision.action === "delete_pending_payment") {
      let pastDueReevaluated = false;
      if (paymentId) {
        await supabase
          .from("billing_intents")
          .update({ status: "canceled", updated_at: nowIso })
          .eq("provider_payment_id", paymentId)
          .eq("status", "pending");

        if (
          userSub.status === "past_due" &&
          userSub.current_period_end &&
          new Date(userSub.current_period_end) > new Date() &&
          (!userSub.asaas_payment_id || userSub.asaas_payment_id === paymentId)
        ) {
          const { error: reevalErr } = await supabase
            .from("user_subscriptions")
            .update({ status: "active", updated_at: nowIso })
            .eq("id", userSub.id);
          if (!reevalErr) {
            pastDueReevaluated = true;
          }
        }

        await supabase.from("audit_events").insert({
          user_id: userSub.user_id,
          entity_type: "user_subscription",
          entity_id: userSub.id,
          action: "payment_deleted",
          payload: {
            payment_id: paymentId,
            subscription_id: subscriptionId,
            past_due_reevaluated: pastDueReevaluated,
          },
        });
      }
      await markWebhookProcessed();
      return json({
        received: true,
        event: eventType,
        action: "pending_payment_deleted",
        paymentId,
        pastDueReevaluated,
      });
    }

    // =========================================================================
    // CASO E: CANCELAMENTO / ATUALIZAÇÃO DE ASSINATURA RECORRENTE
    // =========================================================================
    if (decision.action === "mark_cancelled") {
      const { error: cancelErr } = await supabase
        .from("user_subscriptions")
        .update({ cancel_at_period_end: true, updated_at: nowIso })
        .eq("id", userSub.id);

      if (cancelErr) {
        console.error("[asaas-webhook] Falha ao marcar cancel_at_period_end:", cancelErr);
        return json({ error: "Erro ao atualizar cancelamento" }, 500);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "marked_cancelled_at_period_end",
        payload: { subscription_id: subscriptionId },
      });

      await markWebhookProcessed();

      return json({ received: true, event: eventType, status: "canceled_at_period_end" });
    }

    if (decision.action === "sync_subscription_updated") {
      const { error: syncErr } = await supabase
        .from("user_subscriptions")
        .update({ asaas_sync_status: "synced", updated_at: nowIso })
        .eq("id", userSub.id);

      if (syncErr) {
        console.error("[asaas-webhook] Falha ao sincronizar SUBSCRIPTION_UPDATED:", syncErr);
        return json({ error: "Erro ao sincronizar assinatura" }, 500);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "subscription_updated",
        payload: {
          subscription_id: decision.subscriptionId,
          provider_status: decision.status ?? null,
          next_due_date: decision.nextDueDate ?? null,
        },
      });

      await markWebhookProcessed();

      return json({ received: true, event: eventType, action: "subscription_updated" });
    }

    // =========================================================================
    // CASO F1: ESTORNO DE ANTECIPAÇÃO ACUMULATIVA (D-16)
    // =========================================================================
    if (decision.action === "refund_cumulative_renewal") {
      let asaasSyncStatus: "synced" | "pending_resync" = "synced";
      if (userSub.asaas_subscription_id) {
        try {
          await updateAsaasSubscriptionNextDueDate(
            userSub.asaas_subscription_id,
            decision.newPeriodEnd,
          );
        } catch (syncErr) {
          asaasSyncStatus = "pending_resync";
          console.warn(
            "[asaas-webhook] Falha ao ajustar nextDueDate após estorno de acumulativo:",
            sanitizePaymentLog(syncErr),
          );
        }
      }

      const { error: refundCumErr } = await supabase
        .from("user_subscriptions")
        .update({
          current_period_end: decision.newPeriodEnd,
          asaas_sync_status: asaasSyncStatus,
          updated_at: nowIso,
        })
        .eq("id", userSub.id);

      if (refundCumErr) {
        console.error("[asaas-webhook] Falha ao estornar antecipação acumulativa:", refundCumErr);
        return json({ error: "Erro ao estornar antecipação acumulativa" }, 500);
      }

      if (decision.intentId) {
        await supabase
          .from("billing_intents")
          .update({
            status: "canceled",
            updated_at: nowIso,
            metadata: {
              ...(intent?.metadata || {}),
              refunded: true,
              refunded_at: nowIso,
            },
          })
          .eq("id", decision.intentId);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "cumulative_renewal_refunded",
        payload: {
          payment_id: paymentId,
          months_reverted: decision.monthsCount,
          new_period_end: decision.newPeriodEnd,
        },
      });

      await markWebhookProcessed();

      return json({
        received: true,
        event: eventType,
        action: "cumulative_renewal_refunded",
        newPeriodEnd: decision.newPeriodEnd,
      });
    }

    // =========================================================================
    // CASO F2: REVERSÃO / ESTORNO INTEGRAL (PAYMENT_REFUNDED)
    // =========================================================================
    if (decision.action === "mark_refunded") {
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
        } catch (cancelErr) {
          if (!isAsaasAlreadyCanceledError(cancelErr)) {
            console.warn(
              "[asaas-webhook] Falha ao cancelar assinatura recorrente no Asaas após estorno:",
              sanitizePaymentLog(cancelErr),
            );
          }
        }
      }

      const { error: refundErr } = await supabase
        .from("user_subscriptions")
        .update({
          tier: "read_only",
          plan_id: "trial",
          status: "canceled",
          cancel_at_period_end: false,
          asaas_subscription_id: null,
          scheduled_plan_id: null,
          scheduled_first_charge_at: null,
          current_period_end: nowIso,
          updated_at: nowIso,
        })
        .eq("id", userSub.id);

      if (refundErr) {
        console.error("[asaas-webhook] Falha ao processar PAYMENT_REFUNDED:", refundErr);
        return json({ error: "Erro ao registrar estorno" }, 500);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "marked_refunded",
        payload: { payment_id: paymentId },
      });

      await markWebhookProcessed();

      return json({ received: true, event: eventType, status: "refunded" });
    }

    // =========================================================================
    // CASO F3: CHARGEBACK RECEBIDO (D-06 — CANCELA ASAAS, BLOQUEIA E ALERTA)
    // =========================================================================
    if (decision.action === "mark_chargeback") {
      let asaasCanceled = !userSub.asaas_subscription_id;
      if (userSub.asaas_subscription_id) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
          asaasCanceled = true;
        } catch (cancelErr) {
          if (isAsaasAlreadyCanceledError(cancelErr)) {
            asaasCanceled = true;
          } else {
            console.error(
              "[asaas-webhook] Falha ao cancelar assinatura recorrente no Asaas após chargeback:",
              sanitizePaymentLog(cancelErr),
            );
          }
        }
      }

      const { error: cbErr } = await supabase
        .from("user_subscriptions")
        .update({
          tier: "read_only",
          plan_id: "trial",
          status: "canceled",
          cancel_at_period_end: false,
          asaas_subscription_id: null,
          scheduled_plan_id: null,
          scheduled_first_charge_at: null,
          current_period_end: nowIso,
          chargeback_flagged_at: userSub.chargeback_flagged_at || nowIso,
          updated_at: nowIso,
        })
        .eq("id", userSub.id);

      if (cbErr) {
        console.error("[asaas-webhook] Falha ao gravar bloqueio de chargeback:", cbErr);
        return json({ error: "Erro ao registrar chargeback" }, 500);
      }

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "chargeback_requested",
        payload: {
          payment_id: paymentId,
          subscription_id: subscriptionId,
          asaas_canceled: asaasCanceled,
          value: payment?.value ?? null,
        },
      });

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("id", userSub.user_id)
          .maybeSingle();

        const safeEmail = escapeTelegramHtml(
          profile?.email ? maskEmailForLog(String(profile.email)) : "—",
        );
        const safeValue = escapeTelegramHtml(String(payment?.value?.toFixed?.(2) ?? payment?.value ?? "0.00"));
        const text = [
          `<b>[AXIR] ALERTA CRÍTICO: CHARGEBACK RECEBIDO</b>`,
          `<b>Usuário:</b> <code>${escapeTelegramHtml(userSub.user_id)}</code> (${safeEmail})`,
          `<b>ID Pagamento:</b> <code>${escapeTelegramHtml(paymentId || "—")}</code>`,
          `<b>Valor Contestado:</b> R$ ${safeValue}`,
          `<b>Recorrência Cancelada no Asaas:</b> ${asaasCanceled ? "SIM" : "PENDENTE CANCELAMENTO MANUAL"}`,
          `<b>Ação:</b> Conta bloqueada para novas compras (chargeback_flagged_at). Verificar prazo de defesa (5–7 dias) no painel Asaas.`,
        ].join("\n");
        await sendAdminTelegramAlert(text);
      } catch (tgErr) {
        console.warn("[asaas-webhook] Falha ao notificar Telegram sobre chargeback:", sanitizePaymentLog(tgErr));
      }

      await markWebhookProcessed();

      return json({ received: true, event: eventType, status: "chargeback_blocked" });
    }

    // =========================================================================
    // CASO G/H: DISPUTAS DE CHARGEBACK & ESTORNO PARCIAL (D-16)
    // =========================================================================
    if (decision.action === "record_chargeback_dispute") {
      const actionName =
        decision.eventType === "PAYMENT_CHARGEBACK_DISPUTE"
          ? "chargeback_dispute"
          : "chargeback_reversal_pending";

      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: actionName,
        payload: {
          event: decision.eventType,
          payment_id: paymentId || null,
          value: payment?.value ?? null,
        },
      });

      try {
        const text = [
          `<b>[AXIR] ATUALIZAÇÃO DE DISPUTA CHARGEBACK</b>`,
          `<b>Evento:</b> ${escapeTelegramHtml(decision.eventType)}`,
          `<b>Usuário:</b> <code>${escapeTelegramHtml(userSub.user_id)}</code>`,
          `<b>ID Pagamento:</b> <code>${escapeTelegramHtml(paymentId || "—")}</code>`,
        ].join("\n");
        await sendAdminTelegramAlert(text);
      } catch (tgErr) {
        console.warn("[asaas-webhook] Falha ao notificar disputa de chargeback:", sanitizePaymentLog(tgErr));
      }

      await markWebhookProcessed();

      return json({ received: true, event: eventType, action: actionName });
    }

    if (decision.action === "record_partial_refund") {
      await supabase.from("audit_events").insert({
        user_id: userSub.user_id,
        entity_type: "user_subscription",
        entity_id: userSub.id,
        action: "payment_partially_refunded",
        payload: {
          payment_id: decision.paymentId || null,
          value: decision.value,
        },
      });

      try {
        const text = [
          `<b>[AXIR] ESTORNO PARCIAL REGISTRADO NO ASAAS</b>`,
          `<b>Usuário:</b> <code>${escapeTelegramHtml(userSub.user_id)}</code>`,
          `<b>ID Pagamento:</b> <code>${escapeTelegramHtml(decision.paymentId || "—")}</code>`,
          `<b>Valor:</b> R$ ${escapeTelegramHtml(decision.value.toFixed(2))}`,
        ].join("\n");
        await sendAdminTelegramAlert(text);
      } catch (tgErr) {
        console.warn("[asaas-webhook] Falha ao notificar estorno parcial:", sanitizePaymentLog(tgErr));
      }

      await markWebhookProcessed();

      return json({ received: true, event: eventType, action: "payment_partially_refunded" });
    }

    return json({ received: true, ignored: true, reason: decision.action });
  } catch (err: unknown) {
    console.error("[asaas-webhook] Erro não tratado:", sanitizePaymentLog(err));
    return json({ error: "Erro interno no processamento do webhook" }, 500);
  }
});
