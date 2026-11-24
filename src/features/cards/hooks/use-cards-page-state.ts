import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { calculateMixedCardSplit, filterCardsByViewScope } from "@/domain/business";
import {
  autoSelectBillMonth,
  buildCompetenceSummaries,
  invoiceStatus,
  partitionInvoiceExpenses,
  sortCardsByPreference,
} from "@/domain/cards";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useSafeBusinessMode, useSafeIncomes, useSafeViewScope } from "@/hooks/use-safe-business-scope";
import { currentMonth } from "@/lib/date";
import {
  useAllCardExpenses,
  useAllCardPayments,
  useCardExpenses,
  useCardPayments,
  useCategories,
  useCreditCards,
  usePermission,
  useUserPreferences,
} from "@/state";
import {
  buildInvoiceExpenseRows,
  buildPrintPaymentRows,
  buildUsedLimitMap,
  selectPriorityCardAndMonth,
} from "./cards-page-selectors";
import { useCardSubscriptionRadar } from "./use-card-subscription-radar";
import { useCardsActions } from "./use-cards-actions";

export type { CardPaymentDialogMode } from "./use-cards-actions";

/** Orquestra queries, derivação de competência e ações da página de Cartões. */
export function useCardsPageState() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("cards");
  const aiPermission = usePermission("ai_extraction");

  const cardsQuery = useCreditCards();
  const allCardExpensesQuery = useAllCardExpenses();
  const allCardPaymentsQuery = useAllCardPayments();
  const userPreferencesQuery = useUserPreferences();

  const primaryCardId = userPreferencesQuery.data?.custom_settings?.primaryCardId ?? null;
  const cardOrder = useMemo(
    () => userPreferencesQuery.data?.custom_settings?.cardOrder ?? [],
    [userPreferencesQuery.data?.custom_settings?.cardOrder],
  );

  const { isBusinessModeEnabled } = useSafeBusinessMode();
  const { effectiveViewScope } = useSafeViewScope();
  const cards = useMemo(
    () =>
      sortCardsByPreference(filterCardsByViewScope(cardsQuery.data ?? [], effectiveViewScope), {
        primaryCardId,
        cardOrder,
      }),
    [cardsQuery.data, effectiveViewScope, primaryCardId, cardOrder],
  );

  const { isHighlighted } = useHighlightTarget("q");
  const paramCard = searchParams.get("card");
  const paramMonth = searchParams.get("month");

  const allExpenses = useMemo(() => allCardExpensesQuery.data ?? [], [allCardExpensesQuery.data]);
  const allPayments = useMemo(() => allCardPaymentsQuery.data ?? [], [allCardPaymentsQuery.data]);

  const prioritySelection = useMemo(
    () => selectPriorityCardAndMonth(cards, allExpenses, allPayments, primaryCardId),
    [cards, allExpenses, allPayments, primaryCardId],
  );

  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const selectedCardId = paramCard ?? pickedCardId ?? prioritySelection.cardId;
  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? (selectedCardId ? undefined : cards[0]) ?? null;

  const [month, setMonth] = useState<string | null>(null);
  const cardId = selectedCard?.id ?? null;
  const expensesQuery = useCardExpenses(cardId);
  const paymentsQuery = useCardPayments(cardId);
  const categoriesQuery = useCategories("expense");

  const loading = cardsQuery.isLoading || (cardId !== null && (expensesQuery.isLoading || paymentsQuery.isLoading));
  const queryError = cardsQuery.error ?? expensesQuery.error ?? paymentsQuery.error ?? categoriesQuery.error;

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c])),
    [categoriesQuery.data],
  );

  const summaries = useMemo(
    () => buildCompetenceSummaries(expensesQuery.data ?? [], paymentsQuery.data ?? []),
    [expensesQuery.data, paymentsQuery.data],
  );
  const effectiveMonth =
    paramMonth ??
    month ??
    (pickedCardId === null && !paramCard && prioritySelection.month ? prioritySelection.month : null) ??
    (summaries.length > 0 ? autoSelectBillMonth(summaries) : currentMonth());
  const summary = summaries.find((s) => s.month === effectiveMonth);

  const previousUnpaidSummaries = useMemo(
    () => summaries.filter((s) => s.month < effectiveMonth && s.saldoCents > 0),
    [summaries, effectiveMonth],
  );

  const competenceExpenses = useMemo(
    () => (expensesQuery.data ?? []).filter((e) => e.bill_competence === effectiveMonth),
    [expensesQuery.data, effectiveMonth],
  );
  const competencePayments = useMemo(
    () => (paymentsQuery.data ?? []).filter((p) => p.competence_month === effectiveMonth),
    [paymentsQuery.data, effectiveMonth],
  );
  const incomesQuery = useSafeIncomes(effectiveMonth, {
    enabled: isBusinessModeEnabled && Boolean(cardId),
  });
  const mixedCardSplit = useMemo(() => {
    if (!isBusinessModeEnabled || !selectedCard || selectedCard.scope === "business") return null;
    return calculateMixedCardSplit({
      cardId: selectedCard.id,
      competenceMonth: effectiveMonth,
      expenses: competenceExpenses,
      incomes: incomesQuery.data ?? [],
    });
  }, [isBusinessModeEnabled, selectedCard, effectiveMonth, competenceExpenses, incomesQuery.data]);

  const { installments, regular, charges } = useMemo(
    () => partitionInvoiceExpenses(competenceExpenses),
    [competenceExpenses],
  );
  const consumptionExpenses = useMemo(
    () => [...installments, ...regular],
    [installments, regular],
  );

  const usedLimitMap = useMemo(
    () => buildUsedLimitMap(cards, allExpenses, allPayments, effectiveMonth),
    [cards, allExpenses, allPayments, effectiveMonth],
  );

  const actions = useCardsActions({
    isReadOnlyMode: permission.isReadOnlyMode,
    onRefetchAll: () => {
      void Promise.all([cardsQuery.refetch(), expensesQuery.refetch(), paymentsQuery.refetch()]);
    },
  });

  const { cardSubscriptionImpact, ignoreSubscriptionItem } = useCardSubscriptionRadar({
    selectedCard,
    allExpenses,
    categoryById,
    currentInvoiceSaldoBrutoCents: summary?.saldoBrutoCents ?? 0,
    isReadOnlyMode: permission.isReadOnlyMode,
    onRequireUpgrade: actions.requireUpgrade,
  });

  const selectCard = (id: string) => {
    actions.setActionError(null);
    setPickedCardId(id);
    setMonth(null);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("card");
        return updated;
      },
      { replace: true },
    );
  };

  const getMonthStatus = (targetMonth: string) => {
    if (!selectedCard) return "closed";
    const sum = summaries.find((s) => s.month === targetMonth);
    return invoiceStatus(targetMonth, selectedCard.due_day, sum?.saldoCents ?? 0);
  };

  const handleFormOpenChange = (next: boolean) => {
    if (!next) {
      actions.setFormOpen(false);
      actions.setEditingCard(null);
      if (actions.fromUrl) {
        setSearchParams(
          (prev) => {
            const updated = new URLSearchParams(prev);
            updated.delete("novo");
            return updated;
          },
          { replace: true },
        );
      }
    } else {
      actions.setFormOpen(true);
    }
  };

  const handleCardDeleted = (deletedId: string) => {
    const remaining = cards.filter((c) => c.id !== deletedId);
    if (selectedCard?.id === deletedId) {
      if (remaining.length > 0 && remaining[0]) {
        selectCard(remaining[0].id);
      } else {
        setPickedCardId(null);
      }
    }
  };

  return {
    navigate,
    permission,
    aiPermission,
    cards,
    primaryCardId,
    selectedCard,
    cardId,
    loading,
    queryError,
    isHighlighted,
    effectiveMonth,
    setMonth,
    summary,
    previousUnpaidSummaries,
    competenceExpenses,
    consumptionExpenses,
    competencePayments,
    installments,
    regular,
    charges,
    usedLimitMap,
    categoryById,
    invStatus: getMonthStatus(effectiveMonth),
    getMonthStatus,
    cardSubscriptionImpact,
    ignoreSubscriptionItem,
    selectCard,
    handleFormOpenChange,
    handleCardDeleted,
    printExpenseRows: buildInvoiceExpenseRows(consumptionExpenses, categoryById),
    printChargeRows: buildInvoiceExpenseRows(charges, categoryById),
    printPaymentRows: buildPrintPaymentRows(competencePayments),
    mixedCardSplit,
    ...actions,
  };
}
