import { createClient } from "jsr:@supabase/supabase-js@2";
import { cancelAsaasSubscription } from "../_shared/asaas.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

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
          updated_at: new Date().toISOString(),
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

      // 4. Trilha imutável de auditoria LGPD
      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "profiles",
        entity_id: targetUserId,
        action: "ADMIN_PROVISION_USER",
        payload: {
          provisioned_by: callerUser.id,
          target_user_id: targetUserId,
          email: cleanEmail,
          name: cleanName,
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

      await adminClient.from("audit_events").insert({
        user_id: callerUser.id,
        entity_type: "profiles",
        entity_id: targetUserId || recoveryData.user?.id || callerUser.id,
        action: "ADMIN_GENERATE_RECOVERY_LINK",
        payload: {
          generated_by: callerUser.id,
          email: cleanEmail,
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

      const { error: rpcError } = await adminClient.rpc("admin_reset_user_mfa", {
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
      // cancelado ou se solicitado explicitamente, cancela no Asaas prevenindo cobrança fantasma
      if (userSub?.asaas_subscription_id && (willBeLifetimeOrReadOnly || shouldCancelAsaas)) {
        try {
          await cancelAsaasSubscription(userSub.asaas_subscription_id);
          asaasCanceled = true;
        } catch (err: unknown) {
          console.warn("[admin-super-action] Falha ao cancelar assinatura no Asaas ao atualizar para Lifetime/Cancelado:", err);
        }
      }

      // 3. Monta payload de atualização
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (targetTier) {
        updateData.tier = targetTier;
        updateData.plan_id = targetTier;
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
        await adminClient
          .from("user_subscriptions")
          .update(updateData)
          .eq("user_id", targetUserId);
      } else {
        await adminClient
          .from("user_subscriptions")
          .insert({
            user_id: targetUserId,
            plan_id: targetTier || "lifetime",
            tier: targetTier || "lifetime",
            status: targetStatus || "active",
            current_period_end: targetPeriodEnd || null,
            trial_ends_at: targetTrialEnds || null,
            ...updateData,
          });
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

    return jsonResponse(req, { error: "Ação não reconhecida." }, 400);
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro interno ao processar operação de superadmin.", err);
  }
});
