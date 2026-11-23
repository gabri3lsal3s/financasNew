/**
 * Motor puro das cotações (Bloco A — Motor Global SWR + EOD/EOM + PTAX).
 *
 * Funções sem I/O, testáveis com Vitest (src/tests/quotes-core.test.ts) e
 * reutilizadas pela edge function `supabase/functions/quotes/index.ts`
 * (runtime Deno — este arquivo não importa nada externo).
 */

export type QuoteCurrency = "BRL" | "USD";
export type QuoteMarket = "BR" | "US" | "FX" | "CRYPTO";
export type QuoteProvider = "yahoo" | "brapi" | "bcb_ptax" | "awesomeapi" | "cache";

export interface ParsedQuote {
  ticker: string;
  price: number;
  currency: QuoteCurrency;
}

export interface ParsedSplitEvent {
  timestamp: number;
  dateISO: string;
  numerator: number;
  denominator: number;
  ratio: number;
}

export interface ParsedQuoteWithMeta extends ParsedQuote {
  marketPriceAt: string | null;
  provider: QuoteProvider;
  chartPreviousClose?: number | null;
  splits?: ParsedSplitEvent[];
  referenceDate?: string;
}

export interface QuoteUpsertRow {
  user_id: null;
  ticker: string;
  price: number;
  currency: QuoteCurrency;
  source: "api" | "fallback";
  updated_at: string;
}

export interface GlobalQuoteUpsertRow extends QuoteUpsertRow {
  market_price_at: string | null;
  fetched_at: string;
  provider: string | null;
  pending_spike_price: number | null;
  pending_spike_at: string | null;
}

const FRACTIONAL_B3_WITH_SA_REGEX = /^([A-Z][A-Z0-9]{3}\d{1,2})F\.SA$/;
const FRACTIONAL_B3_REGEX = /^([A-Z][A-Z0-9]{3}\d{1,2})F$/;
const US_DOT_SHARE_REGEX = /^([A-Z]{1,4})\.([ABC])$/;
const STANDARD_B3_REGEX = /^(?=[A-Z0-9]{4}\d{1,2}$)(?=.*[A-Z])[A-Z][A-Z0-9]{3}\d{1,2}$/;
const CRYPTO_TICKERS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "ADA",
  "XRP",
  "USDT",
  "USDC",
  "BNB",
  "DOGE",
  "MATIC",
  "LINK",
  "DOT",
  "AVAX",
  "LTC",
  "BTCBRL",
  "ETHBRL",
  "SOLBRL",
  "XRPBRL",
  "ADABRL",
]);
const BARE_CRYPTO_BRL_PAIR_REGEX = /^(BTC|ETH|SOL|ADA|XRP|BNB|DOGE|AVAX|LTC|LINK|DOT|MATIC)BRL$/;

/**
 * Classifica o mercado de negociação de um ticker para cálculo de calendário,
 * feriados locais e horário de pregão com DST.
 */
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
    CRYPTO_TICKERS.has(ticker)
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

/**
 * Normaliza o ticker armazenado para o formato da API Yahoo Finance:
 *   • B3 fracionário (PETR4F, PETR4F.SA, B3SA3F, BOVA11F) → padrão `.SA` (PETR4.SA, B3SA3.SA);
 *   • Ações EUA com classe (BRK.B, BF.B) → hífen (BRK-B, BF-B), preservando bolsas globais (VWRA.L, SHOP.TO);
 *   • B3 com número (PETR4, B3SA3, BOVA11, IVVB11, A1MD34) → sufixo `.SA`;
 *   • Pares cambiais USD/BRL → `USDBRL=X` e cripto BRL sem hífen (BTCBRL) → `BTC-BRL`;
 *   • Já com sufixo/`.SA`/`=`/`-`/`.` → mantém;
 *   • Internacional puro 1–5 letras (AAPL, MSFT, O, T) → mantém.
 */
export function normalizeTickerForApi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "";

  if (ticker === "USD-BRL" || ticker === "USDBRL") return "USDBRL=X";
  if (ticker === "EUR-BRL" || ticker === "EURBRL") return "EURBRL=X";

  const bareCryptoMatch = ticker.match(BARE_CRYPTO_BRL_PAIR_REGEX);
  if (bareCryptoMatch && bareCryptoMatch[1]) return `${bareCryptoMatch[1]}-BRL`;

  const fracSaMatch = ticker.match(FRACTIONAL_B3_WITH_SA_REGEX);
  if (fracSaMatch && fracSaMatch[1]) return `${fracSaMatch[1]}.SA`;

  if (ticker.endsWith(".SA")) return ticker;

  const fracMatch = ticker.match(FRACTIONAL_B3_REGEX);
  if (fracMatch && fracMatch[1]) return `${fracMatch[1]}.SA`;

  const usDotMatch = ticker.match(US_DOT_SHARE_REGEX);
  if (usDotMatch && usDotMatch[1] && usDotMatch[2]) {
    return `${usDotMatch[1]}-${usDotMatch[2]}`;
  }

  if (ticker.includes("=") || ticker.includes("-") || ticker.includes(".")) return ticker;
  if (/^[A-Za-z]{1,5}$/.test(ticker)) return ticker;
  return `${ticker}.SA`;
}

/**
 * Normaliza o ticker para a API Brapi (remove `.SA` e sufixo fracionário `F` da B3).
 */
export function normalizeTickerForBrapi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "";
  const withoutSa = ticker.endsWith(".SA") ? ticker.slice(0, -3) : ticker;
  const fracMatch = withoutSa.match(FRACTIONAL_B3_REGEX);
  if (fracMatch && fracMatch[1]) return fracMatch[1];
  return withoutSa;
}

// ---------------------------------------------------------------------------
// Calendário Puro Multi-Mercado (B3 / ANBIMA + NYSE / NASDAQ + DST Automático)
// ---------------------------------------------------------------------------

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

function getEasterSunday(year: number): { month: number; day: number } {
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
  const d = new Date(Date.UTC(year, month - 1, day));
  const dow = d.getUTCDay();
  if (dow === 6) {
    // Sábado → sexta anterior (se cair no ano corrente ou Dec 31 quando Jan 1 do ano seguinte)
    holidays.add(addCalendarDays(year, month, day, -1));
  } else if (dow === 0) {
    // Domingo → segunda seguinte
    holidays.add(addCalendarDays(year, month, day, 1));
  } else {
    holidays.add(formatDateIso(year, month, day));
  }
}

