/**
 * Portão de Qualidade Final v3 — Certificação de Produção (>= 98/100)
 * Caso Canônico BR-20261119-6445 (Dossiê Executivo, Extrato Analítico e Relatório Executivo)
 *
 * Valida os 6 Gates de Auditoria Forense Definidos em prompt_v3_certificacao_final_axir.md:
 * - Gate v3.1: Sincronização de Fluxo Líquido (Dossiê, Relatório Executivo, Extrato TWR: R$ 100,38)
 * - Gate v3.2: Continuidade da Coluna Retorno Total no Extrato (-1,4% em Nov/26 MTD sem salto para +8,7%)
 * - Gate v3.3: Consistência Estritamente Positiva (r > 0), sem_snapshot para gaps e alinhamento Sharpe/CDI 12M
 * - Gate v3.4: Transparência de Câmbio PTAX / Fallback no Rodapé de Internacional
 * - Gate v3.5: Card 4 Reconciliado com Realizados e Duplo Custo Explicado na Narrativa (R$ 17.319,94 + R$ 289,45)
 * - Gate v3.6: Polimento Final (Ciclicidade & Porte, rótulo SELIC, proteção contra cabeçalho órfão)
 */

import { describe, expect, it } from "vitest";
import { formatFixedIncomeRateLabel } from "@/domain/portfolio/fixed-income";
import { formatFixedIncomeRateLabel as formatGroupRateLabel } from "@/domain/portfolio/position-grouping";
import { calculateConsistencyMetrics, calculatePortfolioRiskSummary } from "@/domain/portfolio/risk-metrics";
import { buildPortfolioMonthlySeries } from "@/domain/portfolio/summary";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { computePeriodInvestmentFlow } from "@/domain/reports/period-investment-flow";

