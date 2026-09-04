import { describe, expect, it } from "vitest";
import {
  allocationByTicker,
  assetYieldOnCostPct,
  buildPortfolioMonthlySeries,
  calculatePortfolioTotalReturn,
  calculateWeightedAveragePrice,
  portfolioReturnPct,
} from "./summary";

describe("buildPortfolioMonthlySeries — Snapshots patrimoniais com proventos acumulados (§F36 e §F37)", () => {
  it("calcula ganho de capital e retorno total integrando proventos até cada mês", () => {
    const rawSnapshots = [
      { month: "2026-01", total_value: 10000, total_cost: 10000 },
      { month: "2026-02", total_value: 10500, total_cost: 10000 },
      { month: "2026-03", total_value: 9800, total_cost: 10000 },
    ];
    const dividends = [
      { date: "2026-01-15", amount: 100 },
      { date: "2026-02-15", amount: 150 },
      { date: "2026-03-15", amount: 200 },
    ];

    const series = buildPortfolioMonthlySeries({
      rawSnapshots,
      dividends,
      initialAccumulatedDividends: 50,
      limit: 6,
    });

    expect(series).toHaveLength(3);

    // Mês 1: Custo 10k, Valor 10k, Proventos no mês 100, Acumulado 50 + 100 = 150
    expect(series[0]!.month).toBe("2026-01");
    expect(series[0]!.valueBRL).toBe(10000);
    expect(series[0]!.costBRL).toBe(10000);
    expect(series[0]!.monthDividendsBRL).toBe(100);
    expect(series[0]!.accumulatedDividendsBRL).toBe(150);
    expect(series[0]!.capitalGainPnl).toBe(0);
    expect(series[0]!.capitalGainPct).toBe(0);
    expect(series[0]!.totalReturnPnl).toBe(150); // 0 + 150
    expect(series[0]!.totalReturnPct).toBe(1.5); // 150 / 10000 = 1.5%

    // Mês 2: Custo 10k, Valor 10.5k, Proventos no mês 150, Acumulado 150 + 150 = 300
    expect(series[1]!.month).toBe("2026-02");
    expect(series[1]!.valueBRL).toBe(10500);
    expect(series[1]!.monthDividendsBRL).toBe(150);
    expect(series[1]!.accumulatedDividendsBRL).toBe(300);
    expect(series[1]!.capitalGainPnl).toBe(500);
    expect(series[1]!.capitalGainPct).toBe(5);
    expect(series[1]!.totalReturnPnl).toBe(800); // 500 + 300
    expect(series[1]!.totalReturnPct).toBe(8); // 800 / 10000 = 8%

    // Mês 3: Custo 10k, Valor 9.8k (queda de cotação), Proventos 200, Acumulado 300 + 200 = 500
    expect(series[2]!.month).toBe("2026-03");
    expect(series[2]!.valueBRL).toBe(9800);
    expect(series[2]!.monthDividendsBRL).toBe(200);
    expect(series[2]!.accumulatedDividendsBRL).toBe(500);
    expect(series[2]!.capitalGainPnl).toBe(-200);
    expect(series[2]!.capitalGainPct).toBe(-2);
    expect(series[2]!.totalReturnPnl).toBe(300); // -200 + 500 = +300
    expect(series[2]!.totalReturnPct).toBe(3); // 300 / 10000 = +3% (Retorno Total positivo mesmo com queda de cotação)
  });

  it("inclui ponto do mês corrente e respeita limite", () => {
    const rawSnapshots = [
      { month: "2026-01", total_value: 1000, total_cost: 1000 },
      { month: "2026-02", total_value: 1100, total_cost: 1000 },
    ];
    const currentMonthPoint = { month: "2026-03", total_value: 1200, total_cost: 1000 };

    const series = buildPortfolioMonthlySeries({
      rawSnapshots,
      currentMonthPoint,
      dividends: [],
      limit: 2,
    });

    expect(series).toHaveLength(2);
    expect(series[0]!.month).toBe("2026-02");
    expect(series[1]!.month).toBe("2026-03");
  });
});

describe("calculatePortfolioTotalReturn — Retorno Total consolidado da carteira (§F17)", () => {
  it("calcula ganho de capital e retorno total somando proventos", () => {
    const res = calculatePortfolioTotalReturn([
      { valueBRL: 980, totalCostBRL: 1000, dividends: 120, isCash: false },
      { valueBRL: 2500, totalCostBRL: 2000, dividends: 0, isCash: false },
      { valueBRL: 500, totalCostBRL: 500, dividends: 0, isCash: true }, // caixa — fora
    ]);

    expect(res.totalValueBRL).toBe(3480);
    expect(res.totalCostBRL).toBe(3000);
    expect(res.totalDividendsBRL).toBe(120);
    expect(res.capitalGainPnl).toBe(480); // (3480 - 3000) = +480
    expect(res.capitalGainPct).toBe(16); // 480 / 3000 = 16%
    expect(res.totalReturnPnl).toBe(600); // 480 + 120 = +600
    expect(res.totalReturnPct).toBe(20); // 600 / 3000 = 20%
  });

  it("consolida a custódia aberta no totalReturnPct e acumula o histórico no allTimeEconomicPnl", () => {
    const res = calculatePortfolioTotalReturn([
      { valueBRL: 10000, totalCostBRL: 8000, dividends: 500, isCash: false },
      // Posição encerrada (CDB resgatado com lucro realizado de R$ 106,04)
      {
        valueBRL: 0,
        totalCostBRL: 0,
        quantity: 0,
        historicalCostBRL: 1236.27,
        historicalRedeemedBRL: 1342.31,
        dividends: 50,
        isCash: false,
      },
    ]);

    expect(res.totalValueBRL).toBe(10000);
    expect(res.totalCostBRL).toBe(8000);
    expect(res.capitalGainPnl).toBe(2000); // 10000 - 8000
    expect(res.activeDividendsBRL).toBe(500);
    expect(res.closedDividendsBRL).toBe(50);
    expect(res.totalDividendsBRL).toBe(550);
    expect(res.realizedPnl).toBe(106.04); // 1342.31 - 1236.27
    // Retorno da Custódia Aberta: (2000 + 500) = 2500 -> 2500 / 8000 = 31.25%
    expect(res.totalReturnPnl).toBe(2500);
    expect(res.totalReturnPct).toBe(31.25);
    // Resultado Econômico Total Histórico (P&L em R$): 2000 + 550 + 106.04 = 2656.04
    expect(res.allTimeEconomicPnl).toBe(2656.04);
  });

  it("retorna nulo nos percentuais quando não há ativos com custo", () => {
    const res = calculatePortfolioTotalReturn([
      { valueBRL: 1000, totalCostBRL: 1000, isCash: true },
    ]);
    expect(res.totalReturnPct).toBeNull();
    expect(res.capitalGainPct).toBeNull();
  });
});

