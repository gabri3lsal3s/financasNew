import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getAsaasSubscription,
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
  renderTrialEndingReminderEmail,
  renderTrialExpiredReadOnlyEmail,
} from "../_shared/email-templates.ts";
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
      .select("id, user_id, asaas_subscription_id, current_period_end, status, tier")
      .eq("asaas_sync_status", "pending_resync")
      .not("asaas_subscription_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(10);

    for (const sub of pendingSubscriptions || []) {
      if (!sub.asaas_subscription_id) continue;
      try {
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
      purgedWebhookLogs: purgedWebhookLogs ?? 0,
      purgedEmailLogs: purgedEmailLogs ?? 0,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro ao processar ciclo de vida de faturamento.", err);
  }
});
