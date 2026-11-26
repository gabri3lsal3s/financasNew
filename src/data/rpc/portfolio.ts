import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";
import { callRpc, unwrapRpc } from "./client";
import type {
  ApproveDividendsBatchPayload,
  ApproveDividendsBatchResult,
  ConfirmDividendEventsPayload,
  ConfirmDividendEventsResult,
  FixedIncomeMetadata,
  MonthlyClosingPayload,
  MonthlyClosingResult,
  PortfolioSnapshot,
  SetDividendTrackingAssetItem,
  SetDividendTrackingAtomicResult,
  SyncUserDividendsResult,
  WriteUserDividendCommand,
  WriteUserDividendResult,
} from "@/types";

/** Upsert de meta de grupo (classe ou setor escopado por classe) — §3.11.1. */
export async function setGroupTarget(
  groupType: "class" | "sector",
  name: string,
  target: number,
  className?: string,
): Promise<void> {
  await unwrapRpc(
    callRpc("set_group_target", {
      p_group_type: groupType,
      p_name: name,
      p_target: target,
      ...(groupType === "sector" && className ? { p_class_name: className } : {}),
    }),
    true,
  );
}

/** Remove uma meta de grupo (classe ou setor escopado por classe). */
export async function removeGroupTarget(
  groupType: "class" | "sector",
  name: string,
  className?: string,
): Promise<void> {
  await unwrapRpc(
    callRpc("remove_group_target", {
      p_group_type: groupType,
      p_name: name,
      ...(groupType === "sector" && className ? { p_class_name: className } : {}),
    }),
    true,
  );
}

export interface SaveHierarchyTargetsParams {
  classes: Array<{ name: string; target_percentage: number }>;
  sectors: Array<{ class_name: string; name: string; target_percentage: number }>;
}

/**
 * Substitui atomicamente toda a árvore hierárquica de metas (Classes % + Setores % por Classe).
 * Valida soma de classes ≤ 100% e soma de setores por classe ≤ 100% no servidor.
 */
export async function savePortfolioHierarchyTargets(
  params: SaveHierarchyTargetsParams,
): Promise<boolean> {
  return unwrapRpc(
    callRpc("save_portfolio_hierarchy_targets", {
      p_classes: params.classes,
      p_sectors: params.sectors,
    }),
  );
}

