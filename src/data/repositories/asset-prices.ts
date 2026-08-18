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
    ticker: row.ticker.trim().toUpperCase(),
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

