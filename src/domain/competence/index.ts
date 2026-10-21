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

/** YYYY-MM de uma data ou string ISO. */
function parseDateParts(date: Date | string): { year: number; month: number; day: number } {
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]) - 1,
        day: Number(match[3]),
      };
    }
    const d = new Date(date);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Limita o dia ao último dia do mês (year, month 0-based). */
export function clampDay(day: number, year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(Math.trunc(day), 1), daysInMonth);
}

/**
 * Competência da fatura para uma compra: YYYY-MM do mês da fatura.
 * Aceita objeto Date nativo ou string ISO "YYYY-MM-DD" com parsing imune a fusos horários.
 * `closingDay` é clampado ao mês da compra (ex.: 31 em abril → 30).
 */
export function resolveBillCompetence(purchaseDate: Date | string, closingDay: number): string {
  const { year, month, day } = parseDateParts(purchaseDate);
  const boundary = clampDay(closingDay, year, month);

  let targetYear = year;
  let targetMonth = month;
  if (day >= boundary) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  return formatMonthKey(targetYear, targetMonth);
}

/** Mesmo cálculo considerando overrides do mês da compra (prevalecem sobre o padrão). */
export function resolveBillCompetenceWithOverrides(
  purchaseDate: Date | string,
  defaultClosingDay: number,
  overrides: CompetenceOverride[],
): string {
  const { year, month } = parseDateParts(purchaseDate);
  const key = formatMonthKey(year, month);
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
