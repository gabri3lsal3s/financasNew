/**
 * Orquestrador Isomórfico do Laboratório Forense de Auditoria.
 *
 * Executável em Node.js (CLI) e no Navegador (Web Worker ou Thread Principal).
 * Zero dependências de DOM, React ou Supabase.
 */

import type {
  AuditModule,
  ForensicAuditReport,
  InvariantResult,
  ModuleAuditScore,
  PersonaAuditResult,
} from "../types";
import { AUDIT_MODULE_LABELS } from "../types";
import {
  personaInvestor6445,
  personaTemporalStress,
  personaCardsLoans,
  personaTripsSplit,
  personaFamilyBudget,
  personaBoundaryZero,
  personaInsightsStress,
  personaAdvancedModules,
} from "../personas";
import {
  assertPortfolioDoubleEntry,
  assertPortfolioCustodySum,
  assertHistoricalPtaxCost,
  assertAllocationGoals100AndZeroGap,
  assertCalendarSpineContinuity,
  assertCentConservation,
  assertClosingDayCompetence,
  assertEarlyAmortizationDiscount,
  assertLoanScheduleZeroFinalBalance,
  assertTripsZeroSum,
  assertMinCashFlowSettlement,
  assertProportionalSplit,
  assert50_30_20Envelope,
  assertAnnualProvisionAccrual,
  assertRiskMetricsZeroDivisionSafety,
  assertLeapYearBoundary,
  assertCryptoEightDecimals,
  assertInsightSeverityOrdering,
  assertDismissalCooldown,
  assertCardLimitRadar,
  assertPixCrc16Integrity,
  assertEmergencyRunwayLiquidity,
  assertDebtPayoffOptimality,
  lifecycleInvariantSuite,
} from "../invariants";
import { HeadlessStateStore } from "../engine/headless-state-store";
import { HeadlessTransactionRouter } from "../engine/headless-transaction-router";
import { executeAllJourneys } from "../journeys/journey-catalog";

export interface AuditRunnerOptions {
  environment?: "synthetic" | "live_anonymized";
  personaIds?: readonly string[];
  moduleFilter?: readonly AuditModule[];
}

export function createEmptyModuleScore(module: AuditModule): ModuleAuditScore {
  return {
    module,
    label: AUDIT_MODULE_LABELS[module],
    score: 100,
    passed: 0,
    failed: 0,
    total: 0,
  };
}

export function calculateModuleScores(
  results: readonly InvariantResult[],
): Record<AuditModule, ModuleAuditScore> {
  const scores: Record<AuditModule, ModuleAuditScore> = {
    portfolio: createEmptyModuleScore("portfolio"),
    insights: createEmptyModuleScore("insights"),
    cards: createEmptyModuleScore("cards"),
    loans: createEmptyModuleScore("loans"),
    debts: createEmptyModuleScore("debts"),
    trips: createEmptyModuleScore("trips"),
    family: createEmptyModuleScore("family"),
    budgets: createEmptyModuleScore("budgets"),
    projection: createEmptyModuleScore("projection"),
    auxiliary: createEmptyModuleScore("auxiliary"),
    lifecycle: createEmptyModuleScore("lifecycle"),
  };

  for (const res of results) {
    const mod = scores[res.module];
    if (!mod) continue;
    mod.total += 1;
    if (res.status === "passed") {
      mod.passed += 1;
    } else if (res.status === "failed") {
      mod.failed += 1;
    }
  }

  for (const key of Object.keys(scores) as AuditModule[]) {
    const m = scores[key];
    if (m && m.total > 0) {
      m.score = Math.round((m.passed / m.total) * 100);
    } else if (m) {
      m.score = 100;
    }
  }

  return scores;
}

/**
 * Executa a bateria de auditoria forense sobre as personas determinísticas e invariantes.
 */
