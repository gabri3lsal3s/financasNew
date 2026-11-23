/**
 * Edge Function de Cotações, Câmbio Oficial (PTAX) e Fechamento EOD/EOM (Bloco A).
 *
 * Ações suportadas:
 *  1. 'quotes' (default): SWR compartilhado sob demanda + EOD Guard + Cooldown + Single-Flight + histórico `period1/period2`;
 *  2. 'eod_close' (service_role / cron): fechamento diário EOD em `asset_prices` e `market_price_history` (+ feriado cruzado EOM);
 *  3. 'close_month_global' (service_role / cron): congelamento EOM + hidratação `portfolio_monthly_prices` + snapshots elegíveis;
 *  4. 'sync_corporate_dividends': ingestão de proventos B3 (Brapi + fallback Yahoo incerto) e EUA (Yahoo 30% IR);
 *  5. 'process_user_dividends' (service_role / cron): apuração data-com, anti-flood, deduplicação fuzzy, efetivação Caixa e push.
 *
 * Deploy: supabase functions deploy quotes --no-verify-jwt
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildGlobalQuoteUpsertRow,
  classifyTickerMarket,
  computeCustodyAtComDatePure,
  evaluateSpikeGuardrail,
  getFirstNBusinessDaysOfMonthBR,
  getLastBusinessDayOfMonthBR,
  getZonedDateParts,
  isBusinessDayForMarket,
  isCashClass,
  isFuzzyDuplicateManualDividend,
  isMarketQuotedAsset,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiDetailed,
  parseBcbPtaxResponse,
  parseBrapiDetailed,
  parseBrapiDividends,
  parseYahooChartDetailed,
  parseYahooDividends,
  parseYahooHistoricalClose,
  resolveAntiFloodCutoffDate,
  shouldSkipByEodGuard,
  type GlobalQuoteUpsertRow,
  type ParsedCorporateDividend,
  type ParsedQuoteWithMeta,
} from "../_shared/quotes-core.ts";
import {
  buildCorsHeaders,
  jsonResponse,
  safeErrorResponse,
  timingSafeEqualString,
} from "../_shared/http.ts";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const FETCH_TIMEOUT_MS = 4_500;
const POOL_CONCURRENCY = 6;
const STANDARD_COOLDOWN_MS = 15 * 60_000;
const REPORT_COOLDOWN_MS = 5 * 60_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; AxirFinance/2.0; +https://axir.com.br)";

interface CachedAssetPriceRow {
  ticker: string;
  price: number;
  currency: "BRL" | "USD";
  source: "api" | "fallback";
  market_price_at: string | null;
  fetched_at: string | null;
  provider: string | null;
  pending_spike_price: number | null;
  pending_spike_at: string | null;
}

function getBrapiToken(): string {
  return (Deno.env.get("BRAPI_TOKEN") ?? "").trim();
}

function isFxUsdBrlTicker(ticker: string): boolean {
  const n = ticker.trim().toUpperCase();
  return n === "USDBRL=X" || n === "USD-BRL" || n === "USDBRL";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch resiliente com timeout e retry com backoff exponencial + jitter em 429/5xx/rede. */
async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
  retries = 2,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) return response;

      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const jitter = Math.floor(Math.random() * 200);
          await sleep(250 * Math.pow(2, attempt) + jitter);
          continue;
        }
      }
      return response;
    } catch {
      clearTimeout(timer);
      if (attempt < retries) {
        const jitter = Math.floor(Math.random() * 150);
        await sleep(200 * Math.pow(2, attempt) + jitter);
        continue;
      }
    }
  }
  return null;
}

/** Pool simples de concorrência limitada para prevenir rajadas 429 nas APIs externas. */
async function runWithConcurrencyPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runner(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]!, current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

/** Formata data para BCB Olinda PTAX (MM-DD-YYYY). */
function formatOlindaDate(date: Date): string {
  const parts = getZonedDateParts(date, "America/Sao_Paulo");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${m}-${d}-${parts.year}`;
}

/** Busca PTAX Oficial no BCB (Olinda PTAX com lookback de 7 dias corridos → SGS Série 1). */
async function fetchBcbPtax(
  referenceDate: Date = new Date(),
  originalTicker = "USDBRL=X",
): Promise<ParsedQuoteWithMeta | null> {
  const endDate = new Date(referenceDate.getTime());
  const startDate = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const olindaUrl =
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${formatOlindaDate(startDate)}'&@dataFinalCotacao='${formatOlindaDate(endDate)}'&$format=json`;

  const olindaRes = await fetchWithRetry(olindaUrl, { headers: { "User-Agent": USER_AGENT } }, 4_500, 1);
  if (olindaRes?.ok) {
    try {
      const payload: unknown = await olindaRes.json();
      const parsed = parseBcbPtaxResponse(originalTicker, payload);
      if (parsed) return parsed;
    } catch {
      // segue para SGS Série 1
    }
  }

  const sgsEnd = getZonedDateParts(endDate, "America/Sao_Paulo");
  const sgsStart = getZonedDateParts(startDate, "America/Sao_Paulo");
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const sgsUrl =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json` +
    `&dataInicial=${pad2(sgsStart.day)}/${pad2(sgsStart.month)}/${sgsStart.year}` +
    `&dataFinal=${pad2(sgsEnd.day)}/${pad2(sgsEnd.month)}/${sgsEnd.year}`;

  const sgsRes = await fetchWithRetry(sgsUrl, { headers: { "User-Agent": USER_AGENT } }, 4_000, 1);
  if (sgsRes?.ok) {
    try {
      const payload: unknown = await sgsRes.json();
      const parsed = parseBcbPtaxResponse(originalTicker, payload);
      if (parsed) return parsed;
    } catch {
      // fallback para Yahoo/AwesomeAPI
    }
  }

  return null;
}

/** Busca cotação no Yahoo Finance v8 com `events=split` e timestamp real. */
async function fetchYahooQuote(ticker: string): Promise<ParsedQuoteWithMeta | null> {
  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker) return null;

  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=1mo&events=split`;
    const response = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, FETCH_TIMEOUT_MS, 1);
    if (!response?.ok) continue;
    try {
      const payload: unknown = await response.json();
      const parsed = parseYahooChartDetailed(ticker, payload);
      if (parsed) return parsed;
    } catch {
      // tenta próximo host
    }
  }
  return null;
}

/** Busca fechamento histórico real de um mês (`period1`/`period2`) via Yahoo Chart API v8. */
async function fetchYahooHistoricalMonthClose(
  ticker: string,
  targetMonth: string,
): Promise<ParsedQuoteWithMeta | null> {
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) return null;
  if (isFxUsdBrlTicker(ticker)) {
    const [y, m] = targetMonth.split("-").map(Number);
    const lastBiz = getLastBusinessDayOfMonthBR(y ?? 2026, m ?? 1);
    const refDate = new Date(`${lastBiz}T23:59:00-03:00`);
    const ptax = await fetchBcbPtax(refDate, "USDBRL=X");
    if (ptax) return ptax;
  }

  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker) return null;

  const [yearNum, monthNum] = targetMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(yearNum ?? 2026, (monthNum ?? 1) - 1, -7));
  const endDate = new Date(Date.UTC(yearNum ?? 2026, monthNum ?? 1, 2));
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);

  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&period1=${period1}&period2=${period2}`;
    const response = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, 5_000, 1);
    if (!response?.ok) continue;
    try {
      const payload: unknown = await response.json();
      const parsed = parseYahooHistoricalClose(ticker, payload, targetMonth);
      if (parsed) return parsed;
    } catch {
      // tenta próximo host
    }
  }
  return null;
}

/** Busca cotação B3 na Brapi autenticada com `BRAPI_TOKEN` no servidor. */
async function fetchBrapiQuote(ticker: string): Promise<ParsedQuoteWithMeta | null> {
  const market = classifyTickerMarket(ticker);
  if (market !== "BR") return null;

  const cleanTicker = normalizeTickerForBrapi(ticker);
  if (!cleanTicker || cleanTicker.includes("=")) return null;

  const brapiToken = getBrapiToken();
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  const tokenQuery = brapiToken ? `?token=${encodeURIComponent(brapiToken)}` : "";
  if (brapiToken) {
    headers["Authorization"] = `Bearer ${brapiToken}`;
  }

  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}${tokenQuery}`;
  const response = await fetchWithRetry(url, { headers }, FETCH_TIMEOUT_MS, 1);
  if (!response?.ok) return null;
  try {
    const payload: unknown = await response.json();
    return parseBrapiDetailed(ticker, payload);
  } catch {
    return null;
  }
}

