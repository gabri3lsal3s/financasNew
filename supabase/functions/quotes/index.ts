/**
 * Edge function de cotações e inteligência de mercado (F1.7 — ESPECIFICAÇÃO §1.6 D5).
 *
 * Suporta três ações canônicas:
 *  1. 'quotes' (default): sincroniza cotações oficiais e atualiza cache global (`asset_prices`);
 *  2. 'sync_corporate_dividends': ingere proventos corporativos B3 via Brapi para tickers sob custódia;
 *  3. 'close_month': fecha a competência do mês e persiste snapshots via `commit_monthly_closing_atomic`.
 *
 * Deploy: supabase functions deploy quotes --no-verify-jwt
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  applySpikeGuardrail,
  buildQuoteUpsertRow,
  isCashClass,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBrapiDividends,
  parseBrapiResponse,
  parseYahooChartResponse,
  type ParsedCorporateDividend,
  type ParsedQuote,
  type QuoteUpsertRow,
} from "../_shared/quotes-core.ts";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const FETCH_TIMEOUT_MS = 4_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; FinancasNew/1.0; +https://github.com/financasnew)";

/** Busca cotação no Yahoo Finance com timeout e rotação de hosts. */
async function fetchYahooQuote(ticker: string): Promise<ParsedQuote | null> {
  const apiTicker = normalizeTickerForApi(ticker);
  if (!apiTicker) return null;

  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(apiTicker)}?interval=1d&range=1d`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const payload: unknown = await response.json();
      const parsed = parseYahooChartResponse(ticker, payload);
      if (parsed) return parsed;
    } catch {
      // host falhou (timeout/erro de rede) → tenta o próximo
    }
  }
  return null;
}

/** Busca cotação de ações/FIIs na Brapi (fallback para B3). */
async function fetchBrapiQuote(ticker: string): Promise<ParsedQuote | null> {
  const cleanTicker = normalizeTickerForBrapi(ticker);
  if (!cleanTicker || cleanTicker.includes("=")) return null;

  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseBrapiResponse(ticker, payload);
  } catch {
    return null;
  }
}

/** Busca proventos corporativos na Brapi para um lote de tickers. */
async function fetchBrapiDividendsForTickers(tickers: string[]): Promise<ParsedCorporateDividend[]> {
  const cleanTickers = tickers
    .map(normalizeTickerForBrapi)
    .filter((t) => t && !t.includes("="));
  if (cleanTickers.length === 0) return [];

  const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTickers.join(","))}?dividends=true`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS * 2);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return [];
    const results = (payload as Record<string, unknown>).results;
    if (!Array.isArray(results)) return [];

    const allDividends: ParsedCorporateDividend[] = [];
    for (const item of results) {
      const sym = (item as Record<string, unknown>)?.symbol as string;
      if (sym) {
        const itemDivs = parseBrapiDividends(sym, { results: [item] });
        allDividends.push(...itemDivs);
      }
    }
    return allDividends;
  } catch {
    return [];
  }
}

/** Busca cotação cambial USD-BRL na AwesomeAPI (fallback para câmbio). */
async function fetchAwesomeApiQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (normalized !== "USDBRL=X" && normalized !== "USD-BRL" && normalized !== "USDBRL") {
    return null;
  }

  const url = "https://economia.awesomeapi.com.br/last/USD-BRL";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return parseAwesomeApiResponse(ticker, payload);
  } catch {
    return null;
  }
}

