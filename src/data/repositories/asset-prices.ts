import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import {
  fallbackPriceFor,
  inferCurrencyFromTicker,
  isCashAssetClass,
} from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";

/**
 * Cotações (§1.6 D5 — Modelo Global Compartilhado + Override Manual):
 *   • Cache global (user_id NULL) é escrito exclusivamente pela Edge Function (`service_role`);
 *   • Override manual (user_id = dono, source 'manual') prevalece sobre tudo;
 *   • Fallback offline/custo médio é apenas contingência quando não há preço oficial.
 */

export type ManualPriceInput = {
  ticker: string;
  price: number;
};

/** Preço de mercado de um ativo: cache global + override manual do usuário + fallback offline. */
export interface AssetPriceRow {
  ticker: string;
  price: number;
  currency: AssetCurrency;
  source: "api" | "fallback" | "manual";
  manual_price: number | null;
  user_id?: string | null;
  updated_at?: string | null;
  fetched_at?: string | null;
  market_price_at?: string | null;
  provider?: string | null;
}

/** Linha histórica oficial de fechamento EOD/EOM em `public.market_price_history`. */
export interface MarketPriceHistoryRow {
  ticker: string;
  reference_date: string;
  price: number;
  currency: AssetCurrency;
  provider: string | null;
  market_price_at: string | null;
  month: string;
  is_month_end: boolean;
}

const SOURCE_PRIORITY: Record<AssetPriceRow["source"], number> = {
  manual: 3,
  api: 2,
  fallback: 1,
};

