import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { MonthlyPriceInput, MonthlyPriceRow, PortfolioMonthlyPrice } from "@/types";

function mapMonthlyPrice(row: PortfolioMonthlyPrice): MonthlyPriceRow {
  return {
    ...row,
    price: Number(row.price),
  };
}

/**
 * Lista todas as cotações mensais gravadas para uma competência específica (YYYY-MM).
 */
export async function listPortfolioMonthlyPrices(month: string): Promise<MonthlyPriceRow[]> {
  const { data, error } = await resolveQuery<PortfolioMonthlyPrice[]>(
    getSupabase()
      .from("portfolio_monthly_prices")
      .select("*")
      .eq("month", month)
      .order("ticker"),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []).map(mapMonthlyPrice);
}

/**
 * Grava ou atualiza um lote de cotações mensais de forma idempotente para o usuário autenticado.
 */
export async function upsertPortfolioMonthlyPricesBatch(items: MonthlyPriceInput[]): Promise<void> {
  if (items.length === 0) return;

  const user_id = await currentUserId();
  const rows = items.map((item) => ({
    user_id,
    ticker: item.ticker.toUpperCase().trim(),
    month: item.month,
    price: item.price,
    currency: item.currency,
    source: item.source,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_monthly_prices")
      .upsert(rows, { onConflict: "user_id,ticker,month" }),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Remove uma cotação mensal específica por ticker e competência do usuário autenticado.
 */
export async function deletePortfolioMonthlyPrice(ticker: string, month: string): Promise<void> {
  const normalizedTicker = ticker.toUpperCase().trim();
  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_monthly_prices")
      .delete()
      .eq("ticker", normalizedTicker)
      .eq("month", month),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}
