import { describe, expect, it } from "vitest";
import type { PositionRow } from "@/components/modules/position-table";
import {
  buildExecutiveReportClassGroups,
  buildReportMonthOptions,
  resolveReportTotals,
} from "./executive-report-builder";
import { evaluateStaleQuoteGuard } from "./stale-quote-guard";

describe("executive-report-builder", () => {
  it("monta opções de mês ordenadas com rótulo de mês atual", () => {
    const options = buildReportMonthOptions({
      activeMonth: "2026-08",
      initialMonth: "2026-06",
      snapshots: [{ month: "2026-07" }],
    });

    expect(options.map((o) => o.value)).toEqual(["2026-08", "2026-07", "2026-06"]);
    expect(options[0]?.label).toContain("Mês Atual");
  });

  it("calcula rentabilidade da classe internacional em BRL sem distorção cambial", () => {
    const usdRows: PositionRow[] = [
      {
        assetId: "voo-1",
        ticker: "VOO",
        assetClass: "internacional",
        quantity: 1,
        averageCost: 464.41,
        totalCost: 464.41,
        totalCostBRL: 2554.26,
        priceQuote: 691.32,
        priceBRL: 3802.26,
        usdRate: 5.5,
        valueBRL: 3802.26,
        currency: "USD",
        source: "manual",
        pricingMode: "unit_price",
        pct: 100,
        unrealizedPnl: 1248,
        unrealizedPct: 48.86,
        totalReturnPnl: 1248,
        totalReturnPct: 48.86,
        isCash: false,
      },
    ];

    const { classGroups } = buildExecutiveReportClassGroups({
      investmentRows: usdRows,
      effectiveTotalBRL: 3802.26,
      rawAssets: [],
    });

    expect(classGroups).toHaveLength(1);
    expect(classGroups[0]?.pnlPct).toBeCloseTo(48.86, 1);
  });

  it("resolve totais da competência a partir do monthlyStatement quando disponível", () => {
    const totals = resolveReportTotals({
      isCurrentSelected: false,
      selectedMonth: "2026-07",
      currentRows: [],
      totalBRL: 50000,
      cashBRL: 1000,
      monthlyPosition: {
        month: "2026-07",
        totalValueBRL: 95000,
        totalCostBRL: 88000,
        cashQuantity: 5000,
        positions: [],
        monthlyStatement: {
          month: "2026-07",
          startBalanceBRL: 90000,
          endBalanceBRL: 96000,
          monthRatePct: 2,
          monthNetPnlBRL: 1800,
          monthDividendsBRL: 200,
          monthBuysBRL: 0,
          monthSellsBRL: 0,
          monthNetContributionBRL: 4200,
          monthGrossContributionsBRL: 4200,
          monthGrossWithdrawalsBRL: 0,
          weightedCapitalBaseBRL: 92000,
          weightedCashFlowBRL: 2100,
          transactionsCount: 0,
          dividendsCount: 1,
        },
        fidelity: {
          status: "complete",
          canGenerateExecutiveReport: true,
          reasons: [],
          snapshotTotalValue: 96000,
          reconstructedTotalValue: 95000,
          totalAssetsCount: 1,
          calibratedQuotesCount: 1,
          apiQuotesCount: 0,
          fallbackQuotesCount: 0,
        },
      } as never,
    });

    expect(totals.effectiveTotalBRL).toBe(96000);
    expect(totals.effectiveCashBRL).toBe(5000);
    expect(totals.effectiveCostBRL).toBe(88000);
  });

  it("propaga fxSourceLabel real e flags quoteStatusFlag (manual, fallback, stale) por ativo", () => {
    const rows: PositionRow[] = [
      {
        assetId: "a1",
        ticker: "AAPL",
        assetClass: "Internacional",
        quantity: 10,
        averageCost: 200,
        totalCost: 2000,
        totalCostBRL: 11000,
        priceQuote: 220,
        priceBRL: 1265,
        usdRate: 5.75,
        valueBRL: 12650,
        currency: "USD",
        source: "fallback",
        isEstimate: true,
        pricingMode: "unit_price",
        pct: 60,
        unrealizedPnl: 1650,
        unrealizedPct: 15,
        isCash: false,
      },
      {
        assetId: "a2",
        ticker: "PETR4",
        assetClass: "Ações",
        quantity: 100,
        averageCost: 30,
        priceBRL: 38,
        valueBRL: 3800,
        currency: "BRL",
        source: "manual",
        pricingMode: "unit_price",
        pct: 40,
        unrealizedPnl: 800,
        unrealizedPct: 26.67,
        isCash: false,
      },
    ];

    const fxMetadata = {
      rate: 5.75,
      source: "api" as const,
      provider: "yahoo",
      fxRateAt: "2026-06-15T20:00:00.000Z",
      fetchedAt: "2026-06-15T20:05:00.000Z",
      isFallback: false,
    };

    const staleGuard = evaluateStaleQuoteGuard({
      rows,
      fxMetadata,
      now: new Date("2026-06-16T15:00:00.000Z"),
    });

    const { classGroups } = buildExecutiveReportClassGroups({
      investmentRows: rows,
      effectiveTotalBRL: 16450,
      rawAssets: [],
      fxMetadata,
      usdRate: 5.75,
      staleGuard,
    });

    const intl = classGroups.find((g) => g.className === "Internacional");
    const br = classGroups.find((g) => g.className === "Ações");
    expect(intl?.fxSourceLabel).toBe("Yahoo Finance");
    expect(intl?.items[0]?.quoteStatusFlag).toBe("fallback");
    expect(br?.items[0]?.quoteStatusFlag).toBe("manual");
  });
});
