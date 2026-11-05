/**
 * Barrels de dominio - Rateio Financeiro e Divisao de Despesas (AGENTS.md secao 7).
 * Importe via `@/domain/finance` (nunca caminhos profundos).
 */

export {
  DEFAULT_SPLIT_REMAINDER_POLICY,
  MAX_SPLIT_PARTICIPANTS,
  calculateGuestAmountCents,
  calculateSplitSummary,
  splitAmountEqually,
  splitCustomWithRemainder,
  sumSplitCents,
  validateSplitInputs,
} from "./split-math";

export type {
  SplitExpenseSummary,
  SplitOptions,
  SplitParticipant,
  SplitParticipantResult,
  SplitRemainderPolicy,
} from "./split-math";
