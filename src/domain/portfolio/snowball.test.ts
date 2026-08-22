import { describe, expect, it } from "vitest";
import {
  calculateBazinTargetPrice,
  calculatePortfolioConcentration,
  calculateSnowballProgress,
  calculateYieldOnCost,
  normalizeAllocationTargets,
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
  });
});
