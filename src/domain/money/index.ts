/**
 * Barrels de domínio financeiro — moeda (AGENTS.md §7).
 * Importe via `@/domain/money` (nunca caminhos profundos).
 */
export { CURRENCY_INPUT_MAX_DIGITS, centsFromDigits, digitsFromCents, extractDigits } from "./currency-input";
export { numberToCents } from "./parse";
export { addMonthsClamped, parcelar, splitCents, toISODate } from "./parcelar";
export type { Parcela } from "./parcelar";
