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
  PortfolioSnapshotInput,
  PortfolioTransaction,
  CorporateDividend,
  PortfolioDividendDismissal,
  PortfolioDividendDismissalReason,
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
    sync_cash: row.sync_cash ? Boolean(row.sync_cash) : false,
    cash_amount:
      row.cash_amount !== undefined && row.cash_amount !== null ? Number(row.cash_amount) : null,
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

/**
 * Valida e normaliza as invariantes canônicas de um snapshot patrimonial (§2.1 PLANO_AUDITORIA):
 * - month: formato estrito YYYY-MM;
 * - total_value: saldo patrimonial total na data de corte (Ativos valorados + Saldo de Caixa), não-negativo;
 * - total_cost: custo de aquisição total aplicado sob custódia (Custo dos Ativos + Saldo de Caixa 1:1), não-negativo.
 */
function validateSnapshotInput(input: PortfolioSnapshotInput): {
  month: string;
  total_value: number;
  total_cost: number;
} {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    throw new AppError(
      "validation",
      `Competência inválida para snapshot: "${input.month}". Formato esperado: YYYY-MM.`,
    );
  }
  const totalValue = Number(input.total_value);
  const totalCost = Number(input.total_cost);
  if (!Number.isFinite(totalValue) || totalValue < 0) {
    throw new AppError(
      "validation",
      "O patrimônio total do snapshot (total_value) deve ser um número não-negativo.",
    );
  }
  if (!Number.isFinite(totalCost) || totalCost < 0) {
    throw new AppError(
      "validation",
      "O custo total do snapshot (total_cost) deve ser um número não-negativo.",
    );
  }
  return {
    month: input.month,
    total_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
  };
}

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

/**
 * Cria ou atualiza um snapshot patrimonial mensal respeitando a regra canônica (§2.1):
 * - total_value: Ativos valorados a mercado/curva + Saldo de Caixa na data de corte.
 * - total_cost: Custo de aquisição dos ativos + Saldo de Caixa (paridade 1:1).
 */
export async function upsertPortfolioSnapshot(
  input: PortfolioSnapshotInput,
): Promise<PortfolioSnapshot> {
  const sanitized = validateSnapshotInput(input);
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioSnapshot>(
    getSupabase()
      .from("portfolio_snapshots")
      .upsert({ ...sanitized, user_id }, { onConflict: "user_id,month" })
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

/**
 * Cria ou atualiza em lote múltiplos snapshots mensais com validação das invariantes canônicas.
 */
export async function batchUpsertPortfolioSnapshots(
  inputs: PortfolioSnapshotInput[],
): Promise<PortfolioSnapshot[]> {
  if (inputs.length === 0) return [];
  const sanitizedInputs = inputs.map(validateSnapshotInput);
  const user_id = await currentUserId();
  const rows = sanitizedInputs.map((input) => ({ ...input, user_id }));
  const { data, error } = await resolveQuery<PortfolioSnapshot[]>(
    getSupabase()
      .from("portfolio_snapshots")
      .upsert(rows, { onConflict: "user_id,month" })
      .select(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapSnapshot);
}

export async function deletePortfolioSnapshot(month: string): Promise<void> {
  const user_id = await currentUserId();
  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_snapshots")
      .delete()
      .eq("user_id", user_id)
      .eq("month", month),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
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

export async function createPortfolioContributionsBatch(
  inputs: Omit<DbInsert<PortfolioContribution>, "user_id">[],
): Promise<PortfolioContribution[]> {
  if (inputs.length === 0) return [];
  const user_id = await currentUserId();
  const rows = inputs.map((input) => ({ ...input, user_id }));
  const { data, error } = await resolveQuery<PortfolioContribution[]>(
    getSupabase().from("portfolio_contributions").insert(rows).select(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapContribution);
}

export async function deletePortfolioContribution(id: string): Promise<void> {
  const { error } = await resolveQuery(getSupabase().from("portfolio_contributions").delete().eq("id", id));
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export async function updatePortfolioContribution(
  id: string,
  input: DbUpdate<PortfolioContribution>,
): Promise<PortfolioContribution> {
  const { data, error } = await resolveQuery<PortfolioContribution>(
    getSupabase().from("portfolio_contributions").update(input).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao editar aporte.", null);
  }
  return mapContribution(data);
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
  const notes = params.notes?.trim() || "Marco Histórico do Bolso";

  // 1. Tenta via RPC atômico (se a migration 0044 já estiver aplicada no banco)
  const { data, error } = await resolveQuery<PortfolioContribution>(
    getSupabase().rpc("create_historical_contribution", {
      p_date: params.date,
      p_amount: params.amount,
      p_notes: notes,
    }),
  );

  if (!error && data) {
    return mapContribution(data as unknown as PortfolioContribution);
  }

  // 2. Fallback resiliente: insere diretamente com asset_id = null via repositório
  return createPortfolioContribution({
    asset_id: null,
    date: params.date,
    amount: params.amount,
    notes,
  });
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

export async function updatePortfolioDividend(
  id: string,
  patch: Partial<Omit<PortfolioDividend, "id" | "user_id" | "created_at">>,
): Promise<PortfolioDividend> {
  const { data, error } = await resolveQuery<PortfolioDividend>(
    getSupabase().from("portfolio_dividends").update(patch).eq("id", id).select().single(),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao atualizar provento.", null);
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

/**
 * Consulta a lista global de proventos corporativos capturados da B3.
 */
export async function listCorporateDividends(limit = 200): Promise<CorporateDividend[]> {
  const { data, error } = await resolveQuery(
    getSupabase()
      .from("corporate_dividends")
      .select("*")
      .order("payment_date", { ascending: false })
      .limit(limit),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return ((data ?? []) as CorporateDividend[]).map((row) => ({
    ...row,
    rate: Number(row.rate),
    net_rate: Number(row.net_rate),
  }));
}

/**
 * Consulta as dispensas de proventos do usuário autenticado.
 */
export async function listPortfolioDividendDismissals(): Promise<PortfolioDividendDismissal[]> {
  const uid = await currentUserId();
  const { data, error } = await resolveQuery(
    getSupabase()
      .from("portfolio_dividend_dismissals")
      .select("*")
      .eq("user_id", uid),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return (data ?? []) as PortfolioDividendDismissal[];
}

/**
 * Registra a dispensa de um provento corporativo para não ser sugerido ao usuário.
 */
export async function dismissCorporateDividend(
  corporateDividendId: string,
  reason: PortfolioDividendDismissalReason = "manual_ignore",
): Promise<PortfolioDividendDismissal> {
  const uid = await currentUserId();
  const { data, error } = await resolveQuery(
    getSupabase()
      .from("portfolio_dividend_dismissals")
      .upsert(
        {
          user_id: uid,
          corporate_dividend_id: corporateDividendId,
          reason,
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: "user_id, corporate_dividend_id" },
      )
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data as PortfolioDividendDismissal;
}

/**
 * Remove a dispensa de um provento corporativo (revertendo para o status sugerido).
 */
export async function removeDividendDismissal(corporateDividendId: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_dividend_dismissals")
      .delete()
      .eq("user_id", uid)
      .eq("corporate_dividend_id", corporateDividendId),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Remove múltiplos proventos por IDs (utilizado no Rollback/Undo de aprovação em lote).
 */
export async function deletePortfolioDividendsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const uid = await currentUserId();
  const { error } = await resolveQuery(
    getSupabase()
      .from("portfolio_dividends")
      .delete()
      .eq("user_id", uid)
      .in("id", ids),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

export type { PortfolioDividend };


