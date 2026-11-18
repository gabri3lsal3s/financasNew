import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAsaasSubscription, postponeAsaasSubscriptionAfterPrepayment } from "../_shared/asaas.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import { renderTrialEndingReminderEmail } from "../_shared/email-templates.ts";

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
    const isAuthorized =
      (token.length > 0 && token === supabaseServiceKey) ||
      (Boolean(cronSecret) && token === cronSecret);

    if (!isAuthorized) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Executa reconciliação de períodos expirados no banco de dados
    const { data: reconciledCount, error: rpcError } = await supabaseAdmin.rpc("reconcile_expired_subscriptions");
    if (rpcError) {
      console.error("[billing-lifecycle-cron] Erro ao executar reconcile_expired_subscriptions:", rpcError);
    }

    // 2. Reconciliação de assinaturas em estado pending_resync com a API do Asaas
    let resyncedCount = 0;
    const { data: pendingSubscriptions } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, user_id, asaas_subscription_id, current_period_end, status, tier")
      .eq("asaas_sync_status", "pending_resync")
      .not("asaas_subscription_id", "is", null)
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
          const newStatus = isAsaasActive ? "active" : "canceled";
          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              status: newStatus,
              asaas_sync_status: "synced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
          resyncedCount++;
        } else {
          console.warn(`[billing-lifecycle-cron] Adiamento no Asaas pendente de retentativa para sub ${sub.id}`);
        }
      } catch (err: unknown) {
        console.warn(`[billing-lifecycle-cron] Falha ao sincronizar sub ${sub.id}:`, err);
      }
    }

    // 3. Identifica trials prestes a expirar em 3 dias e dispara lembretes via Resend
    const now = new Date();
    const threeDaysAheadStart = new Date(now.getTime() + 70 * 60 * 60 * 1000).toISOString();
    const threeDaysAheadEnd = new Date(now.getTime() + 74 * 60 * 60 * 1000).toISOString();

    const { data: expiringTrials } = await supabaseAdmin
      .from("user_subscriptions")
      .select("id, user_id, trial_ends_at, profiles(id, email, name)")
      .eq("tier", "trial")
      .gte("trial_ends_at", threeDaysAheadStart)
      .lte("trial_ends_at", threeDaysAheadEnd);

    let remindersSent = 0;
    const appUrl = Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br";

    for (const sub of expiringTrials || []) {
      const profile = Array.isArray(sub.profiles) ? sub.profiles[0] : sub.profiles;
      if (!profile?.email) continue;

      try {
        const trialEndDate = new Date(sub.trial_ends_at);
        const emailData = renderTrialEndingReminderEmail({
          name: profile.name || "Cliente",
          daysRemaining: 3,
          trialEndsFormatted: trialEndDate.toLocaleDateString("pt-BR"),
          checkoutUrl: `${appUrl}/assinatura`,
        });

        const result = await sendTransactionalEmail(supabaseAdmin, {
          to: profile.email,
          subject: emailData.subject,
          template: "trial_ending_reminder",
          html: emailData.html,
          text: emailData.text,
          userId: sub.user_id,
          idempotencyKey: `trial_ending_3d_${sub.user_id}_${trialEndDate.toISOString().slice(0, 10)}`,
        });

        if (result.success && !result.skipped) {
          remindersSent++;
        }
      } catch (err: unknown) {
        console.warn(`[billing-lifecycle-cron] Falha ao enviar lembrete para user ${sub.user_id}:`, err);
      }
    }

    return jsonResponse(req, {
      success: true,
      timestamp: new Date().toISOString(),
      reconciledSubscriptions: reconciledCount ?? 0,
      resyncedSubscriptions: resyncedCount,
      expiringTrialsNotified: remindersSent,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro ao processar ciclo de vida de faturamento.", err);
  }
});