const BR_HOLIDAYS_CACHE = new Map<number, Set<string>>();
const US_HOLIDAYS_CACHE = new Map<number, Set<string>>();

/** Feriados nacionais / B3 / ANBIMA para um ano civil. */
export function getBrazilHolidays(year: number): Set<string> {
  const cached = BR_HOLIDAYS_CACHE.get(year);
  if (cached) return cached;

  const holidays = new Set<string>([
    formatDateIso(year, 1, 1), // Confraternização Universal
    formatDateIso(year, 4, 21), // Tiradentes
    formatDateIso(year, 5, 1), // Dia do Trabalho
    formatDateIso(year, 9, 7), // Independência
    formatDateIso(year, 10, 12), // Nossa Sra. Aparecida
    formatDateIso(year, 11, 2), // Finados
    formatDateIso(year, 11, 15), // Proclamação da República
    formatDateIso(year, 12, 24), // Véspera de Natal (sem pregão na B3)
    formatDateIso(year, 12, 25), // Natal
    formatDateIso(year, 12, 31), // Véspera de Ano Novo (sem pregão B3 / sem PTAX BCB)
  ]);
  if (year >= 2024) {
    holidays.add(formatDateIso(year, 11, 20)); // Consciência Negra
  }

  const easter = getEasterSunday(year);
  holidays.add(addCalendarDays(year, easter.month, easter.day, -48)); // Segunda de Carnaval
  holidays.add(addCalendarDays(year, easter.month, easter.day, -47)); // Terça de Carnaval
  holidays.add(addCalendarDays(year, easter.month, easter.day, -2)); // Sexta-Feira Santa
  holidays.add(addCalendarDays(year, easter.month, easter.day, 60)); // Corpus Christi

  BR_HOLIDAYS_CACHE.set(year, holidays);
  return holidays;
}

/** Feriados oficiais NYSE / NASDAQ (observados) para um ano civil (NYSE Rule 7.2). */
export function getUsMarketHolidays(year: number): Set<string> {
  const cached = US_HOLIDAYS_CACHE.get(year);
  if (cached) return cached;

  const holidays = new Set<string>();
  observeUsHoliday(holidays, year, 1, 1); // New Year's Day (sábado não fecha 31/dez pela Rule 7.2)
  holidays.add(nthWeekdayOfMonth(year, 1, 1, 3)); // MLK Jr. Day (3ª seg Jan)
  holidays.add(nthWeekdayOfMonth(year, 2, 1, 3)); // Presidents' Day (3ª seg Fev)

  const easter = getEasterSunday(year);
  holidays.add(addCalendarDays(year, easter.month, easter.day, -2)); // Good Friday

  holidays.add(lastWeekdayOfMonth(year, 5, 1)); // Memorial Day (última seg Mai)
  if (year >= 2022) {
    observeUsHoliday(holidays, year, 6, 19); // Juneteenth
  }
  observeUsHoliday(holidays, year, 7, 4); // Independence Day
  holidays.add(nthWeekdayOfMonth(year, 9, 1, 1)); // Labor Day (1ª seg Set)
  holidays.add(nthWeekdayOfMonth(year, 11, 4, 4)); // Thanksgiving (4ª qui Nov)
  observeUsHoliday(holidays, year, 12, 25); // Christmas Day

  US_HOLIDAYS_CACHE.set(year, holidays);
  return holidays;
}

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sun ... 6 = Sat
  isoDate: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const ZONED_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getZonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = ZONED_FORMATTER_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    ZONED_FORMATTER_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

/** Extrai componentes civis exatos de um instante UTC em qualquer fuso IANA (DST-aware). */
export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const fmt = getZonedFormatter(timeZone);
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const year = Number(map.year ?? date.getUTCFullYear());
  const month = Number(map.month ?? date.getUTCMonth() + 1);
  const day = Number(map.day ?? date.getUTCDate());
  const rawHour = Number(map.hour ?? 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.minute ?? 0);
  const second = Number(map.second ?? 0);
  const weekday = WEEKDAY_MAP[map.weekday ?? "Mon"] ?? date.getUTCDay();
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    isoDate: formatDateIso(year, month, day),
  };
}

/**
 * Converte data/hora civil local (ex.: 16:15 em America/New_York) para instante UTC exato,
 * ajustando automaticamente horário de verão (DST).
 */
export function zonedLocalTimeToUtc(
  isoDate: string,
  hour: number,
  minute: number,
  timeZone: string,
  second = 0,
): Date {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const targetUtcAsWallMs = Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1, hour, minute, second, 0);

  let candidateMs = targetUtcAsWallMs;
  for (let pass = 0; pass < 2; pass++) {
    const zoned = getZonedDateParts(new Date(candidateMs), timeZone);
    const zonedAsWallMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
      0,
    );
    const diff = targetUtcAsWallMs - zonedAsWallMs;
    if (diff === 0) break;
    candidateMs += diff;
  }
  return new Date(candidateMs);
}

/** Verifica se a data civil (YYYY-MM-DD) é dia útil no mercado especificado. */
export function isBusinessDayForMarket(isoDate: string, market: QuoteMarket): boolean {
  if (!isoDate || isoDate.length < 10) return false;
  if (market === "CRYPTO") return true;

  const clean = isoDate.slice(0, 10);
  const [y, m, d] = clean.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  if (dow === 0 || dow === 6) return false;

  const year = y ?? 2026;
  if (market === "US") {
    return !getUsMarketHolidays(year).has(clean);
  }
  return !getBrazilHolidays(year).has(clean);
}

/** Conta quantos dias úteis de mercado decorreram no intervalo (startDate, endDate]. */
export function countMarketBusinessDays(
  startDateIso: string,
  endDateIso: string,
  market: QuoteMarket,
): number {
  const start = startDateIso.slice(0, 10);
  const end = endDateIso.slice(0, 10);
  if (!start || !end || end <= start) return 0;

  let count = 0;
  let cursor = start;
  let guard = 0;
  while (cursor < end && guard < 4000) {
    cursor = addCalendarDaysIso(cursor, 1);
    if (isBusinessDayForMarket(cursor, market)) {
      count += 1;
    }
    guard += 1;
  }
  return count;
}

/**
 * Retorna o dia útil de mercado imediatamente anterior a `isoDate` (para derivar `com_date`
 * a partir da `ex-date` em Yahoo Finance para EUA/B3).
 */
