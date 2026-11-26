import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  cancelAsaasSubscription,
  formatBrtDisplayDate,
  isAsaasAlreadyCanceledError,
  sanitizePaymentLog,
} from "../_shared/asaas.ts";
import {
  buildCorsHeaders,
  jsonResponse,
  maskEmailForLog,
  safeErrorResponse,
} from "../_shared/http.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";
import {
  renderPastDueWeeklyReminderEmail,
  type PastDueReminderPreset,
} from "../_shared/email-templates.ts";

interface ProvisionUserPayload {
  name: string;
  email: string;
  phone?: string | null;
  role?: "user" | "admin" | "superadmin";
  plan_id?: string;
  status?: "active" | "pending_approval";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Sessão não informada." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Ambiente Supabase incompleto.");
    }

    // 1. Validar autenticidade do operador chamador
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: callerUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !callerUser) {
      return jsonResponse(req, { error: "Sessão inválida ou expirada." }, 401);
    }

    // 2. Verificar se o chamador possui papel de SUPERADMIN
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, status")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return safeErrorResponse(req, 403, "Falha ao validar privilégios do operador.");
    }

    if (callerProfile.role !== "superadmin" || callerProfile.status !== "active") {
      return jsonResponse(
        req,
        { error: "Apenas superadministradores ativos possuem permissão para executar esta operação." },
        403,
      );
    }

    // 3. Exigir verificação MFA AAL2 caso o superadministrador possua fator TOTP ativo
    const { data: mfaData, error: mfaError } = await adminClient.auth.admin.mfa.listFactors({
      userId: callerUser.id,
    });
    if (mfaError) {
      return safeErrorResponse(req, 403, "Falha ao verificar fatores de autenticação (MFA).");
    }
    const hasVerifiedMfa = (mfaData?.factors ?? []).some(
      (f: { status?: string }) => f.status === "verified",
    );
    if (hasVerifiedMfa) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const payloadBase64 = token.split(".")[1] ?? "";
        const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        const jwtPayload = JSON.parse(atob(padded));
        if (jwtPayload?.aal !== "aal2") {
          return jsonResponse(
            req,
            { error: "Verificação de segundo fator (MFA/2FA AAL2) obrigatória para ações de Superadmin." },
            403,
          );
        }
      } catch {
        return jsonResponse(
          req,
          { error: "Não foi possível validar o nível de segurança MFA (AAL2) do token." },
          403,
        );
      }
    }

    const body = await req.json();
    const { action } = body;

    // -------------------------------------------------------------------------
    // AÇÃO 1: PROVISIONAR NOVO USUÁRIO COM LINK DE ATIVAÇÃO / DEFINIÇÃO DE SENHA
    // -------------------------------------------------------------------------
    if (action === "provision_user") {
      const payload = body as ProvisionUserPayload;
      const cleanEmail = (payload.email || "").trim().toLowerCase();
      const cleanName = (payload.name || "").trim();
      const cleanPhone = (payload.phone || "").trim() || null;
      const targetRole = payload.role === "admin" ? "admin" : "user";
      const targetStatus = payload.status === "pending_approval" ? "pending_approval" : "active";
      const planId = payload.plan_id || "trial";

      if (!cleanEmail || !cleanEmail.includes("@")) {
        return jsonResponse(req, { error: "E-mail inválido." }, 400);
      }
      if (!cleanName) {
        return jsonResponse(req, { error: "Nome completo é obrigatório." }, 400);
      }

      // 1. Tentar gerar link de convite (invite) ou criar usuário
      let targetUserId: string | null = null;
      let actionLink: string | null = null;

      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: cleanEmail,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
            phone: cleanPhone,
          },
        },
      });

      if (inviteError) {
        // Se o usuário já existe no Auth, tentar gerar link de recovery (redefinição/ativação)
        if (
          inviteError.message?.toLowerCase().includes("already registered") ||
          inviteError.message?.toLowerCase().includes("already exists")
        ) {
          const { data: recoveryData, error: recoveryError } =
            await adminClient.auth.admin.generateLink({
              type: "recovery",
              email: cleanEmail,
            });

          if (recoveryError || !recoveryData?.user) {
            return safeErrorResponse(req, 400, "Usuário já existe e não foi possível gerar link de acesso.");
          }

          targetUserId = recoveryData.user.id;
          actionLink = recoveryData.properties?.action_link ?? null;
        } else {
          return safeErrorResponse(req, 400, `Erro ao provisionar usuário: ${inviteError.message}`);
        }
      } else if (inviteData?.user) {
        targetUserId = inviteData.user.id;
        actionLink = inviteData.properties?.action_link ?? null;
      }

      if (!targetUserId) {
        return safeErrorResponse(req, 500, "Não foi possível obter identificador do usuário provisionado.");
      }

      // 2. Garantir metadados e papel em public.profiles
      await adminClient.from("profiles").upsert(
        {
          id: targetUserId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: targetRole,
          status: targetStatus,
          approved_at: targetStatus === "active" ? new Date().toISOString() : null,
          approved_by: targetStatus === "active" ? callerUser.id : null,
        },
        { onConflict: "id" },
      );

      // 3. Garantir assinatura inicial em public.user_subscriptions
      const isProPlan = planId.includes("pro") || planId.includes("annual") || planId.includes("monthly");
      const isLifetime = planId.includes("lifetime");
      const assignedTier = isLifetime ? "lifetime" : isProPlan ? (planId === "pro_monthly" ? "pro_monthly" : "pro_annual") : "trial";
      const resolvedPlanId = isLifetime ? "lifetime" : isProPlan ? (planId === "pro_monthly" ? "pro_monthly" : "pro_annual") : "trial";

      await adminClient.from("user_subscriptions").upsert(
        {
          user_id: targetUserId,
          plan_id: resolvedPlanId,
          tier: assignedTier,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      // 4. Trilha imutável de auditoria LGPD (D-18: sem PII em claro no payload)
      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "profiles",
        entity_id: targetUserId,
        action: "ADMIN_PROVISION_USER",
        payload: {
          provisioned_by: callerUser.id,
          target_user_id: targetUserId,
          email_masked: maskEmailForLog(cleanEmail),
          role: targetRole,
          plan_id: planId,
          status: targetStatus,
          has_action_link: Boolean(actionLink),
          timestamp: new Date().toISOString(),
        },
      });

      return jsonResponse(req, {
        success: true,
        userId: targetUserId,
        email: cleanEmail,
        actionLink,
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 2: GERAR LINK DE RECUPERAÇÃO / ACESSO EM 1 CLIQUE
    // -------------------------------------------------------------------------
    if (action === "generate_recovery_link") {
      const { email: targetEmail, target_user_id: targetUserId } = body;
      const cleanEmail = (targetEmail || "").trim().toLowerCase();

      if (!cleanEmail) {
        return jsonResponse(req, { error: "E-mail de destino é obrigatório." }, 400);
      }

      const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
      });

      if (recoveryError || !recoveryData?.properties?.action_link) {
        return safeErrorResponse(req, 400, "Falha ao gerar link de recuperação de acesso.");
      }

      const resolvedTargetId = targetUserId || recoveryData.user?.id || callerUser.id;
      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "profiles",
        entity_id: resolvedTargetId,
        action: "ADMIN_GENERATE_RECOVERY_LINK",
        payload: {
          generated_by: callerUser.id,
          target_user_id: resolvedTargetId,
          email_masked: maskEmailForLog(cleanEmail),
          timestamp: new Date().toISOString(),
        },
      });

      return jsonResponse(req, {
        success: true,
        actionLink: recoveryData.properties.action_link,
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 3: FORÇAR DESCONEXÃO / REVOGAÇÃO DE SESSÕES ATIVAS
    // -------------------------------------------------------------------------
    if (action === "revoke_sessions") {
      const { target_user_id: targetUserId } = body;
      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      const { error: signOutError } = await adminClient.auth.admin.signOut(targetUserId, "global");
      if (signOutError) {
        return safeErrorResponse(req, 400, `Falha ao encerrar sessões: ${signOutError.message}`);
      }

      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "profiles",
        entity_id: targetUserId,
        action: "ADMIN_REVOKE_SESSIONS",
        payload: {
          revoked_by: callerUser.id,
          target_user_id: targetUserId,
          scope: "global",
          timestamp: new Date().toISOString(),
        },
      });

      return jsonResponse(req, { success: true });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 4: RESETAR AUTENTICADOR 2FA/MFA EM 1 CLIQUE
    // -------------------------------------------------------------------------
    if (action === "reset_mfa") {
      const { target_user_id: targetUserId } = body;
      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      const { error: rpcError } = await userClient.rpc("admin_reset_user_mfa", {
        target_user_id: targetUserId,
      });

      if (rpcError) {
        return safeErrorResponse(req, 400, `Falha ao remover autenticador 2FA: ${rpcError.message}`);
      }

      return jsonResponse(req, { success: true });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 5: ATUALIZAR ASSINATURA / PLANO DO USUÁRIO (SUPERADMIN COM SEGURANÇA GATEWAY)
    // -------------------------------------------------------------------------
    if (action === "admin_update_subscription") {
      const {
        target_user_id: targetUserId,
        tier: targetTier,
        status: targetStatus,
        current_period_end: targetPeriodEnd,
        trial_ends_at: targetTrialEnds,
        cancel_at_period_end: targetCancelAtEnd,
        cancel_asaas: shouldCancelAsaas,
        notes,
      } = body;

      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      // 1. Busca a assinatura atual do usuário
      const { data: userSub, error: subError } = await adminClient
        .from("user_subscriptions")
        .select("id, user_id, tier, status, plan_id, asaas_subscription_id, current_period_end, trial_ends_at")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (subError) {
        return safeErrorResponse(req, 400, `Erro ao consultar assinatura: ${subError.message}`);
      }

      let asaasCanceled = false;
      const willBeLifetimeOrReadOnly = targetTier === "lifetime" || targetTier === "read_only" || targetStatus === "canceled";

      // 2. Se o usuário tinha assinatura ativa no Asaas e está sendo promovido para Lifetime,
      // cancelado ou se solicitado explicitamente, cancela no Asaas de forma fail-closed (D-01)
      if (userSub?.asaas_subscription_id && (willBeLifetimeOrReadOnly || shouldCancelAsaas)) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
          asaasCanceled = true;
        } catch (err: unknown) {
          if (isAsaasAlreadyCanceledError(err)) {
            asaasCanceled = true;
          } else {
            console.error(
              "[admin-super-action] Falha ao cancelar assinatura no Asaas ao atualizar para Lifetime/Cancelado:",
              sanitizePaymentLog(err),
            );
            return safeErrorResponse(
              req,
              502,
              "Não foi possível cancelar a assinatura recorrente no Asaas. Nenhuma alteração local foi aplicada.",
            );
          }
        }
      }

      // 3. Monta payload de atualização
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (targetTier) {
        updateData.tier = targetTier;
        updateData.plan_id = targetTier === "read_only" ? "trial" : targetTier;
      }
      if (targetStatus) {
        updateData.status = targetStatus;
      }
      if (targetPeriodEnd !== undefined) {
        updateData.current_period_end = targetPeriodEnd;
      }
      if (targetTrialEnds !== undefined) {
        updateData.trial_ends_at = targetTrialEnds;
      }
      if (targetCancelAtEnd !== undefined) {
        updateData.cancel_at_period_end = Boolean(targetCancelAtEnd);
      }
      if (asaasCanceled || (targetTier === "lifetime" && userSub?.asaas_subscription_id)) {
        updateData.asaas_subscription_id = null;
        updateData.scheduled_plan_id = null;
        updateData.scheduled_first_charge_at = null;
      }

      if (userSub) {
        const { error: subUpdateErr } = await adminClient
          .from("user_subscriptions")
          .update(updateData)
          .eq("user_id", targetUserId);
        if (subUpdateErr) {
          return safeErrorResponse(req, 500, "Falha ao atualizar assinatura do usuário.", subUpdateErr);
        }
      } else {
        const { error: subInsertErr } = await adminClient
          .from("user_subscriptions")
          .insert({
            user_id: targetUserId,
            plan_id: targetTier === "read_only" ? "trial" : targetTier || "lifetime",
            tier: targetTier || "lifetime",
            status: targetStatus || "active",
            current_period_end: targetPeriodEnd || null,
            trial_ends_at: targetTrialEnds || null,
            ...updateData,
          });
        if (subInsertErr) {
          return safeErrorResponse(req, 500, "Falha ao criar registro de assinatura do usuário.", subInsertErr);
        }
      }

      // 4. Trilha imutável de auditoria
      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "user_subscriptions",
        entity_id: userSub?.id || targetUserId,
        action: "ADMIN_UPDATE_SUBSCRIPTION",
        payload: {
          updated_by: callerUser.id,
          target_user_id: targetUserId,
          previous_tier: userSub?.tier,
          new_tier: targetTier || userSub?.tier,
          previous_status: userSub?.status,
          new_status: targetStatus || userSub?.status,
          asaas_subscription_canceled: asaasCanceled,
          notes: notes || null,
          timestamp: new Date().toISOString(),
        },
      });

      return jsonResponse(req, {
        success: true,
        asaasCanceled,
        message: "Assinatura do usuário atualizada com sucesso.",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 6: CONFIGURAR POLÍTICA DE TOLERÂNCIA PAST_DUE (MANUAL VS AUTO N DIAS)
    // -------------------------------------------------------------------------
    if (action === "set_past_due_policy") {
      const {
        target_user_id: targetUserId,
        grace_mode: graceMode,
        auto_block_days: autoBlockDays,
        reminders_enabled: remindersEnabled,
      } = body as {
        target_user_id?: string;
        grace_mode?: "manual" | "auto";
        auto_block_days?: number | null;
        reminders_enabled?: boolean;
      };

      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      const mode = graceMode === "auto" ? "auto" : "manual";
      const days =
        mode === "auto"
          ? Math.max(1, Math.min(90, Math.round(Number(autoBlockDays) || 7)))
          : null;
      const now = new Date();
      const nowIso = now.toISOString();
      const blockAtIso =
        mode === "auto" && days !== null
          ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const updateFields: Record<string, unknown> = {
        past_due_grace_mode: mode,
        past_due_block_at: blockAtIso,
        updated_at: nowIso,
      };
      if (typeof remindersEnabled === "boolean") {
        updateFields.past_due_reminders_enabled = remindersEnabled;
      }

      const { data: updated, error: updErr } = await adminClient
        .from("user_subscriptions")
        .update(updateFields)
        .eq("user_id", targetUserId)
        .eq("status", "past_due")
        .select("id, past_due_grace_mode, past_due_block_at, past_due_reminders_enabled")
        .maybeSingle();

      if (updErr) {
        return safeErrorResponse(req, 500, "Falha ao atualizar política de carência.", updErr);
      }
      if (!updated) {
        return jsonResponse(req, { error: "Assinatura em atraso não encontrada para este usuário." }, 404);
      }

      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "user_subscriptions",
        entity_id: updated.id,
        action: "ADMIN_SET_PAST_DUE_POLICY",
        payload: {
          target_user_id: targetUserId,
          grace_mode: mode,
          auto_block_days: days,
          past_due_block_at: blockAtIso,
          reminders_enabled: updated.past_due_reminders_enabled,
        },
      });

      return jsonResponse(req, {
        success: true,
        policy: updated,
        message:
          mode === "auto" && blockAtIso
            ? `Bloqueio automático agendado para ${formatBrtDisplayDate(blockAtIso)}.`
            : "Tolerância manual ativada (sem bloqueio automático).",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 7: FORÇAR BLOQUEIO IMEDIATO PARA SOMENTE-LEITURA (PAST_DUE -> READ_ONLY)
    // -------------------------------------------------------------------------
    if (action === "block_past_due_now") {
      const { target_user_id: targetUserId } = body as { target_user_id?: string };
      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      const nowIso = new Date().toISOString();
      const { data: blocked, error: blockErr } = await adminClient
        .from("user_subscriptions")
        .update({
          tier: "read_only",
          status: "read_only_expired",
          past_due_block_at: nowIso,
          past_due_reminders_enabled: false,
          updated_at: nowIso,
        })
        .eq("user_id", targetUserId)
        .eq("status", "past_due")
        .select("id")
        .maybeSingle();

      if (blockErr) {
        return safeErrorResponse(req, 500, "Falha ao bloquear assinatura em atraso.", blockErr);
      }
      if (!blocked) {
        return jsonResponse(req, { error: "Assinatura em atraso não encontrada." }, 404);
      }

      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "user_subscriptions",
        entity_id: blocked.id,
        action: "ADMIN_BLOCK_PAST_DUE_NOW",
        payload: { target_user_id: targetUserId, blocked_at: nowIso },
      });

      return jsonResponse(req, {
        success: true,
        message: "Conta movida imediatamente para o modo somente-leitura.",
      });
    }

    // -------------------------------------------------------------------------
    // AÇÃO 8: DISPARAR AVISO OFICIAL DO APP (TEMPLATE PRÉ-PRONTO) PARA INADIMPLENTE
    // -------------------------------------------------------------------------
    if (action === "send_past_due_reminder") {
      const { target_user_id: targetUserId, preset } = body as {
        target_user_id?: string;
        preset?: PastDueReminderPreset;
      };
      if (!targetUserId) {
        return jsonResponse(req, { error: "ID de usuário é obrigatório." }, 400);
      }

      const validPreset: PastDueReminderPreset =
        preset === "update_card" || preset === "final_warning" ? preset : "friendly";

      const { data: subRow, error: subFetchErr } = await adminClient
        .from("user_subscriptions")
        .select("id, tier, status, past_due_block_at, past_due_reminder_count")
        .eq("user_id", targetUserId)
        .eq("status", "past_due")
        .maybeSingle();

      if (subFetchErr || !subRow) {
        return jsonResponse(req, { error: "Assinatura em atraso não encontrada." }, 404);
      }

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("name, email")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!targetProfile?.email) {
        return jsonResponse(req, { error: "E-mail do usuário não localizado." }, 400);
      }

      const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br").replace(/\/+$/, "");
      const blockDateFormatted = subRow.past_due_block_at
        ? formatBrtDisplayDate(subRow.past_due_block_at)
        : null;
      const planName = subRow.tier === "pro_annual" ? "Plano Pro Anual" : "Plano Pro Mensal";

      const emailData = renderPastDueWeeklyReminderEmail({
        name: targetProfile.name || "Cliente",
        planName,
        preset: validPreset,
        blockDateFormatted,
        manageUrl: `${appUrl}/assinatura`,
      });

      const nowIso = new Date().toISOString();
      const emailRes = await sendTransactionalEmail(adminClient, {
        to: targetProfile.email,
        subject: emailData.subject,
        template: `past_due_admin_${validPreset}`,
        html: emailData.html,
        text: emailData.text,
        userId: targetUserId,
        idempotencyKey: `past_due_manual_${targetUserId}_${Date.now()}`,
      });

      if (!emailRes.success) {
        return safeErrorResponse(req, 502, emailRes.error || "Falha ao enviar e-mail de lembrete.");
      }

      await adminClient
        .from("user_subscriptions")
        .update({
          past_due_last_reminded_at: nowIso,
          past_due_reminder_count: (subRow.past_due_reminder_count ?? 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", subRow.id);

      const cronSecret = Deno.env.get("CRON_SECRET") || supabaseServiceKey;
      try {
        await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            eventType: "past_due_reminder",
            targetUserIds: [targetUserId],
            title: "Aviso de assinatura Axir PRO",
            body:
              validPreset === "final_warning" && blockDateFormatted
                ? `Regularize até ${blockDateFormatted} para evitar pausa nos lançamentos.`
                : "Identificamos pendência na sua assinatura. Clique para regularizar.",
            url: "/assinatura",
            tag: `past_due_${targetUserId}`,
            severity: validPreset === "final_warning" ? "P0" : "P1",
            idempotencyKey: `push_past_due_manual_${targetUserId}_${Date.now()}`,
            respectQuietHours: false,
          }),
        });
      } catch {
        // Falha de push não bloqueia o envio oficial por e-mail
      }

      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "user_subscriptions",
        entity_id: subRow.id,
        action: "ADMIN_SEND_PAST_DUE_REMINDER",
        payload: { target_user_id: targetUserId, preset: validPreset },
      });

      return jsonResponse(req, {
        success: true,
        message: "Aviso oficial do aplicativo enviado com sucesso.",
      });
    }

    return jsonResponse(req, { error: "Ação não reconhecida." }, 400);
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro interno ao processar operação de superadmin.", err);
  }
});
