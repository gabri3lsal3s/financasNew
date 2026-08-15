/**
 * Edge function de cotações (F1.7 — ESPECIFICAÇÃO §1.6 D5).
 *
 * Atualiza o CACHE GLOBAL de preços (`asset_prices` com `user_id` NULL) com
 * cotações do Yahoo Finance, em cascata (query1 → query2), tolerante a
 * falhas por ticker (timeouts curtos) e com guardrail de spike (> 50%/dia
 * mantém o último preço válido).
 *
 * Executa com service role (bypassa RLS) — nunca expõe chaves ao cliente.
 * Pode ser chamada manualmente (curl) ou agendada (Supabase Cron / pg_cron).
 *
 * Segurança: exige `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
 *
 * Deploy:
 *   supabase functions deploy quotes --no-verify-jwt
 *   # variáveis de ambiente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   # (a CLI injeta SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY automaticamente)
 *
 * Agendamento (ex.: a cada 6h) — ver `docs/DEPLOYMENT.md` §7.1 para o SQL
 * de cron (pg_cron + pg_net); evite escrever o padrão de cron dentro de
 * comentários de bloco (a sequência fecharia o comentário).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  applySpikeGuardrail,
  buildQuoteUpsertRow,
  isCashClass,
  normalizeTickerForApi,
  parseYahooChartResponse,
  type ParsedQuote,
  type QuoteUpsertRow,
} from "../_shared/quotes-core.ts";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const FETCH_TIMEOUT_MS = 4_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; FinancasNew/1.0; +https://github.com/financasnew)";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Busca a cotação de um ticker com fallback em cascata entre hosts Yahoo. */
async function fetchQuote(ticker: string): Promise<ParsedQuote | null> {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Autenticação: apenas service role (cron ou chamada manual).
  const auth = req.headers.get("authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== serviceRoleKey) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing env" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1) Tickers únicos da carteira (exclui caixa/reserva — 1:1, sem cotação).
  const { data: assets, error: assetsError } = await supabase
    .from("portfolio_assets")
    .select("ticker, asset_class");
  if (assetsError) {
    return json({ error: assetsError.message }, 500);
  }

  const tickers = [
    ...new Set(
      (assets ?? [])
        .filter((asset) => !isCashClass(asset.asset_class))
        .map((asset) => asset.ticker.trim().toUpperCase())
        .filter((ticker) => ticker.length > 0),
    ),
  ];

  if (tickers.length === 0) {
    return json({ ok: true, updated: 0, guarded: 0, failed: 0 });
  }

  // 2) Preço atual do cache global (para o guardrail de spike).
  const { data: cachedRows } = await supabase
    .from("asset_prices")
    .select("ticker, price")
    .is("user_id", null)
    .in("ticker", tickers);
  const cacheByTicker = new Map<string, number>(
    (cachedRows ?? []).map((row) => [row.ticker, Number(row.price)]),
  );

  // 3) Busca em paralelo (tolerante a falha por ticker).
  const quotes = await Promise.all(tickers.map((ticker) => fetchQuote(ticker)));

  // 4) Guardrail + montagem das linhas de upsert.
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

  // 5) Upsert em lote (unique parcial `idx_asset_prices_manual_unique` não
  //    cobre user_id NULL — por isso o upsert é por (ticker, user_id) com
  //    o valor NULL explícito; o Postgres trata NULL como distinto, então
  //    usamos delete+insert do cache global para manter 1 linha por ticker).
  if (rows.length > 0) {
    const { error: deleteError } = await supabase
      .from("asset_prices")
      .delete()
      .is("user_id", null)
      .in("ticker", rows.map((row) => row.ticker));
    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    const { error: insertError } = await supabase.from("asset_prices").insert(rows);
    if (insertError) {
      return json({ error: insertError.message }, 500);
    }
  }

  return json({
    ok: true,
    updated: rows.length,
    guarded,
    failed,
    tickers,
  });
});
