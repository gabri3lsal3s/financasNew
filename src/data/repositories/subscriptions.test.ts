import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminCreateModularInvite,
  adminRemoveUserModulePermission,
  adminSetUserModulePermission,
  adminSetUserSubscription,
  getMySubscription,
  getPlans,
} from "./subscriptions";

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  getMySubscription: vi.fn(),
  adminSetUserSubscription: vi.fn(),
  adminSetUserModulePermission: vi.fn(),
  adminRemoveUserModulePermission: vi.fn(),
  adminCreateModularInvite: vi.fn(),
}));

import { getSupabase } from "@/data/client";
import {
  adminCreateModularInvite as adminCreateModularInviteRpc,
  adminRemoveUserModulePermission as adminRemoveUserModulePermissionRpc,
  adminSetUserModulePermission as adminSetUserModulePermissionRpc,
  adminSetUserSubscription as adminSetUserSubscriptionRpc,
  getMySubscription as getMySubscriptionRpc,
} from "@/data/rpc";

describe("subscriptions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar planos do sistema via getPlans", async () => {
    const mockPlans = [
      { id: "pro_monthly", name: "Pro Mensal", price_cents: 1990 },
      { id: "pro_annual", name: "Pro Anual", price_cents: 17880 },
    ];

    const mockSelect = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockPlans, error: null }),
    });

    vi.mocked(getSupabase).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as never);

    const plans = await getPlans();
    expect(plans).toEqual(mockPlans);
  });

  it("deve mapear status de assinatura corretamente via getMySubscription", async () => {
    vi.mocked(getMySubscriptionRpc).mockResolvedValue({
      tier: "lifetime",
      status: "active",
      plan_id: "lifetime",
      starts_at: "2026-01-01T00:00:00Z",
      trial_ends_at: null,
      current_period_end: null,
      trial_days_remaining: null,
      cancel_at_period_end: false,
      is_full_access: true,
      is_trial: false,
      is_pro: false,
      is_lifetime: true,
      is_read_only: false,
      can_write: true,
      module_permissions: { investments: "write", debts: "read" },
    });

    const sub = await getMySubscription();
    expect(sub).not.toBeNull();
    expect(sub?.tier).toBe("lifetime");
    expect(sub?.isLifetime).toBe(true);
    expect(sub?.canWrite).toBe(true);
    expect(sub?.moduleAccess?.investments).toBe("write");
  });

  it("deve delegar mutações administrativas para os RPCs corretos", async () => {
    vi.mocked(adminSetUserSubscriptionRpc).mockResolvedValue();
    vi.mocked(adminSetUserModulePermissionRpc).mockResolvedValue();
    vi.mocked(adminRemoveUserModulePermissionRpc).mockResolvedValue();
    vi.mocked(adminCreateModularInviteRpc).mockResolvedValue("inv-123");

    await adminSetUserSubscription({
      userId: "u-1",
      planId: "lifetime",
      tier: "lifetime",
      status: "active",
    });
    expect(adminSetUserSubscriptionRpc).toHaveBeenCalledWith({
      userId: "u-1",
      planId: "lifetime",
      tier: "lifetime",
      status: "active",
    });

    await adminSetUserModulePermission({
      userId: "u-1",
      moduleKey: "investments",
      accessLevel: "write",
    });
    expect(adminSetUserModulePermissionRpc).toHaveBeenCalledWith({
      userId: "u-1",
      moduleKey: "investments",
      accessLevel: "write",
    });

    await adminRemoveUserModulePermission({
      userId: "u-1",
      moduleKey: "investments",
    });
    expect(adminRemoveUserModulePermissionRpc).toHaveBeenCalledWith({
      userId: "u-1",
      moduleKey: "investments",
    });

    const inviteId = await adminCreateModularInvite({
      code: "VIP-INVEST",
      targetTier: "lifetime",
      moduleGrants: { investments: "write" },
    });
    expect(inviteId).toBe("inv-123");
    expect(adminCreateModularInviteRpc).toHaveBeenCalledWith({
      code: "VIP-INVEST",
      targetTier: "lifetime",
      moduleGrants: { investments: "write" },
    });
  });
});