export function getPreviousMarketBusinessDay(isoDate: string, market: QuoteMarket): string {
  const clean = isoDate.slice(0, 10);
  if (!clean || clean.length < 10) return clean;
  for (let back = 1; back <= 14; back++) {
    const candidate = addCalendarDaysIso(clean, -back);
    if (isBusinessDayForMarket(candidate, market)) {
      return candidate;
    }
  }
  return addCalendarDaysIso(clean, -1);
}

export function getMarketTimeZone(market: QuoteMarket): string {
  return market === "US" ? "America/New_York" : "America/Sao_Paulo";
}

/** Verifica se o mercado do ticker está aberto neste instante (pregão ativo ou cripto 24/7). */
export function isMarketOpenForTicker(ticker: string, now: Date = new Date()): boolean {
  const market = classifyTickerMarket(ticker);
  if (market === "CRYPTO") return true;

  const tz = getMarketTimeZone(market);
  const zoned = getZonedDateParts(now, tz);
  if (!isBusinessDayForMarket(zoned.isoDate, market)) return false;

  const minutes = zoned.hour * 60 + zoned.minute;
  if (market === "US") {
    // NYSE / NASDAQ: 09:25 às 16:15 America/New_York
    return minutes >= 9 * 60 + 25 && minutes < 16 * 60 + 15;
  }
  if (market === "FX") {
    // Câmbio PTAX / B3 FX: 09:00 às 18:30 America/Sao_Paulo
    return minutes >= 9 * 60 && minutes < 18 * 60 + 30;
  }
  // B3 Renda Variável: 09:55 às 18:15 America/Sao_Paulo
  return minutes >= 9 * 60 + 55 && minutes < 18 * 60 + 15;
}

/**
 * Retorna o instante UTC do fechamento oficial mais recente anterior ou igual a `now`.
 * Para CRYPTO (mercado 24/7) retorna null.
 */
export function getLastMarketCloseUtc(ticker: string, now: Date = new Date()): Date | null {
  const market = classifyTickerMarket(ticker);
  if (market === "CRYPTO") return null;

  const tz = getMarketTimeZone(market);
  const closeHour = market === "US" ? 16 : 18;
  const closeMinute = market === "FX" ? 30 : 15;
  const nowParts = getZonedDateParts(now, tz);

  for (let back = 0; back < 14; back++) {
    const candidateIso = addCalendarDaysIso(nowParts.isoDate, -back);
    if (!isBusinessDayForMarket(candidateIso, market)) continue;
    const closeUtc = zonedLocalTimeToUtc(candidateIso, closeHour, closeMinute, tz);
    if (closeUtc.getTime() <= now.getTime()) {
      return closeUtc;
    }
  }
  return null;
}

/**
 * Trava EOD Guard: quando o mercado do ticker está fechado e já existe cotação API
 * válida capturada após o fechamento do último pregão, bloqueia chamada externa.
 * Nunca pula se for `cache_miss`, `existingPrice <= 0` ou `existingSource !== "api"`.
 */
export function shouldSkipByEodGuard(params: {
  ticker: string;
  fetchedAt: string | null;
  marketPriceAt: string | null;
  existingPrice: number | null;
  existingSource?: string | null;
  now?: Date;
  reason?: string;
}): boolean {
  const now = params.now ?? new Date();
  if (params.reason === "cache_miss") return false;
  if (params.existingPrice === null || !Number.isFinite(params.existingPrice) || params.existingPrice <= 0) {
    return false;
  }
  if (params.existingSource && params.existingSource !== "api") {
    return false;
  }
  if (isMarketOpenForTicker(params.ticker, now)) {
    return false;
  }
  const lastClose = getLastMarketCloseUtc(params.ticker, now);
  if (!lastClose) return false;

  const refIso = params.fetchedAt ?? params.marketPriceAt;
  if (!refIso) return false;
  const refMs = Date.parse(refIso);
  if (!Number.isFinite(refMs)) return false;

  return refMs >= lastClose.getTime();
}

/** Último dia útil do mês no calendário oficial BR (B3 / ANBIMA). */
export function getLastBusinessDayOfMonthBR(year: number, month: number): string {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = daysInMonth; day >= 1; day--) {
    const iso = formatDateIso(year, month, day);
    if (isBusinessDayForMarket(iso, "BR")) return iso;
  }
  return formatDateIso(year, month, daysInMonth);
}

/** Primeiros N dias úteis do mês no calendário BR (para janela de auto-healing EOM). */
export function getFirstNBusinessDaysOfMonthBR(year: number, month: number, n: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const list: string[] = [];
  for (let day = 1; day <= daysInMonth && list.length < n; day++) {
    const iso = formatDateIso(year, month, day);
    if (isBusinessDayForMarket(iso, "BR")) list.push(iso);
  }
  return list;
}

// ---------------------------------------------------------------------------
// Parsers de APIs Externas (Preços, Timestamps Reais, Splits & PTAX Oficial)
// ---------------------------------------------------------------------------

function toIsoOrNull(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    const ms = raw > 1e12 ? raw : raw * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    const clean = raw.trim();
    // Formato BRT sem offset (ex.: "2026-10-30 13:09:24.123")
    const brtMatch = clean.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (brtMatch && !clean.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(clean)) {
      const utc = zonedLocalTimeToUtc(
        brtMatch[1]!,
        Number(brtMatch[2]!),
        Number(brtMatch[3]!),
        "America/Sao_Paulo",
        Number(brtMatch[4] ?? 0),
      );
      return utc.toISOString();
    }
    const parsed = Date.parse(clean);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return null;
}

/**
 * Extrai cotação detalhada da Yahoo Chart API v8 com timestamp real (`regularMarketTime`),
 * `chartPreviousClose` e mapa de eventos de split (`events.splits`).
 */
