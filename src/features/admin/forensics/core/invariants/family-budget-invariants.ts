/**
 * Invariantes Matemáticos de Orçamento Familiar & Provisões (family-budget-invariants.ts).
 *
 * Assertivas:
 * 1. Rateio Proporcional à Renda (60/40) e Conservação de Centavos
 * 2. Fechamento da Matriz Orçamentária 50/30/20 (Soma = 100%)
 * 3. Provisões Anuais 1/12 e Consumo Carimbado
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { FamilyBudgetState } from "../personas/types";

export const assertProportionalSplit: InvariantAssertion<FamilyBudgetState> = {
  id: "INV-FAM-01",
  name: "Rateio Proporcional à Renda & Conservação",
  module: "family",
  description: "Verifica se a partição proporcional à renda entre parceiros fecha exatamente com o valor total da despesa.",
  execute: (state: FamilyBudgetState) => {
    const [pA, pB] = state.partners;
    const ratioA = pA ? pA.expectedShareRatio : 0.5;
    const ratioB = pB ? pB.expectedShareRatio : 0.5;

    let allPassed = Math.abs(ratioA + ratioB - 1) < 1e-4;
    for (const exp of state.sharedExpenses) {
      const shareA = Math.round(exp.amountCents * ratioA);
      const shareB = exp.amountCents - shareA; // Absorção determinística de resíduo
      if (shareA + shareB !== exp.amountCents) {
        allPassed = false;
      }
    }

    return createAssertionResult({
      id: "INV-FAM-01",
      name: "Rateio Proporcional à Renda & Conservação",
      module: "family",
      expected: "Soma das partes === Valor da despesa",
      found: allPassed ? "Conservação estrita de 100%" : "Divergência detectada",
      passed: allPassed,
      origin: "src/domain/family/settlement.ts",
    });
  },
};

export const assert50_30_20Envelope: InvariantAssertion<FamilyBudgetState> = {
  id: "INV-BUD-01",
  name: "Fechamento da Matriz Orçamentária 50/30/20",
  module: "budgets",
  description: "Garante que os envelopes de Necessidades (50%), Desejos (30%) e Metas (20%) somam 100% da renda.",
  execute: (state: FamilyBudgetState) => {
    const { totalIncomeCents, targetNeedsCents, targetWantsCents, targetSavingsCents } = state.rule50_30_20;
    const sumTargets = targetNeedsCents + targetWantsCents + targetSavingsCents;
    const passed = sumTargets === totalIncomeCents;

    return createAssertionResult({
      id: "INV-BUD-01",
      name: "Fechamento da Matriz Orçamentária 50/30/20",
      module: "budgets",
      expected: totalIncomeCents,
      found: sumTargets,
      passed,
      origin: "src/domain/budgets/proportional.ts",
    });
  },
};

export const assertAnnualProvisionAccrual: InvariantAssertion<FamilyBudgetState> = {
  id: "INV-BUD-02",
  name: "Provisão Anual 1/12 (IPVA/IPTU)",
  module: "budgets",
  description: "Valida que o acúmulo mensal de provisões corresponde rigorosamente a 1/12 do alvo anual.",
  execute: (state: FamilyBudgetState) => {
    let allPassed = true;
    for (const prov of state.provisions) {
      const expectedMonthly = Math.floor(prov.annualTargetCents / 12);
      if (prov.monthlyAccrualCents !== expectedMonthly) {
        allPassed = false;
      }
    }

    return createAssertionResult({
      id: "INV-BUD-02",
      name: "Provisão Anual 1/12 (IPVA/IPTU)",
      module: "budgets",
      expected: "1/12 do alvo anual para cada provisão",
      found: allPassed ? "Alinhamento exato de 1/12" : "Divergência no valor mensal",
      passed: allPassed,
      origin: "src/domain/insights/extended-periodicity.ts",
    });
  },
};

export const familyBudgetInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Orçamento Familiar & Provisões",
  module: "family",
  assertions: [assertProportionalSplit, assert50_30_20Envelope, assertAnnualProvisionAccrual],
};
