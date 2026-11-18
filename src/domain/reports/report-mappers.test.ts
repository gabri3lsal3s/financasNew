import { describe, expect, it } from "vitest";
import {
  buildFinancialDRE,
  buildReportPeriodLabel,
  mapCategoriesForCloseReport,
  mapPaymentMethodsForCloseReport,
  mapPositionRowsToWealthRows,
  sumContributionsInPeriod,
} from "./report-mappers";

describe("domain/reports/report-mappers", () => {
  it("formata rótulos de período em pt-BR sem expor datas ISO cruas", () => {
    expect(
      buildReportPeriodLabel({
        mode: "custom",
        month: "2026-08",
        year: 2026,
        customStart: "2026-08-01",
        customEnd: "2026-08-31",
      }),
    ).toBe("01/08/2026 a 31/08/2026");

    expect(
      buildReportPeriodLabel({ mode: "year", month: "2026-08", year: 2026 }),
    ).toBe("Exercício de 2026");

    expect(
      buildReportPeriodLabel({ mode: "month", month: "2026-08", year: 2026 }),
    ).toMatch(/Agosto de 2026/i);
  });

  it("soma aportes por competência mensal, anual e intervalo customizado", () => {
    const contributions = [
      { date: "2026-08-05", amount: 1000 },
      { date: "2026-08-20", amount: 500 },
      { date: "2026-09-01", amount: 800 },
      { date: "2025-12-10", amount: 400 },
    ];

    expect(
      sumContributionsInPeriod({
        contributions,
        mode: "month",
        month: "2026-08",
        year: 2026,
        customValid: false,
      }),
    ).toBe(1500);

    expect(
      sumContributionsInPeriod({
        contributions,
        mode: "year",
        month: "2026-08",
        year: 2026,
        customValid: false,
      }),
    ).toBe(2300);

    expect(
      sumContributionsInPeriod({
        contributions,
        mode: "custom",
        month: "2026-08",
        year: 2026,
        customValid: true,
        startDate: "2026-08-10",
        endDate: "2026-09-05",
      }),
    ).toBe(1300);
  });

  it("calcula DRE Pessoal com taxa de poupança e fluxo líquido após aportes", () => {
    const dre = buildFinancialDRE({
      currentIncomeCents: 1_000_000,
      currentExpenseCents: 600_000,
      grossIncomeBrutoCents: 1_000_000,
      totalExpensesBrutoCents: 700_000,
      periodContributionsBRL: 2500,
    });

    expect(dre.operationalSavingsCents).toBe(400_000);
    expect(dre.savingsRatePct).toBe(40);
    expect(dre.investedAporteCents).toBe(250_000);
    expect(dre.netCashFlowCents).toBe(150_000);
    expect(dre.totalExpensesBrutoCents).toBe(700_000);
  });

  it("mapeia categorias, meios de pagamento e linhas de posição para os dossiês", () => {
    const cats = mapCategoriesForCloseReport({
      byCategory: [
        { categoryId: "c1", name: "Moradia", brutoCents: 300_000, ponderadoCents: 300_000, totalCents: 300_000 },
      ],
      grossExpenseBrutoCents: 600_000,
      targetMonth: "2026-08",
      resolveCategoryLimit: () => 250_000,
    });
    expect(cats[0]).toMatchObject({ name: "Moradia", pct: 50, budgetLimitCents: 250_000, variancePct: 20 });

    const methods = mapPaymentMethodsForCloseReport({
      byMethod: [{ method: "pix", brutoCents: 300_000, ponderadoCents: 300_000, totalCents: 300_000 }],
      grossExpenseBrutoCents: 600_000,
      resolveMethodLabel: () => "Pix",
    });
    expect(methods[0]).toMatchObject({ label: "Pix", pct: 50 });

    const wealthRows = mapPositionRowsToWealthRows([
      {
        ticker: "AAPL",
        assetClass: "Internacional",
        currency: "USD",
        quantity: 2,
        averageCost: 100,
        totalCost: 200,
        totalCostBRL: 1000,
        priceQuote: 120,
        priceBRL: 600,
        usdRate: 5,
        valueBRL: 1200,
        unrealizedPnl: 200,
        unrealizedPct: 20,
        dividends: 50,
        dividendsNative: 10,
      },
    ]);
    expect(wealthRows[0]).toMatchObject({
      ticker: "AAPL",
      currency: "USD",
      yocPct: 5,
      isCash: false,
    });
  });
});
