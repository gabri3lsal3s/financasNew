/**
 * Calendário de Mercado Multi-Bolsa (B3/ANBIMA + NYSE/NASDAQ) e Regras de Fechamento & SWR.
 *
 * Funções puras sem dependência de banco de dados ou rede.
 * Reutiliza feriados nacionais brasileiros (ANBIMA/B3) de `business-days.ts`.
 */

import { getEasterSunday, isBusinessDay } from "./business-days";

export type QuoteMarket = "BR" | "US" | "FX" | "CRYPTO";

const FRACTIONAL_B3_REGEX = /^[A-Z]{4}\d{1,2}F$/;
const STANDARD_B3_REGEX = /^[A-Z]{4}\d{1,2}$/;
const US_HOLIDAYS_CACHE = new Map<number, Set<string>>();

function formatDateIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addCalendarDays(year: number, month: number, day: number, daysToAdd: number): string {
  const d = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return formatDateIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function addCalendarDaysIso(isoDate: string, daysToAdd: number): string {
  const parts = isoDate.slice(0, 10).split("-").map(Number);
  return addCalendarDays(parts[0] ?? 2026, parts[1] ?? 1, parts[2] ?? 1, daysToAdd);
}

function nthWeekdayOfMonth(year: number, month: number, targetWeekday: number, nth: number): string {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (targetWeekday - firstDay + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return formatDateIso(year, month, day);
}

function lastWeekdayOfMonth(year: number, month: number, targetWeekday: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  const diff = (lastDow - targetWeekday + 7) % 7;
  return formatDateIso(year, month, daysInMonth - diff);
}

function observeUsHoliday(holidays: Set<string>, year: number, month: number, day: number): void {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dow === 6) {
    holidays.add(addCalendarDays(year, month, day, -1));
  } else if (dow === 0) {
    holidays.add(addCalendarDays(year, month, day, 1));
  } else {
    holidays.add(formatDateIso(year, month, day));
  }
}

/** Classifica o mercado de negociação de um ticker para cálculo de calendário e pregão. */
export function classifyTickerMarket(raw: string): QuoteMarket {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "BR";
  if (
    ticker === "USDBRL=X" ||
    ticker === "EURBRL=X" ||
    ticker === "USD-BRL" ||
    ticker === "USDBRL" ||
    ticker === "EUR-BRL" ||
    ticker === "EURBRL" ||
    ticker.endsWith("=X")
  ) {
    return "FX";
  }
  if (
    ticker.endsWith("-BRL") ||
    ticker.endsWith("-USD") ||
    ticker === "BTC" ||
    ticker === "ETH" ||
    ticker === "BTCBRL" ||
    ticker === "ETHBRL"
  ) {
    return "CRYPTO";
  }
  if (
    ticker.endsWith(".SA") ||
    FRACTIONAL_B3_REGEX.test(ticker) ||
    STANDARD_B3_REGEX.test(ticker)
  ) {
    return "BR";
  }
  return "US";
}

/** Feriados oficiais da NYSE / NASDAQ (observados) para um ano civil. */
export function getUsMarketHolidays(year: number): Set<string> {
  const cached = US_HOLIDAYS_CACHE.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();
  observeUsHoliday(holidays, year, 1, 1);
  observeUsHoliday(holidays, year + 1, 1, 1);
  holidays.add(nthWeekdayOfMonth(year, 1, 1, 3));
  holidays.add(nthWeekdayOfMonth(year, 2, 1, 3));

  const easter = getEasterSunday(year);
  holidays.add(addCalendarDays(year, easter.month, easter.day, -2));

  holidays.add(lastWeekdayOfMonth(year, 5, 1));
  if (year >= 2022) {
    observeUsHoliday(holidays, year, 6, 19);
  }
  observeUsHoliday(holidays, year, 7, 4);
  holidays.add(nthWeekdayOfMonth(year, 9, 1, 1));
  holidays.add(nthWeekdayOfMonth(year, 11, 4, 4));
  observeUsHoliday(holidays, year, 12, 25);

  US_HOLIDAYS_CACHE.set(year, holidays);
  return holidays;
}

export interface MarketZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoDate: string;
}