export async function runForensicAudit(
  options: AuditRunnerOptions = {},
): Promise<ForensicAuditReport> {
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const environment = options.environment ?? "synthetic";
  const { personaIds, moduleFilter } = options;

  const shouldRunPersona = (id: string): boolean => {
    if (!personaIds || personaIds.length === 0) return true;
    return personaIds.includes(id);
  };

  const filterAssertionResult = (result: InvariantResult): boolean => {
    if (!moduleFilter || moduleFilter.length === 0) return true;
    return moduleFilter.includes(result.module);
  };

  const activePersonas: PersonaAuditResult[] = [];
  const allResults: InvariantResult[] = [];

  // 1. Persona Investidor 6445
  if (shouldRunPersona(personaInvestor6445.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaInvestor6445.instantiate();
    const pResults: InvariantResult[] = [
      assertPortfolioDoubleEntry.execute(state),
      assertPortfolioCustodySum.execute(state),
      assertHistoricalPtaxCost.execute(state),
      assertAllocationGoals100AndZeroGap.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaInvestor6445.id,
      personaName: personaInvestor6445.name,
      description: personaInvestor6445.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 2. Persona Estresse Temporal
  if (shouldRunPersona(personaTemporalStress.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaTemporalStress.instantiate();
    const pResults: InvariantResult[] = [
      assertCalendarSpineContinuity.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaTemporalStress.id,
      personaName: personaTemporalStress.name,
      description: personaTemporalStress.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 3. Persona Cartões & Empréstimos
  if (shouldRunPersona(personaCardsLoans.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaCardsLoans.instantiate();
    const pResults: InvariantResult[] = [
      assertCentConservation.execute(state),
      assertClosingDayCompetence.execute(state),
      assertEarlyAmortizationDiscount.execute(state),
      assertLoanScheduleZeroFinalBalance.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaCardsLoans.id,
      personaName: personaCardsLoans.name,
      description: personaCardsLoans.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 4. Persona Modo Viagem & Racha
  if (shouldRunPersona(personaTripsSplit.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaTripsSplit.instantiate();
    const pResults: InvariantResult[] = [
      assertTripsZeroSum.execute(state),
      assertMinCashFlowSettlement.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaTripsSplit.id,
      personaName: personaTripsSplit.name,
      description: personaTripsSplit.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 5. Persona Família & Orçamentos
  if (shouldRunPersona(personaFamilyBudget.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaFamilyBudget.instantiate();
    const pResults: InvariantResult[] = [
      assertProportionalSplit.execute(state),
      assert50_30_20Envelope.execute(state),
      assertAnnualProvisionAccrual.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaFamilyBudget.id,
      personaName: personaFamilyBudget.name,
      description: personaFamilyBudget.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 6. Persona Casos Limite & Divisão por Zero
  if (shouldRunPersona(personaBoundaryZero.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaBoundaryZero.instantiate();
    const pResults: InvariantResult[] = [
      assertRiskMetricsZeroDivisionSafety.execute(state),
      assertLeapYearBoundary.execute(state),
      assertCryptoEightDecimals.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaBoundaryZero.id,
      personaName: personaBoundaryZero.name,
      description: personaBoundaryZero.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 7. Persona Insights & SmartAdvisor
  if (shouldRunPersona(personaInsightsStress.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaInsightsStress.instantiate();
    const pResults: InvariantResult[] = [
      assertInsightSeverityOrdering.execute(state),
      assertDismissalCooldown.execute(state),
      assertCardLimitRadar.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaInsightsStress.id,
      personaName: personaInsightsStress.name,
      description: personaInsightsStress.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 8. Persona Módulos Avançados & Auxiliares
  if (shouldRunPersona(personaAdvancedModules.id)) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = personaAdvancedModules.instantiate();
    const pResults: InvariantResult[] = [
      assertPixCrc16Integrity.execute(state),
      assertEmergencyRunwayLiquidity.execute(state),
      assertDebtPayoffOptimality.execute(state),
    ].filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: personaAdvancedModules.id,
      personaName: personaAdvancedModules.name,
      description: personaAdvancedModules.description,
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // 9. Ciclo de Vida & Transições de Estado (Portão 8)
  if (shouldRunPersona("persona-lifecycle-forensics")) {
    const pStart = typeof performance !== "undefined" ? performance.now() : Date.now();
    const pResults: InvariantResult[] = lifecycleInvariantSuite.assertions
      .map((assertion) => assertion.execute(undefined as never))
      .filter(filterAssertionResult);

    const pDuration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - pStart;
    activePersonas.push({
      personaId: "persona-lifecycle-forensics",
      personaName: "Ciclo de Vida & Transições de Estado",
      description: "Certificação das 16 invariantes de ciclo de vida cobrindo os 8 pilares da aplicação Axir.",
      executionTimeMs: Math.round(pDuration * 100) / 100,
      invariantsCount: pResults.length,
      passedCount: pResults.filter((r) => r.status === "passed").length,
      failedCount: pResults.filter((r) => r.status === "failed").length,
      results: pResults,
    });
    allResults.push(...pResults);
  }

  // Execução das 8 Golden User Journeys em modo Headless
  const journeyStore = new HeadlessStateStore();
  const journeyRouter = new HeadlessTransactionRouter(journeyStore);
  const journeyResults = await executeAllJourneys({ store: journeyStore, router: journeyRouter });

  const durationMs =
    Math.round(
      ((typeof performance !== "undefined" ? performance.now() : Date.now()) - startTime) * 100,
    ) / 100;

  const totalAssertions = allResults.length;
  const totalPassed = allResults.filter((r) => r.status === "passed").length;
  const totalFailed = allResults.filter((r) => r.status === "failed").length;
  const overallScore = totalAssertions > 0 ? Math.round((totalPassed / totalAssertions) * 100) : 100;

  return {
    auditId: `AUDIT-${Date.now().toString(36).toUpperCase()}`,
    generatedAt: new Date().toISOString(),
    environment,
    overallScore,
    totalAssertions,
    totalPassed,
    totalFailed,
    durationMs,
    personas: activePersonas,
    moduleScores: calculateModuleScores(allResults),
    journeys: journeyResults,
  };
}
