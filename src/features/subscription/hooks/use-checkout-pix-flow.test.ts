import { describe, expect, it, vi } from "vitest";

vi.mock("@/state", () => ({
  INVOICES_KEY: ["invoices"],
  USER_SUBSCRIPTION_KEY: ["user-subscription"],
}));

import { hasPixUpgradeConfirmed } from "./use-checkout-pix-flow";

describe("hasPixUpgradeConfirmed (A-02)", () => {
  it("detecta ativação inicial de não-Pro para Pro", () => {
    expect(
      hasPixUpgradeConfirmed(
        { isPro: false, tier: "trial", currentPeriodEnd: null },
        { isPro: true, tier: "pro_annual", currentPeriodEnd: "2027-11-24T00:00:00Z" },
        "annual",
      ),
    ).toBe(true);
  });

  it("não confirma prematuramente quando usuário já é pro_monthly e gera PIX anual", () => {
    expect(
      hasPixUpgradeConfirmed(
        { isPro: true, tier: "pro_monthly", currentPeriodEnd: "2026-12-24T00:00:00Z" },
        { isPro: true, tier: "pro_monthly", currentPeriodEnd: "2026-12-24T00:00:00Z" },
        "annual",
      ),
    ).toBe(false);
  });

  it("confirma upgrade Mensal -> Anual quando tier muda para pro_annual ou currentPeriodEnd avança", () => {
    expect(
      hasPixUpgradeConfirmed(
        { isPro: true, tier: "pro_monthly", currentPeriodEnd: "2026-12-24T00:00:00Z" },
        { isPro: true, tier: "pro_annual", currentPeriodEnd: "2026-12-24T00:00:00Z" },
        "annual",
      ),
    ).toBe(true);

    expect(
      hasPixUpgradeConfirmed(
        { isPro: true, tier: "pro_monthly", currentPeriodEnd: "2026-12-24T00:00:00Z" },
        { isPro: true, tier: "pro_monthly", currentPeriodEnd: "2027-12-24T00:00:00Z" },
        "annual",
      ),
    ).toBe(true);
  });
});
