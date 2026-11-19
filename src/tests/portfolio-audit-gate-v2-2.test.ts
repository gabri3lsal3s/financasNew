/**
 * Portão de Qualidade v2.2 (Gate v2.2)
 * Certificação da Invariante de Fluxo de Caixa, Eliminação da Tripla Contradição e Rastreabilidade de Caixa (§Bloco 2).
 *
 * Módulo puro e desacoplado de banco, React e UI.
 */

import { describe, expect, it } from "vitest";
import { createCanonicalMonthlyStatement } from "@/domain/portfolio/canonical-types";
import { buildPortfolioMonthlySeries } from "@/domain/portfolio/summary";
import { computePeriodInvestmentFlow } from "@/domain/reports/period-investment-flow";
import { PortfolioReportInvariantValidator } from "@/domain/reports/portfolio-report-invariant-validator";
import { createGoldenPayload } from "./portfolio-audit-gate6.test";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

describe("Portão de Qualidade v2.2 (Gate v2.2) — Invariante de Fluxo de Caixa e Movimentações de Nov/2026", () => {
  describe("Critério 1: Invariante Contábil de Fluxo Externo (F_t = Delta C_total)", () => {
    it("garante que F_t é reconciliado com Delta C_total (+R$ 100,38) em vez de permanecer descolado em +R$ 45,88", () => {
      const series = buildPortfolioMonthlySeries({
        rawSnapshots: [
          {
            month: "2026-10",
            total_value: 18318.48,
            total_cost: 17509.01,
          },
          {
            month: "2026-11",
            total_value: 17358.36,
            total_cost: 17609.39, // Delta C = +100.38
          },
        ],
        dividends: [],
        // Contribuição parcial registrada (R$ 45,88) que antes causava o descolamento de R$ 54,50
        contributions: [
          {
            date: "2026-11-05",
            amount: 45.88,
            notes: null,
          },
        ],
      });

      expect(series).toHaveLength(2);
      const nov26 = series.find((p) => p.month === "2026-11");
      expect(nov26).toBeDefined();

      // Delta C = 17609.39 - 17509.01 = 100.38
      // Pela Invariante F_t = Delta C_total, o aporte expurgado no TWR DEVE ser R$ 100,38
      expect(nov26?.netContributionBRL).toBe(100.38);
    });
  });

  describe("Critério 2: Fim da Tripla Contradição (0 operações vs Aporte Líquido não-nulo)", () => {
    it("createCanonicalMonthlyStatement reporta transactionsCount >= 1 quando há fluxo externo sem trades de ativos", () => {
      const stmt = createCanonicalMonthlyStatement({
        month: "2026-11",
        startBalanceBRL: 18318.48,
        endBalanceBRL: 17358.36,
        netExternalCashFlowBRL: 100.38,
        transactions: [], // 0 trades de ações/FIIs
        dividends: [],
      });

      // Não pode exibir 0 operações quando houve aporte de R$ 100,38!
      expect(stmt.transactionsCount).toBe(1);
      expect(stmt.monthBuysBRL).toBe(100.38);
      expect(stmt.netExternalCashFlowBRL).toBe(100.38);
    });

    it("computePeriodInvestmentFlow contabiliza movimentações de CAIXA como operações financeiras", () => {
      const baseAsset: PortfolioAsset = {
        id: "asset-caixa",
        user_id: "u1",
        ticker: "CAIXA",
        asset_class: "Caixa",
        sector: null,
        currency: "BRL",
        quantity: 1,
        average_price: 100.38,
        notes: null,
        score: null,
        allocation_status: "active",
        thesis_summary: null,
        score_criteria: null,
        last_reviewed_at: null,
      };

      const cashTx: PortfolioTransaction = {
        id: "tx-cash-deposit",
        user_id: "u1",
        asset_id: "asset-caixa",
        type: "buy",
        date: "2026-11-10",
        quantity: 1,
        price: 100.38,
        total: 100.38,
      };

      const res = computePeriodInvestmentFlow({
        transactions: [cashTx],
        dividends: [],
        assets: [baseAsset],
        assetCurrencyMap: new Map([["asset-caixa", "BRL"]]),
        usdRate: 5.25,
        isDateInPeriod: (d) => d.startsWith("2026-11"),
        periodLabel: "Nov/2026",
      });

      expect(res.cashDepositsBRL).toBe(100.38);
      expect(res.buysBRL).toBe(100.38);
      expect(res.operationsCount).toBe(1);
      expect(res.netFlowBRL).toBe(100.38);
    });
  });

  describe("Critério 3: Asserção 14 do Validador de Invariantes", () => {
    it("valida que o validador aprova o Golden Payload com 14 asserções", () => {
      const payload = createGoldenPayload();
      const validation = PortfolioReportInvariantValidator.validate(payload);

      expect(validation.assertionsCheckedCount).toBe(14);
      expect(validation.isValid).toBe(true);
      const asser14Errors = validation.errors.filter((e) => e.includes("Asserção 14"));
      expect(asser14Errors).toHaveLength(0);
    });

    it("bloqueia payload que registre aporte positivo com custo aplicado zerado", () => {
      const payload = createGoldenPayload();
      const corruptedSeries = payload.monthlyEvolutionSeries.map((row) => {
        if (row.competence === "2026-09") {
          return {
            ...row,
            netFlowBRL: 500.0,
            openCostBRL: 0, // Incoerência
          };
        }
        return row;
      });

      const corruptedPayload = {
        ...payload,
        monthlyEvolutionSeries: corruptedSeries,
      };

      const validation = PortfolioReportInvariantValidator.validate(corruptedPayload);
      expect(validation.isValid).toBe(false);
      const asser14Errors = validation.errors.filter((e) => e.includes("Asserção 14"));
      expect(asser14Errors.length).toBeGreaterThan(0);
    });
  });
});
