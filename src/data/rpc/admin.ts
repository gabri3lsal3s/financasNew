import { z } from "zod";
import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { callRpc, unwrapRpc, type RpcResult } from "./client";
import type {
  AdminContactDetails,
  AdminPastDueSubscriptionRow,
  BroadcastAudience,
  BroadcastType,
  UserBroadcastNotification,
  AdminConnectionsHealth,
  AdminAiUsageRow,
  AdminUserSupportDiagnostics,
  AdminRetentionRadarRow,
  AdminBillingOverview,
} from "@/types";
import {
  adminConnectionsHealthSchema,
  adminAiUsageSummarySchema,
  adminUserSupportDiagnosticsSchema,
  adminRetentionRadarSchema,
} from "@/domain/admin/schemas";

/**
 * Consulta o mapa de funcionalidades ativas/resolvidas para o usuário atual.
 */
export async function getMyFeatures(): Promise<Record<string, boolean>> {
  return unwrapRpc(callRpc("get_my_features", {}));
}

export interface AdminListUsersParams {
  search?: string | null;
  status?: string | null;
  role?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  suspended_reason: string | null;
  is_test?: boolean;
  deleted_at?: string | null;
  total_count: number;
}

/**
 * Lista usuários para o painel administrativo com paginação e filtros.
 */
export async function adminListUsers(params: AdminListUsersParams = {}): Promise<AdminUserRow[]> {
  return unwrapRpc(
    callRpc("admin_list_users", {
      p_search: params.search ?? null,
      p_status: params.status ?? null,
      p_role: params.role ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    }),
  );
}

/**
 * Altera o status da conta de um usuário (Aprovação, Suspensão, Banimento, Reativação).
 */
export async function adminUpdateUserStatus(params: {
  userId: string;
  status: string;
  reason?: string | null;
  approvedBy?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_update_user_status", {
      p_user_id: params.userId,
      p_status: params.status,
      p_reason: params.reason ?? null,
    }),
    true,
  );
}

/**
 * Altera o papel / role de um usuário (Superadmin only).
 */
export async function adminSetUserRole(params: {
  userId: string;
  role: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_role", {
      p_user_id: params.userId,
      p_role: params.role,
    }),
    true,
  );
}

/**
 * Aplica um override personalizado de feature flag para um usuário.
 */
export async function adminSetFeatureOverride(params: {
  userId: string;
  featureKey: string;
  enabled: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_enabled: params.enabled,
    }),
    true,
  );
}

/**
 * Remove o override de feature flag de um usuário (revertendo ao padrão global).
 */
export async function adminRemoveFeatureOverride(params: {
  userId: string;
  featureKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
    }),
    true,
  );
}

/**
 * Alterna a ativação global de uma funcionalidade (Kill-Switch).
 */
export async function adminToggleGlobalFeature(params: {
  featureKey: string;
  enabled: boolean;
  reason?: string | null;
}): Promise<void> {
  const args = {
    p_feature_key: params.featureKey,
    p_enabled: params.enabled,
    ...(params.reason === undefined ? {} : { p_reason: params.reason }),
  };

  await unwrapRpc(callRpc("admin_toggle_global_feature", args), true);
}

const globalFeatureImpactSchema = z.object({
  active_users_total: z.number().int().nonnegative(),
  explicit_overrides_count: z.number().int().nonnegative(),
});

export async function adminPreviewGlobalFeatureImpact(featureKey: string) {
  // A função pode preceder a atualização dos tipos gerados do Supabase.
  const response = await (getSupabase().rpc(
    "admin_preview_global_feature_impact" as never,
    { p_feature_key: featureKey } as never,
  ) as unknown as PromiseLike<RpcResult<unknown>>);

  if (z.object({ code: z.literal("PGRST202") }).safeParse(response.error).success) {
    return null;
  }

  return globalFeatureImpactSchema.parse(await unwrapRpc(Promise.resolve(response)));
}

/**
 * Cria um novo convite de acesso na allowlist.
 */
export async function adminCreateInvite(params: {
  code: string;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_invite", {
      p_code: params.code,
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
    }),
  );
}

/**
 * Revoga um convite de acesso.
 */
export async function adminRevokeInvite(params: { inviteId: string }): Promise<void> {
  await unwrapRpc(
    callRpc("admin_revoke_invite", {
      p_invite_id: params.inviteId,
    }),
    true,
  );
}

export interface AdminMetricsResult {
  total_users: number;
  active_users: number;
  pending_users: number;
  suspended_users: number;
  test_or_internal_users?: number;
  quarantined_users?: number;
  total_invites: number;
  used_invites: number;
}