/** Busca cotação cambial USD-BRL na AwesomeAPI (último fallback de FX). */
async function fetchAwesomeApiQuote(ticker: string): Promise<ParsedQuoteWithMeta | null> {
  if (!isFxUsdBrlTicker(ticker)) return null;
  const response = await fetchWithRetry(
    "https://economia.awesomeapi.com.br/last/USD-BRL",
    { headers: { "User-Agent": USER_AGENT } },
    FETCH_TIMEOUT_MS,
    1,
  );
  if (!response?.ok) return null;
  try {
    const payload: unknown = await response.json();
    return parseAwesomeApiDetailed(ticker, payload);
  } catch {
    return null;
  }
}

/** Cadeia de provedores exclusivamente no servidor (PTAX / Yahoo / Brapi / AwesomeAPI). */
async function fetchQuotePrimary(ticker: string): Promise<ParsedQuoteWithMeta | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  if (isFxUsdBrlTicker(normalized)) {
    const ptax = await fetchBcbPtax(new Date(), "USDBRL=X");
    if (ptax) return ptax;
    const yahoo = await fetchYahooQuote("USDBRL=X");
    if (yahoo) return yahoo;
    return await fetchAwesomeApiQuote("USDBRL=X");
  }

  const yahoo = await fetchYahooQuote(normalized);
  if (yahoo) return yahoo;

  const brapi = await fetchBrapiQuote(normalized);
  if (brapi) return brapi;

  return null;
}

/** Consulta provedor secundário exclusivamente quando houver suspeita de spike > 50% sem split confirmado. */
async function fetchSecondaryConsensusPrice(
  ticker: string,
  primaryProvider: string,
): Promise<number | null> {
  if (isFxUsdBrlTicker(ticker)) {
    const alt =
      primaryProvider === "bcb_ptax"
        ? await fetchYahooQuote("USDBRL=X")
        : await fetchBcbPtax(new Date(), "USDBRL=X");
    return alt?.price ?? null;
  }
  if (classifyTickerMarket(ticker) === "BR" && primaryProvider === "yahoo") {
    const brapi = await fetchBrapiQuote(ticker);
    return brapi?.price ?? null;
  }
  if (primaryProvider === "brapi") {
    const yahoo = await fetchYahooQuote(ticker);
    return yahoo?.price ?? null;
  }
  return null;
}

/** Busca proventos corporativos na Brapi para um lote de tickers B3, informando quais símbolos foram cobertos. */
async function fetchBrapiDividendsForTickers(
  tickers: string[],
): Promise<{ dividends: ParsedCorporateDividend[]; coveredTickers: Set<string> }> {
  const cleanTickers = [
    ...new Set(
      tickers
        .map(normalizeTickerForBrapi)
        .filter((t) => t && !t.includes("=")),
    ),
  ];
  const coveredTickers = new Set<string>();
  if (cleanTickers.length === 0) return { dividends: [], coveredTickers };

  const brapiToken = getBrapiToken();
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  const tokenParam = brapiToken ? `&token=${encodeURIComponent(brapiToken)}` : "";
  if (brapiToken) {
    headers["Authorization"] = `Bearer ${brapiToken}`;
  }

  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTickers.join(","))}?dividends=true${tokenParam}`;
  const response = await fetchWithRetry(url, { headers }, FETCH_TIMEOUT_MS * 2, 1);
  if (!response?.ok) return { dividends: [], coveredTickers };
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return { dividends: [], coveredTickers };
    const results = (payload as Record<string, unknown>).results;
    if (!Array.isArray(results)) return { dividends: [], coveredTickers };

    const allDividends: ParsedCorporateDividend[] = [];
    for (const item of results) {
      const itemRec = item as Record<string, unknown> | null;
      const sym = typeof itemRec?.symbol === "string" ? itemRec.symbol.trim().toUpperCase() : "";
      if (!sym) continue;
      const hasDividendsObj = Boolean(
        itemRec?.dividendsData &&
          typeof itemRec.dividendsData === "object" &&
          Array.isArray((itemRec.dividendsData as Record<string, unknown>).cashDividends),
      );
      if (hasDividendsObj) {
        coveredTickers.add(normalizeTickerForBrapi(sym));
      }
      allDividends.push(...parseBrapiDividends(normalizeTickerForBrapi(sym), { results: [item] }));
    }
    return { dividends: allDividends, coveredTickers };
  } catch {
    return { dividends: [], coveredTickers };
  }
}

/** Busca proventos via Yahoo Finance (`events=div`) para EUA ou fallback B3 incerto. */
async function fetchYahooDividendsForTicker(
  ticker: string,
  market: "BR" | "US",
): Promise<ParsedCorporateDividend[]> {
  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker || isFxUsdBrlTicker(ticker)) return [];

  const canonicalTicker = market === "BR" ? normalizeTickerForBrapi(ticker) : ticker.trim().toUpperCase();
  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(apiTicker)}?range=1y&interval=1d&events=div`;
    const response = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } }, FETCH_TIMEOUT_MS, 1);
    if (!response?.ok) continue;
    try {
      const payload: unknown = await response.json();
      const parsed = parseYahooDividends(canonicalTicker, payload, market);
      return parsed;
    } catch {
      // tenta próximo host
    }
  }
  return [];
}

