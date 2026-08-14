import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type { DbInsert, PortfolioAsset, PortfolioTransaction } from "@/types";

/**
 * Carteira — integração remota (ledger §3.11.2).
 * A posição NUNCA é armazenada: deriva das transações em `domain/portfolio`.
 */

function mapAsset(row: PortfolioAsset): PortfolioAsset {
  return { ...row };
}

function mapTransaction(row: PortfolioTransaction): PortfolioTransaction {
  return {
    ...row,
    quantity: Number(row.quantity),
    price: Number(row.price),
    total: Number(row.total),
  };
}

/** Ativos da carteira (com posição derivada no domínio). */
export async function listPortfolioAssets(): Promise<PortfolioAsset[]> {
  const { data, error } = await resolveQuery<PortfolioAsset[]>(
    getSupabase().from("portfolio_assets").select("*").order("ticker"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapAsset);
}

/** Transações de um ativo, em ordem cronológica (para o ledger). */
export async function listPortfolioTransactions(assetId: string): Promise<PortfolioTransaction[]> {
  const { data, error } = await resolveQuery<PortfolioTransaction[]>(
    getSupabase().from("portfolio_transactions").select("*").eq("asset_id", assetId).order("date"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapTransaction);
}

export async function createPortfolioAsset(input: Omit<DbInsert<PortfolioAsset>, "user_id">): Promise<PortfolioAsset> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioAsset>(
    getSupabase().from("portfolio_assets").insert({ ...input, user_id }).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar ativo.", null);
  }
  return mapAsset(data);
}

export async function createPortfolioTransaction(
  input: Omit<DbInsert<PortfolioTransaction>, "user_id">,
): Promise<PortfolioTransaction> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioTransaction>(
    getSupabase().from("portfolio_transactions").insert({ ...input, user_id }).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar transação.", null);
  }
  return mapTransaction(data);
}