/**
 * Obtém métricas executivas do SaaS para a aba de Visão Geral.
 */
export async function adminGetMetrics(): Promise<AdminMetricsResult> {
  return unwrapRpc(callRpc("admin_get_metrics", {}));
}

/**
 * Consulta agregada de status da assinatura e permissões do usuário autenticado.
 */
export async function getMySubscription(): Promise<{
  id?: string;
  tier: string;
  status: string;
  billing_phase?: string | null;
  plan_id: string;
  starts_at: string;
  trial_started_at?: string | null;
  trial_ends_at: string | null;
  trial_consumed_at?: string | null;
  trial_days_remaining: number | null;
  has_used_trial?: boolean;
  billing_start_at?: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  scheduled_plan_id?: string | null;
  scheduled_first_charge_at?: string | null;
  pending_plan_id?: string | null;
  pending_plan_effective_at?: string | null;
  payment_method?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  asaas_subscription_id?: string | null;
  asaas_sync_status?: string | null;
  has_card_registered?: boolean;
  has_auto_renew?: boolean;
  is_full_access: boolean;
  is_trial: boolean;
  is_pro: boolean;
  is_lifetime: boolean;
  is_read_only: boolean;
  can_write: boolean;
  module_permissions: Record<string, string>;
} | null> {
  return unwrapRpc(callRpc("get_my_subscription", {}), true);
}

/**
 * Consulta segura de PII de contato para pré-preenchimento de faturamento/cartão do próprio usuário (D-02).
 */
export async function getMyBillingContact() {
  return unwrapRpc(callRpc("get_my_billing_contact", {}), true);
}

/**
 * Superadmin ou Admin altera o plano/tier/status da assinatura de um usuário.
 */
export async function adminSetUserSubscription(params: {
  userId: string;
  planId: string;
  tier: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_subscription", {
      p_user_id: params.userId,
      p_plan_id: params.planId,
      p_tier: params.tier,
      p_status: params.status,
      p_trial_ends_at: params.trialEndsAt ?? null,
      p_current_period_end: params.currentPeriodEnd ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin define override de permissão por módulo para um usuário.
 */
export async function adminSetUserModulePermission(params: {
  userId: string;
  moduleKey: string;
  accessLevel: string;
  expiresAt?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
      p_access_level: params.accessLevel,
      p_expires_at: params.expiresAt ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin remove override de permissão de módulo para um usuário.
 */
export async function adminRemoveUserModulePermission(params: {
  userId: string;
  moduleKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
    }),
    true,
  );
}

/**
 * Criação de convite avançado com preset de plano e matriz de módulos.
 */
export async function adminCreateModularInvite(params: {
  code: string;
  targetTier?: string;
  customTrialDays?: number | null;
  moduleGrants?: Record<string, string>;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
  notes?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_modular_invite", {
      p_code: params.code,
      p_target_tier: params.targetTier ?? "trial",
      p_custom_trial_days: params.customTrialDays ?? null,
      p_module_grants: params.moduleGrants ?? {},
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
      p_notes: params.notes ?? null,
    }),
  );
}

/**
 * Exclui a conta do usuário autenticado e todos os seus dados em ordem topológica reversa (LGPD Art. 18, VI).
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  await unwrapRpc(callRpc("delete_current_user_account", {}), true);
}

/**
 * Alias de retrocompatibilidade para deleteCurrentUserAccount().
 */
export async function deleteOwnAccount(): Promise<void> {
  return deleteCurrentUserAccount();
}

export type AdminStepUpOperation =
  | "delete_user"
  | "quarantine_user"
  | "restore_user"
  | "reset_mfa"
  | "revoke_sessions";

export interface AdminStepUpChallenge {
  challengeId: string;
  stepUpToken: string;
  operation: AdminStepUpOperation;
  targetRef: string;
  expiresAt: string;
}

/**
 * Emite um desafio de step-up de uso único (validade de 5 minutos) vinculado à operação e ao alvo.
 */
export async function issueAdminStepUpChallenge(
  operation: AdminStepUpOperation,
  targetRef: string,
): Promise<AdminStepUpChallenge> {
  const { data, error } = await resolveQuery<{
    challenge_id: string;
    step_up_token: string;
    operation: AdminStepUpOperation;
    target_ref: string;
    expires_at: string;
  }>(
    getSupabase().rpc(
      "admin_issue_step_up_challenge" as never,
      { p_operation: operation, p_target_ref: targetRef } as never,
    ),
  );

  if (error || !data?.step_up_token) {
    const classified = classifyError(error ?? new Error("Falha ao emitir desafio step-up."));
    throw new AppError(classified.kind, classified.message, error);
  }

  return {
    challengeId: data.challenge_id,
    stepUpToken: data.step_up_token,
    operation: data.operation,
    targetRef: data.target_ref,
    expiresAt: data.expires_at,
  };
}

