/**
 * Catálogo Canônico de Personas Teóricas Determinísticas (Golden Seeds).
 * Centraliza o registro e instanciação rápida das 8 personas forenses.
 */

import type { TheoreticalPersona, PersonaCatalogItem } from "./types";
import { personaInvestor6445 } from "./persona-investor-6445";
import { personaTemporalStress } from "./persona-temporal-stress";
import { personaCardsLoans } from "./persona-cards-loans";
import { personaTripsSplit } from "./persona-trips-split";
import { personaFamilyBudget } from "./persona-family-budget";
import { personaBoundaryZero } from "./persona-boundary-zero";
import { personaInsightsStress } from "./persona-insights-stress";
import { personaAdvancedModules } from "./persona-advanced-modules";

export const ALL_PERSONAS: readonly TheoreticalPersona[] = [
  personaInvestor6445,
  personaTemporalStress,
  personaCardsLoans,
  personaTripsSplit,
  personaFamilyBudget,
  personaBoundaryZero,
  personaInsightsStress,
  personaAdvancedModules,
] as const;

export function getAllPersonas(): readonly TheoreticalPersona[] {
  return ALL_PERSONAS;
}

export function getPersonaById(id: string): TheoreticalPersona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}

export function getPersonaCatalog(): readonly PersonaCatalogItem[] {
  return ALL_PERSONAS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    targetModules: p.targetModules,
    estimatedExecutionMs: 15,
  }));
}