export function parseYahooChartDetailed(
  ticker: string,
  payload: unknown,
): ParsedQuoteWithMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const chart = (payload as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return null;
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const entry = result[0] as Record<string, unknown> | undefined;
  const meta = entry?.meta;
  if (!meta || typeof meta !== "object") return null;
  const metaRec = meta as Record<string, unknown>;

  const rawPrice = metaRec.regularMarketPrice;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;

  const rawCurrency = metaRec.currency;
  const currency: QuoteCurrency = rawCurrency === "USD" ? "USD" : "BRL";
  const marketPriceAt = toIsoOrNull(metaRec.regularMarketTime);
  const prevRaw = metaRec.chartPreviousClose ?? metaRec.previousClose;
  const prevNum = typeof prevRaw === "number" ? prevRaw : Number(prevRaw);
  const chartPreviousClose = Number.isFinite(prevNum) && prevNum > 0 ? prevNum : null;

  const splits: ParsedSplitEvent[] = [];
  const events = entry?.events;
  if (events && typeof events === "object") {
    const rawSplits = (events as Record<string, unknown>).splits;
    if (rawSplits && typeof rawSplits === "object") {
      const tz = getMarketTimeZone(classifyTickerMarket(ticker));
      for (const item of Object.values(rawSplits as Record<string, unknown>)) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        const ts = Number(rec.date);
        const num = Number(rec.numerator);
        const den = Number(rec.denominator);
        if (!Number.isFinite(ts) || ts <= 0 || !Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
          continue;
        }
        const dateISO = getZonedDateParts(new Date(ts * 1000), tz).isoDate;
        splits.push({
          timestamp: ts,
          dateISO,
          numerator: num,
          denominator: den,
          ratio: num / den,
        });
      }
      splits.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  return {
    ticker,
    price: priceNum,
    currency,
    marketPriceAt,
    provider: "yahoo",
    chartPreviousClose,
    splits: splits.length > 0 ? splits : undefined,
  };
}

/**
 * Extrai { price, currency } do payload da Yahoo Chart API v8
 * (`/v8/finance/chart/{ticker}` → `chart.result[0].meta`).
 */
export function parseYahooChartResponse(ticker: string, payload: unknown): ParsedQuote | null {
  const detailed = parseYahooChartDetailed(ticker, payload);
  if (!detailed) return null;
  return {
    ticker: detailed.ticker,
    price: detailed.price,
    currency: detailed.currency,
  };
}

/**
 * Extrai o último fechamento válido de uma competência histórica (`YYYY-MM`)
 * a partir de `/v8/finance/chart/{ticker}?interval=1d&period1=...&period2=...`.
 */
export function parseYahooHistoricalClose(
  ticker: string,
  payload: unknown,
  targetMonth: string,
): ParsedQuoteWithMeta | null {
  if (!payload || typeof payload !== "object" || !/^\d{4}-\d{2}$/.test(targetMonth)) return null;
  const chart = (payload as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return null;
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return null;

  const entry = result[0] as Record<string, unknown> | undefined;
  const meta = entry?.meta as Record<string, unknown> | undefined;
  const timestamps = entry?.timestamp;
  const indicators = entry?.indicators as Record<string, unknown> | undefined;
  const quoteArr = indicators?.quote;
  const quoteObj = Array.isArray(quoteArr) ? (quoteArr[0] as Record<string, unknown> | undefined) : undefined;
  const closes = quoteObj?.close;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null;

  const tz = getMarketTimeZone(classifyTickerMarket(ticker));
  const currency: QuoteCurrency = meta?.currency === "USD" ? "USD" : "BRL";

  let latestTs = -1;
  let latestClose: number | null = null;
  let latestDateISO = "";

  const len = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < len; i++) {
    const ts = Number(timestamps[i]);
    const close = Number(closes[i]);
    if (!Number.isFinite(ts) || ts <= 0 || !Number.isFinite(close) || close <= 0) continue;

    const zoned = getZonedDateParts(new Date(ts * 1000), tz);
    if (zoned.isoDate.slice(0, 7) !== targetMonth) continue;

    if (ts >= latestTs) {
      latestTs = ts;
      latestClose = close;
      latestDateISO = zoned.isoDate;
    }
  }

  if (latestClose === null || latestTs <= 0) return null;

  return {
    ticker,
    price: latestClose,
    currency,
    marketPriceAt: new Date(latestTs * 1000).toISOString(),
    referenceDate: latestDateISO,
    provider: "yahoo",
  };
}

/**
 * Extrai cotação detalhada do payload da API Brapi com `regularMarketTime` real.
 */
export function parseBrapiDetailed(ticker: string, payload: unknown): ParsedQuoteWithMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const item = results[0];
  if (!item || typeof item !== "object") return null;
  const itemRecord = item as Record<string, unknown>;
  const rawPrice = itemRecord.regularMarketPrice ?? itemRecord.price;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  const rawCurrency = itemRecord.currency;
  const marketPriceAt = toIsoOrNull(itemRecord.regularMarketTime);
  return {
    ticker,
    price: priceNum,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
    marketPriceAt,
    provider: "brapi",
  };
}

/**
 * Extrai { price, currency } do payload da API Brapi (`/api/quote/{ticker}`).
 */
export function parseBrapiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  const detailed = parseBrapiDetailed(ticker, payload);
  if (!detailed) return null;
  return {
    ticker: detailed.ticker,
    price: detailed.price,
    currency: detailed.currency,
  };
}

/**
 * Extrai cotação oficial PTAX (`cotacaoVenda`, paridade exata com SGS Série 1)
 * a partir da API Olinda PTAX (`{ value: [...] }`) ou SGS Série 1 (`[{ data, valor }]`).
 */
export function parseBcbPtaxResponse(
  ticker: string,
  payload: unknown,
): ParsedQuoteWithMeta | null {
  if (!payload) return null;

  // 1. Formato BCB Olinda PTAX: { value: [{ cotacaoVenda, dataHoraCotacao, ... }] }
  if (typeof payload === "object" && !Array.isArray(payload)) {
    const rawValue = (payload as Record<string, unknown>).value;
    if (!Array.isArray(rawValue) || rawValue.length === 0) return null;

    const validItems = rawValue
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => {
        const rate = Number(item.cotacaoVenda ?? item.cotacaoCompra);
        const dtStr = String(item.dataHoraCotacao ?? "");
        const marketPriceAt = toIsoOrNull(dtStr);
        const refDate = dtStr.slice(0, 10);
        return { rate, dtStr, marketPriceAt, refDate };
      })
      .filter((item) => Number.isFinite(item.rate) && item.rate > 0)
      .sort((a, b) => a.dtStr.localeCompare(b.dtStr));

    const latest = validItems[validItems.length - 1];
    if (!latest) return null;

    return {
      ticker,
      price: Math.round(latest.rate * 10000) / 10000,
      currency: "BRL",
      marketPriceAt: latest.marketPriceAt,
      referenceDate: /^\d{4}-\d{2}-\d{2}$/.test(latest.refDate) ? latest.refDate : undefined,
      provider: "bcb_ptax",
    };
  }

  // 2. Formato BCB SGS Série 1: [{ data: "DD/MM/YYYY", valor: "5.7412" }]
  if (Array.isArray(payload) && payload.length > 0) {
    const last = payload[payload.length - 1];
    if (!last || typeof last !== "object") return null;
    const rec = last as Record<string, unknown>;
    const rate = parseFloat(String(rec.valor ?? "").replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) return null;

    const rawDate = String(rec.data ?? "");
    const dMatch = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const isoDate = dMatch ? `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}` : undefined;
    const marketPriceAt = isoDate
      ? zonedLocalTimeToUtc(isoDate, 18, 0, "America/Sao_Paulo").toISOString()
      : null;

    return {
      ticker,
      price: Math.round(rate * 10000) / 10000,
      currency: "BRL",
      marketPriceAt,
      referenceDate: isoDate,
      provider: "bcb_ptax",
    };
  }

  return null;
}

