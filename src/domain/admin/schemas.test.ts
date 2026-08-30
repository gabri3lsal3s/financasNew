import { describe, expect, it } from "vitest";
import { adminSetSubscriptionSchema, createModularInviteSchema } from "./schemas";

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
});
