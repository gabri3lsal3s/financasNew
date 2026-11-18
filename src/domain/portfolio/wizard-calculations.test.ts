import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import {
  calculateWizardOrderPreview,
  computeCashFitSummary,
  computeCorporateEventFactor,
  computeCorporateEventPreview,
  computeDividendTotalFromMode,
  convertOrderAmountToBRL,
  resolveEffectiveSplitFactor,
  resolveInitialUnitOrPositionCost,
  resolvePortfolioUsdRate,
} from "./wizard-calculations";
import { FALLBACK_USD_RATE } from "./valuation";

const stockAsset: PortfolioAsset = {
  id: "a-1",
  user_id: "u-1",
  ticker: "PETR4",
  asset_class: "Ações",
  currency: "BRL",
  quantity: 100,
  average_price: 30,
};

describe("wizard-calculations", () => {
  it("resolvePortfolioUsdRate prioriza linha USD com taxa válida e usa FALLBACK_USD_RATE como fallback", () => {
    expect(resolvePortfolioUsdRate([])).toBe(FALLBACK_USD_RATE);
    expect(resolvePortfolioUsdRate([{ currency: "BRL", usdRate: 5.1 }, { currency: "USD", usdRate: 5.45 }])).toBe(5.45);
    expect(resolvePortfolioUsdRate([{ currency: "USD", usdRate: 0 }])).toBe(FALLBACK_USD_RATE);
  });

  it("convertOrderAmountToBRL converte USD usando taxa ou fallback centralizado", () => {
    expect(convertOrderAmountToBRL(100, "BRL", 5.5)).toBe(100);
    expect(convertOrderAmountToBRL(100, "USD", 5.5)).toBe(550);
    expect(convertOrderAmountToBRL(100, "USD")).toBe(525);
  });

  it("resolveInitialUnitOrPositionCost preserva preço médio unitário para ações e custo inicial para RF", () => {
    expect(resolveInitialUnitOrPositionCost(stockAsset)).toBe(30);
    expect(
      resolveInitialUnitOrPositionCost({
        ...stockAsset,
        asset_class: "Renda Fixa",
        quantity: 1,
        average_price: 5000,
        fixed_income_metadata: {
          rate_type: "cdi",
          rate_value: 100,
          base_date: "2026-01-01",
          initial_investment_value: 4500,
          base_value: 5200,
          is_tax_exempt: false,
        },
      }),
    ).toBe(4500);
  });

  it("suporta proporção livre X:Y em split e reverse_split preservando o custo total", () => {
    const bonusFactor = computeCorporateEventFactor("split", 10, 11);
    expect(bonusFactor).toBeCloseTo(1.1, 6);
    const bonusPreview = computeCorporateEventPreview(100, 33, "split", bonusFactor);
    expect(bonusPreview.isValid).toBe(true);
    expect(bonusPreview.newQuantity).toBe(110);
    expect(bonusPreview.newAveragePrice).toBeCloseTo(30, 6);

    const reverseFactor = computeCorporateEventFactor("reverse_split", 5, 2);
    expect(reverseFactor).toBeCloseTo(2.5, 6);
    const reversePreview = computeCorporateEventPreview(100, 10, "reverse_split", reverseFactor);
    expect(reversePreview.isValid).toBe(true);
    expect(reversePreview.newQuantity).toBe(40);
    expect(reversePreview.newAveragePrice).toBe(25);
  });

  it("resolveEffectiveSplitFactor usa X:Y quando preenchido e mantém compatibilidade com fator legado", () => {
    expect(
      resolveEffectiveSplitFactor({
        mode: "split",
        splitFactor: 2,
        reverseSplitFactor: 2,
        splitFromStr: "10",
        splitToStr: "11",
      }),
    ).toBeCloseTo(1.1, 6);

    expect(
      resolveEffectiveSplitFactor({
        mode: "reverse_split",
        splitFactor: 2,
        reverseSplitFactor: 5,
      }),
    ).toBe(5);
  });

  it("calcula dividendo por cota e por valor total corretamente", () => {
    expect(
      computeDividendTotalFromMode({
        calcMode: "per_share",
        totalCents: 0,
        perShareCents: 150,
        custodyQty: 100,
      }),
    ).toBe(150);

    expect(
      computeDividendTotalFromMode({
        calcMode: "total",
        totalCents: 25000,
        perShareCents: 150,
        custodyQty: 100,
      }),
    ).toBe(250);
  });

  it("calculateWizardOrderPreview calcula compra em USD com split de caixa e aporte", () => {
    const usdAsset: PortfolioAsset = {
      id: "usd-1",
      user_id: "u-1",
      ticker: "AAPL",
      asset_class: "Internacional",
      currency: "USD",
      quantity: 10,
      average_price: 150,
    };

    const preview = calculateWizardOrderPreview(
      {
        mode: "buy",
        selectedAsset: usdAsset,
        ticker: "AAPL",
        assetClass: "Internacional",
        currency: "USD",
        isCash: false,
        notes: "",
        quantityStr: "5",
        priceCents: 20000,
        totalCents: 0,
        date: "2026-08-15",
        splitFactor: 2,
        reverseSplitFactor: 2,
        appliedCostCents: 0,
        syncCash: true,
        recordContribution: true,
      },
      3000,
      5.0,
    );

    expect(preview.newQuantity).toBe(15);
    expect(preview.newAveragePrice).toBeCloseTo(166.67, 2);
    expect(preview.totalOrderValueNative).toBe(1000);
    expect(preview.totalOrderValueBRL).toBe(5000);
    expect(preview.cashDebitBRL).toBe(3000);
    expect(preview.contributionBRL).toBe(2000);
  });

  it("computeCashFitSummary calcula capacidade em caixa para ações inteiras e valor completo", () => {
    expect(
      computeCashFitSummary({
        gapBRL: 500,
        assetClass: "Ações",
        ticker: "PETR4",
        currency: "BRL",
        priceBRL: 35,
        isTotalValue: false,
        cashAvailableBRL: 100,
      }),
    ).toEqual({
      text: "Cabe no caixa: 2 cotas (~",
      costBRL: 70,
      fits: true,
    });

    expect(
      computeCashFitSummary({
        gapBRL: 500,
        assetClass: "Ações",
        ticker: "PETR4",
        currency: "BRL",
        priceBRL: 120,
        isTotalValue: false,
        cashAvailableBRL: 100,
      }),
    ).toEqual({
      text: "Saldo em caixa insuficiente para 1 cota",
      fits: false,
    });

    expect(
      computeCashFitSummary({
        gapBRL: 500,
        assetClass: "Renda Fixa",
        ticker: "CDB",
        currency: "BRL",
        priceBRL: 0,
        isTotalValue: true,
        cashAvailableBRL: 300,
      }),
    ).toEqual({
      text: "Cabe no caixa: ",
      costBRL: 300,
      fits: true,
    });
  });
});