/**
 * Extrai cotação detalhada da AwesomeAPI (`/last/USD-BRL`) com `create_date`.
 */
export function parseAwesomeApiDetailed(
  ticker: string,
  payload: unknown,
): ParsedQuoteWithMeta | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const pairKey = Object.keys(record).find((key) => !key.startsWith("_"));
  if (!pairKey) return null;
  const data = record[pairKey];
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  const rawPrice = dataRecord.bid ?? dataRecord.ask;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;

  const marketPriceAt =
    toIsoOrNull(dataRecord.create_date) ?? toIsoOrNull(Number(dataRecord.timestamp));

  return {
    ticker,
    price: priceNum,
    currency: "BRL",
    marketPriceAt,
    provider: "awesomeapi",
  };
}

/**
 * Extrai a cotação cambial da AwesomeAPI (`/last/USD-BRL`).
 */
export function parseAwesomeApiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  const detailed = parseAwesomeApiDetailed(ticker, payload);
  if (!detailed) return null;
  return {
    ticker: detailed.ticker,
    price: detailed.price,
    currency: detailed.currency,
  };
}

// ---------------------------------------------------------------------------
// Proventos Corporativos (B3 Brapi + Fallback Yahoo B3 Incerto + EUA 30% IR)
// ---------------------------------------------------------------------------

export interface ParsedCorporateDividend {
  ticker: string;
  type: "DIVIDENDO" | "JCP" | "RENDIMENTO" | "SOBRA" | "AMORTIZACAO" | "OUTROS";
  com_date: string;
  payment_date: string | null;
  rate: number;
  net_rate: number;
  tax_rate_pct: number;
  currency: "BRL" | "USD";
  provider: "brapi" | "yahoo";
  is_type_uncertain: boolean;
}

function normalizeDividendType(rawLabel: string | undefined): ParsedCorporateDividend["type"] {
  if (!rawLabel) return "DIVIDENDO";
  const upper = rawLabel.trim().toUpperCase();
  if (upper.includes("JCP") || upper.includes("JUROS")) return "JCP";
  if (upper.includes("RENDIMENTO")) return "RENDIMENTO";
  if (upper.includes("SOBRA")) return "SOBRA";
  if (upper.includes("AMORTIZ")) return "AMORTIZACAO";
  return "DIVIDENDO";
}

function normalizeIsoDateOrNull(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

/**
 * Extrai a lista de proventos corporativos do payload da Brapi (`/api/quote/{ticker}?dividends=true`).
 * Aceita `paymentDate` nula (eventos provisionados ainda sem data de pagamento anunciada).
 */
export function parseBrapiDividends(ticker: string, payload: unknown): ParsedCorporateDividend[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return [];

  const item = results[0];
  if (!item || typeof item !== "object") return [];

  const dividendsData = (item as Record<string, unknown>).dividendsData;
  if (!dividendsData || typeof dividendsData !== "object") return [];

  const cashDividends = (dividendsData as Record<string, unknown>).cashDividends;
  if (!Array.isArray(cashDividends)) return [];

  const list: ParsedCorporateDividend[] = [];
  const cleanTicker = ticker.trim().toUpperCase();

  for (const div of cashDividends) {
    if (!div || typeof div !== "object") continue;
    const divRecord = div as Record<string, unknown>;

    const rawRate = divRecord.rate;
    const rate = typeof rawRate === "number" ? rawRate : Number(rawRate);
    if (!Number.isFinite(rate) || rate <= 0) continue;

    const paymentDate = normalizeIsoDateOrNull(divRecord.paymentDate);
    const comDate =
      normalizeIsoDateOrNull(divRecord.lastDatePrior) ??
      normalizeIsoDateOrNull(divRecord.approvedOn) ??
      paymentDate;
    if (!comDate) continue;

    const divType = normalizeDividendType(divRecord.label as string | undefined);
    const taxRatePct = divType === "JCP" ? 15 : 0;
    const netRate = Math.round(rate * (1 - taxRatePct / 100) * 100000000) / 100000000;

    list.push({
      ticker: cleanTicker,
      type: divType,
      com_date: comDate,
      payment_date: paymentDate,
      rate,
      net_rate: netRate,
      tax_rate_pct: taxRatePct,
      currency: "BRL",
      provider: "brapi",
      is_type_uncertain: false,
    });
  }

  return list;
}

/**
 * Extrai proventos do payload Yahoo Finance (`events=div`):
 * - Mercado EUA (`US`): `currency = "USD"`, retenção padrão de 30% (`net_rate = rate * 0.70`), `com_date` = dia útil NYSE anterior à `ex-date`;
 * - Mercado BR (`BR`, fallback): Yahoo não distingue Dividendo isento (0%) vs JCP (15% IRRF),
 *   portanto marca `is_type_uncertain = true` para exigir confirmação manual do usuário.
 */
export function parseYahooDividends(
  ticker: string,
  payload: unknown,
  marketOverride?: QuoteMarket,
): ParsedCorporateDividend[] {
  if (!payload || typeof payload !== "object") return [];
  const chart = (payload as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return [];
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return [];

  const entry = result[0] as Record<string, unknown> | undefined;
  const events = entry?.events;
  if (!events || typeof events !== "object") return [];

  const rawDivs = (events as Record<string, unknown>).dividends;
  if (!rawDivs || typeof rawDivs !== "object") return [];

  const cleanTicker = ticker.trim().toUpperCase();
  const market = marketOverride ?? classifyTickerMarket(cleanTicker);
  const tz = getMarketTimeZone(market);
  const metaRec = (entry?.meta ?? {}) as Record<string, unknown>;
  const rawMetaCurrency = typeof metaRec.currency === "string" ? metaRec.currency.toUpperCase() : "";
  const currency: "BRL" | "USD" =
    rawMetaCurrency === "BRL"
      ? "BRL"
      : rawMetaCurrency === "USD" || market === "US"
        ? "USD"
        : "BRL";
  const isUS = currency === "USD";
  const taxRatePct = isUS ? 30 : 0;
  const isTypeUncertain = !isUS;

  const list: ParsedCorporateDividend[] = [];
  for (const item of Object.values(rawDivs as Record<string, unknown>)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const rawAmount = rec.amount;
    const rate = typeof rawAmount === "number" ? rawAmount : Number(rawAmount);
    const ts = Number(rec.date);
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(ts) || ts <= 0) {
      continue;
    }

    const exDateIso = getZonedDateParts(new Date(ts * 1000), tz).isoDate;
    const comDate = getPreviousMarketBusinessDay(exDateIso, market);
    const explicitPayDate = normalizeIsoDateOrNull(rec.paymentDate);
    const paymentDate = explicitPayDate;
    const netRate = Math.round(rate * (1 - taxRatePct / 100) * 100000000) / 100000000;

    list.push({
      ticker: cleanTicker,
      type: "DIVIDENDO",
      com_date: comDate,
      payment_date: paymentDate,
      rate,
      net_rate: netRate,
      tax_rate_pct: taxRatePct,
      currency,
      provider: "yahoo",
      is_type_uncertain: isTypeUncertain,
    });
  }

  return list.sort((a, b) => a.com_date.localeCompare(b.com_date));
}

export interface CustodyComDateTxInput {
  type: string;
  date: string;
  quantity: number;
  created_at?: string | null;
}

function roundQty8(val: number): number {
  return Math.round(val * 100_000_000) / 100_000_000;
}

function getCustodyTxIntradayWeight(type: string): number {
  if (type === "split" || type === "reverse_split") return 0;
  if (type === "buy" || type === "subscription") return 1;
  return 2;
}

function toSaoPauloDateIso(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
  }
  return getZonedDateParts(new Date(parsed), "America/Sao_Paulo").isoDate;
}

