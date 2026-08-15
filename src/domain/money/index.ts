/**
 * Barrels de domínio financeiro — moeda (AGENTS.md §7).
 * Importe via `@/domain/money` (nunca caminhos profundos).
 */
export {
  CURRENCY_INPUT_MAX_DIGITS,
  appendDigit,
  brlFromCents,
  centsFromDigits,
  digitsFromCents,
  extractDigits,
  removeLastDigit,
} from "./currency-input";
export { numberToCents, parseBRLToCents } from "./parse";
export { addMonthsClamped, parcelar, somaCents, splitCents, toISODate } from "./parcelar";
export type { Parcela } from "./parcelar";
