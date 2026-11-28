import { describe, expect, it } from "vitest";
import {
  adminAiUsageSummarySchema,
  adminConnectionsHealthSchema,
  adminRetentionRadarSchema,
  adminSetSubscriptionSchema,
  adminUserSupportDiagnosticsSchema,
  createModularInviteSchema,
} from "./schemas";

describe("admin Zod schemas", () => {
  it("deve validar payload correto de criação de convite modular", () => {
    const valid = {
      code: "VIP-INVEST",
      target_tier: "lifetime",
      custom_trial_days: null,
      max_uses: 5,
      target_email: "vip@gmail.com",
      notes: "Concessão vitalícia para beta tester",
      module_grants: { investments: "write", debts: "read" },
    };

    const parsed = createModularInviteSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("deve rejeitar código de convite inválido ou curto", () => {
    const invalid = {
      code: "AB",
    };

    const parsed = createModularInviteSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("deve validar payload de alteração de assinatura de usuário", () => {
    const valid = {
      userId: "123e4567-e89b-12d3-a456-426614174000",
      planId: "pro_annual",
      tier: "pro_annual",
      status: "active",
    };

    const parsed = adminSetSubscriptionSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("deve sanitizar tags HTML e caracteres de controle nas notas do convite", () => {
    const withHtml = {
      code: "VIP-SECURE",
      notes: "<b>Concessão</b> <script>alert(1)</script>especial\u0000",
    };

    const parsed = createModularInviteSchema.safeParse(withHtml);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toBe("Concessão alert(1)especial");
    }
  });

  it("deve validar adminConnectionsHealthSchema e rejeitar status inválido", () => {
    const valid = {
      supabase_db: { status: "ok", checked_at: "2026-11-28T00:00:00Z" },
      asaas: { last_event_at: "2026-11-28T00:00:00Z", events_24h: 12, failures_24h: 0 },
      resend: { last_event_at: null, sent_7d: 40, failed_7d: 1 },
      quotes: { last_fetched_at: "2026-11-28T00:00:00Z", api_count: 15, fallback_count: 2 },
      ai_gemini: { active_quota_users: 8, cache_entries: 120, current_month: "2026-11" },
      push: { active_subscriptions: 30 },
      telegram: {
        silent_mode: false,
        notify_support: true,
        notify_new_users: false,
        updated_at: "2026-11-28T00:00:00Z",
      },
    };

    expect(adminConnectionsHealthSchema.safeParse(valid).success).toBe(true);
    expect(
      adminConnectionsHealthSchema.safeParse({
        ...valid,
        supabase_db: { status: "error", checked_at: "2026-11-28T00:00:00Z" },
      }).success,
    ).toBe(false);
  });

  it("deve validar adminAiUsageSummarySchema com coerção de total_count e rejeitar contagem negativa", () => {
    const valid = [
      {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Ana",
        email: "ana@example.com",
        tier: "pro_monthly",
        sub_status: "active",
        period_month: "2026-11",
        period_day: "2026-11-28",
        receipt_calls_month: 5,
        receipt_calls_day: 1,
        batch_calls_month: 2,
        batch_calls_day: 0,
        updated_at: "2026-11-28T00:00:00Z",
        total_count: "1",
      },
    ];

    const parsed = adminAiUsageSummarySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data[0]?.total_count).toBe(1);
    }

    expect(
      adminAiUsageSummarySchema.safeParse([{
        ...valid[0],
        receipt_calls_month: -1,
      }]).success,
    ).toBe(false);
  });

  it("deve validar adminUserSupportDiagnosticsSchema com e sem cota de IA", () => {
    const valid = {
      devices: [
        {
          platform: "Android",
          app_version: "3.0.15",
          device_label: "Pixel 8",
          last_seen_at: "2026-11-28T00:00:00Z",
        },
      ],
      push_count: 2,
      last_push_at: "2026-11-28T00:00:00Z",
      ai_quota: null,
    };

    expect(adminUserSupportDiagnosticsSchema.safeParse(valid).success).toBe(true);
    expect(
      adminUserSupportDiagnosticsSchema.safeParse({
        ...valid,
        push_count: -3,
      }).success,
    ).toBe(false);
  });

  it("deve validar adminRetentionRadarSchema e rejeitar risk_kind desconhecido", () => {
    const valid = [
      {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Carlos",
        email: "carlos@example.com",
        tier: "pro_annual",
        sub_status: "past_due",
        risk_kind: "past_due_with_ticket",
        last_seen_at: null,
        created_at: "2026-10-01T00:00:00Z",
      },
    ];

    expect(adminRetentionRadarSchema.safeParse(valid).success).toBe(true);
    expect(
      adminRetentionRadarSchema.safeParse([{
        ...valid[0],
        risk_kind: "unknown_risk",
      }]).success,
    ).toBe(false);
  });
});
