import { describe, expect, it } from "vitest";
import {
  buildAssetCostBreakdown,
  buildConsolidatedPositionQuotesBreakdown,
  buildCustodyReconciliationBreakdown,
  buildPortfolioTotalBreakdown,
  buildUnrealizedPnlBreakdown,
} from "./portfolio-breakdown";

describe("buildPortfolioTotalBreakdown", () => {
  it("constrói a memória de cálculo do patrimônio total consolidando BRL, USD e Caixa", () => {
    const breakdown = buildPortfolioTotalBreakdown({
      totalBRL: 150000,
      brlAssetsTotal: 100000,
      usdAssetsTotalBRL: 40000,
      usdRate: 5.5,
      cashBRL: 10000,
    });

    expect(breakdown.id).toBe("portfolio-total-patrimonio");
    expect(breakdown.title).toBe("Patrimônio Total da Carteira");
    expect(breakdown.steps).toHaveLength(3);
    expect(breakdown.steps[0]?.rawValue).toBe(10000000); // 100k BRL em centavos
    expect(breakdown.steps[1]?.rawValue).toBe(4000000); // 40k USD em centavos
    expect(breakdown.steps[2]?.rawValue).toBe(1000000); // 10k Caixa em centavos
    expect(breakdown.result.rawValue).toBe(15000000); // 150k BRL em centavos
  });

  it("omite passos de USD e Caixa quando zerados", () => {
    const breakdown = buildPortfolioTotalBreakdown({
      totalBRL: 50000,
      brlAssetsTotal: 50000,
      cashBRL: 0,
    });

    expect(breakdown.steps).toHaveLength(1);
    expect(breakdown.result.rawValue).toBe(5000000);
  });
});

describe("buildAssetCostBreakdown", () => {
  it("calcula o custo total multiplicando quantidade por preço médio em BRL", () => {
    const breakdown = buildAssetCostBreakdown({
      ticker: "PETR4",
      quantity: 100,
      averagePrice: 38.5,
      currency: "BRL",
      totalCostBRL: 3850,
    });

    expect(breakdown.id).toBe("asset-cost-petr4");
    expect(breakdown.title).toBe("Custo de Aquisição (PETR4)");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[0]?.rawValue).toBe(100);
    expect(breakdown.steps[1]?.rawValue).toBe(3850);
    expect(breakdown.result.rawValue).toBe(385000);
  });

  it("trata ativo internacional em USD com conversão cambial", () => {
    const breakdown = buildAssetCostBreakdown({
      ticker: "AAPL",
      quantity: 10,
      averagePrice: 220,
      currency: "USD",
      totalCostBRL: 11550,
      usdRate: 5.25,
    });

    expect(breakdown.steps).toHaveLength(3);
    expect(breakdown.steps[2]?.label).toContain("Câmbio PTAX");
    expect(breakdown.result.rawValue).toBe(1155000);
  });

  it("trata título de Renda Fixa com regime de valor completo", () => {
    const breakdown = buildAssetCostBreakdown({
      ticker: "CDB Banco Inter",
      quantity: 1,
      averagePrice: 10000,
      totalCostBRL: 10000,
      isTotalValue: true,
    });

    expect(breakdown.steps).toHaveLength(1);
    expect(breakdown.steps[0]?.label).toContain("Aporte Principal Aplicado");
    expect(breakdown.result.rawValue).toBe(1000000);
  });
});

describe("buildUnrealizedPnlBreakdown", () => {
  it("calcula retorno da custódia com valorização de cotação e proventos", () => {
    const breakdown = buildUnrealizedPnlBreakdown({
      ticker: "HGLG11",
      currentValueBRL: 16500,
      totalCostBRL: 15000,
      unrealizedPnlBRL: 1500,
      unrealizedPnlPct: 10,
      totalDividendsBRL: 850,
      totalReturnPnlBRL: 2350,
      totalReturnPct: 15.67,
    });

    expect(breakdown.title).toBe("Resultado da Custódia (HGLG11)");
    expect(breakdown.steps).toHaveLength(4); // Mercado, Custo, Cotação P&L, Proventos
    expect(breakdown.result.rawValue).toBe(235000);
    expect(breakdown.result.tone).toBe("positive");
  });

  it("calcula cenário de desvalorização de cotação sem proventos", () => {
    const breakdown = buildUnrealizedPnlBreakdown({
      ticker: "VALE3",
      currentValueBRL: 5500,
      totalCostBRL: 6000,
      unrealizedPnlBRL: -500,
      unrealizedPnlPct: -8.33,
      totalReturnPnlBRL: -500,
      totalReturnPct: -8.33,
    });

    expect(breakdown.steps).toHaveLength(3);
    expect(breakdown.result.rawValue).toBe(-50000);
    expect(breakdown.result.tone).toBe("negative");
  });
});

