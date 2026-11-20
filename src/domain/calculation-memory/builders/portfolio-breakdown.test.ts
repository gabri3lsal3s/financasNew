import { describe, expect, it } from "vitest";
import {
  buildAssetCostBreakdown,
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
