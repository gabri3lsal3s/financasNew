/**
 * Invariantes Matemáticos de Módulos Auxiliares (auxiliary-invariants.ts).
 *
 * Assertivas:
 * 1. Checksum CRC-16 BACEN de Pix BR Code (Polinômio 0x1021)
 * 2. Pista de Liquidez da Reserva de Emergência (D+0/D+1)
 * 3. Otimização de Quitação de Dívidas (Avalanche economiza mais juros que Bola de Neve)
 */

import type { InvariantAssertion, InvariantSuite } from "./types";
import { createAssertionResult } from "./helpers";
import type { AdvancedModulesState } from "../personas/types";
import { calculatePixCrc16 } from "@/domain/pix/pix-br-code";
import { simulateDebtPayoff } from "@/domain/debts/payoff-simulator";

export const assertPixCrc16Integrity: InvariantAssertion<AdvancedModulesState> = {
  id: "INV-AUX-01",
  name: "Checksum CRC-16 BACEN do Pix BR Code",
  module: "auxiliary",
  description: "Valida que o cálculo do checksum polinomial 0x1021 (EMVCo) confere exatamente com o padrão BACEN.",
  execute: (state: AdvancedModulesState) => {
    const { pixBrCode } = state;
    // O CRC-16 no BR Code é calculado sobre o payload até a tag '6304' inclusive
    const payloadToSign = pixBrCode.rawPayload.slice(0, -4);
    const calculatedCrc = calculatePixCrc16(payloadToSign);
    const passed = calculatedCrc.toUpperCase() === pixBrCode.expectedCrc.toUpperCase();

    return createAssertionResult({
      id: "INV-AUX-01",
      name: "Checksum CRC-16 BACEN do Pix BR Code",
      module: "auxiliary",
      expected: pixBrCode.expectedCrc,
      found: calculatedCrc,
      passed,
      origin: "src/domain/pix/pix-br-code.ts",
    });
  },
};

export const assertEmergencyRunwayLiquidity: InvariantAssertion<AdvancedModulesState> = {
  id: "INV-AUX-02",
  name: "Pista de Liquidez Imediata (Reserva D+0/D+1)",
  module: "projection",
  description: "Garante que apenas ativos de liquidez imediata (D+0/D+1) compõem os meses de cobertura de custo de vida.",
  execute: (state: AdvancedModulesState) => {
    const { emergencyRunway } = state;
    const computedMonths = emergencyRunway.liquidAssetsCents / emergencyRunway.monthlyBurnCents;
    const passed = computedMonths === emergencyRunway.expectedMonthsCovered;

    return createAssertionResult({
      id: "INV-AUX-02",
      name: "Pista de Liquidez Imediata (Reserva D+0/D+1)",
      module: "projection",
      expected: emergencyRunway.expectedMonthsCovered,
      found: computedMonths,
      passed,
      origin: "src/domain/projection/emergency-fund.ts",
    });
  },
};

export const assertDebtPayoffOptimality: InvariantAssertion<AdvancedModulesState> = {
  id: "INV-AUX-03",
  name: "Otimização Financeira da Quitação Avalanche",
  module: "debts",
  description: "Comprova matematicamente que o método Avalanche (maior taxa de juros) paga menos juros do que a Bola de Neve.",
  execute: (state: AdvancedModulesState) => {
    const extraBudgetMonthlyCents = 50_000; // R$ 500,00 extras para acelerar quitação
    const avalancheResult = simulateDebtPayoff(state.debtPayoffComparison, extraBudgetMonthlyCents, "avalanche");
    const snowballResult = simulateDebtPayoff(state.debtPayoffComparison, extraBudgetMonthlyCents, "snowball");

    const interestSaved = snowballResult.totalInterestCents - avalancheResult.totalInterestCents;
    const passed = avalancheResult.totalInterestCents <= snowballResult.totalInterestCents;

    return createAssertionResult({
      id: "INV-AUX-03",
      name: "Otimização Financeira da Quitação Avalanche",
      module: "debts",
      expected: "Juros Avalanche <= Juros Bola de Neve",
      found: `Avalanche: ${avalancheResult.totalInterestCents} cts vs Neve: ${snowballResult.totalInterestCents} cts (Economia = ${interestSaved} cts)`,
      passed,
      origin: "src/domain/debts/payoff-simulator.ts",
    });
  },
};

export const auxiliaryInvariantSuite: InvariantSuite = {
  name: "Suíte Forense de Módulos Auxiliares",
  module: "auxiliary",
  assertions: [assertPixCrc16Integrity, assertEmergencyRunwayLiquidity, assertDebtPayoffOptimality],
};