function addDaysIsoServer(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

async function resolveWithSpikeGuardrail(
  ticker: string,
  prev: CachedAssetPriceRow | undefined,
  now: Date,
): Promise<{
  quote: ParsedQuoteWithMeta | null;
  upsertRow: GlobalQuoteUpsertRow | null;
  guarded: boolean;
}> {
  const fetched = await fetchQuotePrimary(ticker);
  if (!fetched) {
    return { quote: null, upsertRow: null, guarded: false };
  }

  const prevPrice = prev && prev.source === "api" && prev.price > 0 ? Number(prev.price) : null;
  let evalResult = evaluateSpikeGuardrail({
    ticker,
    newPrice: fetched.price,
    newMarketPriceAt: fetched.marketPriceAt ?? now.toISOString(),
    newProvider: fetched.provider,
    previousPrice: prevPrice,
    previousMarketPriceAt: prev?.market_price_at ?? null,
    previousProvider: prev?.provider ?? null,
    pendingSpikePrice: prev?.pending_spike_price ?? null,
    pendingSpikeAt: prev?.pending_spike_at ?? null,
    chartPreviousClose: fetched.chartPreviousClose ?? null,
    splits: fetched.splits,
    now,
  });

  if (!evalResult.accepted && evalResult.reason === "spike_guarded") {
    const secondaryPrice = await fetchSecondaryConsensusPrice(ticker, fetched.provider);
    if (secondaryPrice && secondaryPrice > 0) {
      evalResult = evaluateSpikeGuardrail({
        ticker,
        newPrice: fetched.price,
        newMarketPriceAt: fetched.marketPriceAt ?? now.toISOString(),
        newProvider: fetched.provider,
        previousPrice: prevPrice,
        previousMarketPriceAt: prev?.market_price_at ?? null,
        previousProvider: prev?.provider ?? null,
        pendingSpikePrice: prev?.pending_spike_price ?? null,
        pendingSpikeAt: prev?.pending_spike_at ?? null,
        chartPreviousClose: fetched.chartPreviousClose ?? null,
        splits: fetched.splits,
        secondaryConfirmPrice: secondaryPrice,
        now,
      });
    }
  }

  const nowIso = now.toISOString();
  const upsertRow = buildGlobalQuoteUpsertRow({
    ticker,
    price: evalResult.effectivePrice,
    currency: fetched.currency,
    source: "api",
    marketPriceAt: evalResult.effectiveMarketPriceAt ?? fetched.marketPriceAt ?? nowIso,
    fetchedAt: nowIso,
    provider: evalResult.effectiveProvider ?? fetched.provider,
    pendingSpikePrice: evalResult.pendingSpikePrice,
    pendingSpikeAt: evalResult.pendingSpikeAt,
    updatedAt: nowIso,
  });

  return {
    quote: {
      ...fetched,
      price: evalResult.effectivePrice,
      marketPriceAt: upsertRow.market_price_at,
      provider: (upsertRow.provider ?? fetched.provider) as ParsedQuoteWithMeta["provider"],
    },
    upsertRow,
    guarded: !evalResult.accepted,
  };
}

function getPreviousMonthBR(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const year = y ?? 2026;
  const month = m ?? 1;
  if (month <= 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  const auth = req.headers.get("authorization") ?? "";
  const apiKey = req.headers.get("apikey") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return safeErrorResponse(req, 500, "Serviço temporariamente indisponível.");
  }

  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const isServiceRole =
    (token.length > 0 && (await timingSafeEqualString(token, serviceRoleKey))) ||
    (apiKey.length > 0 && (await timingSafeEqualString(apiKey, serviceRoleKey)));

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let callerUserId: string | null = null;
  if (!isServiceRole) {
    if (!token) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }
    callerUserId = userData.user.id;
  }

  let action = "quotes";
  let requestedTickers: string[] = [];
  let requestedMonth: string | null = null;
  let requestMode: "swr" | "report_preflight" | "preview" = "swr";
  let requestReason: "swr" | "cache_miss" | "post_trade_stale" | "report_preflight" = "swr";

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.action === "string") {
        action = body.action.trim();
      }
      if (body && typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month.trim())) {
        requestedMonth = body.month.trim();
      }
      if (body && (body.mode === "swr" || body.mode === "report_preflight" || body.mode === "preview")) {
        requestMode = body.mode;
      }
      if (
        body &&
        (body.reason === "swr" ||
          body.reason === "cache_miss" ||
          body.reason === "post_trade_stale" ||
          body.reason === "report_preflight")
      ) {
        requestReason = body.reason;
      }
      if (body && Array.isArray(body.tickers)) {
        const TICKER_REGEX = /^[A-Z0-9^=.-]{1,20}$/;
        requestedTickers = [
          ...new Set(
            body.tickers
              .map((t: unknown) => String(t).trim().toUpperCase())
              .filter((t: string) => Boolean(t) && TICKER_REGEX.test(t)),
          ),
        ].slice(0, 60);
      }
    } catch {
      // payload sem json body
    }
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 1: Fechamento Diário EOD (`eod_close`) — Cron 22:00 UTC seg–sex
  // ---------------------------------------------------------------------------
  if (action === "eod_close") {
    if (!isServiceRole) {
      return jsonResponse(req, { error: "forbidden" }, 403);
    }

    const now = new Date();
    const todayParts = getZonedDateParts(now, "America/Sao_Paulo");
    const todayBR = todayParts.isoDate;
    const targetMonth = todayBR.slice(0, 7);
    const lastBizDayBR = getLastBusinessDayOfMonthBR(todayParts.year, todayParts.month);
    const isMonthEndBR = todayBR === lastBizDayBR;

    const { data: activeAssets, error: assetsErr } = await supabase
      .from("portfolio_assets")
      .select("ticker, asset_class, fixed_income_metadata, notes")
      .gt("quantity", 0);

    if (assetsErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos para fechamento EOD.", assetsErr);
    }

    const activeTickerSet = new Set<string>(["USDBRL=X"]);
    for (const a of activeAssets ?? []) {
      if (isMarketQuotedAsset(a)) {
        activeTickerSet.add(a.ticker.trim().toUpperCase());
      }
    }
    const allTickers = [...activeTickerSet];

    const { data: cachedRows } = await supabase
      .from("asset_prices")
      .select("ticker, price, currency, source, market_price_at, fetched_at, provider, pending_spike_price, pending_spike_at")
      .is("user_id", null)
      .in("ticker", allTickers);

    const cacheMap = new Map<string, CachedAssetPriceRow>();
    for (const row of cachedRows ?? []) {
      cacheMap.set(row.ticker.toUpperCase(), {
        ...row,
        price: Number(row.price),
        pending_spike_price: row.pending_spike_price != null ? Number(row.pending_spike_price) : null,
      });
    }

    const openTodayTickers = allTickers.filter((ticker) => {
      const market = classifyTickerMarket(ticker);
      const localDate = getZonedDateParts(now, market === "US" ? "America/New_York" : "America/Sao_Paulo").isoDate;
      return isBusinessDayForMarket(localDate, market);
    });

    const fetchedResults = await runWithConcurrencyPool(
      openTodayTickers,
      POOL_CONCURRENCY,
      async (ticker) => ({
        ticker,
        res: await resolveWithSpikeGuardrail(ticker, cacheMap.get(ticker), now),
      }),
    );

    const globalUpserts: GlobalQuoteUpsertRow[] = [];
    const historyUpserts: Array<{
      ticker: string;
      reference_date: string;
      price: number;
      currency: "BRL" | "USD";
      provider: string | null;
      market_price_at: string | null;
      month: string;
      is_month_end: boolean;
    }> = [];
    const recordedHistoryTickers = new Set<string>();
    let guarded = 0;
    let failed = 0;

    for (const { ticker, res } of fetchedResults) {
      if (!res.upsertRow) {
        failed += 1;
        continue;
      }
      if (res.guarded) guarded += 1;
      globalUpserts.push(res.upsertRow);
      if (res.upsertRow.price > 0) {
        historyUpserts.push({
          ticker,
          reference_date: todayBR,
          price: res.upsertRow.price,
          currency: res.upsertRow.currency,
          provider: res.upsertRow.provider,
          market_price_at: res.upsertRow.market_price_at,
          month: targetMonth,
          is_month_end: isMonthEndBR,
        });
        recordedHistoryTickers.add(ticker);
      }
    }

    // Ajuste 1 (Feriado cruzado no último dia útil BR do mês):
    // Se hoje é fechamento mensal BR e algum ativo (ex.: EUA em feriado ou falha momentânea)
    // não capturou barra nova hoje, congelar em market_price_history (is_month_end=true)
    // o último preço oficial válido de asset_prices para zero lacunas no fechamento EOM.
    let crossHolidayFilled = 0;
    if (isMonthEndBR) {
      for (const ticker of allTickers) {
        if (recordedHistoryTickers.has(ticker)) continue;
        const cached = cacheMap.get(ticker);
        if (cached && cached.source === "api" && cached.price > 0) {
          historyUpserts.push({
            ticker,
            reference_date: todayBR,
            price: cached.price,
            currency: cached.currency,
            provider: cached.provider,
            market_price_at: cached.market_price_at,
            month: targetMonth,
            is_month_end: true,
          });
          recordedHistoryTickers.add(ticker);
          crossHolidayFilled += 1;
        }
      }
    }

    if (globalUpserts.length > 0) {
      const { error: upsertErr } = await supabase.rpc("upsert_global_asset_prices", {
        p_rows: globalUpserts,
      });
      if (upsertErr) {
        return safeErrorResponse(req, 500, "Falha ao gravar EOD em asset_prices.", upsertErr);
      }
    }

    if (historyUpserts.length > 0) {
      const { error: histErr } = await supabase.rpc("upsert_market_price_history", {
        p_rows: historyUpserts,
      });
      if (histErr) {
        return safeErrorResponse(req, 500, "Falha ao gravar histórico EOD.", histErr);
      }
    }

    const { data: purgedCount } = await supabase.rpc("purge_old_eod_market_price_history", {
      p_keep_days: 90,
    });

    return jsonResponse(req, {
      ok: true,
      action: "eod_close",
      reference_date: todayBR,
      is_month_end: isMonthEndBR,
      updated_global: globalUpserts.length,
      recorded_history: historyUpserts.length,
      cross_holiday_filled: crossHolidayFilled,
      guarded,
      failed,
      purged_eod: purgedCount ?? 0,
    });
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 2: Fechamento Mensal Global EOM (`close_month_global`) — Cron 22:30 UTC
  // ---------------------------------------------------------------------------
  if (action === "close_month_global") {
    if (!isServiceRole) {
      return jsonResponse(req, { error: "forbidden" }, 403);
    }

    const now = new Date();
    const todayParts = getZonedDateParts(now, "America/Sao_Paulo");
    const todayBR = todayParts.isoDate;
    const currentMonthBR = todayBR.slice(0, 7);
    const lastBizBR = getLastBusinessDayOfMonthBR(todayParts.year, todayParts.month);
    const first3BizBR = getFirstNBusinessDaysOfMonthBR(todayParts.year, todayParts.month, 3);

    let targetMonth = requestedMonth;
    if (!targetMonth) {
      if (todayBR === lastBizBR) {
        targetMonth = currentMonthBR;
      } else if (first3BizBR.includes(todayBR)) {
        targetMonth = getPreviousMonthBR(currentMonthBR);
      } else {
        return jsonResponse(req, {
          ok: true,
          action: "close_month_global",
          skipped: true,
          reason: "outside_eom_window",
          today: todayBR,
        });
      }
    }

    const [tYear, tMonth] = targetMonth.split("-").map(Number);
    const closingDate = getLastBusinessDayOfMonthBR(tYear ?? todayParts.year, tMonth ?? todayParts.month);

    const { data: allAssets, error: allAssetsErr } = await supabase
      .from("portfolio_assets")
      .select("id, user_id, ticker, asset_class, currency, quantity, average_price, total_cost_brl, fixed_income_metadata, notes");

    if (allAssetsErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos para fechamento EOM.", allAssetsErr);
    }

    const quotedTickerSet = new Set<string>(["USDBRL=X"]);
    for (const a of allAssets ?? []) {
      if ((Number(a.quantity) || 0) > 0 && isMarketQuotedAsset(a)) {
        quotedTickerSet.add(a.ticker.trim().toUpperCase());
      }
    }
    const quotedTickers = [...quotedTickerSet];

    // Lê cotações já congeladas em `market_price_history` para o mês alvo
    const { data: existingHistory } = await supabase
      .from("market_price_history")
      .select("ticker, reference_date, price, currency, provider, market_price_at, is_month_end")
      .eq("month", targetMonth)
      .eq("is_month_end", true)
      .in("ticker", quotedTickers)
      .order("is_month_end", { ascending: false })
      .order("reference_date", { ascending: false });

    const eomPriceMap = new Map<string, { price: number; currency: "BRL" | "USD"; provider: string | null; market_price_at: string | null }>();
    for (const row of existingHistory ?? []) {
      const key = row.ticker.trim().toUpperCase();
      if (!eomPriceMap.has(key) && Number(row.price) > 0) {
        eomPriceMap.set(key, {
          price: Number(row.price),
          currency: row.currency === "USD" ? "USD" : "BRL",
          provider: row.provider,
          market_price_at: row.market_price_at,
        });
      }
    }

    const missingTickers = quotedTickers.filter((t) => !eomPriceMap.has(t));
    if (missingTickers.length > 0) {
      const { data: globalCacheRows } = await supabase
        .from("asset_prices")
        .select("ticker, price, currency, source, provider, market_price_at")
        .is("user_id", null)
        .in("ticker", missingTickers);

      const globalCacheMap = new Map<string, { price: number; currency: "BRL" | "USD"; provider: string | null; market_price_at: string | null }>();
      for (const r of globalCacheRows ?? []) {
        if (r.source === "api" && Number(r.price) > 0) {
          globalCacheMap.set(r.ticker.toUpperCase(), {
            price: Number(r.price),
            currency: r.currency === "USD" ? "USD" : "BRL",
            provider: r.provider,
            market_price_at: r.market_price_at,
          });
        }
      }

      const histFetched = await runWithConcurrencyPool(
        missingTickers,
        POOL_CONCURRENCY,
        async (ticker) => {
          const hist = await fetchYahooHistoricalMonthClose(ticker, targetMonth);
          if (hist && hist.price > 0) {
            return { ticker, hit: { price: hist.price, currency: hist.currency, provider: hist.provider, market_price_at: hist.marketPriceAt } };
          }
          // Fallback controlado somente quando closingDate for recente (<= 7 dias), ex.: feriado cruzado
          const closingAgeDays = (now.getTime() - Date.parse(`${closingDate}T21:00:00Z`)) / (1000 * 60 * 60 * 24);
          const cached = closingAgeDays <= 7 ? globalCacheMap.get(ticker) : undefined;
          return { ticker, hit: cached ?? null };
        },
      );

      const newHistoryRows: Array<{
        ticker: string;
        reference_date: string;
        price: number;
        currency: "BRL" | "USD";
        provider: string | null;
        market_price_at: string | null;
        month: string;
        is_month_end: boolean;
      }> = [];

      for (const { ticker, hit } of histFetched) {
        if (!hit || hit.price <= 0) continue;
        eomPriceMap.set(ticker, hit);
        newHistoryRows.push({
          ticker,
          reference_date: closingDate,
          price: hit.price,
          currency: hit.currency,
          provider: hit.provider,
          market_price_at: hit.market_price_at,
          month: targetMonth,
          is_month_end: true,
        });
      }

      if (newHistoryRows.length > 0) {
        await supabase.rpc("upsert_market_price_history", { p_rows: newHistoryRows });
      }
    }

    // Identifica usuários que possuem transações posteriores à `closingDate` (custódia viva alterada após virada)
    const { data: postClosingTxs } = await supabase
      .from("portfolio_transactions")
      .select("user_id")
      .gt("date", closingDate);
    const usersWithPostClosingTxs = new Set<string>(
      (postClosingTxs ?? []).map((tx) => String(tx.user_id)),
    );

    // Agrupa ativos por usuário para hidratar `portfolio_monthly_prices` e fechar snapshots elegíveis
    const assetsByUser = new Map<string, typeof allAssets>();
    for (const asset of allAssets ?? []) {
      const uid = String(asset.user_id);
      const list = assetsByUser.get(uid) ?? [];
      list.push(asset);
      assetsByUser.set(uid, list);
    }

    const eomFxRate = eomPriceMap.get("USDBRL=X")?.price ?? null;
    let hydratedUsers = 0;
    let closedSnapshots = 0;

    for (const [userId, userAssets] of assetsByUser.entries()) {
      const userPrices: Array<{ ticker: string; price: number; currency: "BRL" | "USD"; source: "api" }> = [];
      if (eomFxRate && eomFxRate > 0) {
        userPrices.push({ ticker: "USDBRL=X", price: eomFxRate, currency: "BRL", source: "api" });
      }

      let hasParametricFixedIncome = false;
      let hasMissingPrice = false;
      let totalValueBRL = 0;
      let totalCostBRL = 0;
      const seenUserTickers = new Set<string>();

      for (const asset of userAssets ?? []) {
        const qty = Number(asset.quantity) || 0;
        const avg = Number(asset.average_price) || 0;
        const tickerUpper = asset.ticker.trim().toUpperCase();
        const isCash =
          isCashClass(asset.asset_class ?? null) ||
          tickerUpper === "CAIXA" ||
          tickerUpper === "CASH";

        if (isCash) {
          const fx = asset.currency === "USD" ? (eomFxRate ?? 0) : 1;
          if (asset.currency === "USD" && !eomFxRate) hasMissingPrice = true;
          totalValueBRL += qty * fx;
          totalCostBRL += qty * fx;
          continue;
        }

        if (qty <= 0) continue;

        if (!isMarketQuotedAsset(asset)) {
          // Renda Fixa paramétrica / Tesouro Direto / valoração customizada:
          // Não duplicamos fórmula de Renda Fixa na Edge Function (Paridade SSOT).
          hasParametricFixedIncome = true;
          continue;
        }

        const eomQuote = eomPriceMap.get(tickerUpper);
        if (!eomQuote || eomQuote.price <= 0) {
          hasMissingPrice = true;
          continue;
        }

        if (!seenUserTickers.has(tickerUpper)) {
          seenUserTickers.add(tickerUpper);
          userPrices.push({
            ticker: tickerUpper,
            price: eomQuote.price,
            currency: asset.currency === "USD" ? "USD" : eomQuote.currency,
            source: "api",
          });
        }

        const fx = asset.currency === "USD" ? (eomFxRate ?? 0) : 1;
        if (asset.currency === "USD" && !eomFxRate) {
          hasMissingPrice = true;
          continue;
        }

        totalValueBRL += qty * eomQuote.price * fx;
        const costNative = qty * avg;
        const assetCostBRL =
          asset.currency === "USD" && asset.total_cost_brl != null && Number(asset.total_cost_brl) > 0
            ? Number(asset.total_cost_brl)
            : costNative * fx;
        totalCostBRL += assetCostBRL;
      }

      if (userPrices.length === 0) continue;

      const canCloseDirectly =
        !hasParametricFixedIncome &&
        !hasMissingPrice &&
        !usersWithPostClosingTxs.has(userId) &&
        totalValueBRL > 0;

      const { data: closeRes } = await supabase.rpc("commit_monthly_closing_system", {
        p_user_id: userId,
        p_month: targetMonth,
        p_closing_date: closingDate,
        p_prices: userPrices,
        p_total_value: canCloseDirectly ? Math.round(totalValueBRL * 100) / 100 : null,
        p_total_cost: canCloseDirectly ? Math.round(totalCostBRL * 100) / 100 : null,
      });

      hydratedUsers += 1;
      if ((closeRes as { snapshot_closed?: boolean } | null)?.snapshot_closed) {
        closedSnapshots += 1;
      }
    }

    return jsonResponse(req, {
      ok: true,
      action: "close_month_global",
      month: targetMonth,
      closing_date: closingDate,
      frozen_tickers: eomPriceMap.size,
      hydrated_users: hydratedUsers,
      closed_snapshots: closedSnapshots,
    });
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 3A: Coleta Global de Proventos B3 + EUA (`sync_corporate_dividends`) — Cron 10:00 UTC
  // ---------------------------------------------------------------------------
  if (action === "sync_corporate_dividends") {
    let assetsQuery = supabase
      .from("portfolio_assets")
      .select("ticker, asset_class, fixed_income_metadata, notes")
      .gt("quantity", 0);
    if (callerUserId && !isServiceRole) {
      assetsQuery = assetsQuery.eq("user_id", callerUserId);
    }

    const { data: activeAssets, error: assetsErr } = await assetsQuery;
    if (assetsErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos para proventos.", assetsErr);
    }

    const brCanonicalSet = new Set<string>();
    const usTickerSet = new Set<string>();

    for (const a of activeAssets ?? []) {
      if (!isMarketQuotedAsset(a)) continue;
      const rawTicker = a.ticker.trim().toUpperCase();
      if (!rawTicker || isFxUsdBrlTicker(rawTicker)) continue;
      const market = classifyTickerMarket(rawTicker);
      if (market === "CRYPTO" || market === "FX") continue;
      if (market === "US") {
        usTickerSet.add(rawTicker);
      } else {
        const canonical = normalizeTickerForBrapi(rawTicker);
        if (canonical) brCanonicalSet.add(canonical);
      }
    }

    const brTickers = [...brCanonicalSet];
    const usTickers = [...usTickerSet];
    if (brTickers.length === 0 && usTickers.length === 0) {
      return jsonResponse(req, {
        ok: true,
        action: "sync_corporate_dividends",
        synced_dividends: 0,
        tickers: [],
      });
    }

    const allCorporateDividends: ParsedCorporateDividend[] = [];
    const coveredBrTickers = new Set<string>();
    const chunkSize = 15;
    for (let i = 0; i < brTickers.length; i += chunkSize) {
      const chunk = brTickers.slice(i, i + chunkSize);
      const { dividends, coveredTickers } = await fetchBrapiDividendsForTickers(chunk);
      allCorporateDividends.push(...dividends);
      for (const ct of coveredTickers) coveredBrTickers.add(ct);
    }

    // Fallback Yahoo B3 para tickers não cobertos pela Brapi (sempre marca `is_type_uncertain = true`)
    const uncoveredBrTickers = brTickers.filter((t) => !coveredBrTickers.has(t));
    if (uncoveredBrTickers.length > 0) {
      const brFallbackBatches = await runWithConcurrencyPool(
        uncoveredBrTickers,
        POOL_CONCURRENCY,
        async (ticker) => await fetchYahooDividendsForTicker(ticker, "BR"),
      );
      for (const batch of brFallbackBatches) {
        allCorporateDividends.push(...batch);
      }
    }

    // EUA: coleta via Yahoo Finance com retenção 30% IR e `com_date` dia útil NYSE anterior
    if (usTickers.length > 0) {
      const usBatches = await runWithConcurrencyPool(
        usTickers,
        POOL_CONCURRENCY,
        async (ticker) => await fetchYahooDividendsForTicker(ticker, "US"),
      );
      for (const batch of usBatches) {
        allCorporateDividends.push(...batch);
      }
    }

    let upserted = 0;
    let promoted = 0;
    if (allCorporateDividends.length > 0) {
      const rpcBatchSize = 200;
      for (let i = 0; i < allCorporateDividends.length; i += rpcBatchSize) {
        const chunk = allCorporateDividends.slice(i, i + rpcBatchSize);
        const { data: rpcRes, error: divUpsertError } = await supabase.rpc(
          "upsert_corporate_dividend_system",
          { p_rows: chunk },
        );
        if (divUpsertError) {
          return safeErrorResponse(req, 500, "Falha ao gravar proventos corporativos.", divUpsertError);
        }
        const resObj = rpcRes as { upserted?: number; promoted?: number } | null;
        upserted += resObj?.upserted ?? 0;
        promoted += resObj?.promoted ?? 0;
      }
    }

    return jsonResponse(req, {
      ok: true,
      action: "sync_corporate_dividends",
      synced_dividends: upserted + promoted,
      upserted,
      promoted,
      br_fallback_count: uncoveredBrTickers.length,
      us_count: usTickers.length,
      tickers: [...brTickers, ...usTickers],
    });
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 3B: Materialização & Efetivação por Usuário (`process_user_dividends`) — Cron 11:30 UTC
  // ---------------------------------------------------------------------------
  if (action === "process_user_dividends") {
    if (!isServiceRole) {
      return jsonResponse(req, { error: "forbidden" }, 403);
    }

    const now = new Date();
    const todayBR = getZonedDateParts(now, "America/Sao_Paulo").isoDate;
    const lookbackStart = addDaysIsoServer(todayBR, -120);

    const { data: rawAssets, error: assetsErr } = await supabase
      .from("portfolio_assets")
      .select("id, user_id, ticker, asset_class, currency, quantity, fixed_income_metadata, notes, created_at")
      .gt("quantity", 0);

    if (assetsErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar custódias para proventos.", assetsErr);
    }

    const quotedAssets = (rawAssets ?? []).filter((a) => {
      if (!isMarketQuotedAsset(a)) return false;
      const m = classifyTickerMarket(a.ticker);
      return m === "BR" || m === "US";
    });

    if (quotedAssets.length === 0) {
      return jsonResponse(req, { ok: true, action: "process_user_dividends", processed_users: 0 });
    }

    const candidateUserIds = [...new Set(quotedAssets.map((a) => String(a.user_id)))];
    const { data: activeProfiles } = await supabase
      .from("profiles")
      .select("id, status")
      .in("id", candidateUserIds)
      .eq("status", "active");
    const activeUserSet = new Set<string>((activeProfiles ?? []).map((p) => String(p.id)));

    const { data: fxRow } = await supabase
      .from("asset_prices")
      .select("price")
      .is("user_id", null)
      .eq("ticker", "USDBRL=X")
      .maybeSingle();
    const usdBrlRate = fxRow && Number(fxRow.price) > 0 ? Number(fxRow.price) : 5.25;

    const { data: corpRows, error: corpErr } = await supabase
      .from("corporate_dividends")
      .select("id, ticker, type, com_date, payment_date, rate, net_rate, tax_rate_pct, currency, is_type_uncertain")
      .or(`payment_date.is.null,com_date.gte.${lookbackStart},payment_date.gte.${lookbackStart}`);

    if (corpErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar agenda corporativa de proventos.", corpErr);
    }

    const corpByTicker = new Map<string, Array<{
      id: string;
      ticker: string;
      type: string;
      com_date: string;
      payment_date: string | null;
      rate: number;
      net_rate: number;
      tax_rate_pct: number;
      currency: "BRL" | "USD";
      is_type_uncertain: boolean;
    }>>();

    for (const c of corpRows ?? []) {
      const key = String(c.ticker).trim().toUpperCase();
      const list = corpByTicker.get(key) ?? [];
      list.push({
        id: String(c.id),
        ticker: key,
        type: String(c.type),
        com_date: String(c.com_date).slice(0, 10),
        payment_date: c.payment_date ? String(c.payment_date).slice(0, 10) : null,
        rate: Number(c.rate),
        net_rate: Number(c.net_rate),
        tax_rate_pct: Number(c.tax_rate_pct ?? 0),
        currency: c.currency === "USD" ? "USD" : "BRL",
        is_type_uncertain: Boolean(c.is_type_uncertain),
      });
      corpByTicker.set(key, list);
    }

    const assetsByUser = new Map<string, typeof quotedAssets>();
    for (const asset of quotedAssets) {
      const uid = String(asset.user_id);
      if (!activeUserSet.has(uid)) continue;
      const list = assetsByUser.get(uid) ?? [];
      list.push(asset);
      assetsByUser.set(uid, list);
    }

    let processedUsers = 0;
    let provisionedCount = 0;
    let pendingCount = 0;
    let settledCount = 0;
    let pushDispatchedCount = 0;

    for (const [uid, userAssets] of assetsByUser.entries()) {
      processedUsers += 1;
      const [prefRes, txRes, manDivRes, existingEventsRes] = await Promise.all([
        supabase.from("user_preferences").select("custom_settings").eq("user_id", uid).maybeSingle(),
        supabase
          .from("portfolio_transactions")
          .select("asset_id, type, date, quantity, created_at")
          .eq("user_id", uid)
          .in("type", ["buy", "subscription", "sell", "split", "reverse_split"]),
        supabase
          .from("portfolio_dividends")
          .select("id, asset_id, ticker, date, amount")
          .eq("user_id", uid),
        supabase
          .from("user_dividend_events")
          .select("id, corporate_dividend_id, status, payment_date, settled_dividend_id, is_type_uncertain")
          .eq("user_id", uid),
      ]);

      const customSettings = (prefRes.data?.custom_settings ?? {}) as {
        dividendAutomation?: {
          settlementMode?: "auto" | "manual_confirm";
          autoCreditCash?: boolean;
          notifyOnProvisioned?: boolean;
          notifyOnPayment?: boolean;
          activatedAt?: string | null;
        };
      };
      const divAuto = customSettings.dividendAutomation ?? {};
      const settlementMode = divAuto.settlementMode === "manual_confirm" ? "manual_confirm" : "auto";
      const autoCreditCash = divAuto.autoCreditCash !== false;
      const notifyOnProvisioned = divAuto.notifyOnProvisioned !== false;
      const notifyOnPayment = divAuto.notifyOnPayment !== false;
      const cutoffDate = resolveAntiFloodCutoffDate(divAuto.activatedAt, todayBR, 7);

      const txsByAsset = new Map<string, Array<{ type: string; date: string; quantity: number; created_at?: string | null }>>();
      for (const tx of txRes.data ?? []) {
        const aid = String(tx.asset_id);
        const list = txsByAsset.get(aid) ?? [];
        list.push({
          type: String(tx.type),
          date: String(tx.date),
          quantity: Number(tx.quantity),
          created_at: tx.created_at ? String(tx.created_at) : null,
        });
        txsByAsset.set(aid, list);
      }

      const manDivsByAsset = new Map<string, Array<{ id: string; date: string; amount: number }>>();
      for (const md of manDivRes.data ?? []) {
        const aid = md.asset_id ? String(md.asset_id) : "";
        if (!aid) continue;
        const list = manDivsByAsset.get(aid) ?? [];
        list.push({ id: String(md.id), date: String(md.date), amount: Number(md.amount) });
        manDivsByAsset.set(aid, list);
      }

      const existingByCorpId = new Map<string, {
        id: string;
        status: string;
        payment_date: string | null;
        settled_dividend_id: string | null;
        is_type_uncertain: boolean;
      }>();
      for (const ev of existingEventsRes.data ?? []) {
        if (ev.corporate_dividend_id) {
          existingByCorpId.set(String(ev.corporate_dividend_id), {
            id: String(ev.id),
            status: String(ev.status),
            payment_date: ev.payment_date ? String(ev.payment_date).slice(0, 10) : null,
            settled_dividend_id: ev.settled_dividend_id ? String(ev.settled_dividend_id) : null,
            is_type_uncertain: Boolean(ev.is_type_uncertain),
          });
        }
      }

      const newProvisionedTickers: string[] = [];
      const newPendingTickers: string[] = [];
      const newSettledTickers: string[] = [];

      for (const asset of userAssets) {
        const market = classifyTickerMarket(asset.ticker);
        const lookupTicker = market === "BR" ? normalizeTickerForBrapi(asset.ticker) : asset.ticker.trim().toUpperCase();
        const corpList = corpByTicker.get(lookupTicker) ?? [];
        if (corpList.length === 0) continue;

        const assetTxs = txsByAsset.get(String(asset.id)) ?? [];
        const assetManualDivs = manDivsByAsset.get(String(asset.id)) ?? [];

        for (const corp of corpList) {
          if (corp.com_date > todayBR) continue;
          const existing = existingByCorpId.get(corp.id);
          if (existing?.status === "SETTLED" || existing?.status === "DISMISSED") continue;

          const qtyOnCom = computeCustodyAtComDatePure(
            { quantity: Number(asset.quantity), created_at: asset.created_at ? String(asset.created_at) : null },
            assetTxs,
            corp.com_date,
          );
          if (qtyOnCom <= 0) continue;

          const grossAmount = Math.round(qtyOnCom * corp.rate * 100) / 100;
          const netAmount = Math.round(qtyOnCom * corp.net_rate * 100) / 100;
          if (netAmount <= 0) continue;

          const isProvisioned = !corp.payment_date || corp.payment_date > todayBR;

          if (isProvisioned) {
            if (!existing) {
              const { error: insErr } = await supabase
                .from("user_dividend_events")
                .upsert(
                  {
                    user_id: uid,
                    corporate_dividend_id: corp.id,
                    asset_id: asset.id,
                    ticker: lookupTicker,
                    type: corp.type,
                    status: "PROVISIONED",
                    com_date: corp.com_date,
                    payment_date: corp.payment_date,
                    quantity_on_com_date: qtyOnCom,
                    gross_rate: corp.rate,
                    net_rate: corp.net_rate,
                    tax_rate_pct: corp.tax_rate_pct,
                    gross_amount: grossAmount,
                    net_amount: netAmount,
                    currency: corp.currency,
                    is_manual: false,
                    is_type_uncertain: corp.is_type_uncertain,
                  },
                  { onConflict: "user_id, corporate_dividend_id" },
                );
              if (!insErr) {
                provisionedCount += 1;
                newProvisionedTickers.push(lookupTicker);
              }
            } else if (existing.status === "PROVISIONED") {
              await supabase
                .from("user_dividend_events")
                .update({
                  payment_date: corp.payment_date,
                  quantity_on_com_date: qtyOnCom,
                  gross_rate: corp.rate,
                  net_rate: corp.net_rate,
                  tax_rate_pct: corp.tax_rate_pct,
                  gross_amount: grossAmount,
                  net_amount: netAmount,
                  is_type_uncertain: corp.is_type_uncertain,
                  updated_at: now.toISOString(),
                })
                .eq("id", existing.id);
            }
            continue;
          }

          // Data de pagamento vencida (`payment_date <= todayBR`)
          const fuzzyDup = isFuzzyDuplicateManualDividend(corp.payment_date, netAmount, assetManualDivs);
          if (fuzzyDup.matched) {
            await supabase
              .from("user_dividend_events")
              .upsert(
                {
                  user_id: uid,
                  corporate_dividend_id: corp.id,
                  asset_id: asset.id,
                  ticker: lookupTicker,
                  type: corp.type,
                  status: "SETTLED",
                  com_date: corp.com_date,
                  payment_date: corp.payment_date,
                  quantity_on_com_date: qtyOnCom,
                  gross_rate: corp.rate,
                  net_rate: corp.net_rate,
                  tax_rate_pct: corp.tax_rate_pct,
                  gross_amount: grossAmount,
                  net_amount: netAmount,
                  currency: corp.currency,
                  settled_dividend_id: fuzzyDup.matchedDividendId,
                  is_manual: false,
                  is_type_uncertain: corp.is_type_uncertain,
                  notes: "Conciliado automaticamente com lançamento manual",
                  updated_at: now.toISOString(),
                },
                { onConflict: "user_id, corporate_dividend_id" },
              );
            continue;
          }

          const mustManualConfirm =
            corp.is_type_uncertain ||
            settlementMode === "manual_confirm" ||
            (corp.payment_date !== null && corp.payment_date < cutoffDate);

          const { data: upsertedEvent, error: upEvErr } = await supabase
            .from("user_dividend_events")
            .upsert(
              {
                user_id: uid,
                corporate_dividend_id: corp.id,
                asset_id: asset.id,
                ticker: lookupTicker,
                type: corp.type,
                status: "PENDING_CONFIRMATION",
                com_date: corp.com_date,
                payment_date: corp.payment_date,
                quantity_on_com_date: qtyOnCom,
                gross_rate: corp.rate,
                net_rate: corp.net_rate,
                tax_rate_pct: corp.tax_rate_pct,
                gross_amount: grossAmount,
                net_amount: netAmount,
                currency: corp.currency,
                is_manual: false,
                is_type_uncertain: corp.is_type_uncertain,
                updated_at: now.toISOString(),
              },
              { onConflict: "user_id, corporate_dividend_id" },
            )
            .select("id")
            .single();

          if (upEvErr || !upsertedEvent?.id) continue;

          if (mustManualConfirm) {
            if (!existing || existing.status !== "PENDING_CONFIRMATION") {
              pendingCount += 1;
              newPendingTickers.push(lookupTicker);
            }
          } else {
            const { data: settleRes, error: settleErr } = await supabase.rpc(
              "settle_user_dividend_event_system",
              {
                p_event_id: upsertedEvent.id,
                p_sync_cash: autoCreditCash,
                p_fx_rate: corp.currency === "USD" ? usdBrlRate : null,
              },
            );
            if (!settleErr && !(settleRes as { already_settled?: boolean } | null)?.already_settled) {
              settledCount += 1;
              newSettledTickers.push(lookupTicker);
            }
          }
        }
      }

      // Disparo opcional via push-dispatcher respeitando preferências e Horário Silencioso
      if (newSettledTickers.length > 0 && notifyOnPayment) {
        const uniq = [...new Set(newSettledTickers)];
        await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType: "dividend_settled",
            targetUserIds: [uid],
            title: uniq.length === 1 ? `Provento recebido: ${uniq[0]}` : `${uniq.length} proventos recebidos`,
            body: autoCreditCash
              ? `Crédito registrado no extrato e somado ao Caixa (${uniq.slice(0, 3).join(", ")}).`
              : `Proventos registrados no extrato de dividendos (${uniq.slice(0, 3).join(", ")}).`,
            url: "/investments?tab=proventos",
            severity: "P2",
            idempotencyKey: `dividends:settled:${todayBR}:${uniq.join(",")}`,
            respectQuietHours: true,
          }),
        }).catch(() => undefined);
        pushDispatchedCount += 1;
      } else if (newPendingTickers.length > 0 && notifyOnPayment) {
        const uniq = [...new Set(newPendingTickers)];
        await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType: "dividend_pending_confirmation",
            targetUserIds: [uid],
            title: "Proventos aguardando confirmação",
            body: `Confira ${uniq.slice(0, 3).join(", ")} para confirmar alíquota/crédito no Caixa.`,
            url: "/investments?tab=proventos&review=1",
            severity: "P1",
            idempotencyKey: `dividends:pending:${todayBR}:${uniq.join(",")}`,
            respectQuietHours: true,
          }),
        }).catch(() => undefined);
        pushDispatchedCount += 1;
      } else if (newProvisionedTickers.length > 0 && notifyOnProvisioned) {
        const uniq = [...new Set(newProvisionedTickers)];
        await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventType: "dividend_provisioned",
            targetUserIds: [uid],
            title: `Proventos provisionados (${uniq.slice(0, 3).join(", ")})`,
            body: "Novos proventos futuros detectados com Data COM na sua carteira.",
            url: "/investments?tab=proventos&subtab=calendario",
            severity: "P3",
            idempotencyKey: `dividends:provisioned:${todayBR}:${uniq.join(",")}`,
            respectQuietHours: true,
          }),
        }).catch(() => undefined);
        pushDispatchedCount += 1;
      }
    }

    return jsonResponse(req, {
      ok: true,
      action: "process_user_dividends",
      processed_users: processedUsers,
      provisioned: provisionedCount,
      pending_confirmation: pendingCount,
      settled: settledCount,
      push_dispatched: pushDispatchedCount,
    });
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 4: Histórico Mensal (`month` explícito < mês corrente)
  // ---------------------------------------------------------------------------
  const now = new Date();
  const currentMonthBR = getZonedDateParts(now, "America/Sao_Paulo").isoDate.slice(0, 7);

  if (requestedMonth && requestedMonth < currentMonthBR) {
    let targetTickers = requestedTickers;
    if (targetTickers.length === 0) {
      let query = supabase
        .from("portfolio_assets")
        .select("ticker, asset_class, fixed_income_metadata, notes");
      if (callerUserId) query = query.eq("user_id", callerUserId);
      const { data: assets } = await query;
      targetTickers = [
        ...new Set(
          (assets ?? [])
            .filter((a) => isMarketQuotedAsset(a))
            .map((a) => a.ticker.trim().toUpperCase()),
        ),
      ];
    }

    if (targetTickers.length === 0) {
      return jsonResponse(req, { ok: true, action, month: requestedMonth, quotes: [], fromHistory: 0, fetched: 0 });
    }

    // 1) Lê histórico já congelado em `market_price_history`
    const { data: histRows } = await supabase
      .from("market_price_history")
      .select("ticker, price, currency, provider, market_price_at, reference_date")
      .eq("month", requestedMonth)
      .eq("is_month_end", true)
      .in("ticker", targetTickers)
      .order("is_month_end", { ascending: false })
      .order("reference_date", { ascending: false });

    const quoteMap = new Map<string, { ticker: string; price: number; currency: "BRL" | "USD"; marketPriceAt: string | null; provider: string | null }>();
    for (const r of histRows ?? []) {
      const key = r.ticker.toUpperCase().trim();
      if (!quoteMap.has(key) && Number(r.price) > 0) {
        quoteMap.set(key, {
          ticker: key,
          price: Number(r.price),
          currency: r.currency === "USD" ? "USD" : "BRL",
          marketPriceAt: r.market_price_at,
          provider: r.provider,
        });
      }
    }

    const fromHistory = quoteMap.size;
    const missing = targetTickers.filter((t) => !quoteMap.has(t));
    let fetched = 0;

    if (missing.length > 0) {
      if (!isServiceRole && callerUserId) {
        const { data: rl } = await supabase.rpc("check_quote_refresh_rate_limit", {
          p_user_id: callerUserId,
          p_max_per_min: 10,
          p_max_per_hour: 60,
        });
        const rlResult = rl as { allowed?: boolean; retry_after_seconds?: number } | null;
        if (rlResult && rlResult.allowed === false) {
          return jsonResponse(
            req,
            {
              ok: true,
              action,
              month: requestedMonth,
              rateLimited: true,
              retryAfterSeconds: rlResult.retry_after_seconds ?? 60,
              quotes: [...quoteMap.values()],
            },
            200,
          );
        }
      }

      // Validação anti-envenenamento para histórico
      const { data: validAssets } = await supabase
        .from("portfolio_assets")
        .select("ticker")
        .in("ticker", missing.filter((t) => !isFxUsdBrlTicker(t)));
      const persistableSet = new Set<string>([
        ...(validAssets ?? []).map((a) => a.ticker.trim().toUpperCase()),
        "USDBRL=X",
      ]);

      const [mY, mM] = requestedMonth.split("-").map(Number);
      const fallbackClosingDate = getLastBusinessDayOfMonthBR(mY ?? 2026, mM ?? 1);

      const histFetched = await runWithConcurrencyPool(
        missing,
        POOL_CONCURRENCY,
        async (ticker) => await fetchYahooHistoricalMonthClose(ticker, requestedMonth!),
      );

      const toPersist: Array<{
        ticker: string;
        reference_date: string;
        price: number;
        currency: "BRL" | "USD";
        provider: string | null;
        market_price_at: string | null;
        month: string;
        is_month_end: boolean;
      }> = [];

      for (const hit of histFetched) {
        if (!hit || hit.price <= 0) continue;
        fetched += 1;
        quoteMap.set(hit.ticker, {
          ticker: hit.ticker,
          price: hit.price,
          currency: hit.currency,
          marketPriceAt: hit.marketPriceAt,
          provider: hit.provider,
        });
        if (isServiceRole || persistableSet.has(hit.ticker)) {
          toPersist.push({
            ticker: hit.ticker,
            reference_date: hit.referenceDate ?? fallbackClosingDate,
            price: hit.price,
            currency: hit.currency,
            provider: hit.provider,
            market_price_at: hit.marketPriceAt,
            month: requestedMonth,
            is_month_end: true,
          });
        }
      }

      if (toPersist.length > 0) {
        await supabase.rpc("upsert_market_price_history", { p_rows: toPersist });
      }
    }

    return jsonResponse(req, {
      ok: true,
      action,
      month: requestedMonth,
      fromHistory,
      fetched,
      quotes: [...quoteMap.values()],
    });
  }

  // ---------------------------------------------------------------------------
  // AÇÃO 5: Live SWR Compartilhado (`quotes` default)
  // ---------------------------------------------------------------------------
  let tickers: string[] = requestedTickers;

  if (tickers.length === 0) {
    let query = supabase
      .from("portfolio_assets")
      .select("ticker, asset_class, fixed_income_metadata, notes");
    if (callerUserId && !isServiceRole) {
      query = query.eq("user_id", callerUserId);
    } else {
      query = query.gt("quantity", 0);
    }

    const { data: assets, error: assetsError } = await query;
    if (assetsError) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos.", assetsError);
    }

    tickers = [
      ...new Set([
        ...(assets ?? [])
          .filter((asset) => isMarketQuotedAsset(asset))
          .map((asset) => asset.ticker.trim().toUpperCase())
          .filter((ticker) => ticker.length > 0),
        "USDBRL=X",
      ]),
    ];
  }

  if (tickers.length === 0) {
    return jsonResponse(req, {
      ok: true,
      action,
      updated: 0,
      guarded: 0,
      failed: 0,
      skippedByEodGuard: 0,
      skippedByCooldown: 0,
      skippedByLock: 0,
      quotes: [],
    });
  }

  // Anti-envenenamento de cache: somente tickers cadastrados em `portfolio_assets` (ou USDBRL=X) podem gravar cache global
  let persistableSet = new Set<string>(tickers);
  if (!isServiceRole) {
    const nonFxTickers = tickers.filter((t) => !isFxUsdBrlTicker(t));
    const knownSet = new Set<string>(["USDBRL=X"]);
    if (nonFxTickers.length > 0) {
      const { data: validAssets } = await supabase
        .from("portfolio_assets")
        .select("ticker")
        .in("ticker", nonFxTickers);
      for (const a of validAssets ?? []) {
        knownSet.add(a.ticker.trim().toUpperCase());
      }
    }
    persistableSet = knownSet;
    if (requestMode !== "preview") {
      tickers = tickers.filter((t) => persistableSet.has(t));
      if (tickers.length === 0) {
        return jsonResponse(req, {
          ok: true,
          action,
          updated: 0,
          guarded: 0,
          failed: 0,
          skippedByEodGuard: 0,
          skippedByCooldown: 0,
          skippedByLock: 0,
          persistedGlobal: false,
          quotes: [],
        });
      }
    }
  }

  // Lê estado global atual em `asset_prices`
  const { data: cachedRows } = await supabase
    .from("asset_prices")
    .select("ticker, price, currency, source, market_price_at, fetched_at, provider, pending_spike_price, pending_spike_at")
    .is("user_id", null)
    .in("ticker", tickers);

  const cacheMap = new Map<string, CachedAssetPriceRow>();
  for (const row of cachedRows ?? []) {
    cacheMap.set(row.ticker.toUpperCase(), {
      ...row,
      price: Number(row.price),
      pending_spike_price: row.pending_spike_price != null ? Number(row.pending_spike_price) : null,
    });
  }

  const cooldownMs =
    requestMode === "report_preflight" ? REPORT_COOLDOWN_MS : STANDARD_COOLDOWN_MS;
  const resultQuotes = new Map<
    string,
    { ticker: string; price: number; currency: "BRL" | "USD"; marketPriceAt: string | null; fetchedAt: string | null; provider: string | null }
  >();
  const eligibleToFetch: string[] = [];
  let skippedByEodGuard = 0;
  let skippedByCooldown = 0;

  for (const ticker of tickers) {
    const cached = cacheMap.get(ticker);
    const isCacheMiss = !cached || cached.price <= 0 || cached.source !== "api";

    if (!isServiceRole && shouldSkipByEodGuard({
      ticker,
      fetchedAt: cached?.fetched_at ?? null,
      marketPriceAt: cached?.market_price_at ?? null,
      existingPrice: cached?.price ?? null,
      existingSource: cached?.source ?? null,
      now,
      reason: isCacheMiss
        ? "cache_miss"
        : requestReason === "cache_miss"
          ? "swr"
          : requestReason,
    })) {
      skippedByEodGuard += 1;
      if (cached) {
        resultQuotes.set(ticker, {
          ticker,
          price: cached.price,
          currency: cached.currency,
          marketPriceAt: cached.market_price_at,
          fetchedAt: cached.fetched_at,
          provider: cached.provider,
        });
      }
      continue;
    }

    // Cooldown (bypass exclusivo para `cache_miss` ou `post_trade_stale`)
    const canBypassCooldown = isCacheMiss || requestReason === "post_trade_stale" || isServiceRole;
    if (!canBypassCooldown && cached?.fetched_at) {
      const fetchedMs = Date.parse(cached.fetched_at);
      if (Number.isFinite(fetchedMs) && now.getTime() - fetchedMs < cooldownMs) {
        skippedByCooldown += 1;
        resultQuotes.set(ticker, {
          ticker,
          price: cached.price,
          currency: cached.currency,
          marketPriceAt: cached.market_price_at,
          fetchedAt: cached.fetched_at,
          provider: cached.provider,
        });
        continue;
      }
    }

    eligibleToFetch.push(ticker);
  }

  let guarded = 0;
  let failed = 0;
  let skippedByLock = 0;
  const rowsToPersist: GlobalQuoteUpsertRow[] = [];

  if (eligibleToFetch.length > 0) {
    // Rate limit por usuário apenas quando há necessidade real de chamada externa
    if (!isServiceRole && callerUserId) {
      const { data: rl } = await supabase.rpc("check_quote_refresh_rate_limit", {
        p_user_id: callerUserId,
        p_max_per_min: 10,
        p_max_per_hour: 60,
      });
      const rlResult = rl as { allowed?: boolean; retry_after_seconds?: number } | null;
      if (rlResult && rlResult.allowed === false) {
        for (const t of eligibleToFetch) {
          const cached = cacheMap.get(t);
          if (cached && cached.price > 0) {
            resultQuotes.set(t, {
              ticker: t,
              price: cached.price,
              currency: cached.currency,
              marketPriceAt: cached.market_price_at,
              fetchedAt: cached.fetched_at,
              provider: cached.provider,
            });
          }
        }
        return jsonResponse(
          req,
          {
            ok: true,
            action,
            rateLimited: true,
            retryAfterSeconds: rlResult.retry_after_seconds ?? 60,
            updated: 0,
            guarded: 0,
            failed: 0,
            skippedByEodGuard,
            skippedByCooldown,
            skippedByLock: 0,
            persistedGlobal: false,
            quotes: [...resultQuotes.values()],
          },
          200,
        );
      }
    }

    // Single-Flight Lock por ticker
    const { data: acquiredRaw, error: lockErr } = await supabase.rpc("try_acquire_quote_locks", {
      p_tickers: eligibleToFetch,
      p_ttl_seconds: 45,
      p_owner: callerUserId ?? "service-role",
    });

    const acquiredList =
      !lockErr && Array.isArray(acquiredRaw)
        ? acquiredRaw.map((t) => String(t).trim().toUpperCase())
        : eligibleToFetch;
    const acquiredSet = new Set<string>(acquiredList);

    for (const t of eligibleToFetch) {
      if (!acquiredSet.has(t)) {
        skippedByLock += 1;
        const cached = cacheMap.get(t);
        if (cached && cached.price > 0) {
          resultQuotes.set(t, {
            ticker: t,
            price: cached.price,
            currency: cached.currency,
            marketPriceAt: cached.market_price_at,
            fetchedAt: cached.fetched_at,
            provider: cached.provider,
          });
        }
      }
    }

    const fetchTargets = eligibleToFetch.filter((t) => acquiredSet.has(t));
    const fetchedResults = await runWithConcurrencyPool(
      fetchTargets,
      POOL_CONCURRENCY,
      async (ticker) => ({
        ticker,
        res: await resolveWithSpikeGuardrail(ticker, cacheMap.get(ticker), now),
      }),
    );

    for (const { ticker, res } of fetchedResults) {
      if (!res.upsertRow || !res.quote) {
        failed += 1;
        const cached = cacheMap.get(ticker);
        if (cached && cached.price > 0) {
          resultQuotes.set(ticker, {
            ticker,
            price: cached.price,
            currency: cached.currency,
            marketPriceAt: cached.market_price_at,
            fetchedAt: cached.fetched_at,
            provider: cached.provider,
          });
        }
        continue;
      }

      if (res.guarded) guarded += 1;
      resultQuotes.set(ticker, {
        ticker,
        price: res.upsertRow.price,
        currency: res.upsertRow.currency,
        marketPriceAt: res.upsertRow.market_price_at,
        fetchedAt: res.upsertRow.fetched_at,
        provider: res.upsertRow.provider,
      });

      if (isServiceRole || persistableSet.has(ticker)) {
        rowsToPersist.push(res.upsertRow);
      }
    }
  }

  let persistedGlobal = false;
  if (rowsToPersist.length > 0) {
    const { error: upsertError } = await supabase.rpc("upsert_global_asset_prices", {
      p_rows: rowsToPersist,
    });
    if (upsertError) {
      return safeErrorResponse(req, 500, "Falha ao atualizar cache global de cotações.", upsertError);
    }
    persistedGlobal = true;
  }

  return jsonResponse(req, {
    ok: true,
    action,
    month: requestedMonth,
    updated: persistedGlobal ? rowsToPersist.length : 0,
    guarded,
    failed,
    skippedByEodGuard,
    skippedByCooldown,
    skippedByLock,
    persistedGlobal,
    tickers,
    quotes: [...resultQuotes.values()],
  });
});
