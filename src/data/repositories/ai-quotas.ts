import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { AppError, classifyError } from "@/services/errors";
import {
  AI_QUOTA_LIMITS,
  evaluateAiQuotaAllowance,
  getBrtQuotaPeriods,
  PASSIVE_AI_DAILY_RESERVE,
  type UserAiQuotaRowSnapshot,
} from "../../../supabase/functions/_shared/ai-schemas";

export interface AiQuotaRemainingSummary {
  periodMonth: string;
  periodDay: string;
  batchDailyLimit: number;
  batchMonthlyLimit: number;
  batchUsedDay: number;
  batchUsedMonth: number;
  batchRemainingDay: number;
  batchRemainingMonth: number;
  receiptDailyLimit: number;
  receiptMonthlyLimit: number;
  receiptRemainingDay: number;
  receiptRemainingMonth: number;
  canRunPassiveCategorizeBatch: boolean;
  getAffordableBatchCalls: (requestedCount: number) => number;
}

/**
 * Calcula saldo restante de cotas de IA considerando reset diário BRT
 * (`period_day !== todayBrt`) e reserva do último crédito (`PASSIVE_AI_DAILY_RESERVE`)
 * para evitar que `categorize_batch` consuma a última extração disponível (D4 / D6).
 */
export function computeAiQuotaRemaining(
  row: UserAiQuotaRowSnapshot | null,
  now = new Date(),
): AiQuotaRemainingSummary {
  const { periodMonth, periodDay, nextDayResetAtIso, nextMonthResetAtIso } =
    getBrtQuotaPeriods(now);

  // Paridade total Trial = Pro (D6)
  const batchLimits = AI_QUOTA_LIMITS.pro.batch_calls;
  const receiptLimits = AI_QUOTA_LIMITS.pro.receipt_calls;

  const isSameDay = Boolean(row && row.period_day === periodDay);
  const batchUsedDay = row && isSameDay ? row.batch_calls_day : 0;
  const batchUsedMonth = row ? row.batch_calls_month : 0;
  const receiptUsedDay = row && isSameDay ? row.receipt_calls_day : 0;
  const receiptUsedMonth = row ? row.receipt_calls_month : 0;

  const batchRemainingDay = Math.max(0, batchLimits.day - batchUsedDay);
  const batchRemainingMonth = Math.max(0, batchLimits.month - batchUsedMonth);
  const receiptRemainingDay = Math.max(0, receiptLimits.day - receiptUsedDay);
  const receiptRemainingMonth = Math.max(0, receiptLimits.month - receiptUsedMonth);

  const passiveEval = evaluateAiQuotaAllowance({
    planGroup: "pro",
    bucket: "batch_calls",
    row,
    todayBrt: periodDay,
    nextDayResetAtIso,
    nextMonthResetAtIso,
    priority: "passive",
  });

  const canRunPassiveCategorizeBatch =
    passiveEval.allowed &&
    batchRemainingDay > PASSIVE_AI_DAILY_RESERVE &&
    batchRemainingMonth > PASSIVE_AI_DAILY_RESERVE;

  const maxBatchNow = Math.min(batchRemainingDay, batchRemainingMonth);

  return {
    periodMonth,
    periodDay,
    batchDailyLimit: batchLimits.day,
    batchMonthlyLimit: batchLimits.month,
    batchUsedDay,
    batchUsedMonth,
    batchRemainingDay,
    batchRemainingMonth,
    receiptDailyLimit: receiptLimits.day,
    receiptMonthlyLimit: receiptLimits.month,
    receiptRemainingDay,
    receiptRemainingMonth,
    canRunPassiveCategorizeBatch,
    getAffordableBatchCalls: (requestedCount: number) =>
      Math.max(0, Math.min(Math.max(0, requestedCount), maxBatchNow)),
  };
}

/**
 * Consulta leve da linha de cota mensal do usuário autenticado em `public.user_ai_quotas`
 * (RLS `SELECT` já liberado em `migration 0145`).
 */
export async function fetchMyAiQuotaForMonth(
  periodMonth?: string,
): Promise<UserAiQuotaRowSnapshot | null> {
  const resolvedMonth = periodMonth ?? getBrtQuotaPeriods().periodMonth;

  const { data, error } = await resolveQuery<UserAiQuotaRowSnapshot | null>(
    getSupabase()
      .from("user_ai_quotas")
      .select(
        "period_day, receipt_calls_month, receipt_calls_day, batch_calls_month, batch_calls_day",
      )
      .eq("period_month", resolvedMonth)
      .maybeSingle(),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  return data;
}