function replayCustodyOpsDetailed(
  initialQty: number,
  txs: readonly CustodyComDateTxInput[],
): { qty: number; clampedSell: boolean } {
  let qty = initialQty;
  let clampedSell = false;
  for (const tx of txs) {
    const q = Number(tx.quantity) || 0;
    if (tx.type === "buy" || tx.type === "subscription") {
      qty += q;
    } else if (tx.type === "sell") {
      if (qty + 1e-6 < q) {
        clampedSell = true;
      }
      qty = Math.max(0, qty - q);
    } else if (tx.type === "split") {
      const factor = q > 0 ? q : 1;
      qty *= factor;
    } else if (tx.type === "reverse_split") {
      const factor = q > 0 ? q : 1;
      qty /= factor;
    }
  }
  return { qty: roundQty8(Math.max(0, qty)), clampedSell };
}

/**
 * Reconstrução determinística de custódia até o fechamento da Data COM (`America/Sao_Paulo`):
 * - Suporta ativos criados com saldo inicial declarado (baseline) e compras/vendas/splits posteriores
 *   (inclusive venda integral do saldo pré-ledger seguida de recompra posterior);
 * - Ordena operações intradia (`split`/`reverse_split` → `buy`/`subscription` → `sell`);
 * - Zero dependência de JSX/Supabase.
 */
export function computeCustodyAtComDatePure(
  asset: { quantity: number; created_at?: string | null },
  transactions: readonly CustodyComDateTxInput[],
  comDate: string,
): number {
  const comClean = comDate.slice(0, 10);
  const currentQty = Math.max(0, Number(asset.quantity) || 0);
  const assetCreatedAt = toSaoPauloDateIso(asset.created_at);

  const custodyTxs = transactions
    .filter(
      (tx) =>
        tx.type === "buy" ||
        tx.type === "subscription" ||
        tx.type === "sell" ||
        tx.type === "split" ||
        tx.type === "reverse_split",
    )
    .slice()
    .sort((a, b) => {
      const dCmp = a.date.slice(0, 10).localeCompare(b.date.slice(0, 10));
      if (dCmp !== 0) return dCmp;
      const wCmp = getCustodyTxIntradayWeight(a.type) - getCustodyTxIntradayWeight(b.type);
      if (wCmp !== 0) return wCmp;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });

  if (custodyTxs.length === 0) {
    if (!assetCreatedAt || assetCreatedAt <= comClean) {
      return currentQty;
    }
    return 0;
  }

  // Calcula eventual custódia inicial pré-ledger fazendo reconciliação reversa a partir de `asset.quantity`.
  const zeroPass = replayCustodyOpsDetailed(0, custodyTxs);
  let baselineQty = 0;

  if (currentQty > zeroPass.qty + 1e-6 || zeroPass.clampedSell) {
    let q = currentQty;
    for (let i = custodyTxs.length - 1; i >= 0; i--) {
      const tx = custodyTxs[i]!;
      const txQty = Number(tx.quantity) || 0;
      if (tx.type === "buy" || tx.type === "subscription") {
        q -= txQty;
      } else if (tx.type === "sell") {
        q += txQty;
      } else if (tx.type === "split") {
        const factor = txQty > 0 ? txQty : 1;
        q /= factor;
      } else if (tx.type === "reverse_split") {
        const factor = txQty > 0 ? txQty : 1;
        q *= factor;
      }
    }
    baselineQty = q > 1e-6 ? roundQty8(q) : 0;
  }

  const txsUpToCom = custodyTxs.filter((tx) => tx.date.slice(0, 10) <= comClean);
  if (baselineQty > 0 && assetCreatedAt && assetCreatedAt > comClean && txsUpToCom.length === 0) {
    return 0;
  }

  return replayCustodyOpsDetailed(baselineQty, txsUpToCom).qty;
}

/**
 * Resolve a data de corte Anti-Flood: `max(activatedAt, todayBR - safeWindowDays)`.
 * Eventos anteriores a esse corte jamais liquidam automaticamente no Caixa.
 */
export function resolveAntiFloodCutoffDate(
  activatedAtIso: string | null | undefined,
  todayBR: string,
  safeWindowDays = 7,
): string {
  const safeFloor = addCalendarDaysIso(todayBR.slice(0, 10), -Math.max(1, safeWindowDays));
  const activatedDate = normalizeIsoDateOrNull(activatedAtIso);
  if (!activatedDate) return safeFloor;
  return activatedDate > safeFloor ? activatedDate : safeFloor;
}

