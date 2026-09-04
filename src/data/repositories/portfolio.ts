import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import type {
  DbInsert,
  DbUpdate,
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioSnapshot,
  PortfolioTransaction,
} from "@/types";

/**
 * Carteira — integração remota (Posição Consolidada e Snapshots §F36).
 */

function mapAsset(row: PortfolioAsset): PortfolioAsset {
  return {
    ...row,
    quantity: Number(row.quantity ?? 0),
    average_price: Number(row.average_price ?? 0),
    accumulated_dividends: Number(row.accumulated_dividends ?? 0),
    estimated_monthly_dividend_per_share: Number(row.estimated_monthly_dividend_per_share ?? 0),
  };
}

function mapTransaction(row: PortfolioTransaction): PortfolioTransaction {
  return {
    ...row,
    quantity: Number(row.quantity),
    price: Number(row.price),
    total: Number(row.total),
  };
}

function mapSnapshot(row: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...row,
    total_value: Number(row.total_value),
    total_cost: Number(row.total_cost),
  };
}

function mapContribution(row: PortfolioContribution): PortfolioContribution {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

function mapDividend(row: PortfolioDividend): PortfolioDividend {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

// ---------------------------------------------------------------------------
// Ativos da Carteira (Posição Consolidada)
// ---------------------------------------------------------------------------

/** Ativos da carteira com quantidade e preço médio consolidados. */
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

/** Cria ou atualiza ativos em lote (importador de custódia). */
export async function upsertPortfolioAssetsBatch(
  inputs: Omit<DbInsert<PortfolioAsset>, "user_id">[],
): Promise<PortfolioAsset[]> {
  if (inputs.length === 0) return [];
  const user_id = await currentUserId();
  const payload = inputs.map((input) => ({ ...input, user_id }));
  const { data, error } = await resolveQuery<PortfolioAsset[]>(
    getSupabase()
      .from("portfolio_assets")
      .upsert(payload, { onConflict: "user_id,ticker" })
      .select(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapAsset);
}

/** Edita um ativo (ticker/classe/moeda/posição). */
export async function updatePortfolioAsset(id: string, patch: DbUpdate<PortfolioAsset>): Promise<PortfolioAsset> {
  const { data, error } = await resolveQuery<PortfolioAsset>(
    getSupabase().from("portfolio_assets").update(patch).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao editar ativo.", null);
  }
  return mapAsset(data);
}

/** Exclui um ativo em cascata. */
export async function deletePortfolioAsset(id: string): Promise<void> {
  const { error } = await resolveQuery(getSupabase().from("portfolio_assets").delete().eq("id", id));
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

// ---------------------------------------------------------------------------
// Snapshots Mensais de Patrimônio
// ---------------------------------------------------------------------------

export async function listPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  const { data, error } = await resolveQuery<PortfolioSnapshot[]>(
    getSupabase().from("portfolio_snapshots").select("*").order("month"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapSnapshot);
}

export async function upsertPortfolioSnapshot(input: {
  month: string;
  total_value: number;
  total_cost: number;
}): Promise<PortfolioSnapshot> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioSnapshot>(
    getSupabase()
      .from("portfolio_snapshots")
      .upsert({ ...input, user_id }, { onConflict: "user_id,month" })
      .select()
      .single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao gravar snapshot de patrimônio.", null);
  }
  return mapSnapshot(data);
}

// ---------------------------------------------------------------------------
// Contribuições / Aportes Mensais (Desacopladas)
// ---------------------------------------------------------------------------

export async function listPortfolioContributions(): Promise<PortfolioContribution[]> {
  const { data, error } = await resolveQuery<PortfolioContribution[]>(
    getSupabase().from("portfolio_contributions").select("*").order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapContribution);
}

export async function createPortfolioContribution(
  input: Omit<DbInsert<PortfolioContribution>, "user_id">,
): Promise<PortfolioContribution> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioContribution>(
    getSupabase().from("portfolio_contributions").insert({ ...input, user_id }).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar contribuição de aporte.", null);
  }
  return mapContribution(data);
}

export async function deletePortfolioContribution(id: string): Promise<void> {
  const { error } = await resolveQuery(getSupabase().from("portfolio_contributions").delete().eq("id", id));
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Upsert atômico do Marco Zero do Bolso via RPC.
 * Garante a invariante de unicidade no servidor: remove todos os marcos zeros anteriores
 * do usuário e insere o novo calibrado em uma única chamada transacional.
 */
export async function upsertMarcoZero(params: {
  date: string;
  amount: number;
  notes?: string;
}): Promise<PortfolioContribution> {
  const { data, error } = await resolveQuery<PortfolioContribution>(
    getSupabase().rpc("upsert_marco_zero", {
      p_date: params.date,
      p_amount: params.amount,
      p_notes: params.notes ?? "Marco Zero do Bolso · Custo Histórico Inicial",
    }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao salvar Marco Zero do Bolso.", null);
  }
  // O RPC retorna o objeto completo do registro criado
  return mapContribution(data as unknown as PortfolioContribution);
}

/**
 * Criação segura de Aporte Histórico do Bolso via RPC.
 * Registra o aporte financeiro histórico com validação de invariantes e vinculação
 * segura ao usuário autenticado (auth.uid()).
 */
export async function createHistoricalContribution(params: {
  date: string;
  amount: number;
  notes?: string;
}): Promise<PortfolioContribution> {
  const { data, error } = await resolveQuery<PortfolioContribution>(
    getSupabase().rpc("create_historical_contribution", {
      p_date: params.date,
      p_amount: params.amount,
      p_notes: params.notes ?? "Marco Histórico do Bolso",
    }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao criar aporte histórico.", null);
  }
  return mapContribution(data as unknown as PortfolioContribution);
}


// ---------------------------------------------------------------------------
// Proventos Recebidos
// ---------------------------------------------------------------------------

export async function listPortfolioDividends(): Promise<PortfolioDividend[]> {
  const { data, error } = await resolveQuery<PortfolioDividend[]>(
    getSupabase().from("portfolio_dividends").select("*").order("date", { ascending: false }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapDividend);
}

export async function createPortfolioDividend(
  input: Omit<DbInsert<PortfolioDividend>, "user_id">,
): Promise<PortfolioDividend> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioDividend>(
    getSupabase().from("portfolio_dividends").insert({ ...input, user_id }).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao registrar provento.", null);
  }
  return mapDividend(data);
}

export async function deletePortfolioDividend(id: string): Promise<void> {
  const { error } = await resolveQuery(getSupabase().from("portfolio_dividends").delete().eq("id", id));
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

// ---------------------------------------------------------------------------
// Métodos de compatibilidade (Transações legadas / Extrato)
// ---------------------------------------------------------------------------

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

export async function listAllPortfolioTransactions(): Promise<PortfolioTransaction[]> {
  const { data, error } = await resolveQuery<PortfolioTransaction[]>(
    getSupabase().from("portfolio_transactions").select("*").order("date"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapTransaction);
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

export async function createPortfolioTransactionsBatch(
  inputs: Omit<DbInsert<PortfolioTransaction>, "user_id">[],
): Promise<PortfolioTransaction[]> {
  if (inputs.length === 0) return [];
  const user_id = await currentUserId();
  const payload = inputs.map((input) => ({ ...input, user_id }));
  const { data, error } = await resolveQuery<PortfolioTransaction[]>(
    getSupabase().from("portfolio_transactions").insert(payload).select(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapTransaction);
}

export async function updatePortfolioTransaction(
  id: string,
  patch: DbUpdate<PortfolioTransaction>,
): Promise<PortfolioTransaction> {
  const { data, error } = await resolveQuery<PortfolioTransaction>(
    getSupabase().from("portfolio_transactions").update(patch).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao editar transação.", null);
  }
  return mapTransaction(data);
}

export async function deletePortfolioTransaction(id: string): Promise<void> {
  const { error } = await resolveQuery(getSupabase().from("portfolio_transactions").delete().eq("id", id));
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export async function deletePortfolioTransactionsMatching(filter: {
  asset_id: string;
  date: string;
  types?: PortfolioTransaction["type"][];
  total?: number;
}): Promise<void> {
  let query = getSupabase()
    .from("portfolio_transactions")
    .delete()
    .eq("asset_id", filter.asset_id)
    .eq("date", filter.date);

  if (filter.types && filter.types.length > 0) {
    query = query.in("type", filter.types);
  }
  if (filter.total !== undefined) {
    query = query.eq("total", filter.total);
  }
  const { error } = await resolveQuery(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export async function deletePortfolioDividendsMatching(filter: {
  asset_id: string;
  date: string;
  amount?: number;
}): Promise<void> {
  let query = getSupabase()
    .from("portfolio_dividends")
    .delete()
    .eq("asset_id", filter.asset_id)
    .eq("date", filter.date);

  if (filter.amount !== undefined) {
    query = query.eq("amount", filter.amount);
  }
  const { error } = await resolveQuery(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export async function deletePortfolioContributionsMatching(filter: {
  asset_id: string;
  date: string;
  amount?: number;
}): Promise<void> {
  let query = getSupabase()
    .from("portfolio_contributions")
    .delete()
    .eq("asset_id", filter.asset_id)
    .eq("date", filter.date);

  if (filter.amount !== undefined) {
    query = query.eq("amount", filter.amount);
  }
  const { error } = await resolveQuery(query);
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

