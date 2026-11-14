import { callRpc, unwrapRpc } from "./client";
import type {
  ApproveDividendsBatchPayload,
  ApproveDividendsBatchResult,
  MonthlyClosingPayload,
  MonthlyClosingResult,
  PortfolioSnapshot,
} from "@/types";

export interface AllocationTargetItem {
  assetId: string;
  /** 0–100. */
  target: number;
}

/**
 * Substitui o conjunto de metas por ativo em UMA transação (D1/§3.11.1).
 * Valida a soma final ≤ 100% após o lote — excedeu, nada é salvo.
 */
export async function setAllocationTargets(targets: AllocationTargetItem[]): Promise<void> {
  await unwrapRpc(
    callRpc("set_allocation_targets", {
      p_targets: targets.map((t) => ({ asset_id: t.assetId, target_percentage: t.target })),
    }),
    true,
  );
}

/** Upsert de meta de grupo (classe ou setor) — §3.11.1. */
export async function setGroupTarget(
  groupType: "class" | "sector",
  name: string,
  target: number,
): Promise<void> {
  await unwrapRpc(
    callRpc("set_group_target", {
      p_group_type: groupType,
      p_name: name,
      p_target: target,
    }),
    true,
  );
}

/** Remove uma meta de grupo (classe ou setor). */
export async function removeGroupTarget(groupType: "class" | "sector", name: string): Promise<void> {
  await unwrapRpc(
    callRpc("remove_group_target", {
      p_group_type: groupType,
      p_name: name,
    }),
    true,
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
  notes?: string | null;
}

/**
 * Executa aporte em lote de forma transacional e atômica (§F36).
 * Atualiza posições em `portfolio_assets`, insere compras em `portfolio_transactions`
 * e grava a contribuição em `portfolio_contributions`.
 */
export async function executePortfolioBatchAporte(params: ExecutePortfolioBatchAporteParams): Promise<boolean> {
  return unwrapRpc(
    callRpc("execute_portfolio_batch_aporte", {
      p_items: params.items,
      p_date: params.date,
      p_total_amount: params.totalAmount,
      p_notes: params.notes ?? null,
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