/**
 * Deduplicação fuzzy entre evento corporativo e lançamentos manuais (`portfolio_dividends`):
 * tolera ±`maxBusinessDays` dias úteis (B3/BR) e ±`maxAmountDiff` na moeda nativa.
 */
export function isFuzzyDuplicateManualDividend(
  paymentDate: string | null,
  netAmount: number,
  manualDividends: ReadonlyArray<{ id?: string; date: string; amount: number }>,
  maxBusinessDays = 3,
  maxAmountDiff = 0.05,
): { matched: boolean; matchedDividendId: string | null } {
  if (!paymentDate) return { matched: false, matchedDividendId: null };
  const payClean = paymentDate.slice(0, 10);

  for (const manual of manualDividends) {
    const manualDate = manual.date.slice(0, 10);
    const diffDays =
      payClean === manualDate
        ? 0
        : payClean < manualDate
          ? countMarketBusinessDays(payClean, manualDate, "BR")
          : countMarketBusinessDays(manualDate, payClean, "BR");
    if (diffDays > maxBusinessDays) continue;

    if (Math.abs(netAmount - Number(manual.amount)) <= maxAmountDiff) {
      return { matched: true, matchedDividendId: manual.id ?? null };
    }
  }

  return { matched: false, matchedDividendId: null };
}

// ---------------------------------------------------------------------------
// Guardrail de Spike Split-Aware + Builders de Cache Global
// ---------------------------------------------------------------------------

export interface SpikeGuardrailInput {
  ticker: string;
  newPrice: number;
  newMarketPriceAt?: string | null;
  newProvider?: string | null;
  previousPrice: number | null;
  previousMarketPriceAt?: string | null;
  previousProvider?: string | null;
  pendingSpikePrice?: number | null;
  pendingSpikeAt?: string | null;
  chartPreviousClose?: number | null;
  splits?: readonly ParsedSplitEvent[];
  secondaryConfirmPrice?: number | null;
  now?: Date;
}

export interface SpikeGuardrailResult {
  accepted: boolean;
  effectivePrice: number;
  effectiveMarketPriceAt: string | null;
  effectiveProvider: string | null;
  pendingSpikePrice: number | null;
  pendingSpikeAt: string | null;
  reason:
    | "ok"
    | "split_verified"
    | "consensus_verified"
    | "stale_cache_override"
    | "double_confirm_unlocked"
    | "spike_guarded";
}

/**
 * Avalia variação > 50% com inteligência para splits/inplits recentes (5 dias úteis),
 * consenso (`chartPreviousClose` / provedor secundário), cache velho (> 5 dias úteis)
 * e auto-destravamento via confirmação dupla (`pending_spike_*` >= 10 min).
 */
export function evaluateSpikeGuardrail(input: SpikeGuardrailInput): SpikeGuardrailResult {
  const now = input.now ?? new Date();
  const market = classifyTickerMarket(input.ticker);
  const tz = getMarketTimeZone(market);
  const nowIso = getZonedDateParts(now, tz).isoDate;

  const {
    newPrice,
    newMarketPriceAt = null,
    newProvider = null,
    previousPrice,
    previousMarketPriceAt = null,
    previousProvider = null,
    pendingSpikePrice = null,
    pendingSpikeAt = null,
    chartPreviousClose = null,
    splits,
    secondaryConfirmPrice = null,
  } = input;

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return {
      accepted: false,
      effectivePrice: previousPrice && previousPrice > 0 ? previousPrice : 0,
      effectiveMarketPriceAt: previousMarketPriceAt,
      effectiveProvider: previousProvider,
      pendingSpikePrice: pendingSpikePrice ?? null,
      pendingSpikeAt: pendingSpikeAt ?? null,
      reason: "spike_guarded",
    };
  }

  if (previousPrice === null || previousPrice === undefined || previousPrice <= 0) {
    return {
      accepted: true,
      effectivePrice: newPrice,
      effectiveMarketPriceAt: newMarketPriceAt,
      effectiveProvider: newProvider,
      pendingSpikePrice: null,
      pendingSpikeAt: null,
      reason: "ok",
    };
  }

  const variation = Math.abs(newPrice - previousPrice) / previousPrice;
  if (variation <= 0.5) {
    return {
      accepted: true,
      effectivePrice: newPrice,
      effectiveMarketPriceAt: newMarketPriceAt,
      effectiveProvider: newProvider,
      pendingSpikePrice: null,
      pendingSpikeAt: null,
      reason: "ok",
    };
  }

  // 1. Eventos de split/inplit nos últimos 5 dias úteis do mercado (exigindo preço anterior pré-split)
  const prevMarketDateIso =
    previousMarketPriceAt && Number.isFinite(Date.parse(previousMarketPriceAt))
      ? getZonedDateParts(new Date(Date.parse(previousMarketPriceAt)), tz).isoDate
      : null;

  if (splits && splits.length > 0) {
    for (const sp of splits) {
      if (sp.ratio <= 0) continue;
      if (prevMarketDateIso && prevMarketDateIso >= sp.dateISO) continue;
      const bizDaysSinceSplit = countMarketBusinessDays(sp.dateISO, nowIso, market);
      const isRecent =
        (sp.dateISO <= nowIso && bizDaysSinceSplit <= 5) ||
        sp.dateISO === addCalendarDaysIso(nowIso, 1);
      if (!isRecent) continue;

      const expectedPostSplitPrice = previousPrice / sp.ratio;
      if (
        expectedPostSplitPrice > 0 &&
        Math.abs(newPrice - expectedPostSplitPrice) / expectedPostSplitPrice <= 0.25
      ) {
        return {
          accepted: true,
          effectivePrice: newPrice,
          effectiveMarketPriceAt: newMarketPriceAt,
          effectiveProvider: newProvider,
          pendingSpikePrice: null,
          pendingSpikeAt: null,
          reason: "split_verified",
        };
      }
    }
  }

  // 2. Consenso estrito por provedor secundário distinto (±5%) — evita auto-validação por mesmo provedor
  void chartPreviousClose;
  if (
    secondaryConfirmPrice &&
    secondaryConfirmPrice > 0 &&
    Math.abs(newPrice - secondaryConfirmPrice) / secondaryConfirmPrice <= 0.05
  ) {
    return {
      accepted: true,
      effectivePrice: newPrice,
      effectiveMarketPriceAt: newMarketPriceAt,
      effectiveProvider: newProvider,
      pendingSpikePrice: null,
      pendingSpikeAt: null,
      reason: "consensus_verified",
    };
  }

  // 3. Cache antigo (> 5 dias úteis)
  if (previousMarketPriceAt) {
    const prevMs = Date.parse(previousMarketPriceAt);
    if (Number.isFinite(prevMs)) {
      const prevDateIso = getZonedDateParts(new Date(prevMs), tz).isoDate;
      if (countMarketBusinessDays(prevDateIso, nowIso, market) > 5) {
        return {
          accepted: true,
          effectivePrice: newPrice,
          effectiveMarketPriceAt: newMarketPriceAt,
          effectiveProvider: newProvider,
          pendingSpikePrice: null,
          pendingSpikeAt: null,
          reason: "stale_cache_override",
        };
      }
    }
  }

  // 4. Auto-destravamento via confirmação dupla (>= 10 min no mesmo patamar ±5%)
  if (pendingSpikePrice && pendingSpikePrice > 0 && pendingSpikeAt) {
    const spikeMs = Date.parse(pendingSpikeAt);
    const elapsedMs = now.getTime() - spikeMs;
    const within5Pct = Math.abs(newPrice - pendingSpikePrice) / pendingSpikePrice <= 0.05;
    if (Number.isFinite(spikeMs) && elapsedMs >= 10 * 60_000 && within5Pct) {
      return {
        accepted: true,
        effectivePrice: newPrice,
        effectiveMarketPriceAt: newMarketPriceAt,
        effectiveProvider: newProvider,
        pendingSpikePrice: null,
        pendingSpikeAt: null,
        reason: "double_confirm_unlocked",
      };
    }
  }

  // 5. Bloqueado: preserva preço, timestamp e provedor anteriores e agenda confirmação
  const samePendingBand = Boolean(
    pendingSpikePrice &&
      pendingSpikePrice > 0 &&
      pendingSpikeAt &&
      Math.abs(newPrice - pendingSpikePrice) / pendingSpikePrice <= 0.05,
  );

  return {
    accepted: false,
    effectivePrice: previousPrice,
    effectiveMarketPriceAt: previousMarketPriceAt,
    effectiveProvider: previousProvider,
    pendingSpikePrice: newPrice,
    pendingSpikeAt: samePendingBand && pendingSpikeAt ? pendingSpikeAt : now.toISOString(),
    reason: "spike_guarded",
  };
}