async function extractAdminSuperActionError(
  data: unknown,
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (error && typeof error === "object" && "context" in error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof ctx === "object" && "json" in ctx && typeof (ctx as Response).json === "function") {
      try {
        const res = ctx as Response;
        const body = (await (typeof res.clone === "function" ? res.clone() : res).json()) as {
          error?: unknown;
          message?: unknown;
        } | null;
        if (body && typeof body.error === "string" && body.error.trim()) {
          return body.error;
        }
        if (body && typeof body.message === "string" && body.message.trim()) {
          return body.message;
        }
      } catch {
        // Ignora falha ao ler corpo JSON da resposta
      }
    }
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * Superadmin exclui definitivamente um usuário e todos os seus dados do sistema via Edge Function segura.
 */
export async function adminDeleteUser(params: { targetUserId: string }): Promise<void> {
  const challenge = await issueAdminStepUpChallenge("delete_user", params.targetUserId);
  const { data, error } = await getSupabase().functions.invoke("admin-super-action", {
    body: {
      action: "delete_user",
      target_user_id: params.targetUserId,
      step_up_token: challenge.stepUpToken,
    },
  });

  if (error || !data?.success) {
    const message = await extractAdminSuperActionError(
      data,
      error,
      "Falha ao excluir usuário definitivamente.",
    );
    throw new AppError("network", message, error ?? data);
  }
}

/**
 * Coloca um usuário em quarentena (soft-delete + bloqueio imediato) via Edge Function segura.
 */
export async function adminQuarantineUser(params: {
  targetUserId: string;
  reason?: string | null;
}): Promise<void> {
  const challenge = await issueAdminStepUpChallenge("quarantine_user", params.targetUserId);
  const { data, error } = await getSupabase().functions.invoke("admin-super-action", {
    body: {
      action: "quarantine_user",
      target_user_id: params.targetUserId,
      reason: params.reason ?? null,
      step_up_token: challenge.stepUpToken,
    },
  });

  if (error || !data?.success) {
    const message = await extractAdminSuperActionError(
      data,
      error,
      "Falha ao colocar usuário em quarentena.",
    );
    throw new AppError("network", message, error ?? data);
  }
}

/**
 * Restaura um usuário que estava em quarentena via Edge Function segura.
 */
export async function adminRestoreUser(params: { targetUserId: string }): Promise<void> {
  const challenge = await issueAdminStepUpChallenge("restore_user", params.targetUserId);
  const { data, error } = await getSupabase().functions.invoke("admin-super-action", {
    body: {
      action: "restore_user",
      target_user_id: params.targetUserId,
      step_up_token: challenge.stepUpToken,
    },
  });

  if (error || !data?.success) {
    const message = await extractAdminSuperActionError(
      data,
      error,
      "Falha ao restaurar usuário da quarentena.",
    );
    throw new AppError("network", message, error ?? data);
  }
}

/**
 * Marca ou desmarca uma conta como conta de teste/interna para higiene de métricas.
 */
export async function adminSetUserTestFlag(params: {
  userId: string;
  isTest: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_test_flag" as never, {
      p_user_id: params.userId,
      p_is_test: params.isTest,
    } as never),
    true,
  );
}

/**
 * Obtém a visão consolidada de faturamento real e assinaturas do painel administrativo.
 */
export async function adminGetBillingOverview(): Promise<AdminBillingOverview> {
  return unwrapRpc(callRpc("admin_get_billing_overview" as never, {} as never));
}

/**
 * Consulta auditada dos dados de contato de um usuário pelo Administrador (LGPD Art. 18).
 */
export async function adminGetUserContactDetails(userId: string): Promise<AdminContactDetails> {
  return unwrapRpc(
    callRpc("admin_get_user_contact_details" as never, {
      p_user_id: userId,
    } as never),
  );
}

/**
 * Envia uma notificação administrativa de broadcast / push direto aos clientes.
 */
export async function adminSendBroadcastNotification(params: {
  title: string;
  message: string;
  type?: BroadcastType;
  actionUrl?: string | null;
  targetAudience?: BroadcastAudience;
  targetUserIds?: string[] | null;
  expiresAt?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_send_broadcast_notification" as never, {
      p_title: params.title,
      p_message: params.message,
      p_type: params.type ?? "info",
      p_action_url: params.actionUrl ?? null,
      p_target_audience: params.targetAudience ?? "all",
      p_target_user_ids: params.targetUserIds ?? null,
      p_expires_at: params.expiresAt ?? null,
    } as never),
  );
}

