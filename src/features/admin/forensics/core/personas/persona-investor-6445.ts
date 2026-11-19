/**
 * Persona Investidor — Caso Forense Canônico BR-20261118-6445
 *
 * Módulos: Investimentos, Relatórios Executivos, Insights de Carteira.
 * Valida integridade patrimonial, TWR, PTAX histórica, proventos e metas.
 */

/**
 * Persona Investidor — Caso Forense Canônico BR-20261118-6445
 *
 * Módulos: Investimentos & Custódia, Inteligência & SmartAdvisor.
 * Valida integridade patrimonial, TWR, PTAX histórica, proventos e metas.
 */

import type { TheoreticalPersona, Investor6445State, SyntheticAllocationGoal } from "./types";
import {
  GOLDEN_CASE_ID,
  GOLDEN_AS_OF_DATE,
  GOLDEN_PTAX_RATE,
  GOLDEN_EXPECTED,
  GOLDEN_ASSETS_FIXTURE,
  GOLDEN_TRANSACTIONS_FIXTURE,
  GOLDEN_TARGETS_SANITIZED,
} from "@/tests/fixtures/golden_portfolio_6445";

export const personaInvestor6445: TheoreticalPersona<Investor6445State> = {
  id: "persona-investor-6445",
  name: "Investidor Consolidado (Caso BR-20261118-6445)",
  description:
    "Reproduz a carteira real multimoeda de 26 ativos, 6 ETFs em USD com PTAX histórica, R$ 1.794,47 em proventos e 26 competências mensais.",
  targetModules: ["portfolio", "insights"],
  instantiate: (): Investor6445State => {
    const allocationGoals: SyntheticAllocationGoal[] = GOLDEN_TARGETS_SANITIZED.map((t, index) => ({
      id: `goal-${index + 1}`,
      user_id: "user-6445",
      asset_class: t.assetClass,
      target_percentage: t.targetPercentage,
    }));

    const historicalQuotes: Record<string, number> = {
      VOO: 500.0,
      GLD: 229.47,
      BITB: 41.85,
      VEA: 50.0,
      ARGT: 60.0,
      MCHI: 46.67,
      "TESOURO-SELIC": 1617.51,
      "CDB ORIGINAL": 1348.01,
      "TESOURO-IPCA": 214.65,
    };

    const usdHistoricalPtax: Record<string, number> = {
      "2024-10-01": 5.0,
      "2025-01-15": 5.15,
      "2025-06-20": 5.2,
      "2026-11-18": GOLDEN_PTAX_RATE,
    };

    return {
      caseId: GOLDEN_CASE_ID,
      asOfDate: GOLDEN_AS_OF_DATE,
      ptaxRate: GOLDEN_PTAX_RATE,
      expected: { ...GOLDEN_EXPECTED },
      // Cópia profunda/isolada em memória
      assets: JSON.parse(JSON.stringify(GOLDEN_ASSETS_FIXTURE)),
      transactions: JSON.parse(JSON.stringify(GOLDEN_TRANSACTIONS_FIXTURE)),
      allocationGoals,
      historicalQuotes,
      usdHistoricalPtax,
    };
  },
};

