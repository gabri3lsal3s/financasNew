import { describe, expect, it } from "vitest";
import {
  calculateAccountVariableCostCents,
  calculateEstimatedMrrCents,
  calculateFinOpsOverview,
  calculateNetRevenueCents,
  type FinOpsMonthlyParams,
} from "./unit-economics";

const BASE_PARAMS: FinOpsMonthlyParams = {
  periodMonth: "2026-11",
  asaasPixFeeCents: 199,
  asaasCardPercentBps: 299,
  aiReceiptUnitCostCents: 2,
  aiBatchUnitCostCents: 5,
  fixedInfraCents: 1000,
  confidence: "estimated",
};

describe("unit-economics", () => {
  it("calcula MRR normalizando plano anual por 12 e excluindo trial, lifetime, read_only e inativos", () => {
    const mrr = calculateEstimatedMrrCents([
      { userId: "u1", tier: "pro_monthly", status: "active", monthlyPriceCents: 2990 },
      { userId: "u2", tier: "pro_annual", status: "active", annualPriceCents: 24000 },
      { userId: "u3", tier: "trial", status: "trialing", monthlyPriceCents: 2990 },
      { userId: "u4", tier: "lifetime", status: "active", amountCents: 49900 },
      { userId: "u5", tier: "read_only", status: "read_only_expired", monthlyPriceCents: 2990 },
      { userId: "u6", tier: "pro_monthly", status: "canceled", monthlyPriceCents: 2990 },
      { userId: "u7", tier: "pro_annual", status: "past_due", annualPriceCents: 24000 },
    ]);

    expect(mrr).toBe(2990 + 2000);
  });

  it("calcula receita líquida com taxas Pix/Cartão e sinaliza ausência de taxa ou dados como estimado", () => {
    const measured = calculateNetRevenueCents(
      [
        { amountCents: 2990, paymentMethod: "pix", explicitFeeCents: 150 },
        { amountCents: 10000, paymentMethod: "card", explicitFeeCents: 310 },
      ],
      BASE_PARAMS,
    );
    expect(measured).toEqual({
      grossRevenueCents: 12990,
      gatewayFeesCents: 460,
      netRevenueCents: 12530,
      isEstimated: false,
    });

    const missingFees = calculateNetRevenueCents(
      [
        { amountCents: 2990, paymentMethod: "pix" },
        { amountCents: 10000, paymentMethod: "card" },
        { amountCents: 5000, paymentMethod: "unknown" },
      ],
      { asaasPixFeeCents: null, asaasCardPercentBps: null },
    );
    expect(missingFees).toEqual({
      grossRevenueCents: 17990,
      gatewayFeesCents: 0,
      netRevenueCents: 17990,
      isEstimated: true,
    });
  });

  it("calcula custo variável de IA por conta", () => {
    const cost = calculateAccountVariableCostCents(
      { receiptCallsMonth: 12, batchCallsMonth: 3 },
      BASE_PARAMS,
    );
    expect(cost).toBe(12 * 2 + 3 * 5);
  });

  it("distribui resíduo determinístico em centavos no rateio de custo fixo e calcula margem por conta", () => {
    const overview = calculateFinOpsOverview({
      params: {
        ...BASE_PARAMS,
        fixedInfraCents: 100,
      },
      subscriptions: [
        { userId: "u-c", tier: "pro_monthly", status: "active", monthlyPriceCents: 2990 },
        { userId: "u-a", tier: "pro_annual", status: "active", annualPriceCents: 24000 },
      ],
      payments: [
        { userId: "u-a", amountCents: 2000, paymentMethod: "pix", explicitFeeCents: 199 },
        { userId: "u-c", amountCents: 2990, paymentMethod: "card", explicitFeeCents: 90 },
      ],
      accounts: [
        {
          userId: "u-c",
          receiptCallsMonth: 10,
          batchCallsMonth: 1,
          grossRevenueCents: 2990,
          gatewayFeesCents: 90,
        },
        {
          userId: "u-a",
          receiptCallsMonth: 5,
          batchCallsMonth: 0,
          grossRevenueCents: 2000,
          gatewayFeesCents: 199,
        },
        {
          userId: "u-b",
          receiptCallsMonth: 0,
          batchCallsMonth: 2,
          grossRevenueCents: 0,
          gatewayFeesCents: 0,
        },
      ],
    });

    expect(overview.allocatedFixedInfraCents).toBe(100);
    expect(overview.accountMargins.map((item) => item.userId)).toEqual(["u-a", "u-b", "u-c"]);
    expect(overview.accountMargins.map((item) => item.allocatedFixedCostCents)).toEqual([34, 33, 33]);

    const [accountA, accountB] = overview.accountMargins;
    if (!accountA || !accountB) throw new Error("expected account margins");
    expect(accountA.aiVariableCostCents).toBe(10);
    expect(accountA.totalCostCents).toBe(199 + 10 + 34);
    expect(accountA.netProfitCents).toBe(2000 - 243);
    expect(accountA.marginBps).toBe(Math.round(((2000 - 243) * 10_000) / 2000));

    expect(accountB.grossRevenueCents).toBe(0);
    expect(accountB.netProfitCents).toBe(-(10 + 33));
    expect(accountB.marginBps).toBeNull();

    expect(overview.grossRevenueCents).toBe(4990);
    expect(overview.gatewayFeesCents).toBe(289);
    expect(overview.aiVariableCostCents).toBe(10 + 10 + 25);
    expect(overview.totalCostCents).toBe(289 + 45 + 100);
    expect(overview.estimatedNetProfitCents).toBe(4990 - 434);
  });

  it("trata denominador zero no rateio quando não há contas ativas ou dados", () => {
    const overview = calculateFinOpsOverview({
      params: {
        periodMonth: "2026-11",
        asaasPixFeeCents: null,
        asaasCardPercentBps: null,
        aiReceiptUnitCostCents: null,
        aiBatchUnitCostCents: null,
        fixedInfraCents: 500,
        confidence: "no_data",
      },
      subscriptions: [],
      payments: [],
      accounts: [],
    });

    expect(overview.activeAccountsCount).toBe(0);
    expect(overview.allocatedFixedInfraCents).toBe(0);
    expect(overview.fixedInfraCents).toBe(500);
    expect(overview.estimatedNetProfitCents).toBe(-500);
    expect(overview.marginBps).toBeNull();
    expect(overview.accountMargins).toEqual([]);
    expect(overview.isEstimated).toBe(true);
  });
});
