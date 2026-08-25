/**
 * Calendário de Dias Úteis Brasileiros (B3 / ANBIMA / Mercado Financeiro).
 *
 * Funções puras para determinação de feriados nacionais fixos e móveis,
 * dias úteis e contagem de prazos para precificação de renda fixa.
 *
 *   • Feriados Fixos: Ano Novo (01/01), Tiradentes (21/04), Dia do Trabalho (01/05),
 *     Independência (07/09), N. Sra Aparecida (12/10), Finados (02/11),
 *     Proclamação da República (15/11), Consciência Negra (20/11) e Natal (25/12);
 *   • Feriados Móveis (B3): Segunda e Terça de Carnaval, Sexta-Feira Santa e Corpus Christi;
 *   • Base 252 dias úteis padrão do mercado financeiro nacional.
 *
 * Módulo puro — sem dependência de UI, I/O ou banco de dados.
 */

/**
 * Calcula o Domingo de Páscoa para um determinado ano utilizando o algoritmo de Meeus/Jones/Butcher.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { month, day };
}

/** Formata dia e mês em ISO string YYYY-MM-DD. */
function formatIso(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Adiciona dias corridos a uma data (em UTC para evitar offset de fuso). */
function addCalendarDays(year: number, month: number, day: number, daysToAdd: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Cache em memória de feriados por ano para performance O(1). */
const HOLIDAYS_CACHE = new Map<number, Set<string>>();

/**
 * Retorna todos os feriados nacionais e de mercado da B3 para um determinado ano.
 */
export function getNationalHolidays(year: number): Set<string> {
  const cached = HOLIDAYS_CACHE.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();

  // 1. Feriados Fixos Nacionais
  holidays.add(formatIso(year, 1, 1)); // Confraternização Universal
  holidays.add(formatIso(year, 4, 21)); // Tiradentes
  holidays.add(formatIso(year, 5, 1)); // Dia do Trabalho
  holidays.add(formatIso(year, 9, 7)); // Independência do Brasil
  holidays.add(formatIso(year, 10, 12)); // Nossa Senhora Aparecida
  holidays.add(formatIso(year, 11, 2)); // Finados
  holidays.add(formatIso(year, 11, 15)); // Proclamação da República
  holidays.add(formatIso(year, 12, 25)); // Natal

  // Dia Nacional de Zumbi e da Consciência Negra (Feriado Nacional Lei 14.759 a partir de 2024)
  if (year >= 2024) {
    holidays.add(formatIso(year, 11, 20));
  }

  // 2. Feriados Móveis do Mercado Financeiro (calculados a partir da Páscoa)
  const easter = getEasterSunday(year);

  // Carnaval: Segunda-feira (-48 dias) e Terça-feira (-47 dias)
  holidays.add(addCalendarDays(year, easter.month, easter.day, -48));
  holidays.add(addCalendarDays(year, easter.month, easter.day, -47));

  // Sexta-Feira Santa / Paixão de Cristo (-2 dias)
  holidays.add(addCalendarDays(year, easter.month, easter.day, -2));

  // Corpus Christi (+60 dias)
  holidays.add(addCalendarDays(year, easter.month, easter.day, 60));

  HOLIDAYS_CACHE.set(year, holidays);
  return holidays;
}

/**
 * Extrai componentes de ano, mês e dia no formato local seguro.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return { year, month, day };
}

/**
 * Verifica se uma data específica cai em final de semana (sábado ou domingo).
 */
export function isWeekend(dateStr: string): boolean {
  const { year, month, day } = parseDateParts(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = d.getUTCDay(); // 0 = Domingo, 6 = Sábado
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Verifica se uma data é dia útil bancário e de negociação da B3.
 */
export function isBusinessDay(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  if (isWeekend(dateStr)) return false;

  const { year } = parseDateParts(dateStr);
  const holidays = getNationalHolidays(year);
  return !holidays.has(dateStr.slice(0, 10));
}

/**
 * Conta o número de dias úteis decorridos entre duas datas na convenção financeira (startDate, endDate].
 *
 *   • Se startDate == endDate: retorna 0;
 *   • Se endDate < startDate: retorna 0;
 *   • Exemplo: de Quinta (01) para Sexta (02) = 1 dia útil.
 *   • Exemplo: de Sexta (02) para Segunda (05) = 1 dia útil (ignora sábado e domingo).
 */
export function countBusinessDays(startDate: string, endDate: string): number {
  const startClean = startDate.slice(0, 10);
  const endClean = endDate.slice(0, 10);

  if (endClean <= startClean) return 0;

  const { year: startY, month: startM, day: startD } = parseDateParts(startClean);
  const current = new Date(Date.UTC(startY, startM - 1, startD));
  const { year: endY, month: endM, day: endD } = parseDateParts(endClean);
  const endLimit = new Date(Date.UTC(endY, endM - 1, endD));

  let count = 0;

  while (true) {
    current.setUTCDate(current.getUTCDate() + 1);
    if (current > endLimit) break;

    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

    if (isBusinessDay(iso)) {
      count++;
    }
  }

  return count;
}

/**
 * Conta o número de dias corridos entre duas datas no formato ISO.
 */
export function countCalendarDays(startDate: string, endDate: string): number {
  const startClean = startDate.slice(0, 10);
  const endClean = endDate.slice(0, 10);

  if (endClean <= startClean) return 0;

  const { year: sY, month: sM, day: sD } = parseDateParts(startClean);
  const { year: eY, month: eM, day: eD } = parseDateParts(endClean);

  const startMs = Date.UTC(sY, sM - 1, sD);
  const endMs = Date.UTC(eY, eM - 1, eD);

  const diffMs = endMs - startMs;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Adiciona N dias úteis a uma data inicial, retornando a data resultante em YYYY-MM-DD.
 */
export function addBusinessDays(startDate: string, numBusinessDays: number): string {
  const clean = startDate.slice(0, 10);
  if (numBusinessDays <= 0) return clean;

  const { year, month, day } = parseDateParts(clean);
  const current = new Date(Date.UTC(year, month - 1, day));
  let remaining = numBusinessDays;

  while (remaining > 0) {
    current.setUTCDate(current.getUTCDate() + 1);
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

    if (isBusinessDay(iso)) {
      remaining--;
    }
  }

  const resY = current.getUTCFullYear();
  const resM = String(current.getUTCMonth() + 1).padStart(2, "0");
  const resD = String(current.getUTCDate()).padStart(2, "0");
  return `${resY}-${resM}-${resD}`;
}

/**
 * Retorna o próximo dia útil a partir de uma data (se a data já for útil, retorna ela mesma).
 */
export function getNextBusinessDay(dateStr: string): string {
  const clean = dateStr.slice(0, 10);
  if (isBusinessDay(clean)) return clean;

  const { year, month, day } = parseDateParts(clean);
  const current = new Date(Date.UTC(year, month - 1, day));

  while (true) {
    current.setUTCDate(current.getUTCDate() + 1);
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

    if (isBusinessDay(iso)) {
      return iso;
    }
  }
}