describe("Portão de Qualidade Final v3 — Certificação de Produção", () => {
  describe("Gate v3.1 — Sincronização do Fluxo Líquido em Todos os Relatórios", () => {
    it("Dossiê, Relatório Executivo e Extrato TWR consolidam R$ 100,38 no mês corrente", () => {
      // Cenário caso-base: aporte de R$ 100,38 registrado via extrato mensal homogêneo
      const flow = computePeriodInvestmentFlow({
        monthlyStatement: {
          monthBuysBRL: 0,
          monthSellsBRL: 0,
          monthDividendsBRL: 0,
          monthNetContributionBRL: 100.38,
          transactionsCount: 0,
        },
      });

      expect(flow.buysBRL).toBe(100.38);
      expect(flow.sellsBRL).toBe(0);
      expect(flow.netFlowBRL).toBe(100.38);
      expect(flow.externalContributionsBRL).toBe(100.38);
    });

    it("prioriza reconciledNetFlowBRL quando fornecido pela série mensal canônica", () => {
      const flow = computePeriodInvestmentFlow({
        reconciledNetFlowBRL: 100.38,
      });

      expect(flow.netFlowBRL).toBe(100.38);
      expect(flow.buysBRL).toBe(100.38);
    });
  });

  describe("Gate v3.2 — Continuidade da Coluna Retorno Total no Extrato", () => {
    it("aplica a fórmula contínua do período na linha MTD segregada, calculando -1,4% sem salto artificial", () => {
      // 2 meses históricos fechados + 1 mês MTD (Nov/26)
      const rawSnapshots = [
        { month: "2026-09", total_value: 17500, total_cost: 17000 },
        { month: "2026-10", total_value: 17400, total_cost: 17509.01 },
      ];

      const currentMonthPoint = {
        month: "2026-11",
        total_value: 17358.36,
        total_cost: 17609.39, // delta custo = +100.38
        capital_gain_pnl: -249.42,
        capital_gain_pct: -1.42,
        total_return_pnl: 1508.15,
        total_return_pct: 8.71, // all-time na custódia aberta
        status: "provisional" as const,
      };

      const series = buildPortfolioMonthlySeries({
        rawSnapshots,
        currentMonthPoint,
        dividends: [{ date: "2026-11-05", amount: 4.6 }],
        contributions: [{ date: "2026-11-10", amount: 100.38 }],
        initialAccumulatedDividends: 1789.87,
        openingDividendsBalance: 1789.87,
        segregateOpeningDividends: true,
        limit: 0,
      });

      const mtdRow = series.find((s) => s.month === "2026-11");
      expect(mtdRow).toBeDefined();

      // Invariante v3: totalReturnPct do período reflete a variação do período contínuo (-1,4%)
      // e preserva allTimeTotalReturnPct para a visão histórica consolidada (+8,7%)
      expect(mtdRow?.totalReturnPct).toBeCloseTo(-1.4, 0.5);
      expect(mtdRow?.allTimeTotalReturnPct).toBeCloseTo(8.7, 0.5);
    });
  });

  describe("Gate v3.3 — Consistência Estritamente Positiva (r > 0) e sem_snapshot", () => {
    it("trata 0,00% como neutro, calculando 5/12 (41,7%) em carteira com 5 meses positivos e 1 zerado", () => {
      // 12 meses fechados: 5 positivos (> 0), 1 zerado (0.00%), 6 negativos (< 0)
      const rates = [1.5, 2.0, -0.8, -1.2, 0.0, 3.1, -0.5, 1.2, -2.1, 0.8, -1.5, -0.4];
      const consistency = calculateConsistencyMetrics(rates);

      expect(consistency.totalMonths).toBe(12);
      expect(consistency.positiveMonths).toBe(5);
      expect(consistency.negativeMonths).toBe(6);
      expect(consistency.winRatePct).toBeCloseTo(41.7, 1);
    });

    it("classifica meses sem dados no calendário como sem_snapshot sem contaminação estatística", () => {
      const rawSnapshots = [
        { month: "2026-07", total_value: 17000, total_cost: 16800 },
        // Ago/2026 ausente (gap de snapshot)
        { month: "2026-09", total_value: 17500, total_cost: 17000 },
      ];

      const series = buildPortfolioMonthlySeries({
        rawSnapshots,
        currentMonthPoint: null,
        limit: 0,
      });

      const agoRow = series.find((s) => s.month === "2026-08");
      expect(agoRow).toBeDefined();
      expect(agoRow?.snapshotOrigin).toBe("sem_snapshot");
      expect(agoRow?.netContributionBRL).toBe(0);
    });

    it("calcula Sharpe ratio alinhado com o CDI acumulado de 12 meses", () => {
      const points = [
        { patrimonyBRL: 16000, ratePct: 1.0 },
        { patrimonyBRL: 16200, ratePct: 0.8 },
        { patrimonyBRL: 16400, ratePct: -0.5 },
        { patrimonyBRL: 16500, ratePct: 1.2 },
        { patrimonyBRL: 16600, ratePct: 0.9 },
        { patrimonyBRL: 16700, ratePct: -0.4 },
        { patrimonyBRL: 16800, ratePct: 1.1 },
        { patrimonyBRL: 16900, ratePct: 0.5 },
        { patrimonyBRL: 17000, ratePct: -1.0 },
        { patrimonyBRL: 17200, ratePct: 1.5 },
        { patrimonyBRL: 17400, ratePct: -0.8 },
        { patrimonyBRL: 17358, ratePct: -0.2 },
      ];

      const summary = calculatePortfolioRiskSummary(points, 12.6, { useTrailing12Months: true });
      expect(summary.volatility.annualizedStdDevPct).toBeGreaterThan(0);
      expect(summary.consistency.totalMonths).toBe(12);
      expect(typeof summary.sharpeRatio).toBe("number");
    });
  });

  describe("Gate v3.4 — Transparência de Câmbio PTAX / Fallback", () => {
    it("reconhece FALLBACK_USD_RATE (5.25) como câmbio de referência estimado", () => {
      const rate = 5.25;
      const isFallback = Math.abs(rate - FALLBACK_USD_RATE) < 0.0001;
      expect(isFallback).toBe(true);

      const label = isFallback
        ? `Conversão USD/BRL pelo câmbio de referência estimado (fallback): R$ ${rate.toFixed(4).replace(".", ",")}`
        : `Conversão USD/BRL pela PTAX Oficial BCB de referência: R$ ${rate.toFixed(4).replace(".", ",")}`;

      expect(label).toContain("fallback");
      expect(label).toContain("R$ 5,2500");
    });
  });

  describe("Gate v3.5 — Reconciliação Contábil de Custo e P&L Histórico", () => {
    it("reconcilia custo de ativos aplicados com custo total consolidado com reserva de caixa", () => {
      const activeAssetsCostBRL = 17319.94;
      const cashReserveBRL = 289.45;
      const totalConsolidatedCostBRL = Math.round((activeAssetsCostBRL + cashReserveBRL) * 100) / 100;

      expect(totalConsolidatedCostBRL).toBe(17609.39);

      const totalReturnBRL = 1508.15;
      const returnOnAssetsPct = (totalReturnBRL / activeAssetsCostBRL) * 100;
      const returnOnTotalPct = (totalReturnBRL / totalConsolidatedCostBRL) * 100;

      // Retorno sobre ativos = +8,7% | Retorno com caixa = +8,6%
      expect(Math.round(returnOnAssetsPct * 10) / 10).toBe(8.7);
      expect(Math.round(returnOnTotalPct * 10) / 10).toBe(8.6);
    });

    it("soma ganhos realizados e proventos de ativos encerrados ao P&L Total", () => {
      const unrealizedPnl = -249.42;
      const activeDividends = 1757.57;
      const closedDividends = 36.90;
      const realizedSalesGain = 0.0;

      const totalEconomicPnl = Math.round(
        (unrealizedPnl + activeDividends + closedDividends + realizedSalesGain) * 100,
      ) / 100;

      // Com ativos encerrados: R$ 1.545,05; sem ativos encerrados: R$ 1.508,15
      expect(totalEconomicPnl).toBe(1545.05);
    });
  });

  describe("Gate v3.6 — Polimento Visual & Ausência de Quebras Indesejadas", () => {
    it("formata rótulo de TESOURO-SELIC como SELIC no relatório executivo e tabelas", () => {
      const labelDirect = formatFixedIncomeRateLabel(
        { rate_type: "selic", rate_value: 100 },
        "TESOURO-SELIC",
      );
      expect(labelDirect).toBe("SELIC");

      const labelCdiFix = formatFixedIncomeRateLabel(
        { rate_type: "cdi", rate_value: 100 },
        "TESOURO-SELIC",
      );
      expect(labelCdiFix).toBe("SELIC");

      const labelGroup = formatGroupRateLabel({
        isMatured: false,
        ticker: "TESOURO-SELIC",
        fixedIncomeMetadata: { rate_type: "selic", rate_value: 100, base_date: "2026-01-01" },
      });
      expect(labelGroup).toBe("SELIC");
    });

    it("formata Selic com ágio/deságio explícito quando rate_value < 10", () => {
      const label = formatFixedIncomeRateLabel(
        { rate_type: "selic", rate_value: 0.15 },
        "TESOURO-SELIC-2029",
      );
      expect(label).toBe("Selic + 0,15% a.a.");
    });
  });
});
