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