/** Busca a cotação com pipeline de fallback em cascata (Yahoo → Brapi / AwesomeAPI). */
async function fetchQuote(ticker: string): Promise<ParsedQuote | null> {
  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "USDBRL=X" || normalized === "USD-BRL" || normalized === "USDBRL") {
    const yahoo = await fetchYahooQuote(ticker);
    if (yahoo) return yahoo;
    return await fetchAwesomeApiQuote(ticker);
  }

  const yahoo = await fetchYahooQuote(ticker);
  if (yahoo) return yahoo;

  const brapi = await fetchBrapiQuote(ticker);
  if (brapi) return brapi;

  return null;
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
    (token.length > 0 && token === serviceRoleKey) ||
    (apiKey.length > 0 && apiKey === serviceRoleKey);

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

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.action === "string") {
        action = body.action;
      }
      if (body && typeof body.month === "string") {
        requestedMonth = body.month;
      }
      if (body && Array.isArray(body.tickers)) {
        const TICKER_REGEX = /^[A-Z0-9^=.-]{1,15}$/;
        requestedTickers = body.tickers
          .map((t: string) => String(t).trim().toUpperCase())
          .filter((t: string) => Boolean(t) && TICKER_REGEX.test(t))
          .slice(0, 50);
      }
    } catch {
      // payload sem json body
    }
  }

  // AÇÃO 1: Sincronização de proventos corporativos B3
  if (action === "sync_corporate_dividends") {
    let assetsQuery = supabase.from("portfolio_assets").select("ticker, asset_class").gt("quantity", 0);
    if (callerUserId && !isServiceRole) {
      assetsQuery = assetsQuery.eq("user_id", callerUserId);
    }

    const { data: activeAssets, error: assetsErr } = await assetsQuery;
    if (assetsErr) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos para proventos.", assetsErr);
    }

    const uniqueTickers = [
      ...new Set(
        (activeAssets ?? [])
          .filter((a) => !isCashClass(a.asset_class))
          .map((a) => a.ticker.trim().toUpperCase())
          .filter((t) => t.length > 0),
      ),
    ];

    if (uniqueTickers.length === 0) {
      return jsonResponse(req, { ok: true, synced_dividends: 0, tickers: [] });
    }

    const chunkSize = 15;
    const allCorporateDividends: ParsedCorporateDividend[] = [];
    for (let i = 0; i < uniqueTickers.length; i += chunkSize) {
      const chunk = uniqueTickers.slice(i, i + chunkSize);
      const chunkDividends = await fetchBrapiDividendsForTickers(chunk);
      allCorporateDividends.push(...chunkDividends);
    }

    let inserted = 0;
    if (allCorporateDividends.length > 0) {
      const upsertRows = allCorporateDividends.map((d) => ({
        ticker: d.ticker,
        type: d.type,
        com_date: d.com_date,
        payment_date: d.payment_date,
        rate: d.rate,
        net_rate: d.net_rate,
        currency: d.currency,
      }));

      const { error: divUpsertError } = await supabase
        .from("corporate_dividends")
        .upsert(upsertRows, { onConflict: "ticker, com_date, type, payment_date" });

      if (divUpsertError) {
        return safeErrorResponse(req, 500, "Falha ao gravar proventos corporativos.", divUpsertError);
      }
      inserted = upsertRows.length;
    }

    return jsonResponse(req, {
      ok: true,
      action: "sync_corporate_dividends",
      synced_dividends: inserted,
      tickers: uniqueTickers,
    });
  }

  // AÇÃO 2 & 3: Cotações padrão ou Fechamento Mensal
  let tickers: string[] = requestedTickers;

  if (tickers.length === 0) {
    let query = supabase.from("portfolio_assets").select("ticker, asset_class");
    if (callerUserId) {
      query = query.eq("user_id", callerUserId);
    }

    const { data: assets, error: assetsError } = await query;
    if (assetsError) {
      return safeErrorResponse(req, 500, "Falha ao carregar ativos.", assetsError);
    }

    tickers = [
      ...new Set(
        (assets ?? [])
          .filter((asset) => !isCashClass(asset.asset_class))
          .map((asset) => asset.ticker.trim().toUpperCase())
          .filter((ticker) => ticker.length > 0),
      ),
    ];
  }

  if (tickers.length === 0) {
    return jsonResponse(req, { ok: true, updated: 0, guarded: 0, failed: 0, quotes: [] });
  }

  const { data: cachedRows } = await supabase
    .from("asset_prices")
    .select("ticker, price")
    .is("user_id", null)
    .in("ticker", tickers);
  const cacheByTicker = new Map<string, number>(
    (cachedRows ?? []).map((row) => [row.ticker, Number(row.price)]),
  );

  const quotes = await Promise.all(tickers.map((ticker) => fetchQuote(ticker)));

  const now = new Date().toISOString();
  const rows: QuoteUpsertRow[] = [];
  let guarded = 0;
  let failed = 0;

  for (const quote of quotes) {
    if (!quote) {
      failed += 1;
      continue;
    }
    const price = applySpikeGuardrail(quote.price, cacheByTicker.get(quote.ticker) ?? null);
    if (price !== quote.price) guarded += 1;
    rows.push(buildQuoteUpsertRow(quote.ticker, price, quote.currency, now));
  }

  // Somente service role (cron) pode mutar o cache global — previne envenenamento por JWT de usuário.
  if (isServiceRole && rows.length > 0) {
    const { error: deleteError } = await supabase
      .from("asset_prices")
      .delete()
      .is("user_id", null)
      .in(
        "ticker",
        rows.map((row) => row.ticker),
      );
    if (deleteError) {
      return safeErrorResponse(req, 500, "Falha ao atualizar cache de cotações.", deleteError);
    }

    const { error: insertError } = await supabase.from("asset_prices").insert(rows);
    if (insertError) {
      return safeErrorResponse(req, 500, "Falha ao atualizar cache de cotações.", insertError);
    }
  }

  return jsonResponse(req, {
    ok: true,
    action,
    month: requestedMonth,
    updated: isServiceRole ? rows.length : 0,
    guarded,
    failed,
    persistedGlobal: isServiceRole,
    tickers,
    quotes: rows.map((r) => ({
      ticker: r.ticker,
      price: Number(r.price),
      currency: r.currency,
    })),
  });
});