/**
 * Consulta as notificações de broadcast ativas e relevantes para o usuário autenticado.
 */
export async function getMyBroadcastNotifications(limit = 20): Promise<UserBroadcastNotification[]> {
  const result = await unwrapRpc(
    callRpc("get_my_broadcast_notifications" as never, {
      p_limit: limit,
    } as never),
  );
  return (result ?? []) as UserBroadcastNotification[];
}

/**
 * Marca uma notificação broadcast como lida pelo usuário.
 */
export async function markBroadcastAsRead(notificationId: string): Promise<void> {
  await unwrapRpc(
    callRpc("mark_broadcast_as_read" as never, {
      p_notification_id: notificationId,
    } as never),
    true,
  );
}

/**
 * Dispensa permanentemente uma notificação broadcast do feed do usuário.
 */
export async function dismissBroadcastNotification(notificationId: string): Promise<void> {
  await unwrapRpc(
    callRpc("dismiss_broadcast_notification" as never, {
      p_notification_id: notificationId,
    } as never),
    true,
  );
}

/**
 * Registra um snapshot/backup do sistema pelo Administrador.
 */
export async function adminLogSystemBackup(params: {
  backupType?: "manual" | "scheduled" | "pre_migration";
  tableCount?: number;
  recordCount?: number;
  fileSizeBytes?: number;
  checksumSha256?: string;
  status?: "in_progress" | "completed" | "failed";
  notes?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_log_system_backup" as never, {
      p_backup_type: params.backupType ?? "manual",
      p_table_count: params.tableCount ?? 0,
      p_record_count: params.recordCount ?? 0,
      p_file_size_bytes: params.fileSizeBytes ?? 0,
      p_checksum_sha256: params.checksumSha256 ?? "",
      p_status: params.status ?? "completed",
      p_notes: params.notes ?? null,
    } as never),
  );
}

/**
 * Lista todas as assinaturas em atraso (past_due) para gestão de carência no Admin.
 */
export async function adminListPastDueSubscriptions(): Promise<AdminPastDueSubscriptionRow[]> {
  return unwrapRpc(
    callRpc("admin_list_past_due_subscriptions" as never, {} as never),
  ) as Promise<AdminPastDueSubscriptionRow[]>;
}

/**
 * Consulta passiva da saúde das conexões e integrações do sistema (sem chamadas externas).
 */
export async function adminGetConnectionsHealth(): Promise<AdminConnectionsHealth> {
  const raw = await unwrapRpc(
    callRpc("admin_get_connections_health" as never, {} as never),
  );
  return adminConnectionsHealthSchema.parse(raw);
}

