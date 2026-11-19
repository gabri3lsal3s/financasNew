/**
 * Catálogo Canônico de Jornadas Sintéticas de Ciclo de Vida (journey-catalog.ts).
 *
 * Registra as 8 Golden User Journeys dos 8 pilares da aplicação Axir.
 * Conforme AGENTS.md (TypeScript estrito, sem emojis).
 */

import type { JourneyContext, JourneyDefinition, JourneyExecutionResult } from "./types";
import { journeyAuthLifecycle } from "./jrn-auth-lifecycle";
import { journeySubscriptionLifecycle } from "./jrn-subscription-lifecycle";
import { journeyCategoriesLifecycle } from "./jrn-categories-lifecycle";
import { journeyCardsDebtsLifecycle } from "./jrn-cards-debts-lifecycle";
import { journeyPortfolioCustody } from "./jrn-portfolio-custody";
import { journeyFamilyBudget } from "./jrn-family-budget";
import { journeyTripsSplit } from "./jrn-trips-split";
import { journeyInsightsBackup } from "./jrn-insights-backup";

export const ALL_GOLDEN_JOURNEYS: readonly JourneyDefinition[] = [
  journeyAuthLifecycle,
  journeySubscriptionLifecycle,
  journeyCategoriesLifecycle,
  journeyCardsDebtsLifecycle,
  journeyPortfolioCustody,
  journeyFamilyBudget,
  journeyTripsSplit,
  journeyInsightsBackup,
];

/**
 * Executa todas as 8 jornadas de ponta a ponta e consolida o diagnóstico.
 */
export async function executeAllJourneys(ctx: JourneyContext): Promise<JourneyExecutionResult[]> {
  const results: JourneyExecutionResult[] = [];
  for (const journey of ALL_GOLDEN_JOURNEYS) {
    const result = await journey.execute(ctx);
    results.push(result);
  }
  return results;
}

/**
 * Executa uma jornada específica pelo identificador canônico (ex.: JRN-AUTH-01).
 */
export async function executeJourneyById(
  journeyId: string,
  ctx: JourneyContext,
): Promise<JourneyExecutionResult | null> {
  const journey = ALL_GOLDEN_JOURNEYS.find((j) => j.id === journeyId);
  if (!journey) {
    return null;
  }
  return journey.execute(ctx);
}