export interface ExecuteBatchAporteItemInput {
  asset_id: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ExecutePortfolioBatchAporteParams {
  items: ExecuteBatchAporteItemInput[];
  date: string;
  totalAmount: number;
  cashUsed?: number;
  notes?: string | null;
  batchId?: string | null;
}

/**
 * Executa aporte em lote de forma transacional e atômica (§F36 + Aporte Composto).
 * Atualiza posições em `portfolio_assets`, insere compras em `portfolio_transactions`,
 * abate eventual `cashUsed` de CAIXA e grava apenas o dinheiro novo em `portfolio_contributions`.
 */
export async function executePortfolioBatchAporte(params: ExecutePortfolioBatchAporteParams): Promise<boolean> {
  return unwrapRpc(
    callRpc("execute_portfolio_batch_aporte", {
      p_items: params.items,
      p_date: params.date,
      p_total_amount: params.totalAmount,
      p_notes: params.notes ?? null,
      p_cash_used: params.cashUsed ?? 0,
      p_batch_id: params.batchId ?? null,
    }),
  );
}

/**
 * Reverte de forma transacional e atômica um lote de aporte executado (Undo ACID).
 * Valida que nenhum ativo do lote teve movimentações posteriores, restaura a posição
 * (quantidade e preço médio) anterior, reverte o débito de Caixa e exclui as transações.
 */
export async function revertPortfolioBatchAporte(batchId: string): Promise<boolean> {
  return unwrapRpc(
    callRpc("revert_portfolio_batch_aporte", {
      p_batch_id: batchId,
    }),
  );
}

export interface DeletePortfolioTransactionAtomicParams {
  transactionId: string;
  newQuantity?: number | null;
  newAveragePrice?: number | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  reverseCash?: boolean;
  usdRate?: number;
}

/**
 * Exclui atomicamente uma transação da carteira, cascateia provento/aporte vinculado
 * e reconcilia quantidade/preço médio do ativo (RPC `delete_portfolio_transaction_atomic`).
 */
export async function deletePortfolioTransactionAtomic(
  params: DeletePortfolioTransactionAtomicParams,
): Promise<boolean> {
  return unwrapRpc(
    callRpc("delete_portfolio_transaction_atomic", {
      p_transaction_id: params.transactionId,
      p_reverse_cash: params.reverseCash ?? false,
      p_usd_rate: params.usdRate ?? 5.25,
      p_reconciled_quantity: params.newQuantity ?? null,
      p_reconciled_avg_price: params.newAveragePrice ?? null,
      p_reconciled_fi_metadata: params.fixedIncomeMetadata ?? null,
    }),
  );
}

/**
 * Consolida atômica e transacionalmente o fechamento mensal da carteira.
 * Persiste cotações em portfolio_monthly_prices e o snapshot consolidado em portfolio_snapshots.
 */
export async function commitMonthlyClosingRpc(
  payload: MonthlyClosingPayload,
): Promise<MonthlyClosingResult> {
  return unwrapRpc(
    callRpc("commit_monthly_closing_atomic", {
      p_month: payload.month,
      p_closing_date: payload.closing_date,
      p_prices: payload.prices,
      p_total_value: payload.total_value,
      p_total_cost: payload.total_cost,
    }),
  );
}

/**
 * Aprova múltiplos proventos de forma atômica no banco de dados.
 * Se sync_cash = true, realiza o UPSERT garantido no ativo CAIXA, criando-o caso inexista.
 */
export async function approveDividendsBatchRpc(
  payload: ApproveDividendsBatchPayload,
): Promise<ApproveDividendsBatchResult> {
  return unwrapRpc(
    callRpc("approve_dividends_batch_atomic", {
      p_dividends: payload.dividends,
      p_sync_cash: payload.sync_cash ?? false,
    }),
  );
}

/**
 * Confirma eventos de proventos (automatizados ou manuais) de forma atômica,
 * respeitando valores editados, IRRF/WHT e conversão USD -> BRL no Caixa.
 */
export async function confirmUserDividendEventsRpc(
  payload: ConfirmDividendEventsPayload,
): Promise<ConfirmDividendEventsResult> {
  return unwrapRpc(
    callRpc("confirm_user_dividend_events_atomic", {
      p_items: payload.items,
      p_sync_cash: payload.sync_cash ?? true,
    }),
  );
}

/**
 * Reverte atomicamente proventos confirmados (exclui `portfolio_dividends`, estorna crédito em Caixa
 * quando aplicável e restaura `user_dividend_events` / dispensas sem race conditions).
 */
export async function revertConfirmedDividendEventsRpc(payload: {
  dividendIds: string[];
  eventIds?: string[] | null;
  corporateIds?: string[] | null;
}): Promise<{
  success: boolean;
  deleted_dividends: number;
  reverted_events: number;
  reverted_cash_brl: number;
}> {
  return unwrapRpc(
    callRpc("revert_confirmed_dividend_events_atomic", {
      p_dividend_ids: payload.dividendIds,
      p_event_ids: payload.eventIds ?? null,
      p_corporate_ids: payload.corporateIds ?? null,
    }),
  );
}

/**
 * Dispensa ou descarta atomicamente um evento/sugestão de provento sem race conditions.
 */
export async function dismissUserDividendEventRpc(payload: {
  eventId?: string | null;
  corporateDividendId?: string | null;
  assetId?: string | null;
  reason?: string;
}): Promise<{
  success: boolean;
  event_id: string | null;
  corporate_dividend_id: string | null;
}> {
  return unwrapRpc(
    callRpc("dismiss_user_dividend_event_atomic", {
      p_event_id: payload.eventId ?? null,
      p_corporate_dividend_id: payload.corporateDividendId ?? null,
      p_asset_id: payload.assetId ?? null,
      p_reason: payload.reason ?? "manual_ignore",
    }),
  );
}

/**
 * Calibra atomicamente o piso global e os cortes individuais de proventos por lote,
 * saneando na mesma transação eventos abertos automáticos inelegíveis.
 */
export async function setDividendTrackingAtomicRpc(payload: {
  trackingStartDate?: string | null;
  assets?: SetDividendTrackingAssetItem[];
  expectedTrackingStartDate?: string | null;
}): Promise<SetDividendTrackingAtomicResult> {
  return unwrapRpc(
    callRpc("set_dividend_tracking_atomic", {
      p_tracking_start: payload.trackingStartDate ?? null,
      p_assets: payload.assets ?? [],
      p_expected_tracking_start: payload.expectedTrackingStartDate ?? null,
    }),
  );
}

/**
 * Registra atomicamente um aporte/depósito em uma meta via RPC allocate_goal_deposit (§Plano 12).
 */
export async function allocateGoalDeposit(input: {
  shareId: string;
  amountCents: number;
  contributorName?: string;
  sourceAccountId?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  share_id: string;
  new_current_cents: number;
  target_cents: number;
  is_completed: boolean;
}> {
  return unwrapRpc(
    callRpc("allocate_goal_deposit" as never, {
      p_share_id: input.shareId,
      p_amount_cents: input.amountCents,
      p_contributor_name: input.contributorName ?? "Você",
      p_source_account_id: input.sourceAccountId ?? null,
      p_notes: input.notes ?? null,
    } as never),
  );
}

/**
 * Calibra manualmente o snapshot de um mês fechado de forma não destrutiva via RPC.
 */
export async function calibratePortfolioSnapshotRpc(payload: {
  month: string;
  total_value: number;
  total_cost: number;
}): Promise<{ success: boolean; snapshot: PortfolioSnapshot }> {
  return unwrapRpc(
    callRpc("calibrate_portfolio_snapshot", {
      p_month: payload.month,
      p_total_value: payload.total_value,
      p_total_cost: payload.total_cost,
    }),
  );
}

/**
 * Restaura o snapshot de um mês ao valor original gravado no fechamento oficial de mercado via RPC.
 */
export async function resetManualSnapshotCalibrationRpc(payload: {
  month: string;
}): Promise<{ success: boolean; action?: string; snapshot?: PortfolioSnapshot; message?: string }> {
  return unwrapRpc(
    callRpc("reset_manual_snapshot_calibration", {
      p_month: payload.month,
    }),
  );
}

/**
 * Executa escrita transacional de provento manual (`create` / `update` / `delete`) via Edge Function
 * `quotes` (`action: 'write_user_dividend'`), com timeout cliente de 10s e guarda explícita offline (§4.3).
 */
export async function writeUserDividendEdge(
  command: WriteUserDividendCommand,
  timeoutMs = 10_000,
): Promise<WriteUserDividendResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AppError("network", "Sem conexão. Conecte-se para salvar.", null);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await getSupabase().functions.invoke<WriteUserDividendResult>("quotes", {
      body: { action: "write_user_dividend", command },
      signal: controller.signal,
    });
    if (error) {
      const classified = classifyError(error);
      throw new AppError(classified.kind, classified.message, error);
    }
    if (!data || !data.success) {
      throw new AppError("unknown", "Falha ao processar operação transacional de provento.", data);
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AppError(
        "network",
        "Tempo limite excedido (10s). Recarregue o extrato antes de tentar novamente.",
        err,
      );
    }
    const classified = classifyError(err);
    throw new AppError(classified.kind, classified.message, err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispara sincronização interativa de proventos do titular (`action: 'sync_user_dividends'`)
 * a partir do catálogo já persistido, respeitando cooldown de 60s e limite horário.
 */
export async function syncUserDividendsEdge(): Promise<SyncUserDividendsResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AppError("network", "Sem conexão. Conecte-se para salvar.", null);
  }
  const { data, error } = await getSupabase().functions.invoke<SyncUserDividendsResult>("quotes", {
    body: { action: "sync_user_dividends" },
  });
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (!data) {
    throw new AppError("unknown", "Resposta vazia ao sincronizar proventos.", null);
  }
  return data;
}

/**
 * Dispensa em lote eventos de provento com revisão otimista (tudo ou nada).
 */
export async function dismissUserDividendEventsAtomicRpc(payload: {
  ids: string[];
  revisions?: number[] | null;
  reason?: string;
}): Promise<{
  success: boolean;
  dismissed_ids: string[];
  revisions: number[];
}> {
  return unwrapRpc(
    callRpc("dismiss_user_dividend_events_atomic", {
      p_ids: payload.ids,
      p_revisions: payload.revisions ?? null,
      p_reason: payload.reason ?? "manual_ignore",
    }),
  );
}
