import { useMemo } from "react";
import { resolveBillCompetence } from "@/domain/competence";
import { todayISO } from "@/domain/debts";
import { calculateCardSubscriptionImpact } from "@/domain/insights/card-radar";
import { partitionFeedback } from "@/domain/insights/feedback";
import { detectRecurrences, type ExpenseLike } from "@/domain/insights/recurrences";
import { currentMonth } from "@/lib/date";
import { useFeedback, useSetFeedback } from "@/state";
import type { Category, CreditCard, Expense } from "@/types";

export interface UseCardSubscriptionRadarOptions {
  selectedCard: CreditCard | null;
  allExpenses: readonly Expense[];
  categoryById: Map<string, Category>;
  currentInvoiceSaldoBrutoCents: number;
  isReadOnlyMode: boolean;
  onRequireUpgrade: (context: string) => void;
}

/** Calcula impacto de assinaturas previstas na fatura em aberto do cartão selecionado. */
export function useCardSubscriptionRadar({
  selectedCard,
  allExpenses,
  categoryById,
  currentInvoiceSaldoBrutoCents,
  isReadOnlyMode,
  onRequireUpgrade,
}: UseCardSubscriptionRadarOptions) {
  const feedbackQuery = useFeedback();
  const setFeedbackMutation = useSetFeedback();

  const cardSubscriptionImpact = useMemo(() => {
    if (!selectedCard) return null;

    const availableLimitCents =
      selectedCard.credit_limit !== null && selectedCard.credit_limit !== undefined && selectedCard.credit_limit > 0
        ? Math.max(0, Math.round(selectedCard.credit_limit * 100) - currentInvoiceSaldoBrutoCents)
        : null;

    const cardExpenseLikes: ExpenseLike[] = allExpenses
      .filter((e) => e.card_id === selectedCard.id)
      .map((e) => ({
        id: e.id,
        description: e.description,
        date: e.date,
        month: e.date ? e.date.slice(0, 7) : (e.bill_competence ?? currentMonth()),
        valueCents: Math.round(e.value * 100),
        categoryId: e.category_id,
        categoryName: categoryById.get(e.category_id)?.name ?? null,
        categoryIcon: categoryById.get(e.category_id)?.icon ?? null,
        installmentGroupId: e.installment_group_id,
        recurrenceId: e.recurrence_id,
        tripId: e.trip_id,
        paymentMethod: "credit_card",
        cardId: e.card_id,
        cardName: selectedCard.name,
        rawExpense: e,
      }));

    const todayISOStr = todayISO();
    const detected = detectRecurrences(cardExpenseLikes, {
      todayISO: todayISOStr,
      includeFormalRecurrences: true,
    });
    const { active } = partitionFeedback(detected, feedbackQuery.data ?? {});
    const openInvoiceCompetence = resolveBillCompetence(todayISOStr, selectedCard.closing_day);
    const openInvoiceExpenses = allExpenses.filter(
      (e) => e.card_id === selectedCard.id && e.bill_competence === openInvoiceCompetence,
    );

    return calculateCardSubscriptionImpact(selectedCard, active, {
      todayISO: todayISOStr,
      availableLimitCents,
      existingCardExpenses: openInvoiceExpenses.map((e) => ({
        description: e.description,
        installmentGroupId: e.installment_group_id,
      })),
    });
  }, [selectedCard, allExpenses, categoryById, currentInvoiceSaldoBrutoCents, feedbackQuery.data]);

  const ignoreSubscriptionItem = (key: string) => {
    if (isReadOnlyMode) {
      onRequireUpgrade("Gerenciar Radar de Assinaturas");
      return;
    }
    setFeedbackMutation.mutate({ occurrenceKey: key, decision: "ignore" });
  };

  return { cardSubscriptionImpact, ignoreSubscriptionItem };
}
