import type { SubscriptionTier } from "./subscription";

export type AdminSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "read_only_expired";

export interface AdminConnectionsHealth {
  supabase_db: {
    status: "ok";
    checked_at: string;
  };
  asaas: {
    last_event_at: string | null;
    events_24h: number;
    failures_24h: number;
  };
  resend: {
    last_event_at: string | null;
    sent_7d: number;
    failed_7d: number;
  };
  quotes: {
    last_fetched_at: string | null;
    api_count: number;
    fallback_count: number;
  };
  ai_gemini: {
    active_quota_users: number;
    cache_entries: number;
    current_month: string;
  };
  push: {
    active_subscriptions: number;
  };
  telegram: {
    silent_mode: boolean;
    notify_support: boolean;
    notify_new_users: boolean;
    updated_at: string | null;
  };
}

export interface AdminAiUsageRow {
  user_id: string;
  name: string | null;
  email: string | null;
  tier: SubscriptionTier | null;
  sub_status: AdminSubscriptionStatus | null;
  period_month: string;
  period_day: string;
  receipt_calls_month: number;
  receipt_calls_day: number;
  batch_calls_month: number;
  batch_calls_day: number;
  updated_at: string;
  total_count: number;
}

export interface AdminSupportDiagnosticDevice {
  platform: string | null;
  app_version: string | null;
  device_label: string | null;
  last_seen_at: string;
}

export interface AdminSupportDiagnosticAiQuota {
  period_month: string;
  period_day: string;
  receipt_calls_month: number;
  receipt_calls_day: number;
  batch_calls_month: number;
  batch_calls_day: number;
  updated_at: string;
}

export interface AdminUserSupportDiagnostics {
  devices: AdminSupportDiagnosticDevice[];
  push_count: number;
  last_push_at: string | null;
  ai_quota: AdminSupportDiagnosticAiQuota | null;
}

export type AdminRetentionRiskKind =
  | "paid_inactive_21d"
  | "trial_stalled_72h"
  | "past_due_with_ticket";

export interface AdminRetentionRadarRow {
  user_id: string;
  name: string | null;
  email: string | null;
  tier: SubscriptionTier;
  sub_status: AdminSubscriptionStatus;
  risk_kind: AdminRetentionRiskKind;
  last_seen_at: string | null;
  created_at: string;
}