/** Extrai data e hora civis em um fuso IANA (DST-aware). */
export function getMarketZonedParts(date: Date, timeZone: string): MarketZonedDateParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const year = Number(map.year ?? date.getUTCFullYear());
  const month = Number(map.month ?? date.getUTCMonth() + 1);
  const day = Number(map.day ?? date.getUTCDate());
  const rawHour = Number(map.hour ?? 0);
  return {
    year,
    month,
    day,
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute ?? 0),
    second: Number(map.second ?? 0),
    isoDate: formatDateIso(year, month, day),
  };
}

/** Converte horário civil local no fuso de mercado para instante UTC exato (DST-aware). */
export function zonedMarketTimeToUtc(
  isoDate: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const wallAsUtcMs = Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
  let candidateMs = wallAsUtcMs;
  for (let pass = 0; pass < 2; pass++) {
    const z = getMarketZonedParts(new Date(candidateMs), timeZone);
    const zWallMs = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second, 0);
    const diff = wallAsUtcMs - zWallMs;
    if (diff === 0) break;
    candidateMs += diff;
  }
  return new Date(candidateMs);
}

/** Verifica se `isoDate` (YYYY-MM-DD) é dia útil no mercado informado. */
export function isBusinessDayForMarket(isoDate: string, market: QuoteMarket): boolean {
  if (!isoDate || isoDate.length < 10) return false;
  if (market === "CRYPTO") return true;
  if (market === "US") {
    const clean = isoDate.slice(0, 10);
    const [y, m, d] = clean.split("-").map(Number);
    const dow = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).getUTCDay();
    if (dow === 0 || dow === 6) return false;
    return !getUsMarketHolidays(y ?? 2026).has(clean);
  }
  return isBusinessDay(isoDate);
}

/** Conta quantos pregões/dias úteis existem no intervalo `(fromIso, toIso]` para o mercado dado. */
export function countMarketBusinessDays(
  fromIso: string,
  toIso: string,
  market: QuoteMarket,
  maxScanDays = 45,
): number {
  const start = fromIso.slice(0, 10);
  const end = toIso.slice(0, 10);
  if (!start || !end || start >= end) return 0;

  let count = 0;
  for (let i = 1; i <= maxScanDays; i++) {
    const nextIso = addCalendarDaysIso(start, i);
    if (isBusinessDayForMarket(nextIso, market)) {
      count += 1;
    }
    if (nextIso >= end) break;
  }
  return count;
}

export function getMarketTimeZone(market: QuoteMarket): string {
  return market === "US" ? "America/New_York" : "America/Sao_Paulo";
}

/** Verifica se o pregão está aberto no instante informado para o ticker especificado. */
export function isMarketOpenForTicker(ticker: string, now: Date = new Date()): boolean {
  const market = classifyTickerMarket(ticker);
  if (market === "CRYPTO") return true;

  const tz = getMarketTimeZone(market);
  const zoned = getMarketZonedParts(now, tz);
  if (!isBusinessDayForMarket(zoned.isoDate, market)) return false;

  const minutes = zoned.hour * 60 + zoned.minute;
  if (market === "US") {
    return minutes >= 9 * 60 + 25 && minutes < 16 * 60 + 15;
  }
  if (market === "FX") {
    return minutes >= 9 * 60 && minutes < 18 * 60 + 30;
  }
  return minutes >= 9 * 60 + 55 && minutes < 18 * 60 + 15;
}

