/**
 * Helpers de mês (YYYY-MM) — utilitários genéricos (sem regra financeira).
 * Usados para ranges de consulta por mês (listagens, relatórios).
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Valida YYYY-MM. */
export function isValidMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

/** Desloca um mês YYYY-MM por `delta` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const total = (year ?? 0) * 12 + ((monthNum ?? 1) - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Mês corrente (YYYY-MM) no fuso local. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface MonthRange {
  /** Primeiro dia do mês (YYYY-MM-01) — inclusivo nas queries. */
  start: string;
  /** Primeiro dia do mês seguinte — exclusivo nas queries (gte/lte). */
  end: string;
}

/** Range de consulta de um mês: [start, end). */
export function monthRange(month: string): MonthRange {
  if (!isValidMonth(month)) {
    throw new Error(`Mês inválido: ${month} (esperado YYYY-MM).`);
  }
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` };
}

/** Rótulo curto pt-BR ("ago/2026" → "Ago 2026"). */
export function monthLabel(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year ?? 0, (monthNum ?? 1) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

/** Ano corrente (número inteiro de 4 dígitos) no fuso local. */
export function currentYear(): number {
  return new Date().getFullYear();
}

const DATE_ONLY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Formata uma data ISO (YYYY-MM-DD) como dd/mm/aaaa — apresentação pt-BR.
 * Fonte única (DRY): antes havia `formatDate` duplicada em proventos-tab,
 * transaction-list-dialog e use-search. Aceita data com ou sem componente de
 * hora (a parte antes de "T" é usada); entradas fora do padrão retornam o
 * próprio valor (fallback seguro, sem lançar).
 */
export function formatDateBR(iso: string): string {
  const datePart = iso.split("T")[0] ?? "";
  if (!DATE_ONLY_PATTERN.test(datePart)) {
    return iso;
  }
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year}`;
}

/** Valida se é um ano plausível (entre 1900 e 2100). */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
}

export interface YearRange {
  /** Primeiro dia do ano (YYYY-01-01) — inclusivo nas queries. */
  start: string;
  /** Primeiro dia do ano seguinte ((YYYY+1)-01-01) — exclusivo nas queries. */
  end: string;
}

/** Range de consulta de um ano completo: [YYYY-01-01, (YYYY+1)-01-01). */
export function yearRange(year: number): YearRange {
  if (!isValidYear(year)) {
    throw new Error(`Ano inválido: ${year} (esperado número entre 1900 e 2100).`);
  }
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}
