import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { readAllPages, resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import { currentMonth } from "@/lib/date";
import { normalizeDividendTickerKey } from "@/domain/portfolio/dividend-deduplication";
import { computeOperationalDiscoveryFloor } from "@/domain/portfolio/dividend-engine";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
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
  CorporateDividendType,
  PortfolioDividendDismissal,
  PortfolioDividendDismissalReason,
  UserDividendEvent,
  UserDividendEventStatus,
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
    total_cost_brl: row.total_cost_brl != null ? Number(row.total_cost_brl) : null,
    average_cost_brl: row.average_cost_brl != null ? Number(row.average_cost_brl) : null,
    fx_rate_at_purchase: row.fx_rate_at_purchase != null ? Number(row.fx_rate_at_purchase) : null,
    score: row.score != null ? Number(row.score) : null,
    allocation_status: row.allocation_status ?? "active",
    score_criteria: row.score_criteria ?? {},
    last_reviewed_at: row.last_reviewed_at ?? null,
    review_frequency_months: row.review_frequency_months != null ? Number(row.review_frequency_months) : 6,
    thesis_summary: row.thesis_summary ?? null,
    dividends_start_date: row.dividends_start_date ? String(row.dividends_start_date).slice(0, 10) : null,
  };
}

const PORTFOLIO_ASSET_COLUMNS =
  "id, user_id, ticker, asset_class, sector, currency, quantity, average_price, accumulated_dividends, estimated_monthly_dividend_per_share, fixed_income_metadata, is_family, family_id, family_share_mode, family_share_percentage, notes, score, allocation_status, score_criteria, last_reviewed_at, review_frequency_months, thesis_summary, ceiling_price, ceiling_method, ceiling_metadata, total_cost_brl, average_cost_brl, fx_rate_at_purchase, dividends_start_date, created_at, updated_at";
const PORTFOLIO_SNAPSHOT_COLUMNS =
  "id, user_id, month, total_value, total_cost, auto_total_value, auto_total_cost, manual_total_value, manual_total_cost, is_manually_calibrated, calibrated_at, status, closing_date, closed_at, created_at, updated_at";
const PORTFOLIO_CONTRIBUTION_COLUMNS =
  "id, user_id, asset_id, date, amount, notes, batch_id, created_at";
const PORTFOLIO_DIVIDEND_COLUMNS =
  "id, user_id, asset_id, ticker, date, amount, notes, sync_cash, cash_amount, source_event_id, request_id, entry_origin, created_at";
const PORTFOLIO_TRANSACTION_COLUMNS =
  "id, user_id, asset_id, type, date, quantity, price, total, fx_rate, total_cost_brl, notes, batch_id, linked_dividend_id, request_id, cost_basis_realized, iof_withheld, ir_withheld, net_realized_amount, gross_realized_pnl, net_realized_pnl";
const USER_DIVIDEND_EVENT_COLUMNS =
  "id, user_id, corporate_dividend_id, asset_id, ticker, type, status, com_date, payment_date, quantity_on_com_date, gross_rate, net_rate, tax_rate_pct, gross_amount, net_amount, currency, fx_rate_applied, settled_dividend_id, is_manual, is_type_uncertain, settlement_origin, manual_review_required, dismiss_reason, notes, revision, created_at, updated_at";

function mapTransaction(row: PortfolioTransaction): PortfolioTransaction {
  return {
    ...row,
    quantity: Number(row.quantity),
    price: Number(row.price),
    total: Number(row.total),
    total_cost_brl: row.total_cost_brl != null ? Number(row.total_cost_brl) : null,
    fx_rate: row.fx_rate != null ? Number(row.fx_rate) : null,
  };
}

function mapSnapshot(row: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...row,
    total_value: Number(row.total_value),
    total_cost: Number(row.total_cost),
    auto_total_value: row.auto_total_value != null ? Number(row.auto_total_value) : null,
    auto_total_cost: row.auto_total_cost != null ? Number(row.auto_total_cost) : null,
    manual_total_value: row.manual_total_value != null ? Number(row.manual_total_value) : null,
    manual_total_cost: row.manual_total_cost != null ? Number(row.manual_total_cost) : null,
    is_manually_calibrated: Boolean(row.is_manually_calibrated),
    calibrated_at: row.calibrated_at ?? null,
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
    request_id: row.request_id ?? null,
    entry_origin: row.entry_origin ?? "legacy",
  };
}

