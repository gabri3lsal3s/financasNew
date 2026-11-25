import { describe, expect, it } from "vitest";
import { computeAiQuotaRemaining } from "./ai-quotas";
import {
  AI_QUOTA_LIMITS,
  PASSIVE_AI_DAILY_RESERVE,
} from "../../../supabase/functions/_shared/ai-schemas";

describe("computeAiQuotaRemaining (Onda 1 — Paridade Trial=Pro e Reserva do Último Crédito)", () => {
  const refNow = new Date("2026-11-23T18:00:00Z"); // 15:00 BRT -> 2026-11-23

  it("assume limites plenos Trial = Pro (30/dia · 120/mês batch; 15/dia · 100/mês recibos) sem histórico prévio", () => {
    const summary = computeAiQuotaRemaining(null, refNow);

    expect(summary.batchDailyLimit).toBe(AI_QUOTA_LIMITS.pro.batch_calls.day);
    expect(summary.batchMonthlyLimit).toBe(AI_QUOTA_LIMITS.pro.batch_calls.month);
    expect(summary.batchDailyLimit).toBe(30);
    expect(summary.batchMonthlyLimit).toBe(120);
    expect(summary.receiptDailyLimit).toBe(15);
    expect(summary.receiptMonthlyLimit).toBe(100);
    expect(summary.batchRemainingDay).toBe(30);
    expect(summary.batchRemainingMonth).toBe(120);
    expect(summary.canRunPassiveCategorizeBatch).toBe(true);
    expect(summary.getAffordableBatchCalls(3)).toBe(3);
  });

  it("reseta contadores diários quando period_day é anterior a hoje BRT", () => {
    const summary = computeAiQuotaRemaining(
      {
        period_day: "2026-11-22",
        batch_calls_day: 30,
        batch_calls_month: 50,
        receipt_calls_day: 15,
        receipt_calls_month: 20,
      },
      refNow,
    );

    expect(summary.batchUsedDay).toBe(0);
    expect(summary.batchRemainingDay).toBe(30);
    expect(summary.batchRemainingMonth).toBe(70);
    expect(summary.receiptRemainingDay).toBe(15);
    expect(summary.receiptRemainingMonth).toBe(80);
    expect(summary.canRunPassiveCategorizeBatch).toBe(true);
  });

  it("bloqueia chamada passiva (categorize_batch) quando resta <= PASSIVE_AI_DAILY_RESERVE crédito diário OU mensal", () => {
    const lowDay = computeAiQuotaRemaining(
      {
        period_day: "2026-11-23",
        batch_calls_day: 30 - PASSIVE_AI_DAILY_RESERVE,
        batch_calls_month: 40,
        receipt_calls_day: 0,
        receipt_calls_month: 0,
      },
      refNow,
    );
    expect(lowDay.batchRemainingDay).toBe(1);
    expect(lowDay.canRunPassiveCategorizeBatch).toBe(false);
    expect(lowDay.getAffordableBatchCalls(3)).toBe(1);

    const lowMonth = computeAiQuotaRemaining(
      {
        period_day: "2026-11-23",
        batch_calls_day: 2,
        batch_calls_month: 120 - PASSIVE_AI_DAILY_RESERVE,
        receipt_calls_day: 0,
        receipt_calls_month: 0,
      },
      refNow,
    );
    expect(lowMonth.batchRemainingMonth).toBe(1);
    expect(lowMonth.canRunPassiveCategorizeBatch).toBe(false);
    expect(lowMonth.getAffordableBatchCalls(3)).toBe(1);
  });
});
