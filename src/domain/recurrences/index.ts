/**
 * Motor puro de recorrências — Fase 32 (proposta aprovada 2026-08-17).
 * Importe via `@/domain/recurrences` (nunca caminhos profundos).
 */
export { buildRecurrenceOccurrences, occurrencesForMonth, MAX_RECURRENCE_OCCURRENCES } from "./occurrences";
export { resolveOccurrenceDeleteIds } from "./delete";
export { RECURRENCE_FREQUENCIES, RECURRENCE_KINDS } from "./types";
export type { RecurrenceFrequency, RecurrenceKind, RecurrenceOccurrence, RecurrenceRule } from "./types";
