/**
 * Competência de fatura de cartão — ESPECIFICAÇÃO §3.3.2 (D3).
 *
 * Regra base `resolveBillCompetence(purchaseDate, closingDay)`:
 *   • dia da compra ≥ closing day (clamped ao último dia do mês) → fatura do
 *     mês SEGUINTE;
 *   • caso contrário → fatura do mês atual.
 *
 * `clampDay` limita o closing day ao último dia do mês (31/01 → 31; 31/04 → 30).
 * Overrides mensais (`card_competence_overrides`) prevalecem sobre o padrão.
 * O snapshot é gravado na escrita (D3); o recálculo é controlado (RPC).
 *
 * Motor puro — testável isoladamente.
 */

export interface CompetenceOverride {
  /** YYYY-MM do mês da COMPRA ao qual o override se aplica. */
  month: string;
  closingDay: number;
  dueDay: number;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** YYYY-MM de uma data. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Limita o dia ao último dia do mês (year, month 0-based). */
export function clampDay(day: number, year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(Math.trunc(day), 1), daysInMonth);
}

/** Último dia de um mês (year, month 0-based). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Competência da fatura para uma compra: YYYY-MM do mês da fatura.
 * `closingDay` é clampado ao mês da compra (ex.: 31 em abril → 30).
 */
export function resolveBillCompetence(purchaseDate: Date, closingDay: number): string {
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth();
  const day = purchaseDate.getDate();
  const boundary = clampDay(closingDay, year, month);

  const competence = day >= boundary ? new Date(year, month + 1, 1) : new Date(year, month, 1);
  return monthKey(competence);
}

/** Mesmo cálculo considerando overrides do mês da compra (prevalecem sobre o padrão). */
export function resolveBillCompetenceWithOverrides(
  purchaseDate: Date,
  defaultClosingDay: number,
  overrides: CompetenceOverride[],
): string {
  const key = monthKey(purchaseDate);
  const override = overrides.find((item) => item.month === key);
  return resolveBillCompetence(purchaseDate, override?.closingDay ?? defaultClosingDay);
}

/** Valida o formato YYYY-MM. */
export function isValidMonthKey(value: string): boolean {
  return MONTH_KEY.test(value);
}

/** Data de vencimento de uma competência (último dia do mês com dueDay clamped). */
export function dueDateOfCompetence(competenceMonth: string, dueDay: number): string {
  if (!isValidMonthKey(competenceMonth)) {
    throw new Error(`Mês inválido: ${competenceMonth}`);
  }
  const [year, month] = competenceMonth.split("-").map(Number);
  const y = year ?? 0;
  const m = (month ?? 1) - 1;
  const day = clampDay(dueDay, y, m);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
