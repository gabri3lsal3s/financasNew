import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  getAsaasSubscription,
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
            .eq("id", sub.id);
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