/**
 * Guardrail simplificado (§1.6): variação > 50% sem contexto mantém o último preço válido.
 */
export function applySpikeGuardrail(currentPrice: number, previousPrice: number | null): number {
  if (previousPrice === null || previousPrice === undefined || previousPrice <= 0) return currentPrice;
  if (currentPrice <= 0) return previousPrice;
  const variation = Math.abs(currentPrice - previousPrice) / previousPrice;
  return variation > 0.5 ? previousPrice : currentPrice;
}

/**
 * Monta a linha básica de upsert do cache global com a fonte `api`.
 */
export function buildQuoteUpsertRow(
  ticker: string,
  price: number,
  currency: QuoteCurrency,
  updatedAt: string,
): QuoteUpsertRow {
  return {
    user_id: null,
    ticker,
    price,
    currency,
    source: "api",
    updated_at: updatedAt,
  };
}

/**
 * Monta o payload completo para a RPC `upsert_global_asset_prices`.
 */
export function buildGlobalQuoteUpsertRow(params: {
  ticker: string;
  price: number;
  currency: QuoteCurrency;
  source?: "api" | "fallback";
  marketPriceAt: string | null;
  fetchedAt: string;
  provider: string | null;
  pendingSpikePrice?: number | null;
  pendingSpikeAt?: string | null;
  updatedAt?: string;
}): GlobalQuoteUpsertRow {
  return {
    user_id: null,
    ticker: params.ticker.trim().toUpperCase(),
    price: params.price,
    currency: params.currency,
    source: params.source ?? "api",
    market_price_at: params.marketPriceAt,
    fetched_at: params.fetchedAt,
    provider: params.provider,
    pending_spike_price: params.pendingSpikePrice ?? null,
    pending_spike_at: params.pendingSpikeAt ?? null,
    updated_at: params.updatedAt ?? params.fetchedAt,
  };
}

const CASH_CLASS_ALIASES = new Set(["caixa", "reserva", "cash"]);

export function isCashClass(assetClass: string | null): boolean {
  if (!assetClass) return false;
  const normalized = assetClass
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return CASH_CLASS_ALIASES.has(normalized);
}

/**
 * Determina se um ativo cadastrado deve ser consultado em APIs de bolsa/mercado
 * (exclui Caixa/Reserva, Renda Fixa Privada, Renda Fixa paramétrica com `fixed_income_metadata`,
 * Tesouro Direto e ativos de valoração customizada).
 */
export function isMarketQuotedAsset(asset: {
  ticker?: string | null;
  asset_class?: string | null;
  fixed_income_metadata?: unknown;
  notes?: string | null;
}): boolean {
  const ticker = (asset.ticker ?? "").trim().toUpperCase();
  if (!ticker) return false;
  if (ticker === "CAIXA" || ticker === "CASH" || ticker.startsWith("CASH_") || ticker.startsWith("CAIXA_")) {
    return false;
  }
  if (isCashClass(asset.asset_class ?? null)) return false;
  if (asset.fixed_income_metadata != null) return false;
  if (
    asset.notes &&
    (asset.notes.includes("[VALUATION:CUSTOM]") || asset.notes.includes("[PRICING:TOTAL]"))
  ) {
    return false;
  }

  const normClass = (asset.asset_class ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    normClass &&
    !normClass.includes("cripto") &&
    !normClass.includes("crypto") &&
    (normClass.includes("renda fixa") ||
      normClass.includes("rendafixa") ||
      normClass.includes("tesouro") ||
      normClass.includes("caixa") ||
      normClass.includes("reserva"))
  ) {
    return false;
  }

  const PRIVATE_FIXED_INCOME_PREFIX_RE =
    /^(CDB|RDB|LCI|LCA|CRI|CRA|LC|LF|LFT|NTNB|LTN|DEB|TESOURO)([-_\s]|$)/;
  if (
    PRIVATE_FIXED_INCOME_PREFIX_RE.test(ticker) ||
    ticker.includes(" ")
  ) {
    return false;
  }

  return true;
}