describe("portfolioReturnPct — rentabilidade ponderada pelo valor (§F17)", () => {
  it("pondera os percentuais pelo valor de mercado e ignora caixa", () => {
    const pct = portfolioReturnPct([
      { valueBRL: 6000, unrealizedPct: 20 },
      { valueBRL: 2000, unrealizedPct: 5 },
      { valueBRL: 1000, unrealizedPct: null }, // caixa — fora
    ]);
    // (6000×20 + 2000×5) ÷ 8000 = 130000/8000 = 16,25
    expect(pct).toBe(16.25);
  });

  it("prioriza totalReturnPct se disponível", () => {
    const pct = portfolioReturnPct([
      { valueBRL: 6000, unrealizedPct: -5, totalReturnPct: 15 },
      { valueBRL: 2000, unrealizedPct: 10, totalReturnPct: 25 },
    ]);
    // (6000×15 + 2000×25) ÷ 8000 = (90000 + 50000) / 8000 = 140000 / 8000 = 17.5
    expect(pct).toBe(17.5);
  });

  it("retorna null sem base (vazio ou só caixa)", () => {
    expect(portfolioReturnPct([])).toBeNull();
    expect(portfolioReturnPct([{ valueBRL: 500, unrealizedPct: null }])).toBeNull();
  });

  it("arredonda para 2 casas", () => {
    const pct = portfolioReturnPct([
      { valueBRL: 3333, unrealizedPct: 10 },
      { valueBRL: 3333, unrealizedPct: 10 },
      { valueBRL: 3334, unrealizedPct: 10 },
    ]);
    expect(pct).toBe(10);
  });
});

describe("allocationByTicker — alocação por ativo (§F17)", () => {
  it("agrupa por ticker com peso no patrimônio e ordena desc", () => {
    const slices = allocationByTicker([
      { ticker: "PETR4", valueBRL: 8000 },
      { ticker: "BOVA11", valueBRL: 2000 },
    ]);
    expect(slices).toEqual([
      { ticker: "PETR4", valueBRL: 8000, pct: 80 },
      { ticker: "BOVA11", valueBRL: 2000, pct: 20 },
    ]);
  });

  it("carteira vazia → lista vazia", () => {
    expect(allocationByTicker([])).toEqual([]);
  });
});

describe("assetYieldOnCostPct — Yield on Cost de ativo", () => {
  it("calcula a relação percentual entre proventos recebidos e custo total", () => {
    // 500 reais de proventos com 5.000 de custo = 10%
    expect(assetYieldOnCostPct(500, 5000)).toBe(10);
    // 123.45 reais com 2.500 = 4.94%
    expect(assetYieldOnCostPct(123.45, 2500)).toBe(4.94);
  });

  it("retorna null se não houver custo ou não houver proventos", () => {
    expect(assetYieldOnCostPct(0, 5000)).toBeNull();
    expect(assetYieldOnCostPct(500, 0)).toBeNull();
    expect(assetYieldOnCostPct(-10, 5000)).toBeNull();
    expect(assetYieldOnCostPct(500, -100)).toBeNull();
  });
});

describe("calculateWeightedAveragePrice — Helper de Aporte e Lotes", () => {
  it("calcula preço médio ponderado corretamente ao adicionar novo lote", () => {
    // 100 cotas a R$ 20 + 100 cotas a R$ 40 = 200 cotas a R$ 30 (custo R$ 6.000)
    const res = calculateWeightedAveragePrice(100, 20, 100, 40);
    expect(res).toEqual({
      newQuantity: 200,
      newAveragePrice: 30,
      newTotalCost: 6000,
    });
  });

  it("calcula primeiro lote quando quantidade atual era zero", () => {
    const res = calculateWeightedAveragePrice(0, 0, 50, 35.5);
    expect(res).toEqual({
      newQuantity: 50,
      newAveragePrice: 35.5,
      newTotalCost: 1775,
    });
  });

  it("retorna zeros se as quantidades forem zero", () => {
    const res = calculateWeightedAveragePrice(0, 0, 0, 0);
    expect(res).toEqual({
      newQuantity: 0,
      newAveragePrice: 0,
      newTotalCost: 0,
    });
  });
});