/** Retorna o instante UTC do último fechamento oficial anterior ou igual a `now`. */
export function getLastMarketCloseUtc(ticker: string, now: Date = new Date()): Date | null {
  const market = classifyTickerMarket(ticker);
  if (market === "CRYPTO") return null;

  const tz = getMarketTimeZone(market);
  const closeHour = market === "US" ? 16 : 18;
  const closeMinute = market === "FX" ? 30 : 15;
  const nowParts = getMarketZonedParts(now, tz);

  for (let back = 0; back < 14; back++) {
    const candidateIso = addCalendarDaysIso(nowParts.isoDate, -back);
    if (!isBusinessDayForMarket(candidateIso, market)) continue;
    const closeUtc = zonedMarketTimeToUtc(candidateIso, closeHour, closeMinute, tz);
    if (closeUtc.getTime() <= now.getTime()) {
      return closeUtc;
    }
  }
  return null;
}

export type SwrStaleReason = "cache_miss" | "swr_expired" | null;

/**
 * Avalia no cliente se um ticker deve ser enviado à Edge Function no ciclo SWR.
 * - `cache_miss`: sem preço válido de API no cache global (dispara 1x mesmo com mercado fechado);
 * - `swr_expired`: pregão aberto (ou mercado fechado antes de capturar EOD pós-fechamento) e `now - fetchedAt >= ttlMs`.
 * Override manual (`source === "manual"`) não precisa revalidar no cliente salvo quando não há necessidade.
 */
export function isTickerQuoteStaleForSwr(params: {
  ticker: string;
  source?: string | null;
  price?: number | null;
  fetchedAt?: string | null;
  marketPriceAt?: string | null;
  now?: Date;
  ttlMs?: number;
}): SwrStaleReason {
  const now = params.now ?? new Date();
  const ttlMs = params.ttlMs ?? 15 * 60_000;

  if (params.source === "manual") {
    return null;
  }

  if (
    params.source !== "api" ||
    params.price == null ||
    !Number.isFinite(params.price) ||
    params.price <= 0
  ) {
    return "cache_miss";
  }

  const refIso = params.fetchedAt ?? params.marketPriceAt ?? null;
  const refMs = refIso ? Date.parse(refIso) : NaN;

  if (!isMarketOpenForTicker(params.ticker, now)) {
    const lastClose = getLastMarketCloseUtc(params.ticker, now);
    if (!lastClose) return null;
    if (!Number.isFinite(refMs) || refMs < lastClose.getTime()) {
      return "swr_expired";
    }
    return null;
  }

  if (!Number.isFinite(refMs)) {
    return "swr_expired";
  }

  return now.getTime() - refMs >= ttlMs ? "swr_expired" : null;
}

/**
 * Retorna o último dia útil de um mês e ano específicos no formato ISO YYYY-MM-DD (calendário B3).
 */
export function getLastBusinessDayOfMonth(year: number, month: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Mês inválido: ${month}. Deve estar entre 1 e 12.`);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const m = String(month).padStart(2, "0");

  for (let day = daysInMonth; day >= 1; day--) {
    const d = String(day).padStart(2, "0");
    const isoDate = `${year}-${m}-${d}`;
    if (isBusinessDay(isoDate)) {
      return isoDate;
    }
  }

  return `${year}-${m}-${String(daysInMonth).padStart(2, "0")}`;
}

/**
 * Verifica se o mercado de negociação da B3 para a competência informada já se encerrou.
 */
export function isMarketClosedForMonth(
  year: number,
  month: number,
  currentDateTime: Date = new Date(),
): boolean {
  const lastBizDay = getLastBusinessDayOfMonth(year, month);
  const parts = lastBizDay.split("-").map(Number);
  const y = parts[0] ?? year;
  const m = parts[1] ?? month;
  const d = parts[2] ?? 28;

  // 19:00 BRT (UTC-3) equivale exatamente a 22:00:00 UTC
  const marketCloseUtc = new Date(Date.UTC(y, m - 1, d, 22, 0, 0, 0));

  return currentDateTime.getTime() >= marketCloseUtc.getTime();
}
