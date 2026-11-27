import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  deleteAsaasPayment,
  findAsaasSubscriptionByExternalReference,
  getAsaasPayment,
  getAsaasSubscription,
  getAsaasSubscriptionPayments,
  isAsaasAlreadyCanceledError,
  postponeAsaasSubscriptionAfterPrepayment,
  sanitizePaymentLog,
} from "../_shared/asaas.ts";
import {
  buildCorsHeaders,
  jsonResponse,
  safeErrorResponse,
  timingSafeEqualString,
} from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import {
  renderPastDueWeeklyReminderEmail,
  renderTrialEndingReminderEmail,
  renderTrialExpiredReadOnlyEmail,
} from "../_shared/email-templates.ts";
import { formatBrtDisplayDate } from "../_shared/asaas.ts";
import { addCivilMonthsServer, resolveTierFromPayment } from "../_shared/asaas-plans.ts";
import { escapeTelegramHtml, sendTelegramNotification } from "../_shared/telegram.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

async function recordResyncFailureAndAlert(
  supabaseAdmin: SupabaseClient,
  sub: { id: string; user_id: string; asaas_subscription_id: string | null },
  errMsg: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const safeError = sanitizePaymentLog(errMsg).slice(0, 300);

  // Gira fila FIFO para evitar head-of-line blocking no limit(10)
  await supabaseAdmin
    .from("user_subscriptions")
    .update({ updated_at: nowIso })
    .eq("id", sub.id);

  await supabaseAdmin.from("audit_events").insert({
    user_id: sub.user_id,
    entity_type: "user_subscription",
    entity_id: sub.id,
    action: "asaas_resync_failed",
    payload: {
      subscription_id: sub.asaas_subscription_id,
      error: safeError,
    },
  });

  const lookbackIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "user_subscription")
    .eq("entity_id", sub.id)
    .eq("action", "asaas_resync_failed")
    .gte("created_at", lookbackIso);

  if ((count ?? 0) >= 3) {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (botToken && chatId) {
      const text = [
        `<b>[AXIR] ALERTA DE FALHA PERSISTENTE EM RESYNC ASAAS</b>`,
        `<b>Assinatura ID:</b> <code>${escapeTelegramHtml(sub.id)}</code>`,
        `<b>Asaas Sub ID:</b> <code>${escapeTelegramHtml(sub.asaas_subscription_id || "—")}</code>`,
        `<b>Falhas nos últimos 7 dias:</b> ${count}`,
        `<b>Último erro:</b> ${escapeTelegramHtml(safeError)}`,
      ].join("\n");
      await sendTelegramNotification({ botToken, chatId, text });
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor incompleta.");
    }

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const isServiceKey =
      token.length > 0 && (await timingSafeEqualString(token, supabaseServiceKey));
    const isCronSecret =
      token.length > 0 &&
      Boolean(cronSecret) &&
      (await timingSafeEqualString(token, cronSecret!));
    const isAuthorized = isServiceKey || isCronSecret;

    if (!isAuthorized) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Executa reconciliação de períodos expirados no banco de dados
    const { data: reconciledCount, error: rpcError } = await supabaseAdmin.rpc(
      "reconcile_expired_subscriptions",
    );
    if (rpcError) {
      console.error("[billing-lifecycle-cron] Erro ao executar reconcile_expired_subscriptions:", rpcError);
    }

    // 2. Reconciliação FIFO de assinaturas em estado pending_resync com a API do Asaas (D-17)
    let resyncedCount = 0;
    const { data: pendingSubscriptions } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, user_id, asaas_subscription_id, current_period_end, status, tier, payment_method")
      .eq("asaas_sync_status", "pending_resync")
      .not("asaas_subscription_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(10);

    for (const sub of pendingSubscriptions || []) {
      if (!sub.asaas_subscription_id) continue;
      try {
        // Caso PIX Anual cuja assinatura recorrente mensal anterior falhou ao cancelar no webhook
        if (sub.payment_method === "pix" && sub.tier === "pro_annual") {
          try {
            await cancelAsaasSubscription(sub.asaas_subscription_id);
          } catch (cancelErr: unknown) {
            if (!isAsaasAlreadyCanceledError(cancelErr)) {
              throw cancelErr;
            }
          }

          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              asaas_subscription_id: null,
              card_last4: null,
              asaas_sync_status: "synced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id)
            .eq("asaas_subscription_id", sub.asaas_subscription_id);
          resyncedCount++;
          continue;
        }

        let postponeOk = true;
        if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
          const postponeRes = await postponeAsaasSubscriptionAfterPrepayment(
            sub.asaas_subscription_id,
            sub.current_period_end,
          );
          postponeOk = postponeRes.success;
        }

        if (postponeOk) {
          const asaasSub = await getAsaasSubscription(sub.asaas_subscription_id);
          const isAsaasActive = asaasSub?.status === "ACTIVE";
          const hasPaidRemaining =
            Boolean(sub.current_period_end) && new Date(sub.current_period_end!) > new Date();

          const updateFields: Record<string, unknown> = {
            asaas_sync_status: "synced",
            updated_at: new Date().toISOString(),
          };
          if (isAsaasActive) {
            updateFields.status = "active";
          } else if (hasPaidRemaining) {
            updateFields.status = "active";
            updateFields.cancel_at_period_end = true;
          } else {
            updateFields.status = "canceled";
          }

          await supabaseAdmin
            .from("user_subscriptions")
            .update(updateFields)
            .eq("id", sub.id);
          resyncedCount++;
        } else {
          await recordResyncFailureAndAlert(
            supabaseAdmin,
            sub,
            "Falha parcial ao remover cobranças PENDING anteriores ao novo vencimento.",
          );
          console.warn(
            `[billing-lifecycle-cron] Adiamento no Asaas pendente de retentativa para sub ${sub.id}`,
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await recordResyncFailureAndAlert(supabaseAdmin, sub, errMsg);
        console.warn(`[billing-lifecycle-cron] Falha ao sincronizar sub ${sub.id}:`, sanitizePaymentLog(err));
      }
    }

    // 2b. Higiene automática de cobranças PIX pendentes expiradas (evita status OVERDUE no Asaas)
    let expiredPixIntents = 0;
    const pixGraceCutoffIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const legacyPixCutoffIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: stalePixIntents, error: stalePixErr } = await supabaseAdmin
      .from("billing_intents")
      .select("id, user_id, kind, plan_id, months_count, amount_cents, provider_payment_id, metadata")
      .eq("method", "pix")
      .eq("status", "pending")
      .or(`expires_at.lte.${pixGraceCutoffIso},and(expires_at.is.null,created_at.lte.${legacyPixCutoffIso})`)
      .order("created_at", { ascending: true })
      .limit(25);

    if (stalePixErr) {
      console.error("[billing-lifecycle-cron] Erro ao consultar intents PIX expiradas:", stalePixErr);
    }

    const cleanupNowIso = new Date().toISOString();
    for (const intent of stalePixIntents || []) {
      const expirePayload = {
        status: "expired",
        updated_at: cleanupNowIso,
        metadata: {
          ...((intent.metadata as Record<string, unknown> | null) || {}),
          expired_by: "lifecycle_cron",
          expired_at: cleanupNowIso,
        },
      };

      if (!intent.provider_payment_id) {
        const { error: markErr } = await supabaseAdmin
          .from("billing_intents")
          .update(expirePayload)
          .eq("id", intent.id)
          .eq("status", "pending");
        if (!markErr) expiredPixIntents++;
        continue;
      }

      try {
        const payment = await getAsaasPayment(intent.provider_payment_id);
        const statusUpper = (payment.status || "").toUpperCase();

        if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(statusUpper)) {
          // Reconcilia pagamento PIX já confirmado no Asaas cuja aplicação via webhook falhou ou atrasou
          const { data: userSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select(
              "id, user_id, tier, status, asaas_subscription_id, current_period_end, trial_ends_at, billing_start_at, trial_consumed_at",
            )
            .eq("user_id", intent.user_id)
            .maybeSingle();

          if (!userSub) {
            console.warn(`[billing-lifecycle-cron] Assinatura ausente ao reconciliar intent PIX ${intent.id}.`);
            continue;
          }

          if (intent.kind === "cumulative_renewal") {
            const billingTypeUpper = (payment.billingType || "PIX").toUpperCase();
            if (billingTypeUpper !== "PIX" || typeof payment.value !== "number" || payment.value <= 0) {
              console.error(
                `[billing-lifecycle-cron] Payload PIX cumulativo inválido para ${intent.provider_payment_id} (type=${billingTypeUpper}, value=${payment.value}).`,
              );
              continue;
            }
            const months = intent.months_count ?? 1;
            const initialSync = userSub.asaas_subscription_id ? "pending_resync" : "synced";
            const { data: cumRes, error: cumErr } = await supabaseAdmin.rpc(
              "apply_cumulative_renewal_from_payment",
              {
                p_user_id: intent.user_id,
                p_subscription_row_id: userSub.id,
                p_provider_payment_id: intent.provider_payment_id,
                p_amount_cents: Math.round(payment.value * 100),
                p_months_count: months,
                p_asaas_sync_status: initialSync,
                p_intent_id: intent.id,
                p_metadata: { reconciled_by: "billing_lifecycle_cron", asaas_status: payment.status },
              },
            );
            if (cumErr) {
              console.error(`[billing-lifecycle-cron] Erro ao reconciliar PIX acumulativo ${intent.id}:`, cumErr);
              continue;
            }
            if (cumRes?.applied && userSub.asaas_subscription_id && typeof cumRes?.new_period_end === "string") {
              try {
                const postRes = await postponeAsaasSubscriptionAfterPrepayment(
                  userSub.asaas_subscription_id,
                  cumRes.new_period_end,
                );
                if (postRes.success) {
                  await supabaseAdmin
                    .from("user_subscriptions")
                    .update({ asaas_sync_status: "synced", updated_at: new Date().toISOString() })
                    .eq("id", userSub.id)
                    .eq("asaas_subscription_id", userSub.asaas_subscription_id)
                    .eq("current_period_end", cumRes.new_period_end);
                }
              } catch (postErr) {
                console.warn("[billing-lifecycle-cron] Adiamento pós-reconciliação pendente:", sanitizePaymentLog(postErr));
              }
            }
          } else {
            const resolvedTier = resolveTierFromPayment({
              value: payment.value,
              billingType: payment.billingType || "PIX",
            });
            if (!resolvedTier) {
              console.error(
                `[billing-lifecycle-cron] Pagamento PIX ${intent.provider_payment_id} fora do catálogo oficial (value=${payment.value}); ignorando reconciliação.`,
              );
              continue;
            }

            let prevSubCanceled = false;
            if (resolvedTier === "pro_annual" && userSub.asaas_subscription_id) {
              try {
                await cancelAsaasSubscription(userSub.asaas_subscription_id);
                prevSubCanceled = true;
              } catch (cancelErr: unknown) {
                if (isAsaasAlreadyCanceledError(cancelErr)) {
                  prevSubCanceled = true;
                } else {
                  console.warn(
                    `[billing-lifecycle-cron] Falha ao cancelar sub recorrente ${userSub.asaas_subscription_id} ao reconciliar PIX anual:`,
                    sanitizePaymentLog(cancelErr),
                  );
                }
              }
            }

            const nowDate = new Date();
            const baseDate =
              userSub.current_period_end && new Date(userSub.current_period_end) > nowDate
                ? new Date(userSub.current_period_end)
                : userSub.trial_ends_at && new Date(userSub.trial_ends_at) > nowDate
                  ? new Date(userSub.trial_ends_at)
                  : nowDate;
            const nextEnd = addCivilMonthsServer(baseDate, resolvedTier === "pro_annual" ? 12 : 1);
            const isFirstCharge = !userSub.billing_start_at || userSub.tier === "trial";
            const isReactivation =
              userSub.status === "canceled" ||
              userSub.status === "read_only_expired" ||
              userSub.tier === "read_only";
            const needsResync =
              resolvedTier === "pro_annual" && Boolean(userSub.asaas_subscription_id) && !prevSubCanceled;

            const { data: actRes, error: actErr } = await supabaseAdmin.rpc("activate_subscription_from_payment", {
              p_user_id: intent.user_id,
              p_subscription_row_id: userSub.id,
              p_provider_payment_id: intent.provider_payment_id,
              p_kind: isFirstCharge ? "subscription_first_charge" : "subscription_renewal",
              p_amount_cents: Math.round((payment.value || 0) * 100),
              p_target_tier: resolvedTier,
              p_current_period_end: nextEnd.toISOString(),
              p_asaas_customer_id: null,
              p_asaas_subscription_id: null,
              p_clear_asaas_subscription: prevSubCanceled,
              p_asaas_sync_status: needsResync ? "pending_resync" : "synced",
              p_set_billing_start_at: isFirstCharge || isReactivation,
              p_billing_start_at: nowDate.toISOString(),
              p_trial_consumed_at: userSub.trial_consumed_at || nowDate.toISOString(),
              p_payment_method: "pix",
              p_intent_id: intent.id,
              p_metadata: { reconciled_by: "billing_lifecycle_cron", asaas_status: payment.status },
            });
            if (actErr) {
              console.error(`[billing-lifecycle-cron] Erro ao reconciliar PIX ${intent.id}:`, actErr);
              continue;
            }
            if (actRes?.terminal_intent) {
              await supabaseAdmin.from("audit_events").insert({
                user_id: intent.user_id,
                entity_type: "user_subscription",
                entity_id: userSub.id,
                action: "canceled_intent_payment_received",
                payload: {
                  payment_id: intent.provider_payment_id,
                  intent_id: actRes.intent_id ?? intent.id,
                  intent_kind: actRes.intent_kind ?? intent.kind,
                  intent_status: actRes.intent_status ?? "canceled",
                  value: payment.value ?? null,
                },
              });
              continue;
            }
            if (!actRes?.applied) {
              continue;
            }
          }

          await supabaseAdmin.from("audit_events").insert({
            user_id: intent.user_id,
            entity_type: "user_subscription",
            entity_id: userSub.id,
            action: "cron_reconciled_paid_pix",
            payload: { intent_id: intent.id, payment_id: intent.provider_payment_id, kind: intent.kind },
          });
          resyncedCount++;
          continue;
        }

        if (["PENDING", "OVERDUE"].includes(statusUpper)) {
          try {
            await deleteAsaasPayment(intent.provider_payment_id);
          } catch (delErr: unknown) {
            if (!isAsaasAlreadyCanceledError(delErr)) {
              throw delErr;
            }
          }
        }

        const { error: markErr } = await supabaseAdmin
          .from("billing_intents")
          .update(expirePayload)
          .eq("id", intent.id)
          .eq("status", "pending");
        if (!markErr) expiredPixIntents++;
      } catch (err: unknown) {
        if (isAsaasAlreadyCanceledError(err)) {
          const { error: markErr } = await supabaseAdmin
            .from("billing_intents")
            .update(expirePayload)
            .eq("id", intent.id)
            .eq("status", "pending");
          if (!markErr) expiredPixIntents++;
        } else {
          console.warn(
            `[billing-lifecycle-cron] Falha ao expirar intent PIX ${intent.id}:`,
            sanitizePaymentLog(err),
          );
        }
      }
    }

    // 2c. Reconciliação persistente de assinaturas anteriores que falharam ao cancelar no checkout
    const { data: resolvedPrevCancels } = await supabaseAdmin
      .from("audit_events")
      .select("payload")
      .eq("action", "previous_subscription_cancel_resolved")
      .order("created_at", { ascending: false })
      .limit(500);

    const resolvedEventIds = new Set<string>();
    const resolvedSubIds = new Set<string>();
    for (const r of resolvedPrevCancels || []) {
      const p = r.payload as Record<string, unknown> | null;
      if (typeof p?.source_event_id === "string" && p.source_event_id) {
        resolvedEventIds.add(p.source_event_id);
      }
      if (typeof p?.previous_subscription_id === "string" && p.previous_subscription_id) {
        resolvedSubIds.add(p.previous_subscription_id);
      }
    }

    let failedQuery = supabaseAdmin
      .from("audit_events")
      .select("id, user_id, entity_id, payload")
      .eq("action", "previous_subscription_cancel_failed")
      .order("created_at", { ascending: true });

    if (resolvedEventIds.size > 0) {
      failedQuery = failedQuery.not("id", "in", `(${Array.from(resolvedEventIds).join(",")})`);
    }

    const { data: failedPrevCancels } = await failedQuery.limit(20);

    for (const evt of failedPrevCancels || []) {
      const prevSubId = (evt.payload as Record<string, unknown> | null)?.previous_subscription_id;
      if (typeof prevSubId !== "string" || !prevSubId) continue;
      if (resolvedSubIds.has(prevSubId)) {
        await supabaseAdmin.from("audit_events").insert({
          user_id: evt.user_id,
          entity_type: "user_subscription",
          entity_id: evt.entity_id,
          action: "previous_subscription_cancel_resolved",
          payload: { previous_subscription_id: prevSubId, source_event_id: evt.id },
        });
        continue;
      }
      try {
        try {
          await cancelAsaasSubscription(prevSubId);
        } catch (cancelErr: unknown) {
          if (!isAsaasAlreadyCanceledError(cancelErr)) throw cancelErr;
        }
        await supabaseAdmin.from("audit_events").insert({
          user_id: evt.user_id,
          entity_type: "user_subscription",
          entity_id: evt.entity_id,
          action: "previous_subscription_cancel_resolved",
          payload: { previous_subscription_id: prevSubId, source_event_id: evt.id },
        });
        resolvedSubIds.add(prevSubId);
        resyncedCount++;
      } catch (retryErr: unknown) {
        console.warn(
          `[billing-lifecycle-cron] Falha ao retentar cancelamento da sub anterior ${prevSubId}:`,
          sanitizePaymentLog(retryErr),
        );
      }
    }

    // 2d. Reconciliação de locks 'processing' antigos de cartão (> 2 min)
    const staleCardCutoffIso = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: staleCardIntents } = await supabaseAdmin
      .from("billing_intents")
      .select("id, user_id, plan_id, amount_cents, provider_subscription_id, metadata")
      .eq("method", "credit_card")
      .eq("status", "processing")
      .lte("created_at", staleCardCutoffIso)
      .order("created_at", { ascending: true })
      .limit(15);

    for (const cardIntent of staleCardIntents || []) {
      try {
        let remoteSub: { id: string; status: string; deleted?: boolean } | null = null;
        if (cardIntent.provider_subscription_id) {
          try {
            remoteSub = await getAsaasSubscription(cardIntent.provider_subscription_id);
          } catch (getErr: unknown) {
            if (isAsaasAlreadyCanceledError(getErr) || (getErr as { status?: number })?.status === 404) {
              remoteSub = null;
            } else {
              throw getErr;
            }
          }
        } else {
          remoteSub = await findAsaasSubscriptionByExternalReference(cardIntent.id);
        }

        if (!remoteSub || remoteSub.deleted) {
          await supabaseAdmin
            .from("billing_intents")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
              metadata: {
                ...((cardIntent.metadata as Record<string, unknown> | null) || {}),
                reconciled_by: "lifecycle_cron",
                reason: "not_found_in_asaas",
              },
            })
            .eq("id", cardIntent.id)
            .eq("status", "processing");
          continue;
        }

        const subPayments = await getAsaasSubscriptionPayments(remoteSub.id);
        const paidPayment = subPayments.find((p) =>
          ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes((p.status || "").toUpperCase()),
        );

        if (paidPayment) {
          const resolvedTier = resolveTierFromPayment({
            value: paidPayment.value,
            billingType: "CREDIT_CARD",
          });
          const { data: userSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, user_id, tier, status, current_period_end, trial_ends_at, billing_start_at, trial_consumed_at")
            .eq("user_id", cardIntent.user_id)
            .maybeSingle();

          if (resolvedTier && userSub) {
            const nowDate = new Date();
            const baseDate =
              userSub.current_period_end && new Date(userSub.current_period_end) > nowDate
                ? new Date(userSub.current_period_end)
                : nowDate;
            const nextEnd = addCivilMonthsServer(baseDate, resolvedTier === "pro_annual" ? 12 : 1);
            const { data: cardActRes, error: cardActErr } = await supabaseAdmin.rpc("activate_subscription_from_payment", {
              p_user_id: cardIntent.user_id,
              p_subscription_row_id: userSub.id,
              p_provider_payment_id: paidPayment.id,
              p_kind: !userSub.billing_start_at || userSub.tier === "trial" ? "subscription_first_charge" : "subscription_renewal",
              p_amount_cents: Math.round((paidPayment.value || 0) * 100),
              p_target_tier: resolvedTier,
              p_current_period_end: nextEnd.toISOString(),
              p_asaas_customer_id: null,
              p_asaas_subscription_id: remoteSub.id,
              p_clear_asaas_subscription: false,
              p_asaas_sync_status: "synced",
              p_set_billing_start_at: !userSub.billing_start_at,
              p_billing_start_at: nowDate.toISOString(),
              p_trial_consumed_at: userSub.trial_consumed_at || nowDate.toISOString(),
              p_payment_method: "credit_card",
              p_intent_id: cardIntent.id,
              p_metadata: { reconciled_by: "billing_lifecycle_cron" },
            });
            if (cardActErr) {
              console.error(`[billing-lifecycle-cron] Erro na RPC ao reconciliar cartão ${cardIntent.id}:`, cardActErr);
              continue;
            }
            if (cardActRes?.terminal_intent) {
              await supabaseAdmin.from("audit_events").insert({
                user_id: cardIntent.user_id,
                entity_type: "user_subscription",
                entity_id: userSub.id,
                action: "canceled_intent_payment_received",
                payload: {
                  payment_id: paidPayment.id,
                  intent_id: cardActRes.intent_id ?? cardIntent.id,
                  intent_kind: cardActRes.intent_kind ?? "subscription_start",
                  intent_status: cardActRes.intent_status ?? "canceled",
                  value: paidPayment.value ?? null,
                },
              });
              continue;
            }
            if (cardActRes?.applied || cardActRes?.duplicate) {
              resyncedCount++;
            }
            continue;
          }
        }

        const { error: pendingErr } = await supabaseAdmin
          .from("billing_intents")
          .update({
            status: "pending",
            provider_subscription_id: remoteSub.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cardIntent.id)
          .eq("status", "processing");
        if (!pendingErr) {
          resyncedCount++;
        }
      } catch (cardRecErr: unknown) {
        console.warn(
          `[billing-lifecycle-cron] Falha ao reconciliar intent cartão ${cardIntent.id}:`,
          sanitizePaymentLog(cardRecErr),
        );
      }
    }

    // 3. Identifica trials prestes a expirar (janela segura de 28h: 48h a 76h antes do vencimento)
    const now = new Date();
    const windowStart = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 76 * 60 * 60 * 1000).toISOString();

    const { data: expiringTrials, error: expiringTrialsError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, user_id, trial_ends_at, profiles!inner(id, email, name, status)")
      .eq("tier", "trial")
      .eq("status", "trialing")
      .is("scheduled_plan_id", null)
      .eq("profiles.status", "active")
      .gte("trial_ends_at", windowStart)
      .lte("trial_ends_at", windowEnd);

    if (expiringTrialsError) {
      console.error("[billing-lifecycle-cron] Erro ao buscar trials prestes a expirar:", expiringTrialsError);
    }

    let remindersSent = 0;
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br").replace(/\/+$/, "");

    for (const sub of expiringTrials || []) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
      if (!profile?.email) continue;

      try {
        const trialEndDate = new Date(sub.trial_ends_at);
        const rawDaysRemaining = Math.ceil(
          (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );
        const daysRemaining = Math.max(1, Math.min(3, rawDaysRemaining));
        const trialEndsFormatted = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(trialEndDate);
        const emailData = renderTrialEndingReminderEmail({
          name: profile.name || "Cliente",
          daysRemaining,
          trialEndsFormatted,
          checkoutUrl: `${appUrl}/assinatura`,
        });

        const brtDateKey = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(trialEndDate);

        const result = await sendTransactionalEmail(supabaseAdmin, {
          to: profile.email,
          subject: emailData.subject,
          template: "trial_ending_reminder",
          html: emailData.html,
          text: emailData.text,
          userId: sub.user_id,
          idempotencyKey: `trial_ending_3d_${sub.user_id}_${brtDateKey}`,
        });

        if (result.success && !result.skipped) {
          remindersSent++;
        }
      } catch (err: unknown) {
        console.warn(`[billing-lifecycle-cron] Falha ao enviar lembrete para user ${sub.user_id}:`, sanitizePaymentLog(err));
      }
    }

    // 4. Notifica usuários cujo período de testes de 30 dias encerrou recentemente (últimas 48h)
    const expiredLookback = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentlyExpiredTrials, error: expiredTrialsError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, user_id, trial_ends_at, trial_consumed_at, profiles!inner(id, email, name, status)")
      .eq("tier", "read_only")
      .eq("status", "read_only_expired")
      .is("billing_start_at", null)
      .eq("profiles.status", "active")
      .gte("trial_ends_at", expiredLookback)
      .lte("trial_ends_at", now.toISOString());

    if (expiredTrialsError) {
      console.error("[billing-lifecycle-cron] Erro ao buscar trials recém-expirados:", expiredTrialsError);
    }

    let expiredNoticesSent = 0;
    for (const sub of recentlyExpiredTrials || []) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
      if (!profile?.email) continue;

      try {
        const emailData = renderTrialExpiredReadOnlyEmail({
          name: profile.name || "Cliente",
          reactivateUrl: `${appUrl}/assinatura`,
        });

        const brtEndKey = sub.trial_ends_at
          ? new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(sub.trial_ends_at))
          : "once";

        const result = await sendTransactionalEmail(supabaseAdmin, {
          to: profile.email,
          subject: emailData.subject,
          template: "trial_expired_read_only",
          html: emailData.html,
          text: emailData.text,
          userId: sub.user_id,
          idempotencyKey: `trial_expired_ro_${sub.user_id}_${brtEndKey}`,
        });

        if (result.success && !result.skipped) {
          expiredNoticesSent++;
        }
      } catch (err: unknown) {
        console.warn(`[billing-lifecycle-cron] Falha ao enviar aviso de trial expirado para user ${sub.user_id}:`, sanitizePaymentLog(err));
      }
    }

    // 4b. Lembretes semanais automáticos para assinaturas past_due com tolerância ativa
    const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: pastDueSubs, error: pastDueQueryErr } = await supabaseAdmin
      .from("user_subscriptions")
      .select(
        "id, user_id, tier, past_due_block_at, past_due_last_reminded_at, past_due_reminder_count, profiles!inner(id, email, name, status)",
      )
      .eq("status", "past_due")
      .eq("past_due_reminders_enabled", true)
      .eq("profiles.status", "active");

    if (pastDueQueryErr) {
      console.error("[billing-lifecycle-cron] Erro ao buscar assinaturas past_due:", pastDueQueryErr);
    }

    let pastDueRemindersSent = 0;
    const cronToken = cronSecret || supabaseServiceKey;
    for (const sub of pastDueSubs || []) {
      if (sub.past_due_block_at && new Date(sub.past_due_block_at) <= now) {
        continue;
      }
      if (sub.past_due_last_reminded_at && sub.past_due_last_reminded_at > sevenDaysAgoIso) {
        continue;
      }

      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
      if (!profile?.email) continue;

      try {
        const blockDateFormatted = sub.past_due_block_at
          ? formatBrtDisplayDate(sub.past_due_block_at)
          : null;
        const planName = sub.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal";
        const preset = blockDateFormatted ? "final_warning" : "friendly";
        const emailData = renderPastDueWeeklyReminderEmail({
          name: profile.name || "Cliente",
          planName,
          preset,
          blockDateFormatted,
          manageUrl: `${appUrl}/assinatura`,
        });

        const weekBucket = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
        const emailRes = await sendTransactionalEmail(supabaseAdmin, {
          to: profile.email,
          subject: emailData.subject,
          template: "past_due_weekly_reminder",
          html: emailData.html,
          text: emailData.text,
          userId: sub.user_id,
          idempotencyKey: `past_due_weekly_${sub.user_id}_${weekBucket}`,
        });

        if (emailRes.success && !emailRes.skipped) {
          pastDueRemindersSent++;
          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              past_due_last_reminded_at: now.toISOString(),
              past_due_reminder_count: (sub.past_due_reminder_count ?? 0) + 1,
              updated_at: now.toISOString(),
            })
            .eq("id", sub.id);

          // Push remoto complementar (fail-safe)
          try {
            await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cronToken}`,
              },
              body: JSON.stringify({
                eventType: "past_due_reminder",
                targetUserIds: [sub.user_id],
                title: "Pagamento pendente no Axir PRO",
                body: blockDateFormatted
                  ? `Regularize até ${blockDateFormatted} para manter seus lançamentos liberados.`
                  : "Seu pagamento está pendente. Atualize sua forma de pagamento quando puder.",
                url: "/assinatura",
                tag: `past_due_${sub.user_id}`,
                severity: "P1",
                idempotencyKey: `push_past_due_${sub.user_id}_${weekBucket}`,
                respectQuietHours: true,
              }),
            });
          } catch {
            // Não interrompe cron por falha de push
          }
        }
      } catch (err: unknown) {
        console.warn(
          `[billing-lifecycle-cron] Falha ao enviar lembrete semanal past_due para ${sub.user_id}:`,
          sanitizePaymentLog(err),
        );
      }
    }

    // 5. Rotina de TTL LGPD (D-18): expurga logs antigos de webhook (>90d) e e-mail (>180d)
    const webhookCutoffIso = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const emailCutoffIso = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();

    const { count: purgedWebhookLogs, error: webhookPurgeErr } = await supabaseAdmin
      .from("billing_webhook_logs")
      .delete({ count: "exact" })
      .lt("created_at", webhookCutoffIso);
    if (webhookPurgeErr) {
      console.warn("[billing-lifecycle-cron] Aviso ao expurgar billing_webhook_logs:", webhookPurgeErr);
    }

    const { count: purgedEmailLogs, error: emailPurgeErr } = await supabaseAdmin
      .from("transactional_email_logs")
      .delete({ count: "exact" })
      .lt("created_at", emailCutoffIso);
    if (emailPurgeErr) {
      console.warn("[billing-lifecycle-cron] Aviso ao expurgar transactional_email_logs:", emailPurgeErr);
    }

    return jsonResponse(req, {
      success: true,
      timestamp: new Date().toISOString(),
      reconciledSubscriptions: reconciledCount ?? 0,
      resyncedSubscriptions: resyncedCount,
      expiredPixIntents,
      expiringTrialsNotified: remindersSent,
      expiredTrialsNotified: expiredNoticesSent,
      pastDueRemindersSent,
      purgedWebhookLogs: purgedWebhookLogs ?? 0,
      purgedEmailLogs: purgedEmailLogs ?? 0,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro ao processar ciclo de vida de faturamento.", err);
  }
});
