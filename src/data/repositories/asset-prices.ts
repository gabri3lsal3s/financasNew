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
 * Cotações (D5 — §1.6): cache em servidor + override manual.
 *   • Cache global (user_id NULL) é escrito pela edge function — leitura;
 *   • Override manual (user_id = dono, source 'manual') prevalece.
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
}

const SOURCE_PRIORITY: Record<AssetPriceRow["source"], number> = {
  manual: 3,
  api: 2,
  fallback: 1,
};

function mapRow(row: {
  ticker: string;
  price: string | number;
  currency: AssetCurrency;
  source: AssetPriceRow["source"];
  manual_price: string | number | null;
}): AssetPriceRow {
  return {
    ticker: row.ticker.trim().toUpperCase(),
    price: Number(row.price),
    currency: row.currency,
    source: row.source,
    manual_price: row.manual_price === null ? null : Number(row.manual_price),
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
      };
    });
}

/**
 * Consolida as linhas de preços por ticker:
 * 1. Linhas manuais do usuário (`source === 'manual'`) prevalecem sobre cache global (`source === 'api'`) e fallback;
 * 2. Cotação de API positiva (`price > 0`) prevalece sobre fallback estático;
 * 3. Se a cotação da API falhar ou vier zerada, o fallback positivo (preço médio ou nominal) é mantido;
 * 4. O override manual do usuário nunca é sobrescrito.
 */
export function consolidateAssetPrices(rows: AssetPriceRow[]): AssetPriceRow[] {
  const map = new Map<string, AssetPriceRow>();
  for (const row of rows) {
    const key = row.ticker.trim().toUpperCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...row,
        manual_price:
          row.source === "manual"
            ? (row.manual_price ?? (row.price > 0 ? row.price : null))
            : row.manual_price,
      });
      continue;
    }

    const rowPriority = SOURCE_PRIORITY[row.source] ?? 0;
    const existingPriority = SOURCE_PRIORITY[existing.source] ?? 0;

    // 1. Manual tem prioridade absoluta
    if (row.source === "manual") {
      map.set(key, {
        ...row,
        manual_price: row.manual_price ?? (row.price > 0 ? row.price : null),
      });
      continue;
    }
    if (existing.source === "manual") {
      continue;
    }

    // 2. Se a nova linha tem maior prioridade (ex: api sobre fallback)
    if (rowPriority > existingPriority) {
      if (row.price > 0 || existing.price <= 0) {
        map.set(key, row);
      }
      continue;
    }

    // 3. Se a linha existente tem maior prioridade (ex: api sobre fallback)
    if (existingPriority > rowPriority) {
      // Se a cotação existente de API estiver zerada/inválida, permite fallback com preço positivo
      if (existing.price <= 0 && row.price > 0) {
        map.set(key, row);
      }
      continue;
    }

    // 4. Mesma prioridade (ex: api com api, ou fallback com fallback)
    if (existing.price <= 0 && row.price > 0) {
      map.set(key, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Lista os preços relevantes para o usuário:
 * 1. Prioridade estrita da tabela `asset_prices`: cache global (user_id NULL) e overrides do usuário;
 * 2. Fallback offline resiliente: se a tabela `asset_prices` estiver vazia para um ticker
 *    ou houver falha de rede/offline, utiliza os ativos da custódia do usuário
 *    (via índice cobridor `idx_portfolio_assets_user_covering`) com preço médio ou valor nominal.
 * Nunca lança exceção bloqueante se houver ativos ou possibilidade de degradação graciosa.
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

  // 1. Prioridade estrita: leitura da tabela asset_prices
  const pricePromise = resolveQuery<AssetPriceRow[]>(
    getSupabase()
      .from("asset_prices")
      .select("ticker, price, currency, source, manual_price")
      .or(`user_id.is.null,user_id.eq.${user_id}`),
  );

  // 2. Busca ativos da custódia em portfolio_assets aproveitando idx_portfolio_assets_user_covering
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

  // Se a tabela asset_prices falhou (ex: offline ou erro de rede)
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
 * Grava o override manual de preço (prevalece sobre cache/fallback).
 * A moeda é inferida pelo padrão do ticker (mesma regra do domínio — DRY).
 * Usa delete prévio + insert para garantir idempotência sem depender de constraint parcial no Postgres.
 */
export async function setManualPrice(input: ManualPriceInput): Promise<void> {
  const user_id = await currentUserId();
  const normalizedTicker = input.ticker.trim().toUpperCase();
  const currency: AssetCurrency = inferCurrencyFromTicker(normalizedTicker);
  const row = {
    user_id,
    ticker: normalizedTicker,
    price: input.price,
    currency,
    source: "manual" as const,
    manual_price: input.price,
    updated_at: new Date().toISOString(),
  };

  // Remove qualquer override prévio para este usuário e ticker antes de inserir
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

/** Remove o override manual — o preço volta a seguir cache/fallback. */
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

/**
 * Grava a cotação obtida de API para o usuário.
 * Não sobrescreve se o usuário tiver um override manual ativo.
 */
export async function setAssetPriceFromApi(
  ticker: string,
  price: number,
  currency: AssetCurrency,
): Promise<void> {
  await setAssetPricesBatchFromApi([{ ticker, price, currency }]);
}

/**
 * Grava cotações obtidas de API em lote para o usuário (evita N+1 de banco).
 * Não sobrescreve se o usuário tiver override manual ativo para o ticker.
 */
export async function setAssetPricesBatchFromApi(
  quotes: Array<{ ticker: string; price: number; currency: AssetCurrency }>,
): Promise<void> {
  if (quotes.length === 0) return;
  const user_id = await currentUserId();
  const normalizedTickers = [...new Set(quotes.map((q) => q.ticker.trim().toUpperCase()))];

  // 1) Busca em lote todos os overrides manuais existentes
  const { data: existingManuals, error: fetchError } = await resolveQuery<AssetPriceRow[]>(
    getSupabase()
      .from("asset_prices")
      .select("ticker, price, currency, source, manual_price")
      .eq("user_id", user_id)
      .eq("source", "manual")
      .in("ticker", normalizedTickers),
  );

  if (fetchError) {
    const classified = classifyError(fetchError);
    throw new AppError(classified.kind, classified.message, fetchError);
  }

  const manualSet = new Set((existingManuals ?? []).map((m) => m.ticker.trim().toUpperCase()));
  const now = new Date().toISOString();

  // 2) Filtra apenas os tickers sem override manual
  const rowsToInsert = quotes
    .filter((q) => !manualSet.has(q.ticker.trim().toUpperCase()) && q.price > 0)
    .map((q) => ({
      user_id,
      ticker: q.ticker.trim().toUpperCase(),
      price: q.price,
      currency: q.currency,
      source: "api" as const,
      manual_price: null,
      updated_at: now,
    }));

  if (rowsToInsert.length === 0) return;

  const tickersToUpdate = [...new Set(rowsToInsert.map((r) => r.ticker))];

  // 3) Remove caches anteriores de API em lote
  const { error: deleteError } = await getSupabase()
    .from("asset_prices")
    .delete()
    .eq("user_id", user_id)
    .eq("source", "api")
    .in("ticker", tickersToUpdate);

  if (deleteError) {
    const classified = classifyError(deleteError);
    throw new AppError(classified.kind, classified.message, deleteError);
  }

  // 4) Insere o lote em uma única instrução atômica
  const { error: insertError } = await getSupabase().from("asset_prices").insert(rowsToInsert);
  if (insertError) {
    const classified = classifyError(insertError);
    throw new AppError(classified.kind, classified.message, insertError);
  }
}



