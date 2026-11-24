/**
 * Motor puro de rateio de Cartão Misto e controle anti-duplicidade de reembolso PJ para PF (Fase 2B).
 */

import { sumWeightedCents } from "@/domain/money";
import type { TransactionScope } from "@/types";

export interface MixedCardExpenseInput {
  value: number;
  card_id?: string | null;
  bill_competence?: string | null;
  scope?: TransactionScope | null;
  is_internal_transfer?: boolean | null;
}

export interface MixedCardIncomeInput {
  value: number;
  source_ref?: string | null;
}

export interface MixedCardSplitResult {
  cardId: string;
  competenceMonth: string;
  sourceRefKey: string;
  personalCents: number;
  businessCents: number;
  totalCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  isFullyReimbursed: boolean;
}

export function buildCardReimbursementSourceRef(
  cardId: string,
  competenceMonth: string,
): string {
  return `[REIMBURSEMENT]${cardId}:${competenceMonth}`;
}

export function calculateMixedCardSplit(params: {
  cardId: string;
  competenceMonth: string;
  expenses: readonly MixedCardExpenseInput[];
  incomes: readonly MixedCardIncomeInput[];
}): MixedCardSplitResult {
  const sourceRefKey = buildCardReimbursementSourceRef(params.cardId, params.competenceMonth);

  const cardMonthExpenses = params.expenses.filter(
    (e) =>
      e.card_id === params.cardId &&
      e.bill_competence === params.competenceMonth &&
      !e.is_internal_transfer,
  );

  const personalCents = sumWeightedCents(
    cardMonthExpenses
      .filter((e) => (e.scope ?? "personal") === "personal")
      .map((e) => ({ value: e.value, report_weight: 1 })),
  );

  const businessCents = sumWeightedCents(
    cardMonthExpenses
      .filter((e) => (e.scope ?? "personal") === "business")
      .map((e) => ({ value: e.value, report_weight: 1 })),
  );

  const reimbursedCents = sumWeightedCents(
    params.incomes
      .filter((i) => i.source_ref === sourceRefKey)
      .map((i) => ({ value: i.value, report_weight: 1 })),
  );

  const pendingReimbursementCents = Math.max(0, businessCents - reimbursedCents);

  return {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    sourceRefKey,
    personalCents,
    businessCents,
    totalCents: personalCents + businessCents,
    reimbursedCents,
    pendingReimbursementCents,
    isFullyReimbursed: businessCents > 0 && pendingReimbursementCents === 0,
  };
}
