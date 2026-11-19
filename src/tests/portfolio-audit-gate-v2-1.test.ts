import { describe, expect, it } from "vitest";
import {
  calculateTwrSeries,
  type TwrMonthlyInputPoint,
} from "@/domain/portfolio/twr";
import {
  buildPortfolioMonthlySeries,
} from "@/domain/portfolio/summary";
import {
  PortfolioReportInvariantValidator,
} from "@/domain/reports/portfolio-report-invariant-validator";
import { createGoldenPayload } from "./portfolio-audit-gate6.test";

describe("Portão de Qualidade v2.1 (Gate v2.1) — Sanidade do Motor Híbrido, Ago/2026 e Proventos Segregados", () => {
  describe("Critério 1: Correção da Anomalia de Ago/2026 em Carry-Forward", () => {
    it("garante que Ago/2026 com patrimônio e custo inalterados produz TWR = 0,00% e mantém a cota inalterada", () => {
      // Simulação do caso real:
      // Jul/2026: Saldo R$ 17.739,85, Custo R$ 16.802,03, Cota R$ 109,14
      // Ago/2026: Saldo R$ 17.739,85, Custo R$ 16.802,03 (carry_forward interpolado)
      const points: TwrMonthlyInputPoint[] = [
        {
          month: "2026-06",
          totalValueBRL: 17000.0,
          totalCostBRL: 16500.0,
          explicitRatePct: 2.0,
        },
        {
          month: "2026-07",
          totalValueBRL: 17739.85,
          totalCostBRL: 16802.03,
          explicitRatePct: 4.35,
          snapshotOrigin: "retroativo_manual",
        },
        {
          month: "2026-08",
          totalValueBRL: 17739.85,
          totalCostBRL: 16802.03,
          netExternalCashFlowBRL: 0,
          snapshotOrigin: "carry_forward",
        },
      ];

      const res = calculateTwrSeries(points);
      expect(res.status).toBe("ok");

      const julPoint = res.series.find((p) => p.month === "2026-07");
      const agoPoint = res.series.find((p) => p.month === "2026-08");

      expect(julPoint).toBeDefined();
      expect(agoPoint).toBeDefined();

      // Ago/2026 TWR DEVE ser 0.00%
      expect(agoPoint?.monthRatePct).toBe(0.0);
      // A cota de Ago/2026 DEVE ser rigorosamente igual à de Jul/2026 (sem queda para 107,94)
      expect(agoPoint?.sharePrice).toBe(julPoint?.sharePrice);
      expect(agoPoint?.accumulatedRatePct).toBe(julPoint?.accumulatedRatePct);
    });

    it("protege contra atribuição espúria de fluxo em meses com delta de saldo e custo nulos (Invariante ANBIMA)", () => {
      const points: TwrMonthlyInputPoint[] = [
        { month: "2026-07", totalValueBRL: 17739.85, totalCostBRL: 16802.03 },
        {
          month: "2026-08",
          totalValueBRL: 17739.85,
          totalCostBRL: 16802.03,
          snapshotOrigin: "carry_forward",
        },
      ];

      const res = calculateTwrSeries(points);
      expect(res.series[1]?.monthRatePct).toBeGreaterThanOrEqual(0.0);
      expect(res.series[1]?.monthRatePct).toBe(0.0);
      expect(res.series[1]?.sharePrice).toBe(100.0);
    });
  });

  describe("Critério 2: Segregação Limpa de Proventos Retroativos vs. Mensais", () => {
    it("não contamina o mês 1 (Out/2024) com saldo retroativo global de R$ 1.789,87 e preserva congruência do período", () => {
      const rawSnapshots = [
        { month: "2024-10", total_value: 3000, total_cost: 3000 },
        { month: "2024-11", total_value: 3100, total_cost: 3000 },
        { month: "2026-08", total_value: 17739.85, total_cost: 16802.03 },
        { month: "2026-09", total_value: 18562.39, total_cost: 17170.83 },
      ];

      // Proventos pingando apenas em Ago/2026 e Set/2026
      const dividends = [
        { date: "2026-08-15", amount: 4.60 },
        { date: "2026-09-15", amount: 15.00 },
      ];

      // Saldo inicial retroativo informado
      const initialAccumulatedDividends = 1789.87;

      const series = buildPortfolioMonthlySeries({
        rawSnapshots,
        dividends,
        initialAccumulatedDividends,
        openingDividendsBalance: initialAccumulatedDividends,
        segregateOpeningDividends: true,
        limit: 0,
      });

      // Mês 1 (Out/2024) NÃO pode ter R$ 1.789,87 de proventos acumulados no período
      const oct2024 = series.find((p) => p.month === "2024-10");
      expect(oct2024).toBeDefined();
      expect(oct2024?.monthDividendsBRL).toBe(0);
      expect(oct2024?.accumulatedDividendsBRL).toBe(0);
      expect(oct2024?.openingDividendsBalanceBRL).toBe(1789.87);
      expect(oct2024?.totalHistoricalDividendsBRL).toBe(1789.87);
      // Retorno total de Out/2024 deve ser 0% (e não 59.6%)
      expect(oct2024?.totalReturnPnl).toBe(0);
      expect(oct2024?.totalReturnPct).toBe(0);

      // Ago/2026 deve receber os R$ 4,60
      const ago2026 = series.find((p) => p.month === "2026-08");
      expect(ago2026).toBeDefined();
      expect(ago2026?.monthDividendsBRL).toBe(4.60);
      expect(ago2026?.accumulatedDividendsBRL).toBe(4.60);
      expect(ago2026?.totalHistoricalDividendsBRL).toBe(1794.47);

      // Set/2026 acumula +15.00 -> 19.60
      const sep2026 = series.find((p) => p.month === "2026-09");
      expect(sep2026).toBeDefined();
      expect(sep2026?.monthDividendsBRL).toBe(15.00);
      expect(sep2026?.accumulatedDividendsBRL).toBe(19.60);

      // Invariante de Reconciliação do Período: soma(Proventos Mês) === Proventos Acumulado Final
      const sumMonthDivs = series.reduce((acc, p) => acc + p.monthDividendsBRL, 0);
      const lastPoint = series[series.length - 1];
      expect(sumMonthDivs).toBe(lastPoint?.accumulatedDividendsBRL);
      expect(sumMonthDivs).toBe(19.60);
    });
  });

  describe("Critério 3: Continuidade de Cotização na Transição Retroativo -> Ledger", () => {
    it("assegura que a cota transiciona continuamente sem recálculo do passado", () => {
      const points: TwrMonthlyInputPoint[] = [
        {
          month: "2026-08",
          totalValueBRL: 17739.85,
          totalCostBRL: 16802.03,
          explicitRatePct: 0.0,
          snapshotOrigin: "carry_forward",
        },
        {
          month: "2026-09",
          totalValueBRL: 18562.39,
          totalCostBRL: 17170.83,
          netExternalCashFlowBRL: 368.80,
          snapshotOrigin: "calculado_ledger",
        },
      ];

      const res = calculateTwrSeries(points);
      expect(res.series[0]?.sharePrice).toBe(100.0);
      // Set/2026 Dietz: ganho 453.74 / base 17924.25 = +2.53%
      expect(res.series[1]?.monthRatePct).toBeGreaterThan(2.0);
      expect(res.series[1]?.sharePrice).toBeGreaterThan(100.0);
    });
  });

  describe("Critério 4: Asserção 13 do Validador de Invariantes", () => {
    it("valida que o validador bloqueia TWR negativo em carry-forward e aprova quando congruente", () => {
      const payload = createGoldenPayload();

      // No Golden Dataset, Ago/2026 está em carry-forward com TWR = 0,00%
      const validation = PortfolioReportInvariantValidator.validate(payload);
      expect(validation.assertionsCheckedCount).toBe(14);
      expect(validation.isValid).toBe(true);
      const asser13Errors = validation.errors.filter((e) => e.includes("Asserção 13"));
      expect(asser13Errors).toHaveLength(0);

      // Agora simulamos corrupção: em Ago/2026 (onde deltaCost=0 e deltaEquity=0), injetamos TWR = -1.10%
      const jul26 = payload.monthlyEvolutionSeries.find((r) => r.competence === "2026-07")!;
      const corruptedSeries = payload.monthlyEvolutionSeries.map((row) => {
        if (row.competence === "2026-08") {
          return {
            ...row,
            endEquityBRL: jul26.endEquityBRL, // Carry forward idêntico a Jul/2026
            openCostBRL: jul26.openCostBRL,   // Custo inalterado
            monthTwrPct: -1.10, // Violação: variação nula mas TWR negativo!
          };
        }
        return row;
      });

      const corruptedPayload = {
        ...payload,
        monthlyEvolutionSeries: corruptedSeries,
      };

      const corruptedValidation = PortfolioReportInvariantValidator.validate(corruptedPayload);
      expect(corruptedValidation.isValid).toBe(false);
      const corruptedAsser13 = corruptedValidation.errors.filter((e) => e.includes("Asserção 13"));
      expect(corruptedAsser13.length).toBeGreaterThan(0);
      expect(corruptedAsser13[0]).toContain("Asserção 13");
      expect(corruptedAsser13[0]).toContain("2026-08");
    });
  });
});