// ---------------------------------------------------------------------------
// Ativos da Carteira (Posição Consolidada)
// ---------------------------------------------------------------------------

/** Ativos da carteira com quantidade e preço médio consolidados. */
export async function listPortfolioAssets(confirmedUserId?: string): Promise<PortfolioAsset[]> {
  const user_id = confirmedUserId ?? await currentUserId();
  const { data, error } = await resolveQuery<PortfolioAsset[]>(
    getSupabase()
      .from("portfolio_assets")
      .select(PORTFOLIO_ASSET_COLUMNS)
      .eq("user_id", user_id)
      .order("ticker"),
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
 * - total_cost: custo de aquisição total aplicado sob custódia (Custo dos Ativos + Saldo de Caixa 1:1), não-negativo;
 * - status: 'provisional' ou 'closed' (default: 'provisional' para o mês corrente, 'closed' para pretéritos);
 * - closing_date: data válida do fechamento YYYY-MM-DD ou null;
 * - closed_at: timestamp ISO de consolidação ou null.
 */
function validateSnapshotInput(input: PortfolioSnapshotInput): {
  month: string;
  total_value: number;
  total_cost: number;
  status: "provisional" | "closed";
  closing_date: string | null;
  closed_at: string | null;
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

  // Determina status canônico do ciclo de vida
  let status: "provisional" | "closed";
  if (input.status === "provisional" || input.status === "closed") {
    status = input.status;
  } else {
    status = input.month >= currentMonth() ? "provisional" : "closed";
  }

  // Validação opcional da data de corte (YYYY-MM-DD)
  let closing_date: string | null = null;
  if (input.closing_date && /^\d{4}-\d{2}-\d{2}$/.test(input.closing_date)) {
    closing_date = input.closing_date;
  }

  // Timestamp de fechamento
  let closed_at: string | null = null;
  if (input.closed_at) {
    closed_at = input.closed_at;
  } else if (status === "closed") {
    closed_at = new Date().toISOString();
  }

  return {
    month: input.month,
    total_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    status,
    closing_date,
    closed_at,
  };
}

export async function listPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioSnapshot[]>(
    getSupabase()
      .from("portfolio_snapshots")
      .select(PORTFOLIO_SNAPSHOT_COLUMNS)
      .eq("user_id", user_id)
      .order("month"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapSnapshot);
}

/**
 * Calibra manualmente o snapshot de um mês fechado de forma não destrutiva (§F50/F51).
 * O valor original do fechamento automático permanece preservado no banco (auto_total_value/auto_total_cost).
 */
export async function calibratePortfolioSnapshot(
  month: string,
  totalValue: number,
  totalCost: number,
): Promise<PortfolioSnapshot> {
  const { data, error } = await resolveQuery<{ success: boolean; snapshot: PortfolioSnapshot }>(
    getSupabase().rpc("calibrate_portfolio_snapshot", {
      p_month: month,
      p_total_value: Math.round(totalValue * 100) / 100,
      p_total_cost: Math.round(totalCost * 100) / 100,
    }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data?.snapshot) {
    throw new AppError("unknown", "Resposta vazia ao calibrar snapshot de patrimônio.", null);
  }
  return mapSnapshot(data.snapshot);
}

/**
 * Restaura o snapshot de um mês para o valor original gravado no fechamento de mercado,
 * removendo a calibração manual do usuário de forma não destrutiva (§F50/F51).
 */
export async function resetManualSnapshotCalibration(
  month: string,
): Promise<{ success: boolean; action?: string; snapshot?: PortfolioSnapshot }> {
  const { data, error } = await resolveQuery<{
    success: boolean;
    action?: string;
    snapshot?: PortfolioSnapshot;
    message?: string;
  }>(
    getSupabase().rpc("reset_manual_snapshot_calibration", {
      p_month: month,
    }),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return {
    success: Boolean(data?.success),
    action: data?.action,
    snapshot: data?.snapshot ? mapSnapshot(data.snapshot) : undefined,
  };
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
 * Cria ou atualiza em lote múltiplos snapshots mensais com validação das invariantes canônicas
 * e deduplicação inteligente de competência.
 */
export async function batchUpsertPortfolioSnapshots(
  inputs: PortfolioSnapshotInput[],
): Promise<PortfolioSnapshot[]> {
  if (inputs.length === 0) return [];
  const sanitizedInputs = inputs.map(validateSnapshotInput);

  // Deduplica por month mantendo a última ocorrência para evitar conflito ON CONFLICT DO UPDATE no Postgres
  const dedupedMap = new Map<string, (typeof sanitizedInputs)[number]>();
  for (const item of sanitizedInputs) {
    dedupedMap.set(item.month, item);
  }
  const dedupedInputs = Array.from(dedupedMap.values());

  const user_id = await currentUserId();
  const rows = dedupedInputs.map((input) => ({ ...input, user_id }));
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
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioContribution[]>(
    getSupabase()
      .from("portfolio_contributions")
      .select(PORTFOLIO_CONTRIBUTION_COLUMNS)
      .eq("user_id", user_id)
      .order("date", { ascending: false }),
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
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioDividend[]>(
    getSupabase()
      .from("portfolio_dividends")
      .select(PORTFOLIO_DIVIDEND_COLUMNS)
      .eq("user_id", user_id)
      .order("date", { ascending: false }),
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
  const user_id = await currentUserId();
  const { data, error } = await resolveQuery<PortfolioTransaction[]>(
    getSupabase()
      .from("portfolio_transactions")
      .select(PORTFOLIO_TRANSACTION_COLUMNS)
      .eq("user_id", user_id)
      .eq("asset_id", assetId)
      .order("date"),
  );
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return (data ?? []).map(mapTransaction);
}

export async function listAllPortfolioTransactions(): Promise<PortfolioTransaction[]> {
  const user_id = await currentUserId();
  const data = await readAllPages<PortfolioTransaction>((afterId, pageSize) => {
    let page = getSupabase()
      .from("portfolio_transactions")
      .select(PORTFOLIO_TRANSACTION_COLUMNS)
      .eq("user_id", user_id)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<PortfolioTransaction[]>(page);
  });
  return data
    .map(mapTransaction)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
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

function mapCorporateDividend(row: CorporateDividend): CorporateDividend {
  return {
    ...row,
    ticker: row.ticker.trim().toUpperCase(),
    payment_date: row.payment_date ?? null,
    rate: Number(row.rate),
    net_rate: Number(row.net_rate),
    tax_rate_pct: Number(row.tax_rate_pct ?? 0),
    is_type_uncertain: Boolean(row.is_type_uncertain),
    trust_tier: row.trust_tier ?? "raw_fallback",
    external_terms: row.external_terms ?? null,
    published: row.published ?? true,
  };
}

function mapUserDividendEvent(row: UserDividendEvent): UserDividendEvent {
  return {
    ...row,
    ticker: row.ticker.trim().toUpperCase(),
    payment_date: row.payment_date ?? null,
    quantity_on_com_date: Number(row.quantity_on_com_date),
    gross_rate: Number(row.gross_rate),
    net_rate: Number(row.net_rate),
    tax_rate_pct: Number(row.tax_rate_pct ?? 0),
    gross_amount: Number(row.gross_amount),
    net_amount: Number(row.net_amount),
    fx_rate_applied: row.fx_rate_applied != null ? Number(row.fx_rate_applied) : null,
    is_manual: Boolean(row.is_manual),
    is_type_uncertain: Boolean(row.is_type_uncertain),
    manual_review_required: Boolean(row.manual_review_required),
    revision:
      typeof row.revision === "number" && Number.isFinite(row.revision)
        ? row.revision
        : Number.isFinite(Number(row.revision)) && row.revision != null
          ? Number(row.revision)
          : 0,
  };
}

const CORPORATE_DIVIDEND_COLUMNS =
  "id,ticker,type,com_date,payment_date,rate,currency,net_rate,provider,tax_rate_pct,is_type_uncertain,trust_tier,external_terms,published";

/**
 * Consulta proventos corporativos capturados (B3 e EUA) na janela operacional padrão (120d).
 * Pagina por ID em ambos os caminhos (com e sem filtro de tickers) para evitar limite cego.
 */
export async function listCorporateDividends(tickers?: string[]): Promise<CorporateDividend[]> {
  const todayBR = todaySaoPauloISO();
  const floorDate = computeOperationalDiscoveryFloor(todayBR);
  const windowFilter = `com_date.gte.${floorDate},payment_date.gte.${floorDate}`;

  if (Array.isArray(tickers)) {
    const normalizedSet = new Set<string>();
    for (const raw of tickers) {
      const upper = raw.trim().toUpperCase();
      if (!upper) continue;
      normalizedSet.add(upper);
      const canon = normalizeDividendTickerKey(upper);
      if (canon) normalizedSet.add(canon);
    }
    const uniqueTickers = Array.from(normalizedSet);
    if (uniqueTickers.length === 0) return [];

    const byId = new Map<string, CorporateDividend>();
    const CHUNK_SIZE = 150;
    const concurrency = 3;
    for (let offset = 0; offset < uniqueTickers.length; offset += CHUNK_SIZE * concurrency) {
      const batches = Array.from({ length: concurrency }, (_, index) =>
        uniqueTickers.slice(offset + index * CHUNK_SIZE, offset + (index + 1) * CHUNK_SIZE),
      ).filter((batch) => batch.length > 0);
      const pages = await Promise.all(
        batches.map((tickersBatch) =>
          readAllPages<CorporateDividend>((afterId, pageSize) => {
            let query = getSupabase()
              .from("corporate_dividends")
              .select(CORPORATE_DIVIDEND_COLUMNS)
              .in("ticker", tickersBatch)
              .lte("com_date", todayBR)
              .or(windowFilter)
              .order("id", { ascending: true })
              .limit(pageSize);
            if (afterId) query = query.gt("id", afterId);
            return resolveQuery<CorporateDividend[]>(query);
          }),
        ),
      );
      for (const rows of pages) {
        for (const row of rows) byId.set(row.id, mapCorporateDividend(row));
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.com_date.localeCompare(a.com_date));
  }

  const rows = await readAllPages<CorporateDividend>((afterId, pageSize) => {
    let query = getSupabase()
      .from("corporate_dividends")
      .select(CORPORATE_DIVIDEND_COLUMNS)
      .lte("com_date", todayBR)
      .or(windowFilter)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (afterId) query = query.gt("id", afterId);
    return resolveQuery<CorporateDividend[]>(query);
  });

  return rows.map(mapCorporateDividend).sort((a, b) => b.com_date.localeCompare(a.com_date));
}

/**
 * Lista os eventos de proventos materializados ou provisionados manualmente do usuário autenticado.
 */
export async function listUserDividendEvents(): Promise<UserDividendEvent[]> {
  const uid = await currentUserId();
  const rows = await readAllPages<UserDividendEvent>((afterId, pageSize) => {
    let page = getSupabase()
      .from("user_dividend_events")
      .select(USER_DIVIDEND_EVENT_COLUMNS)
      .eq("user_id", uid)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (afterId) page = page.gt("id", afterId);
    return resolveQuery<UserDividendEvent[]>(page);
  });

  return rows.map(mapUserDividendEvent).sort((a, b) => {
    if (a.payment_date == null && b.payment_date != null) return -1;
    if (a.payment_date != null && b.payment_date == null) return 1;
    const payCmp = (b.payment_date ?? "").localeCompare(a.payment_date ?? "");
    if (payCmp !== 0) return payCmp;
    return b.com_date.localeCompare(a.com_date);
  });
}

export interface CreateManualUserDividendEventInput {
  asset_id: string;
  ticker: string;
  type: CorporateDividendType;
  com_date: string;
  payment_date: string | null;
  quantity_on_com_date: number;
  gross_rate?: number;
  net_rate?: number;
  tax_rate_pct?: number;
  gross_amount?: number;
  net_amount: number;
  currency: "BRL" | "USD";
  status?: Extract<UserDividendEventStatus, "PROVISIONED" | "PENDING_CONFIRMATION">;
  notes?: string | null;
}

/**
 * Registra manualmente um evento de provento provisionado pelo usuário (`is_manual = true`).
 */
export async function createManualUserDividendEvent(
  input: CreateManualUserDividendEventInput,
): Promise<UserDividendEvent> {
  const rawNet = Number(input.net_amount);
  if (!Number.isFinite(rawNet) || rawNet <= 0) {
    throw new AppError("validation", "O valor líquido do provento deve ser maior que zero.", null);
  }
  const netAmount = Math.round(rawNet * 100) / 100;
  if (netAmount <= 0) {
    throw new AppError("validation", "O valor líquido do provento deve ser maior que zero.", null);
  }

  const uid = await currentUserId();
  const qty = Math.max(0, Number(input.quantity_on_com_date) || 0);
  const taxPct = Math.max(0, Math.min(100, Number(input.tax_rate_pct ?? 0) || 0));
  const grossAmount =
    input.gross_amount !== undefined
      ? Math.max(netAmount, Math.round(Number(input.gross_amount) * 100) / 100)
      : taxPct > 0 && taxPct < 100
        ? Math.round((netAmount / (1 - taxPct / 100)) * 100) / 100
        : netAmount;
  const netRate =
    input.net_rate !== undefined ? Number(input.net_rate) : qty > 0 ? netAmount / qty : 0;
  const grossRate =
    input.gross_rate !== undefined ? Number(input.gross_rate) : qty > 0 ? grossAmount / qty : 0;

  const { data, error } = await resolveQuery(
    getSupabase()
      .from("user_dividend_events")
      .insert({
        user_id: uid,
        corporate_dividend_id: null,
        asset_id: input.asset_id,
        ticker: input.ticker.trim().toUpperCase(),
        type: input.type,
        status: input.status ?? "PROVISIONED",
        com_date: input.com_date.slice(0, 10),
        payment_date: input.payment_date ? input.payment_date.slice(0, 10) : null,
        quantity_on_com_date: qty,
        gross_rate: grossRate,
        net_rate: netRate,
        tax_rate_pct: taxPct,
        gross_amount: grossAmount,
        net_amount: netAmount,
        currency: input.currency,
        is_manual: true,
        is_type_uncertain: false,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao registrar provento provisionado.", null);
  }

  return mapUserDividendEvent(data as UserDividendEvent);
}

/**
 * Atualiza campos editáveis de um evento de provento do usuário.
 */
export async function updateUserDividendEvent(
  id: string,
  patch: Partial<
    Pick<
      UserDividendEvent,
      | "status"
      | "payment_date"
      | "net_amount"
      | "gross_amount"
      | "tax_rate_pct"
      | "type"
      | "notes"
      | "dismiss_reason"
      | "settled_dividend_id"
      | "settlement_origin"
      | "fx_rate_applied"
    >
  >,
): Promise<UserDividendEvent> {
  const uid = await currentUserId();
  const { data, error } = await resolveQuery(
    getSupabase()
      .from("user_dividend_events")
      .update({
        ...patch,
        manual_review_required: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .single(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Evento de provento não encontrado para atualização.", null);
  }

  return mapUserDividendEvent(data as UserDividendEvent);
}

/**
 * Exclui um evento de provento do usuário (uso típico: provisionamento manual).
 */
export async function deleteUserDividendEvent(id: string): Promise<void> {
  const uid = await currentUserId();
  const { error } = await resolveQuery(
    getSupabase().from("user_dividend_events").delete().eq("id", id).eq("user_id", uid),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
}

/**
 * Reverte eventos liquidados de volta a PENDING_CONFIRMATION durante o Undo seguro.
 */
export async function revertSettledUserDividendEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const uid = await currentUserId();
  const { error } = await resolveQuery(
    getSupabase()
      .from("user_dividend_events")
      .update({
        status: "PENDING_CONFIRMATION",
        settled_dividend_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", uid)
      .in("id", eventIds),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
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
        { onConflict: "user_id,corporate_dividend_id" },
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


