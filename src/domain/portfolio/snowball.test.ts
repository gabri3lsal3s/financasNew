import { describe, expect, it } from "vitest";
import {
  calculateBazinTargetPrice,
  calculatePortfolioConcentration,
  calculateSnowballProgress,
  calculateYieldOnCost,
  calculateYieldOnCostTotal,
  detectReinvestmentOpportunities,
  normalizeAllocationTargets,
  resolveMonthlyDividendPerShare,
} from "./snowball";


describe("domain/portfolio/snowball — Efeito Bola de Neve, YoC e Concentração", () => {
  describe("calculateSnowballProgress", () => {
    it("calcula o progresso quando o ativo ainda está no início da bola de neve", () => {
      // MXRF11 a R$ 10,00 pagando R$ 0,10 por cota. Precisa de 100 cotas. Tem 40 cotas.
      const result = calculateSnowballProgress({
        quantity: 40,
        currentPrice: 10,
        monthlyDividendPerShare: 0.1,
      });

      expect(result.monthlyDividendPerShare).toBe(0.1);
      expect(result.currentMonthlyIncome).toBe(4.0);
      expect(result.sharesNeededForOneShare).toBe(100);
      expect(result.remainingShares).toBe(60);
      expect(result.progressPct).toBe(40);
      expect(result.isSnowballActive).toBe(false);
    });

    it("identifica quando a bola de neve está ativa (o ativo se paga sozinho)", () => {
      // 120 cotas a R$ 10,00 pagando R$ 0,10 por cota (recebe R$ 12,00 > R$ 10,00)
      const result = calculateSnowballProgress({
        quantity: 120,
        currentPrice: 10,
        monthlyDividendPerShare: 0.1,
      });

      expect(result.currentMonthlyIncome).toBe(12.0);
      expect(result.sharesNeededForOneShare).toBe(100);
      expect(result.remainingShares).toBe(0);
      expect(result.progressPct).toBe(100);
      expect(result.isSnowballActive).toBe(true);
    });

    it("trata casos de borda com valores zerados ou negativos", () => {
      const result = calculateSnowballProgress({
        quantity: 0,
        currentPrice: 0,
        monthlyDividendPerShare: 0,
      });

      expect(result.progressPct).toBe(0);
      expect(result.isSnowballActive).toBe(false);
    });
  });

  describe("calculateYieldOnCost", () => {
    it("calcula o retorno real acumulado sobre o custo investido", () => {
      // Recebeu R$ 500 de proventos sobre um custo total de R$ 5.000 -> 10%
      expect(calculateYieldOnCost(500, 5000)).toBe(10);
      // Recebeu R$ 123.45 sobre R$ 1234.50 -> 10%
      expect(calculateYieldOnCost(123.45, 1234.5)).toBe(10);
    });

    it("retorna 0 para custo zerado ou sem proventos", () => {
      expect(calculateYieldOnCost(0, 5000)).toBe(0);
      expect(calculateYieldOnCost(500, 0)).toBe(0);
    });
  });

  describe("calculateYieldOnCostTotal", () => {
    it("soma proventos acumulados históricos e periódicos no YoC", () => {
      // Acumulado: R$ 300, Periódico: R$ 200, Custo: R$ 5.000 -> (500 / 5000) * 100 = 10%
      expect(calculateYieldOnCostTotal(300, 200, 5000)).toBe(10);
    });

    it("funciona quando há apenas proventos acumulados históricos (Cenário B)", () => {
      // Acumulado: R$ 500, Periódico: R$ 0, Custo: R$ 5.000 -> 10%
      expect(calculateYieldOnCostTotal(500, 0, 5000)).toBe(10);
    });

    it("funciona quando há apenas proventos periódicos (Cenário A)", () => {
      // Acumulado: R$ 0, Periódico: R$ 500, Custo: R$ 5.000 -> 10%
      expect(calculateYieldOnCostTotal(0, 500, 5000)).toBe(10);
    });

    it("retorna 0 se custo for zero ou não houver proventos", () => {
      expect(calculateYieldOnCostTotal(0, 0, 5000)).toBe(0);
      expect(calculateYieldOnCostTotal(300, 200, 0)).toBe(0);
    });
  });

  describe("resolveMonthlyDividendPerShare", () => {
    it("prioriza proventos periódicos reais quando disponíveis (Cenário A e C)", () => {
      // Ativo tem 100 cotas, último provento foi R$ 50 (0,50/cota). Estimativa manual é R$ 0,40.
      // Prioridade: latest_tx (0,50/cota)
      const res = resolveMonthlyDividendPerShare(50, 100, 0.4);
      expect(res.perShare).toBe(0.5);
      expect(res.source).toBe("latest_tx");
    });


    it("usa estimativa manual quando não há proventos periódicos (Cenário B)", () => {
      // Ativo não tem lançamentos periódicos (null), mas tem estimativa manual de R$ 0,40
      const res = resolveMonthlyDividendPerShare(null, 100, 0.4);
      expect(res.perShare).toBe(0.4);
      expect(res.source).toBe("manual_estimate");
    });

    it("retorna source none quando não há proventos periódicos nem estimativa manual", () => {
      const res = resolveMonthlyDividendPerShare(null, 100, 0);
      expect(res.perShare).toBe(0);
      expect(res.source).toBe("none");
    });
  });


  describe("calculateBazinTargetPrice", () => {
    it("calcula o preço teto com a taxa padrão de 6% a.a. e margem de segurança", () => {
      // PETR4 paga R$ 3,00 de proventos/ano. Preço teto = 3 / 0.06 = R$ 50,00.
      // Cotação atual a R$ 40,00 -> margem de +25%.
      const result = calculateBazinTargetPrice({
        annualDividendPerShare: 3.0,
        currentPrice: 40.0,
      });

      expect(result.targetPrice).toBe(50.0);
      expect(result.marginOfSafetyPct).toBe(25.0);
      expect(result.isBelowTarget).toBe(true);
    });

    it("identifica ativo acima do preço teto", () => {
      // Cotação a R$ 60,00 para teto de R$ 50,00
      const result = calculateBazinTargetPrice({
        annualDividendPerShare: 3.0,
        currentPrice: 60.0,
      });

      expect(result.targetPrice).toBe(50.0);
      expect(result.marginOfSafetyPct).toBe(-16.7);
      expect(result.isBelowTarget).toBe(false);
    });
  });

  describe("calculatePortfolioConcentration", () => {
    it("detecta ativo concentrado acima de 25%", () => {
      const rows = [
        { assetId: "1", ticker: "PETR4", valueBRL: 6000 },
        { assetId: "2", ticker: "VALE3", valueBRL: 2000 },
        { assetId: "3", ticker: "MXRF11", valueBRL: 2000 },
      ];

      const result = calculatePortfolioConcentration(rows, 25);
      expect(result.isConcentrated).toBe(true);
      expect(result.concentratedAssets).toHaveLength(1);
      expect(result.concentratedAssets[0]?.ticker).toBe("PETR4");
      expect(result.concentratedAssets[0]?.pct).toBe(60);
      expect(result.maxConcentrationPct).toBe(60);
    });

    it("retorna falso para carteira bem distribuída", () => {
      const rows = [
        { assetId: "1", ticker: "PETR4", valueBRL: 2000 },
        { assetId: "2", ticker: "VALE3", valueBRL: 2000 },
        { assetId: "3", ticker: "MXRF11", valueBRL: 2000 },
        { assetId: "4", ticker: "HGLG11", valueBRL: 2000 },
        { assetId: "5", ticker: "IVVB11", valueBRL: 2000 },
      ];

      const result = calculatePortfolioConcentration(rows, 25);
      expect(result.isConcentrated).toBe(false);
      expect(result.concentratedAssets).toHaveLength(0);
    });
  });

  describe("normalizeAllocationTargets", () => {
    it("normaliza metas que somam mais de 100% para exatamente 100%", () => {
      const targets = [
        { id: "1", targetPercentage: 50 },
        { id: "2", targetPercentage: 50 },
        { id: "3", targetPercentage: 50 },
      ];

      const normalized = normalizeAllocationTargets(targets);
      const sum = normalized.reduce((acc, t) => acc + t.targetPercentage, 0);
      expect(sum).toBe(100);
      expect(normalized[0]?.targetPercentage).toBe(33.33);
      expect(normalized[1]?.targetPercentage).toBe(33.33);
      expect(normalized[2]?.targetPercentage).toBe(33.34);
    });

    it("distribui igualmente quando todas as metas são 0", () => {
      const targets = [
        { id: "1", targetPercentage: 0 },
        { id: "2", targetPercentage: 0 },
        { id: "3", targetPercentage: 0 },
        { id: "4", targetPercentage: 0 },
      ];

      const normalized = normalizeAllocationTargets(targets);
      const sum = normalized.reduce((acc, t) => acc + t.targetPercentage, 0);
      expect(sum).toBe(100);
      expect(normalized.every((t) => t.targetPercentage === 25)).toBe(true);
    });

    it("normaliza para um teto customizado (ex: 40%)", () => {
      const targets = [
        { id: "1", targetPercentage: 20 },
        { id: "2", targetPercentage: 20 },
      ];
      const normalized = normalizeAllocationTargets(targets, 40);
      const sum = normalized.reduce((acc, t) => acc + t.targetPercentage, 0);
      expect(sum).toBe(40);
      expect(normalized[0]?.targetPercentage).toBe(20);
      expect(normalized[1]?.targetPercentage).toBe(20);
    });
  });

  describe("detectReinvestmentOpportunities (F50)", () => {
    it("identifica ativos cujos proventos no mês compram 1 ou mais cotas completas", () => {
      const opportunities = detectReinvestmentOpportunities([
        {
          assetId: "a1",
          ticker: "HGLG11",
          currentPrice: 160.0,
          quantity: 150,
          monthDividends: 165.0, // compra 1 cota de R$ 160,00, sobra R$ 5,00
        },
        {
          assetId: "a2",
          ticker: "MXRF11",
          currentPrice: 10.0,
          quantity: 500,
          monthDividends: 50.0, // compra 5 cotas de R$ 10,00, sobra R$ 0,00
        },
        {
          assetId: "a3",
          ticker: "ITUB4",
          currentPrice: 35.0,
          quantity: 10,
          monthDividends: 15.0, // R$ 15 < R$ 35 -> não compra cota inteira
        },
      ]);

      expect(opportunities).toHaveLength(2);
      expect(opportunities[0]?.ticker).toBe("MXRF11");
      expect(opportunities[0]?.purchasableShares).toBe(5);
      expect(opportunities[0]?.totalReinvestmentValue).toBe(50.0);
      expect(opportunities[0]?.leftoverDividends).toBe(0.0);

      expect(opportunities[1]?.ticker).toBe("HGLG11");
      expect(opportunities[1]?.purchasableShares).toBe(1);
      expect(opportunities[1]?.totalReinvestmentValue).toBe(160.0);
      expect(opportunities[1]?.leftoverDividends).toBe(5.0);
    });

    it("retorna lista vazia quando nenhum ativo atinge o valor de 1 cota", () => {
      const opportunities = detectReinvestmentOpportunities([
        {
          assetId: "a1",
          ticker: "KNRI11",
          currentPrice: 140.0,
          quantity: 10,
          monthDividends: 10.0,
        },
      ]);

      expect(opportunities).toEqual([]);
    });
  });
});