describe("buildCustodyReconciliationBreakdown", () => {
  it("constrói a memória de cálculo com custódia no Brasil e no Exterior + câmbio PTAX", () => {
    const breakdown = buildCustodyReconciliationBreakdown({
      summary: {
        custodyBrazilCents: 6000000,
        custodyBrazilAssetsCount: 4,
        custodyBrazilPct: 60,
        custodyForeignUSDCents: 679244,
        custodyForeignBRLCents: 4000000,
        custodyForeignAssetsCount: 2,
        custodyForeignPct: 40,
        fxRateUsed: 5.8889,
        fxSourceLabel: "PTAX Oficial BCB",
        closingPatrimonyCents: 10000000,
        roundingAdjustmentCents: 0,
        hasForeignCustody: true,
      },
      provisionedSummary: {
        totalProvisionedBRLCents: 35000,
        totalPendingBRLCents: 15000,
        totalReceivableBRLCents: 50000,
        totalReceivableUSDCents: 0,
        totalReceivableNativeBRLCents: 50000,
        provisionedCount: 1,
        pendingCount: 1,
        totalCount: 2,
        hasUncertainTax: false,
        fxRateUsed: 5.8889,
      },
    });

    expect(breakdown.id).toBe("portfolio-custody-reconciliation");
    expect(breakdown.title).toBe("Conciliação por Custódia (Brasil vs. Exterior)");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[0]?.rawValue).toBe(6000000);
    expect(breakdown.steps[1]?.rawValue).toBe(4000000);
    expect(breakdown.result.rawValue).toBe(10000000);
    expect(breakdown.notes?.[0]).toContain(
      "ETFs/BDRs listados na B3 permanecem em BRL. Câmbio de referência: R$ 5,8889 (PTAX Oficial BCB).",
    );
    expect(breakdown.notes?.[1]).toContain("Proventos Provisionados: 2 eventos a receber");
  });

  it("constrói memória de cálculo com 100% da custódia em BRL", () => {
    const breakdown = buildCustodyReconciliationBreakdown({
      summary: {
        custodyBrazilCents: 5000000,
        custodyBrazilAssetsCount: 3,
        custodyBrazilPct: 100,
        custodyForeignUSDCents: 0,
        custodyForeignBRLCents: 0,
        custodyForeignAssetsCount: 0,
        custodyForeignPct: 0,
        fxRateUsed: 5.8889,
        fxSourceLabel: "PTAX Oficial BCB",
        closingPatrimonyCents: 5000000,
        roundingAdjustmentCents: 0,
        hasForeignCustody: false,
      },
    });

    expect(breakdown.steps).toHaveLength(1);
    expect(breakdown.result.rawValue).toBe(5000000);
    expect(breakdown.notes?.[0]).toBe(
      "100% da custódia alocada em ativos locais denominados em Real (BRL).",
    );
  });
});

describe("buildConsolidatedPositionQuotesBreakdown", () => {
  it("constrói memória de cálculo quando todas as cotações estão sincronizadas", () => {
    const breakdown = buildConsolidatedPositionQuotesBreakdown({
      activeAssetsCount: 5,
      marketSummary: {
        hasB3Custody: true,
        b3RefIso: "2026-11-23T14:22:00.000Z",
        b3RefLabel: "23/11/2026 11:22",
        hasForeignCustody: true,
        usdRefIso: "2026-11-20T21:00:00.000Z",
        usdRefLabel: "20/11/2026 18:00",
        fxRate: 5.8889,
        fxSourceLabel: "PTAX Oficial BCB",
        fxRefIso: "2026-11-19T16:04:00.000Z",
        fxRefLabel: "19/11/2026 13:04",
      },
      staleGuard: {
        issues: [],
        postTradeStaleTickers: [],
        fallbackTickers: [],
        staleMarketTickers: [],
        hasPostTradeStale: false,
        hasFallback: false,
        hasStaleMarketData: false,
        fxWarning: null,
        hasAnyIssue: false,
        issueByTicker: {},
      },
    });

    expect(breakdown.id).toBe("portfolio-consolidated-position-quotes");
    expect(breakdown.steps[0]?.rawValue).toBe(5);
    expect(breakdown.steps[1]?.rawValue).toBe(0);
    expect(breakdown.result.rawValue).toBe(5);
    expect(breakdown.result.hint).toBe("Nenhum ativo com cotação desatualizada.");
    expect(breakdown.notes).toEqual(
      expect.arrayContaining([
        "Referência B3 (Brasil): 23/11/2026 11:22.",
        "Referência Exterior (NYSE/NASDAQ USD): 20/11/2026 18:00.",
        "Câmbio USD/BRL: R$ 5,8889 (PTAX Oficial BCB, 19/11/2026 13:04).",
      ]),
    );
  });

  it("especifica nominalmente os ativos com cotação desatualizada ou em fallback", () => {
    const breakdown = buildConsolidatedPositionQuotesBreakdown({
      activeAssetsCount: 4,
      staleGuard: {
        issues: [
          {
            ticker: "PETR4",
            market: "BR",
            kind: "stale_market_data",
            marketPriceAt: "2026-11-18T18:00:00Z",
            provider: "brapi",
            latestTradeDate: null,
            message: "PETR4: cotação de mercado defasada (referência 2026-11-18, último pregão encerrado 2026-11-20).",
          },
          {
            ticker: "AAPL",
            market: "US",
            kind: "missing_or_fallback",
            marketPriceAt: null,
            provider: null,
            latestTradeDate: null,
            message: "AAPL: cotação oficial indisponível no momento (valor estimado por fallback/preço médio).",
          },
        ],
        postTradeStaleTickers: [],
        fallbackTickers: ["AAPL"],
        staleMarketTickers: ["PETR4"],
        hasPostTradeStale: false,
        hasFallback: true,
        hasStaleMarketData: true,
        fxWarning: null,
        hasAnyIssue: true,
        issueByTicker: {},
      },
    });

    expect(breakdown.steps[0]?.rawValue).toBe(2); // 2 em dia
    expect(breakdown.steps[1]?.label).toContain("PETR4");
    expect(breakdown.steps[2]?.label).toContain("AAPL");
    expect(breakdown.result.rawValue).toBe(4);
    expect(breakdown.result.tone).toBe("negative");
    expect(breakdown.result.hint).toContain("PETR4, AAPL");
  });
});