function parseTimestampMs(raw?: string | null): number {
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function getRowRecencyMs(row: AssetPriceRow): number {
  if (row.source === "manual") {
    return parseTimestampMs(row.updated_at);
  }
  return (
    parseTimestampMs(row.market_price_at) ||
    parseTimestampMs(row.fetched_at) ||
    parseTimestampMs(row.updated_at)
  );
}

function mapRow(row: {
  ticker: string;
  price: string | number;
  currency: AssetCurrency;
  source: AssetPriceRow["source"];
  manual_price: string | number | null;
  user_id?: string | null;
  updated_at?: string | null;
  fetched_at?: string | null;
  market_price_at?: string | null;
  provider?: string | null;
}): AssetPriceRow {
  return {
    ticker: row.ticker.trim().toUpperCase(),
    price: Number(row.price),
    currency: row.currency,
    source: row.source,
    manual_price: row.manual_price === null ? null : Number(row.manual_price),
    user_id: row.user_id ?? null,
    updated_at: row.updated_at ?? null,
    fetched_at: row.fetched_at ?? null,
    market_price_at: row.market_price_at ?? null,
    provider: row.provider ?? null,
  };
}

/**
 * Constrói linhas de fallback resiliente a partir de ativos conhecidos da custódia.
 * Utiliza o preço médio do ativo ou o valor nominal estático sem lançar exceções.
 */
function buildFallbackRows(
  assets: Array<{
    ticker: string;
    currency?: AssetCurrency;
    average_price?: number | string | null;
    asset_class?: string | null;
  }>,
): AssetPriceRow[] {
  return assets
    .filter((a) => a.ticker && a.ticker.trim().length > 0)
    .map((a) => {
      const normalizedTicker = a.ticker.trim().toUpperCase();
      const avg = Number(a.average_price ?? 0);
      const isCash = isCashAssetClass(a.asset_class) || normalizedTicker === "CAIXA";
      const currency = a.currency ?? inferCurrencyFromTicker(normalizedTicker);
      const nominal = isCash ? 1 : fallbackPriceFor(currency);
      const price = avg > 0 ? avg : nominal;

      return {
        ticker: normalizedTicker,
        price,
        currency,
        source: "fallback" as const,
        manual_price: null,
        user_id: null,
        updated_at: null,
        fetched_at: null,
        market_price_at: null,
        provider: "fallback",
      };
    });
}

/**
 * Consolida as linhas de preços por ticker de forma 100% determinística:
 * 1. Override manual do usuário (`source === 'manual'`) com preço positivo vence sempre;
 * 2. Cotação de API positiva (`price > 0`) vence fallback; entre duas APIs válidas,
 *    vence a de timestamp de mercado (`market_price_at ?? fetched_at ?? updated_at`) mais recente;
 * 3. Never-Degrade: uma linha API positiva nunca é substituída por preço <= 0;
 * 4. Em fallback vs. fallback, prevalece o positivo mais recente.
 */
export function consolidateAssetPrices(rows: AssetPriceRow[]): AssetPriceRow[] {
  const map = new Map<string, AssetPriceRow>();
  for (const row of rows) {
    const key = row.ticker.trim().toUpperCase();
    const normalizedRow: AssetPriceRow =
      row.source === "manual"
        ? {
            ...row,
            ticker: key,
            manual_price: row.manual_price ?? (row.price > 0 ? row.price : null),
          }
        : { ...row, ticker: key };

    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalizedRow);
      continue;
    }

    const rowPriority = SOURCE_PRIORITY[normalizedRow.source] ?? 0;
    const existingPriority = SOURCE_PRIORITY[existing.source] ?? 0;

    if (normalizedRow.source === "manual") {
      if (existing.source !== "manual") {
        if ((normalizedRow.manual_price ?? normalizedRow.price) > 0) {
          map.set(key, normalizedRow);
        }
        continue;
      }
      if (getRowRecencyMs(normalizedRow) >= getRowRecencyMs(existing)) {
        map.set(key, normalizedRow);
      }
      continue;
    }

    if (existing.source === "manual") {
      continue;
    }

    if (rowPriority > existingPriority) {
      if (normalizedRow.price > 0 || existing.price <= 0) {
        map.set(key, normalizedRow);
      }
      continue;
    }

    if (existingPriority > rowPriority) {
      if (existing.price <= 0 && normalizedRow.price > 0) {
        map.set(key, normalizedRow);
      }
      continue;
    }

    // Mesma prioridade (`api` vs `api`, ou `fallback` vs `fallback`)
    if (existing.price <= 0 && normalizedRow.price > 0) {
      map.set(key, normalizedRow);
      continue;
    }
    if (normalizedRow.price > 0 && getRowRecencyMs(normalizedRow) >= getRowRecencyMs(existing)) {
      map.set(key, normalizedRow);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Lista os preços relevantes para o usuário:
 *   • Lê cache global (`user_id IS NULL`) + overrides manuais do usuário (`user_id = owner`);
 *   • Aplica ordenação determinística por `updated_at DESC` e consolidação em memória;
 *   • Degrada graciosamente com fallback local offline em caso de ausência ou falha de rede.
 */
export async function listAssetPrices(
  knownAssets?: Array<{
    ticker: string;
    currency?: AssetCurrency;
    average_price?: number | string | null;
    asset_class?: string | null;
  }>,
): Promise<AssetPriceRow[]> {
  const user_id = await currentUserId();

  const priceQuery = getSupabase()
    .from("asset_prices")
    .select(
      "ticker, price, currency, source, manual_price, user_id, updated_at, fetched_at, market_price_at, provider",
    )
    .or(`user_id.is.null,user_id.eq.${user_id}`);

  const orderedQuery =
    typeof (priceQuery as unknown as { order?: unknown }).order === "function"
      ? (priceQuery as unknown as {
          order: (col: string, opts: { ascending: boolean }) => typeof priceQuery;
        }).order("updated_at", { ascending: false })
      : priceQuery;

  const pricePromise = resolveQuery<AssetPriceRow[]>(orderedQuery);

  const assetPromise = knownAssets
    ? Promise.resolve({ data: knownAssets, error: null })
    : resolveQuery<
        Array<{
          ticker: string;
          currency: AssetCurrency;
          average_price: number | string | null;
          asset_class: string | null;
        }>
      >(
        getSupabase()
          .from("portfolio_assets")
          .select("ticker, currency, average_price, asset_class")
          .eq("user_id", user_id),
      );

  const [priceRes, assetRes] = await Promise.all([pricePromise, assetPromise]);

  if (priceRes.error) {
    if (assetRes.data && assetRes.data.length > 0) {
      const fallbackRows = buildFallbackRows(assetRes.data);
      return consolidateAssetPrices(fallbackRows);
    }
    const classified = classifyError(priceRes.error);
    throw new AppError(classified.kind, classified.message, priceRes.error);
  }

  const mappedPrices = (priceRes.data ?? []).map(mapRow);
  const fallbackRows = buildFallbackRows(assetRes.data ?? []);

  return consolidateAssetPrices([...fallbackRows, ...mappedPrices]);
}

/**
 * Consulta o histórico global oficial de fechamento para uma competência (`YYYY-MM`)
 * em `public.market_price_history`, priorizando linhas `is_month_end = true` e data mais recente.
 */
export async function listMarketPriceHistoryByMonth(
  month: string,
): Promise<MarketPriceHistoryRow[]> {
  if (!/^\d{4}-\d{2}$/.test(month.trim())) return [];

  const { data, error } = await resolveQuery<
    Array<{
      ticker: string;
      reference_date: string;
      price: string | number;
      currency: AssetCurrency;
      provider: string | null;
      market_price_at: string | null;
      month: string;
      is_month_end: boolean;
    }>
  >(
    getSupabase()
      .from("market_price_history")
      .select("ticker, reference_date, price, currency, provider, market_price_at, month, is_month_end")
      .eq("month", month.trim())
      .order("is_month_end", { ascending: false })
      .order("reference_date", { ascending: false }),
  );

  if (error || !Array.isArray(data)) {
    return [];
  }

  const byTicker = new Map<string, MarketPriceHistoryRow>();
  for (const row of data) {
    const ticker = row.ticker.trim().toUpperCase();
    const price = Number(row.price);
    if (!ticker || !Number.isFinite(price) || price <= 0) continue;
    if (!byTicker.has(ticker)) {
      byTicker.set(ticker, {
        ticker,
        reference_date: row.reference_date,
        price,
        currency: row.currency === "USD" ? "USD" : "BRL",
        provider: row.provider ?? null,
        market_price_at: row.market_price_at ?? null,
        month: row.month,
        is_month_end: Boolean(row.is_month_end),
      });
    }
  }

  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Grava o override manual de preço exclusivo do usuário (`source = 'manual'`).
 */
export async function setManualPrice(input: ManualPriceInput): Promise<void> {
  const user_id = await currentUserId();
  const normalizedTicker = input.ticker.trim().toUpperCase();
  const currency: AssetCurrency = inferCurrencyFromTicker(normalizedTicker);
  const nowIso = new Date().toISOString();
  const row = {
    user_id,
    ticker: normalizedTicker,
    price: input.price,
    currency,
    source: "manual" as const,
    manual_price: input.price,
    provider: "manual",
    market_price_at: nowIso,
    updated_at: nowIso,
  };

  const { error: deleteError } = await getSupabase()
    .from("asset_prices")
    .delete()
    .eq("user_id", user_id)
    .eq("ticker", normalizedTicker);

  if (deleteError) {
    const classified = classifyError(deleteError);
    throw new AppError(classified.kind, classified.message, deleteError);
  }

  const { error: insertError } = await getSupabase().from("asset_prices").insert(row);
  if (insertError) {
    const classified = classifyError(insertError);
    throw new AppError(classified.kind, classified.message, insertError);
  }
}

/** Remove o override manual do usuário — a leitura volta a usar o cache global. */
export async function removeManualPrice(ticker: string): Promise<void> {
  const user_id = await currentUserId();
  const normalizedTicker = ticker.trim().toUpperCase();
  const { error } = await getSupabase()
    .from("asset_prices")
    .delete()
    .eq("user_id", user_id)
    .eq("ticker", normalizedTicker)
    .eq("source", "manual");
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
