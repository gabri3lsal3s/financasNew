import { z } from "zod";
import { SUBSCRIPTION_TIERS } from "@/types/subscription";
import { cleanTextSchema } from "@/domain/validation/sanitization";

export const createModularInviteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "O código deve ter pelo menos 3 caracteres.")
    .max(50, "O código não pode ultrapassar 50 caracteres.")
    .regex(/^[A-Za-z0-9_-]+$/, "Código contém caracteres inválidos."),
  target_tier: z.enum(SUBSCRIPTION_TIERS).default("trial"),
  custom_trial_days: z.number().int().positive("Número de dias deve ser positivo.").nullable().optional(),
  max_uses: z.number().int().positive("Limite de usos deve ser pelo menos 1.").default(1),
  expires_at: z.string().datetime().nullable().optional(),
  target_email: z.string().trim().email("E-mail inválido.").nullable().optional().or(z.literal("")),
  notes: cleanTextSchema(500).nullable().optional(),
  module_grants: z.record(z.string(), z.enum(["none", "read", "write", "admin"])).default({}),
});

export type CreateModularInviteInput = z.infer<typeof createModularInviteSchema>;

export const adminSetSubscriptionSchema = z.object({
  userId: z.string().uuid("ID de usuário inválido."),
  planId: z.string().min(1, "Plano obrigatório."),
  tier: z.enum(SUBSCRIPTION_TIERS),
  status: z.enum(["trialing", "active", "past_due", "canceled", "read_only_expired"]),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
});

export type AdminSetSubscriptionInput = z.infer<typeof adminSetSubscriptionSchema>;

export const ADMIN_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "read_only_expired",
] as const;

export const ADMIN_RETENTION_RISK_KINDS = [
  "paid_inactive_21d",
  "trial_stalled_72h",
  "past_due_with_ticket",
] as const;

export const adminConnectionsHealthSchema = z.object({
  supabase_db: z.object({
    status: z.literal("ok"),
    checked_at: z.string(),
  }),
  asaas: z.object({
    last_event_at: z.string().nullable(),
    events_24h: z.number().int().nonnegative(),
    failures_24h: z.number().int().nonnegative(),
  }),
  resend: z.object({
    last_event_at: z.string().nullable(),
    sent_7d: z.number().int().nonnegative(),
    failed_7d: z.number().int().nonnegative(),
  }),
  quotes: z.object({
    last_fetched_at: z.string().nullable(),
    api_count: z.number().int().nonnegative(),
    fallback_count: z.number().int().nonnegative(),
  }),
  ai_gemini: z.object({
    active_quota_users: z.number().int().nonnegative(),
    cache_entries: z.number().int().nonnegative(),
    current_month: z.string(),
  }),
  push: z.object({
    active_subscriptions: z.number().int().nonnegative(),
  }),
  telegram: z.object({
    silent_mode: z.boolean(),
    notify_support: z.boolean(),
    notify_new_users: z.boolean(),
    updated_at: z.string().nullable(),
  }),
});

export const adminAiUsageRowSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  tier: z.enum(SUBSCRIPTION_TIERS).nullable(),
  sub_status: z.enum(ADMIN_SUBSCRIPTION_STATUSES).nullable(),
  period_month: z.string(),
  period_day: z.string(),
  receipt_calls_month: z.number().int().nonnegative(),
  receipt_calls_day: z.number().int().nonnegative(),
  batch_calls_month: z.number().int().nonnegative(),
  batch_calls_day: z.number().int().nonnegative(),
  updated_at: z.string(),
  total_count: z.coerce.number().int().nonnegative(),
});

export const adminAiUsageSummarySchema = z.array(adminAiUsageRowSchema);

export const adminUserSupportDiagnosticsSchema = z.object({
  devices: z.array(
    z.object({
      platform: z.string().nullable(),
      app_version: z.string().nullable(),
      device_label: z.string().nullable(),
      last_seen_at: z.string(),
    }),
  ),
  push_count: z.number().int().nonnegative(),
  last_push_at: z.string().nullable(),
  ai_quota: z
    .object({
      period_month: z.string(),
      period_day: z.string(),
      receipt_calls_month: z.number().int().nonnegative(),
      receipt_calls_day: z.number().int().nonnegative(),
      batch_calls_month: z.number().int().nonnegative(),
      batch_calls_day: z.number().int().nonnegative(),
      updated_at: z.string(),
    })
    .nullable(),
});

export const adminRetentionRadarRowSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  tier: z.enum(SUBSCRIPTION_TIERS),
  sub_status: z.enum(ADMIN_SUBSCRIPTION_STATUSES),
  risk_kind: z.enum(ADMIN_RETENTION_RISK_KINDS),
  last_seen_at: z.string().nullable(),
  created_at: z.string(),
});

export const adminRetentionRadarSchema = z.array(adminRetentionRadarRowSchema);
