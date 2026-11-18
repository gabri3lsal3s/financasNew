import { describe, expect, it } from "vitest";
import type { PortfolioAsset, PortfolioDividend, PortfolioTransaction } from "@/types";
import { computePeriodInvestmentFlow, computeYearDividendsBRL } from "./period-investment-flow";

const baseAsset = (id: string, ticker: string, assetClass: string, currency: "BRL" | "USD"): PortfolioAsset => ({
  id,
  user_id: "u1",
  ticker,
  asset_class: assetClass,
  sector: null,
  currency,
  quantity: 10,
  average_price: 10,
  notes: null,
  score: null,
  allocation_status: "active",
  thesis_summary: null,
  score_criteria: null,
  last_reviewed_at: null,
  review_frequency_months: undefined,
  estimated_monthly_dividend_per_share: undefined,
  updated_at: "2026-01-01T00:00:00Z",
});

describe("domain/reports/period-investment-flow", () => {
  it("calcula compras, vendas e proventos convertendo USD e ignorando caixa e duplicatas", () => {
    const assets: PortfolioAsset[] = [
      baseAsset("a1", "PETR4", "acoes", "BRL"),
      baseAsset("a2", "AAPL", "internacional", "USD"),
      baseAsset("a3", "CAIXA", "caixa", "BRL"),
    ];
    const assetCurrencyMap = new Map<string, string>([
      ["a1", "BRL"],
      ["a2", "USD"],
      ["a3", "BRL"],
    ]);

    const transactions = [
      { id: "t1", user_id: "u1", asset_id: "a1", type: "buy", date: "2026-08-02", quantity: 10, price: 30, total: 300, notes: null, created_at: "" },
      { id: "t2", user_id: "u1", asset_id: "a2", type: "sell", date: "2026-08-05", quantity: 1, price: 100, total: 100, notes: null, created_at: "" },
      { id: "t3", user_id: "u1", asset_id: "a3", type: "buy", date: "2026-08-06", quantity: 1, price: 999, total: 999, notes: null, created_at: "" },
      { id: "t4", user_id: "u1", asset_id: "a1", type: "dividend", date: "2026-08-10", quantity: 1, price: 50, total: 50, notes: null, created_at: "" },
    ] as unknown as PortfolioTransaction[];

    const dividends = [
      { id: "d1", user_id: "u1", asset_id: "a1", date: "2026-08-10", amount: 50, notes: null, created_at: "" },
      { id: "d2", user_id: "u1", asset_id: "a2", date: "2026-08-12", amount: 10, notes: null, created_at: "" },
    ] as unknown as PortfolioDividend[];

    const flow = computePeriodInvestmentFlow({
      transactions,
      dividends,
      assets,
      assetCurrencyMap,
      usdRate: 5,
      isDateInPeriod: (d) => d.startsWith("2026-08"),
      periodLabel: "Agosto de 2026",
    });

    expect(flow.buysBRL).toBe(300);
    expect(flow.sellsBRL).toBe(500);
    expect(flow.dividendsBRL).toBe(100);
    expect(flow.netFlowBRL).toBe(-100);
  });

  it("soma proventos do exercício anual respeitando moeda USD", () => {
    const dividends = [
      { id: "d1", user_id: "u1", asset_id: "a1", date: "2026-03-10", amount: 100, notes: null, created_at: "" },
      { id: "d2", user_id: "u1", asset_id: "a2", date: "2026-04-10", amount: 20, notes: null, created_at: "" },
    ] as unknown as PortfolioDividend[];
    const map = new Map([["a1", "BRL"], ["a2", "USD"]]);

    expect(
      computeYearDividendsBRL({
        dividends,
        selectedYear: 2026,
        assetCurrencyMap: map,
        usdRate: 5.5,
        fallbackCurrentYearDividendsBRL: 0,
      }),
    ).toBe(210);
  });
});
