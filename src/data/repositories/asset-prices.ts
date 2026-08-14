import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { inferCurrencyFromTicker } from "@/domain/portfolio";
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

/** Preço de mercado de um ativo: cache global + override manual do usuário. */
export interface AssetPriceRow {
  ticker: string;
  price: number;
  currency: AssetCurrency;
  source: "api" | "fallback" | "manual";
  manual_price: number | null;
}

function mapRow(row: {
  ticker: string;
  price: string | number;
  currency: AssetCurrency;
  source: AssetPriceRow["source"];
  manual_price: string | number | null;
}): AssetPriceRow {
  return {
    ticker: row.ticker,
    price: Number(row.price),
    currency: row.currency,
    source: row.source,
    manual_price: row.manual_price === null ? null : Number(row.manual_price),
  };
}

/**
 * Lista os preços relevantes para o usuário: cache global (user_id NULL)
 * e overrides manuais do próprio usuário. A resolução do pipeline
 * (manual → api → fallback) acontece no domínio (`domain/portfolio`).
 */
export async function listAssetPrices(): Promise<AssetPriceRow[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<AssetPriceRow[]>(
    getSupabase()
      .from("asset_prices")
      .select("ticker, price, currency, source, manual_price")
      .or(`user_id.is.null,user_id.eq.${user_id}`),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapRow);
}

/**
 * Grava o override manual de preço (prevalece sobre cache/fallback).
 * A moeda é inferida pelo padrão do ticker (mesma regra do domínio — DRY).
 */
export async function setManualPrice(input: ManualPriceInput): Promise<void> {
  const user_id = await currentUserId();
  const currency: AssetCurrency = inferCurrencyFromTicker(input.ticker);
  const row = {
    user_id,
    ticker: input.ticker,
    price: input.price,
    currency,
    source: "manual" as const,
    manual_price: input.price,
    updated_at: new Date().toISOString(),
  };
  // `id` é preenchido pelo default do banco; o unique parcial
  // (ticker, user_id) com user_id IS NOT NULL permite o upsert.
  const { error } = await getSupabase().from("asset_prices").upsert(row, { onConflict: "ticker,user_id" });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/** Remove o override manual — o preço volta a seguir cache/fallback. */
export async function removeManualPrice(ticker: string): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await getSupabase()
    .from("asset_prices")
    .delete()
    .eq("user_id", user_id)
    .eq("ticker", ticker)
    .eq("source", "manual");
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

