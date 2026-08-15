/**
 * Motor puro das cotações (F1.7 — ESPECIFICAÇÃO §1.6 D5).
 *
 * Funções sem I/O, testáveis com Vitest (src/tests/quotes-core.test.ts) e
 * reutilizadas pela edge function `supabase/functions/quotes/index.ts`
 * (runtime Deno — este arquivo não importa nada externo).
 *
 * Pipeline de resiliência do cache global (`asset_prices` com user_id NULL):
 *   API (Yahoo em cascata) → guardrail de spike (> 50%/dia mantém o último) →
 *   upsert com source 'api'. O cliente resolve manual → cache → fallback.
 */

export type QuoteCurrency = "BRL" | "USD";

export interface ParsedQuote {
  ticker: string;
  price: number;
  currency: QuoteCurrency;
}

export interface QuoteUpsertRow {
  user_id: null;
  ticker: string;
  price: number;
  currency: QuoteCurrency;
  source: "api";
  updated_at: string;
}

/**
 * Normaliza o ticker armazenado para o formato da API Yahoo Finance:
 *   • B3 com número (PETR4, BOVA11, IVVB11) → sufixo `.SA`;
 *   • já com sufixo/`=`/`-` (PETR4.SA, USDBRL=X, BTC-BRL) → mantém;
 *   • internacional puro 2–5 letras (AAPL, MSFT) → mantém.
 * Retorna "" para entrada vazia (inválida para a API).
 */
export function normalizeTickerForApi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "";
  if (ticker.endsWith(".SA")) return ticker;
  if (ticker.includes("=") || ticker.includes("-") || ticker.includes(".")) return ticker;
  if (/^[A-Za-z]{2,5}$/.test(ticker)) return ticker;
  return `${ticker}.SA`;
}

/**
 * Extrai { price, currency } do payload da Yahoo Chart API v8
 * (`/v8/finance/chart/{ticker}` → `chart.result[0].meta`).
 * Retorna null para payloads inválidos/incompletos ou preço não-positivo.
 */
export function parseYahooChartResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const chart = (payload as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return null;
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const meta = (result[0] as Record<string, unknown> | undefined)?.meta;
  if (!meta || typeof meta !== "object") return null;
  const rawPrice = (meta as Record<string, unknown>).regularMarketPrice;
  if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice) || rawPrice <= 0) return null;
  const rawCurrency = (meta as Record<string, unknown>).currency;
  return {
    ticker,
    price: rawPrice,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
  };
}

/**
 * Guardrail de spike (§1.6): variação > 50% em 1 dia mantém o último preço
 * válido (proteção contra dado corrompido de API).
 * Espelho de `src/domain/portfolio/valuation.ts` — a edge function roda fora
 * do bundle do Vite e não pode importar de `src/`; mantenha em sincronia.
 */
export function applySpikeGuardrail(currentPrice: number, previousPrice: number | null): number {
  if (previousPrice === null || previousPrice === undefined || previousPrice <= 0) return currentPrice;
  if (currentPrice <= 0) return previousPrice;
  const variation = Math.abs(currentPrice - previousPrice) / previousPrice;
  return variation > 0.5 ? previousPrice : currentPrice;
}

/**
 * Monta a linha de upsert do cache global com a fonte `api`.
 * `updatedAt` recebido por parâmetro (determinístico para testes).
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
 * Ticker de ativo de caixa/reserva (valor 1:1, nunca vai à API de cotações).
 * Espelho de `isCashAssetClass` de `src/domain/portfolio` (DRY de runtime).
 */
const CASH_CLASS_ALIASES = new Set(["caixa", "reserva"]);

export function isCashClass(assetClass: string | null): boolean {
  if (!assetClass) return false;
  const normalized = assetClass.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return CASH_CLASS_ALIASES.has(normalized);
}