export interface AdminAiUsageSummaryParams {
  periodMonth?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Lista paginada do consumo de IA por usuário no mês de referência.
 */
export async function adminGetAiUsageSummary(
  params: AdminAiUsageSummaryParams = {},
): Promise<AdminAiUsageRow[]> {
  const raw = await unwrapRpc(
    callRpc("admin_get_ai_usage_summary" as never, {
      p_period_month: params.periodMonth ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    } as never),
  );
  return adminAiUsageSummarySchema.parse(raw ?? []);
}

/**
 * Consulta diagnósticos passivos de suporte de um usuário (dispositivos, push e cota de IA).
 */
export async function adminGetUserSupportDiagnostics(
  userId: string,
): Promise<AdminUserSupportDiagnostics> {
  const raw = await unwrapRpc(
    callRpc("admin_get_user_support_diagnostics" as never, {
      p_user_id: userId,
    } as never),
  );
  return adminUserSupportDiagnosticsSchema.parse(raw);
}

/**
 * Lista usuários em risco de retenção cruzando assinaturas, dispositivos e tickets.
 */
export async function adminGetRetentionRadar(
  limit = 20,
): Promise<AdminRetentionRadarRow[]> {
  const raw = await unwrapRpc(
    callRpc("admin_get_retention_radar" as never, {
      p_limit: limit,
    } as never),
  );
  return adminRetentionRadarSchema.parse(raw ?? []);
}

const periodMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const nonNegativeCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const dbCents = nonNegativeCount.max(2_147_483_647);
const finopsParamsInputSchema = z.object({
  period_month: periodMonthSchema,
  asaas_pix_fee_cents: dbCents,
  asaas_card_percent_bps: nonNegativeCount.max(10_000),
  ai_receipt_unit_cost_cents: dbCents,
  ai_batch_unit_cost_cents: dbCents,
  fixed_infra_cents: dbCents,
  notes: z.string().trim().nullable(),
});

const finopsParamsSchema = finopsParamsInputSchema.extend({
  updated_by: z.string().uuid().nullable(),
  updated_at: z.string().nullable(),
  configured: z.boolean(),
});

const billingFinopsOverviewSchema = z.object({
  period_month: periodMonthSchema,
  timezone: z.literal("America/Bahia"),
  window_start: z.string(),
  window_end: z.string(),
  params: finopsParamsSchema,
  payments: z.object({
    payments_count: nonNegativeCount,
    gross_revenue_cents: nonNegativeCount,
    pix_count: nonNegativeCount,
    pix_revenue_cents: nonNegativeCount,
    card_count: nonNegativeCount,
    card_revenue_cents: nonNegativeCount,
    other_count: nonNegativeCount,
  }),
  webhooks: z.object({ events_count: nonNegativeCount, failures_count: nonNegativeCount }),
  ai_quotas: z.object({
    active_users_count: nonNegativeCount,
    total_receipt_calls: nonNegativeCount,
    total_batch_calls: nonNegativeCount,
  }),
  emails: z.object({ sent_count: nonNegativeCount, failed_count: nonNegativeCount }),
});

const resetAiQuotaInputSchema = z.object({
  userId: z.string().uuid(),
  bucket: z.enum(["receipt_calls", "batch_calls", "all"]),
  reason: z.string().trim().min(3),
});

const resetAiQuotaResultSchema = z.object({
  user_id: z.string().uuid(),
  period_month: periodMonthSchema,
  bucket: resetAiQuotaInputSchema.shape.bucket,
  reset_applied: z.boolean(),
  receipt_calls_month: nonNegativeCount,
  receipt_calls_day: nonNegativeCount,
  batch_calls_month: nonNegativeCount,
  batch_calls_day: nonNegativeCount,
});

export type AdminFinopsParamsInput = z.input<typeof finopsParamsInputSchema>;
export type AdminFinopsParams = z.output<typeof finopsParamsSchema>;
export type AdminBillingFinopsOverview = z.output<typeof billingFinopsOverviewSchema>;
export type AdminResetAiQuotaInput = z.input<typeof resetAiQuotaInputSchema>;
export type AdminResetAiQuotaResult = z.output<typeof resetAiQuotaResultSchema>;

export async function adminGetFinopsMonthlyParams(periodMonth?: string): Promise<AdminFinopsParams> {
  const period = periodMonthSchema.optional().parse(periodMonth);
  const raw = await unwrapRpc(
    callRpc("admin_get_finops_monthly_params" as never, { p_period_month: period ?? null } as never),
  );
  return finopsParamsSchema.parse(raw);
}

export async function adminUpsertFinopsMonthlyParams(
  input: AdminFinopsParamsInput,
): Promise<AdminFinopsParams> {
  const params = finopsParamsInputSchema.parse(input);
  const raw = await unwrapRpc(
    callRpc("admin_upsert_finops_monthly_params" as never, {
      p_period_month: params.period_month,
      p_asaas_pix_fee_cents: params.asaas_pix_fee_cents,
      p_asaas_card_percent_bps: params.asaas_card_percent_bps,
      p_ai_receipt_unit_cost_cents: params.ai_receipt_unit_cost_cents,
      p_ai_batch_unit_cost_cents: params.ai_batch_unit_cost_cents,
      p_fixed_infra_cents: params.fixed_infra_cents,
      p_notes: params.notes,
    } as never),
  );
  return finopsParamsSchema.parse(raw);
}

export async function adminGetBillingFinopsOverview(
  periodMonth?: string,
): Promise<AdminBillingFinopsOverview> {
  const period = periodMonthSchema.optional().parse(periodMonth);
  const raw = await unwrapRpc(
    callRpc("admin_get_billing_finops_overview" as never, { p_period_month: period ?? null } as never),
  );
  return billingFinopsOverviewSchema.parse(raw);
}

export async function adminResetUserAiQuota(
  input: AdminResetAiQuotaInput,
): Promise<AdminResetAiQuotaResult> {
  const params = resetAiQuotaInputSchema.parse(input);
  const raw = await unwrapRpc(
    callRpc("admin_reset_user_ai_quota" as never, {
      p_user_id: params.userId,
      p_bucket: params.bucket,
      p_reason: params.reason,
    } as never),
  );
  return resetAiQuotaResultSchema.parse(raw);
}
