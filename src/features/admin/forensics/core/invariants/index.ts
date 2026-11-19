/**
 * Suíte de Invariantes — Barrel de Exportação.
 */

export * from "./types";
export * from "./helpers";
export * from "./portfolio-invariants";
export * from "./cards-loans-invariants";
export * from "./trips-split-invariants";
export * from "./family-budget-invariants";
export * from "./boundary-zero-invariants";
export * from "./insights-invariants";
export * from "./auxiliary-invariants";

import type { InvariantSuite } from "./types";
import { portfolioInvariantSuite } from "./portfolio-invariants";
import { cardsLoansInvariantSuite } from "./cards-loans-invariants";
import { tripsSplitInvariantSuite } from "./trips-split-invariants";
import { familyBudgetInvariantSuite } from "./family-budget-invariants";
import { boundaryZeroInvariantSuite } from "./boundary-zero-invariants";
import { insightsInvariantSuite } from "./insights-invariants";
import { auxiliaryInvariantSuite } from "./auxiliary-invariants";

export const ALL_INVARIANT_SUITES: readonly InvariantSuite[] = [
  portfolioInvariantSuite,
  cardsLoansInvariantSuite,
  tripsSplitInvariantSuite,
  familyBudgetInvariantSuite,
  boundaryZeroInvariantSuite,
  insightsInvariantSuite,
  auxiliaryInvariantSuite,
] as const;

export function getAllInvariantSuites(): readonly InvariantSuite[] {
  return ALL_INVARIANT_SUITES;
}
