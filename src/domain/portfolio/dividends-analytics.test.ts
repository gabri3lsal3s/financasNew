import { describe, expect, it } from "vitest";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import {
  buildAssetsDividendsBreakdown,
  buildMonthlyDividendsSummary,
  buildSnowballDashboardItems,
  buildYearlyDividendsSummary,
  type DividendPositionRef,
} from "./dividends-analytics";

const makeAsset = (overrides: Partial<PortfolioAsset> = {}): PortfolioAsset => ({
  id: "a1",
  user_id: "u1",
  ticker: "MXRF11",
  asset_class: "FIIs",
  currency: "BRL",
  quantity: 100,
  average_price: 10,
  ...overrides,
});

const makeDividend = (overrides: Partial<PortfolioDividend> = {}): PortfolioDividend => ({
  id: "d1",
  user_id: "u1",
  asset_id: "a1",
  date: "2026-08-15",
  amount: 10,
  ...overrides,
});

describe("dividends-analytics", () => {
  it("calcula resumo mensal incluindo conversão cambial USD", () => {
    const assets = [
      makeAsset({ id: "a1", ticker: "MXRF11", currency: "BRL" }),
      makeAsset({ id: "a2", ticker: "AAPL", currency: "USD" }),
    ];
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const rowByAssetId = new Map<string, DividendPositionRef>([
      ["a1", { assetId: "a1", currency: "BRL", priceBRL: 10 }],
      ["a2", { assetId: "a2", currency: "USD", priceBRL: 500, usdRate: 5 }],
    ]);

    const summary = buildMonthlyDividendsSummary(
      [
        makeDividend({ id: "d1", asset_id: "a1", amount: 50, date: "2026-08-10" }),
        makeDividend({ id: "d2", asset_id: "a2", amount: 20, date: "2026-08-20" }), // 20 * 5 = 100 BRL
      ],
      "2026-08",
      assetById,
      rowByAssetId,
    );

    expect(summary.monthTotal).toBe(150);
    expect(summary.uniqueTickersCount).toBe(2);
    expect(summary.topPayer).toEqual({ ticker: "AAPL", amount: 100 });
  });

  it("gera série anual de 12 meses com total, média mensal e melhor mês", () => {
    const assetById = new Map([["a1", makeAsset()]]);
    const rowByAssetId = new Map<string, DividendPositionRef>();

    const yearly = buildYearlyDividendsSummary(
      [
        makeDividend({ id: "d1", date: "2026-03-10", amount: 120 }),
        makeDividend({ id: "d2", date: "2026-08-10", amount: 240 }),
      ],
      "2026",
      [{ paymentDate: "2026-08-25", totalAmount: 30 }],
      assetById,
      rowByAssetId,
    );

    expect(yearly.yearly).toHaveLength(12);
    expect(yearly.yearTotal).toBe(360);
    expect(yearly.yearMonthlyAverage).toBe(30);
    expect(yearly.bestMonth?.month).toBe("2026-08");
    expect(yearly.yearly[7]?.projectedTotal).toBe(30);
  });

  it("consolida histórico anterior, lançamentos periódicos e itens da bola de neve", () => {
    const assets = [
      makeAsset({
        id: "a1",
        ticker: "MXRF11",
        quantity: 100,
        average_price: 10,
        accumulated_dividends: 200,
        estimated_monthly_dividend_per_share: 0.1,
      }),
    ];
    const rowByAssetId = new Map<string, DividendPositionRef>([
      ["a1", { assetId: "a1", currency: "BRL", priceBRL: 10, totalCost: 1000 }],
    ]);

    const breakdown = buildAssetsDividendsBreakdown(
      assets,
      [makeDividend({ id: "d1", asset_id: "a1", amount: 50 })],
      rowByAssetId,
    );

    expect(breakdown.historicalTotal).toBe(200);
    expect(breakdown.allPeriodicDividendsTotal).toBe(50);
    expect(breakdown.lifetimeTotal).toBe(250);
    expect(breakdown.items[0]?.yoc).toBe(25);

    const snowball = buildSnowballDashboardItems(assets, [], rowByAssetId);
    expect(snowball.activeCount).toBe(1);
    expect(snowball.totalMonthlyEstimatedIncome).toBe(10);
  });

  it("ignora proventos com paymentDate nula na grade mensal anual sem lançar exceção", () => {
    const assetById = new Map([["a1", makeAsset()]]);
    const yearly = buildYearlyDividendsSummary(
      [],
      "2026",
      [
        { paymentDate: null, totalAmount: 99 },
        { paymentDate: "2026-08-25", totalAmount: 30 },
      ],
      assetById,
      new Map(),
    );
    expect(yearly.yearly[7]?.projectedTotal).toBe(30);
  });

  it("converte proventos recebidos e previstos em USD usando usdRate explícito em buildYearlyDividendsSummary", () => {
    const usdAsset = makeAsset({ id: "us1", ticker: "AAPL", currency: "USD" });
    const assetById = new Map([["us1", usdAsset]]);
    const yearly = buildYearlyDividendsSummary(
      [makeDividend({ id: "d1", asset_id: "us1", date: "2026-08-10", amount: 10 })],
      "2026",
      [{ paymentDate: "2026-08-25", totalAmount: 5, currency: "USD" }],
      assetById,
      new Map(),
      5.5,
    );

    expect(yearly.yearTotal).toBe(55);
    expect(yearly.yearly[7]?.total).toBe(55);
    expect(yearly.yearly[7]?.projectedTotal).toBe(27.5);
  });

  it("converte renda mensal estimada de ativos USD para BRL usando usdRate em buildSnowballDashboardItems", () => {
    const assets = [
      makeAsset({
        id: "us1",
        ticker: "O",
        asset_class: "Internacional",
        currency: "USD",
        quantity: 100,
        average_price: 50,
        estimated_monthly_dividend_per_share: 0.25, // $25/mês
      }),
    ];
    const rowByAssetId = new Map<string, DividendPositionRef>([
      ["us1", { assetId: "us1", currency: "USD", priceBRL: 280, priceQuote: 50 }],
    ]);

    const snowball = buildSnowballDashboardItems(assets, [], rowByAssetId, 5.6);
    expect(snowball.items).toHaveLength(1);
    expect(snowball.items[0]?.currency).toBe("USD");
    expect(snowball.items[0]?.monthlyIncomeBRL).toBe(140); // 25 * 5.6
    expect(snowball.totalMonthlyEstimatedIncome).toBe(140);
  });
});
