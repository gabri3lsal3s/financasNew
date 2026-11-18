import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import {
  calculateFixedIncomeRedemptionPreview,
  computeEffectiveTaxRateFromAmount,
  getFixedIncomeCurrentGrossBalance,
  getFixedIncomeRedemptionInfo,
  resolveFixedIncomeAppliedCost,
} from "./fixed-income-redemption-preview";

const baseTesouroAsset: PortfolioAsset = {
  id: "rf-tesouro",
  user_id: "user-1",
  ticker: "Tesouro Selic 2029",
  asset_class: "Tesouro Direto",
  currency: "BRL",
  quantity: 1,
  average_price: 1426.79,
  fixed_income_metadata: {
    base_value: 1653.17,
    base_date: "2026-09-02",
    initial_investment_value: 1426.79,
    initial_investment_date: "2024-01-01",
    rate_type: "selic",
    rate_value: 100,
    is_tax_exempt: false,
  },
};

describe("fixed-income-redemption-preview", () => {
  it("resolveFixedIncomeAppliedCost prioriza initial_investment_value e suporta posições sem metadata", () => {
    expect(resolveFixedIncomeAppliedCost(baseTesouroAsset)).toBe(1426.79);
    expect(
      resolveFixedIncomeAppliedCost({
        ...baseTesouroAsset,
        quantity: 1,
        average_price: 5000,
        fixed_income_metadata: null,
      }),
    ).toBe(5000);
    expect(resolveFixedIncomeAppliedCost(null)).toBe(0);
  });

  it("aplica tabela regressiva (15% > 720 dias) e calcula resgate líquido", () => {
    const info = getFixedIncomeRedemptionInfo(baseTesouroAsset, "2026-09-02");
    expect(info.appliedCost).toBe(1426.79);
    expect(info.grossValue).toBe(1653.17);
    expect(info.taxRatePct).toBe(15);
    expect(info.iofAmount).toBe(0);
    expect(info.taxAmount).toBeCloseTo(33.96, 2);
    expect(info.netValue).toBeCloseTo(1619.21, 2);
  });

  it("aplica IOF regressivo para resgates com menos de 30 dias corridos", () => {
    const shortTermCdb: PortfolioAsset = {
      id: "cdb-curto",
      user_id: "user-1",
      ticker: "CDB Liquidez",
      asset_class: "Renda Fixa",
      currency: "BRL",
      quantity: 1,
      average_price: 10000,
      fixed_income_metadata: {
        base_value: 10000,
        base_date: "2026-08-01",
        initial_investment_value: 10000,
        initial_investment_date: "2026-08-01",
        rate_type: "cdi",
        rate_value: 100,
        is_tax_exempt: false,
      },
    };

    const preview = calculateFixedIncomeRedemptionPreview({
      asset: shortTermCdb,
      withdrawGross: getFixedIncomeCurrentGrossBalance(shortTermCdb, "2026-08-11"),
      date: "2026-08-11", // 10 dias corridos -> IOF 66%, IR 22.5%
    });

    expect(preview).not.toBeNull();
    expect(preview?.calendarDaysTotal).toBe(10);
    expect(preview?.iofRatePct).toBe(66);
    expect(preview?.taxRatePct).toBe(22.5);
    expect(preview?.iofAmount).toBeGreaterThan(0);
    expect(preview?.taxAmount).toBeGreaterThan(0);
    expect(preview?.netCredit).toBeLessThan(preview?.grossAmount ?? 0);
  });

  it("mantém isenção de IR e IOF para LCI/LCA/CRI/CRA", () => {
    const lciAsset: PortfolioAsset = {
      ...baseTesouroAsset,
      ticker: "LCI 95% CDI",
      asset_class: "Renda Fixa",
      fixed_income_metadata: {
        ...baseTesouroAsset.fixed_income_metadata!,
        initial_investment_date: "2026-08-01",
        base_date: "2026-08-01",
        is_tax_exempt: true,
      },
    };

    const preview = calculateFixedIncomeRedemptionPreview({
      asset: lciAsset,
      withdrawGross: 1653.17,
      date: "2026-08-11",
    });

    expect(preview?.isExempt).toBe(true);
    expect(preview?.taxRatePct).toBe(0);
    expect(preview?.taxAmount).toBe(0);
    expect(preview?.iofAmount).toBe(0);
    expect(preview?.netCredit).toBe(1653.17);
  });

  it("respeita ajuste manual de valor de IRRF e recalcula alíquota efetiva", () => {
    const preview = calculateFixedIncomeRedemptionPreview({
      asset: baseTesouroAsset,
      withdrawGross: 1653.17,
      date: "2026-09-02",
      appliedCostOverride: 1426.79,
      customTaxAmount: 42.67,
    });

    expect(preview).not.toBeNull();
    expect(preview?.realizedProfit).toBe(226.38);
    expect(preview?.taxAmount).toBe(42.67);
    expect(preview?.taxRatePct).toBe(computeEffectiveTaxRateFromAmount(42.67, 226.38));
    expect(preview?.netCredit).toBe(1610.5);
    expect(preview?.isCustomized).toBe(true);
    expect(preview?.isFullRedemption).toBe(true);
    expect(preview?.remainingGrossBalance).toBe(0);
    expect(preview?.remainingCostBasis).toBe(0);
  });

  it("respeita alíquota manual customizada (ex: 20% ou Isento 0%)", () => {
    const preview20 = calculateFixedIncomeRedemptionPreview({
      asset: baseTesouroAsset,
      withdrawGross: 1653.17,
      date: "2026-09-02",
      customTaxRatePct: 20,
    });
    expect(preview20?.taxRatePct).toBe(20);
    expect(preview20?.taxAmount).toBe(45.28); // 20% de 226.38
    expect(preview20?.isCustomized).toBe(true);

    const previewZero = calculateFixedIncomeRedemptionPreview({
      asset: baseTesouroAsset,
      withdrawGross: 1653.17,
      date: "2026-09-02",
      customTaxRatePct: 0,
    });
    expect(previewZero?.taxAmount).toBe(0);
    expect(previewZero?.netCredit).toBe(1653.17);
  });

  it("calcula resgate parcial preservando saldo bruto e custo residual proporcionais", () => {
    const ipcaAsset: PortfolioAsset = {
      ...baseTesouroAsset,
      average_price: 8000,
      fixed_income_metadata: {
        base_value: 9000,
        base_date: "2026-08-26",
        initial_investment_value: 8000,
        initial_investment_date: "2024-01-01",
        rate_type: "ipca",
        rate_value: 6,
        is_tax_exempt: false,
      },
    };

    const preview = calculateFixedIncomeRedemptionPreview({
      asset: ipcaAsset,
      withdrawGross: 1600,
      date: "2026-08-26",
    });

    expect(preview?.remainingGrossBalance).toBe(7400);
    expect(preview?.remainingCostBasis).toBe(6577.78);
    expect(preview?.isFullRedemption).toBe(false);
  });
});
