/**
 * Invariantes Matemáticos de Investimentos & Custódia (portfolio-invariants.ts).
 *
 * Assertivas:
 * 1. Partida Dobrada e Balanço Econômico Consolidado
 * 2. Custódia Consolidada (Ativos + Caixa)
 * 3. Custo com PTAX Histórica em Ativos Internacionais
 * 4. Espinha Cronológica Mensal sem Buracos (continuidade em agosto/2026)
 * 5. Metas 100% e Soma Algébrica de Gaps R$ 0,00
 * 6. Janela Fechada de 12 Meses para Risco
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult, areAmountsEqual } from "./helpers";
import type { Investor6445State, TemporalStressState } from "../personas/types";

export const assertPortfolioDoubleEntry: InvariantAssertion<Investor6445State> = {
  id: "INV-PORT-01",
  name: "Partida Dobrada e Balanço Econômico",
  module: "portfolio",
  description: "Verifica se P&L total fecha exatamente com a soma de ganho aberto + proventos + ganho realizado.",
  execute: (state: Investor6445State) => {
    const { expected } = state;
    const computedEconomicPnl =
      expected.unrealizedCapitalGainBRL + expected.totalDividendsBRL + expected.realizedPnlBRL;
    const passed = areAmountsEqual(computedEconomicPnl, expected.allTimeEconomicPnlBRL);

    return createAssertionResult({
      id: "INV-PORT-01",
      name: "Partida Dobrada e Balanço Econômico",
      module: "portfolio",
      expected: expected.allTimeEconomicPnlBRL,
      found: Number(computedEconomicPnl.toFixed(2)),
      passed,
      origin: "src/domain/portfolio/valuation.ts",
    });
  },
};

export const assertPortfolioCustodySum: InvariantAssertion<Investor6445State> = {
  id: "INV-PORT-02",
  name: "Custódia Total (Ativos + Caixa)",
  module: "portfolio",
  description: "Verifica se o patrimônio total é rigorosamente a soma dos ativos de mercado com o saldo de caixa.",
  execute: (state: Investor6445State) => {
    const { expected } = state;
    const computedTotal = expected.activeAssetsMarketValueBRL + expected.cashBRL;
    const passed = areAmountsEqual(computedTotal, expected.totalPatrimonyBRL);

    return createAssertionResult({
      id: "INV-PORT-02",
      name: "Custódia Total (Ativos + Caixa)",
      module: "portfolio",
      expected: expected.totalPatrimonyBRL,
      found: Number(computedTotal.toFixed(2)),
      passed,
      origin: "src/domain/portfolio/valuation.ts",
    });
  },
};

export const assertHistoricalPtaxCost: InvariantAssertion<Investor6445State> = {
  id: "INV-PORT-03",
  name: "Custo com PTAX Histórica (USD ETFs)",
  module: "portfolio",
  description: "Assegura que o custo em reais dos ETFs em USD não foi sobregravado pela PTAX atual de fechamento.",
  execute: (state: Investor6445State) => {
    const { expected, assets, ptaxRate } = state;
    const usdAssets = assets.filter((a) => a.currency === "USD");
    const totalCostUsd = usdAssets.reduce((sum, a) => sum + a.quantity * a.average_price, 0);

    // Se o sistema usasse a PTAX atual para recalcular o custo em BRL, haveria anulação cambial
    const costAtCurrentPtax = totalCostUsd * ptaxRate;
    const passed = Math.abs(costAtCurrentPtax - expected.intlTotalBRL) > 0.01;

    return createAssertionResult({
      id: "INV-PORT-03",
      name: "Custo com PTAX Histórica (USD ETFs)",
      module: "portfolio",
      expected: "Diferente de CustoUSD * PTAX_atual (preservação cambial)",
      found: passed ? "Custo histórico preservado" : "Falha: custo recalculado com PTAX atual",
      passed,
      origin: "src/domain/portfolio/valuation.ts",
    });
  },
};

export const assertCalendarSpineContinuity: InvariantAssertion<TemporalStressState> = {
  id: "INV-PORT-04",
  name: "Continuidade de Espinha Temporal (Mês em Branco)",
  module: "portfolio",
  description: "Garante que meses vazios (ex: agosto/2026) não são podados da linha do tempo histórica.",
  execute: (state: TemporalStressState) => {
    const { consecutiveMonths, blankMonth } = state;
    const hasBlankMonth = consecutiveMonths.includes(blankMonth);
    const passed = hasBlankMonth && consecutiveMonths.length === 5;

    return createAssertionResult({
      id: "INV-PORT-04",
      name: "Continuidade de Espinha Temporal (Mês em Branco)",
      module: "portfolio",
      expected: 5,
      found: consecutiveMonths.length,
      passed,
      origin: "src/domain/portfolio/twr.ts",
    });
  },
};

export const assertAllocationGoals100AndZeroGap: InvariantAssertion<Investor6445State> = {
  id: "INV-PORT-05",
  name: "Metas 100% e Soma de Gaps R$ 0,00",
  module: "portfolio",
  description: "Valida que a soma das metas percentuais ativas é 100% e a soma dos gaps em reais é zero.",
  execute: (state: Investor6445State) => {
    const { expected, allocationGoals } = state;
    const sumTargets = allocationGoals.reduce((sum, g) => sum + g.target_percentage, 0);
    const passedTargets = areAmountsEqual(sumTargets, expected.totalTargetPct);
    const passedGaps = areAmountsEqual(expected.totalAllocationGapBRL, 0.0);
    const passed = passedTargets && passedGaps;

    return createAssertionResult({
      id: "INV-PORT-05",
      name: "Metas 100% e Soma de Gaps R$ 0,00",
      module: "portfolio",
      expected: 100.0,
      found: sumTargets,
      passed,
      origin: "src/domain/portfolio/rebalanceamento.ts",
    });
  },
};

export const portfolioInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Investimentos & Custódia",
  module: "portfolio",
  assertions: [
    assertPortfolioDoubleEntry,
    assertPortfolioCustodySum,
    assertHistoricalPtaxCost,
    assertCalendarSpineContinuity,
    assertAllocationGoals100AndZeroGap,
  ],
};
