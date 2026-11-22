import { useMemo } from "react";
import { buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { formatCompetenceMonthPtBr } from "@/domain/notifications/hub";
import {
  applyReminderState,
  deriveReminderItems,
  isDebtLinkedToSplit,
  sortReminders,
  type ReminderItem,
} from "@/domain/reminders";
import { formatCentsAsBRL } from "@/services/masks";
import { useCreditCards } from "@/state/queries/use-credit-cards";
import { useAllCardExpenses, useAllCardPayments } from "@/state/queries/use-overview";
import { useDebts } from "@/state/queries/use-debts";
import { useMyPublicShares } from "@/state/queries/use-public-shares";
import { useReminderStates } from "@/state/queries/use-reminder-states";
import { useUserPreferences } from "@/state/queries/use-user-preferences";

export interface RemindersData {
  items: ReminderItem[];
  allItems: ReminderItem[];
  payableItems: ReminderItem[];
  scheduledPayableItems: ReminderItem[];
  receivableItems: ReminderItem[];
  readHistoryItems: ReminderItem[];
  totalCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  receivableCount: number;
  urgentCount: number;
  readCount: number;
  preferences: {
    enabled: boolean;
    debtDaysBefore: number;
    billDaysBefore: number;
  };
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook unificado de lembretes (§3.10) — consolida faturas e dívidas ativas,
 * respeitando o estado salvo do usuário (`reminder_states`) e suas preferências
 * persistidas (`user_preferences`).
 */
export function useReminders(today: string = todayISO()): RemindersData {
  const cardsQuery = useCreditCards();
  const cardExpensesQuery = useAllCardExpenses();
  const cardPaymentsQuery = useAllCardPayments();
  const debtsQuery = useDebts();
  const splitSharesQuery = useMyPublicShares("split");
  const statesQuery = useReminderStates();
  const prefsQuery = useUserPreferences();

  const isLoading =
    cardsQuery.isLoading ||
    cardExpensesQuery.isLoading ||
    cardPaymentsQuery.isLoading ||
    debtsQuery.isLoading ||
    splitSharesQuery.isLoading ||
    statesQuery.isLoading ||
    prefsQuery.isLoading;

  const error = (cardsQuery.error ??
    cardExpensesQuery.error ??
    cardPaymentsQuery.error ??
    debtsQuery.error ??
    splitSharesQuery.error ??
    statesQuery.error ??
    prefsQuery.error) as Error | null;

  const preferences = useMemo(() => {
    const data = prefsQuery.data;
    return {
      enabled: data?.reminders_enabled ?? true,
      debtDaysBefore: data?.reminder_days_before_debt ?? 3,
      billDaysBefore: data?.reminder_days_before_bill ?? 3,
    };
  }, [prefsQuery.data]);

  const { allItems, items, scheduledPayableItems, readHistoryItems, readCount } = useMemo(() => {
    if (!preferences.enabled) {
      return {
        allItems: [],
        items: [],
        scheduledPayableItems: [],
        readHistoryItems: [],
        readCount: 0,
      };
    }

    // Salvaguarda estrita: nunca deriva lembretes enquanto as queries essenciais
    // estiverem carregando ou com dados parciais (ex.: despesas prontas mas pagamentos
    // ainda não carregados transformariam faturas pagas em faturas vencidas falsas).
    if (
      cardsQuery.isLoading ||
      cardExpensesQuery.isLoading ||
      cardPaymentsQuery.isLoading ||
      debtsQuery.isLoading ||
      splitSharesQuery.isLoading ||
      statesQuery.isLoading ||
      prefsQuery.isLoading ||
      !cardsQuery.data ||
      !cardExpensesQuery.data ||
      !cardPaymentsQuery.data ||
      !debtsQuery.data
    ) {
      return {
        allItems: [],
        items: [],
        scheduledPayableItems: [],
        readHistoryItems: [],
        readCount: 0,
      };
    }

    const cards = cardsQuery.data;
    const allExpenses = cardExpensesQuery.data;
    const allPayments = cardPaymentsQuery.data;
    const allDebts = debtsQuery.data;
    const splitShares = splitSharesQuery.data ?? [];
    const states = statesQuery.data ?? [];

    const bills = cards
      .filter((card) => card.is_active)
      .flatMap((card) => {
        const expenses = allExpenses.filter((e) => e.card_id === card.id);
        const payments = allPayments.filter((p) => p.card_id === card.id);
        return buildCompetenceSummaries(expenses, payments)
          .filter((summary) => summary.saldoCents > 0)
          .map((summary) => ({
            key: `bill:${card.id}:${summary.month}`,
            title: `Fatura ${card.name} · ${formatCompetenceMonthPtBr(summary.month)}`,
            subtitle: `Saldo de ${formatCentsAsBRL(summary.saldoCents)}`,
            competenceMonth: summary.month,
            dueDay: card.due_day,
            balanceCents: summary.saldoCents,
            link: { path: "/cartoes", params: { card: card.id, month: summary.month } },
          }));
      });

    const debts = allDebts
      .filter((d) => d.paid_at === null)
      .map((d) => ({
        key: `debt:${d.id}`,
        title: d.name,
        subtitle: d.type === "payable" ? "A pagar" : "A receber",
        direction: d.type,
        isSplitLinked: isDebtLinkedToSplit(d, splitShares, allDebts),
        dueDate: d.due_date,
        amountCents: Math.round(d.amount * 100),
        paidAt: null,
        link: { path: "/dividas", params: { q: d.id } },
      }));

    const derived = deriveReminderItems({ bills, debts, preferences, today });
    const unread = sortReminders(applyReminderState(derived, states, today));
    const derivedFor7dSchedule = deriveReminderItems({
      bills,
      debts,
      preferences: {
        enabled: true,
        billDaysBefore: Math.max(preferences.billDaysBefore, 7),
        debtDaysBefore: Math.max(preferences.debtDaysBefore, 7),
      },
      today,
    });
    const scheduledPayableItems = sortReminders(
      applyReminderState(derivedFor7dSchedule, states, today),
    ).filter((i) => (i.direction ?? "payable") === "payable");
    const stateMap = new Map(states.map((s) => [s.key, s.kind]));
    const activeRead = derived.filter((item) => stateMap.get(item.key) === "read");

    // Reconstitui itens marcados como lidos que não estão mais na lista ativa (ex.: faturas quitadas ou datas passadas)
    const activeKeys = new Set(derived.map((d) => d.key));
    const historicalRead: ReminderItem[] = [];

    for (const state of states) {
      if (state.kind !== "read" || activeKeys.has(state.key)) continue;

      if (state.key.startsWith("bill:")) {
        const parts = state.key.split(":");
        const cardId = parts[1];
        const month = parts[2];
        if (!cardId || !month) continue;

        const card = cards.find((c) => c.id === cardId);
        if (!card) continue;

        const expenses = allExpenses.filter((e) => e.card_id === card.id);
        const payments = allPayments.filter((p) => p.card_id === card.id);
        const summary = buildCompetenceSummaries(expenses, payments).find((s) => s.month === month);

        const dueDate = invoiceDueDate(month, card.due_day);
        const balanceCents = summary?.saldoCents ?? 0;
        const amountCents = balanceCents > 0 ? balanceCents : (summary?.previstoCents ?? 0);

        historicalRead.push({
          key: state.key,
          kind: "bill",
          direction: "payable",
          title: `Fatura ${card.name} · ${formatCompetenceMonthPtBr(month)}`,
          subtitle: balanceCents === 0 ? "Fatura quitada" : `Saldo de ${formatCentsAsBRL(balanceCents)}`,
          dueDate,
          amountCents,
          status: balanceCents === 0 ? "pending" : dueDate < today ? "overdue" : "due_soon",
          link: { path: "/cartoes", params: { card: card.id, month } },
        });
      } else if (state.key.startsWith("debt:")) {
        const debtId = state.key.replace(/^debt:/, "");
        const debt = allDebts.find((d) => d.id === debtId);
        if (!debt) continue;
        if (isDebtLinkedToSplit(debt, splitShares, allDebts)) continue;

        historicalRead.push({
          key: state.key,
          kind: "debt",
          direction: debt.type,
          title: debt.name,
          subtitle: debt.paid_at ? "Dívida quitada" : debt.type === "payable" ? "A pagar" : "A receber",
          dueDate: debt.due_date,
          amountCents: Math.round(debt.amount * 100),
          status:
            debt.paid_at || debt.type === "receivable"
              ? "pending"
              : debt.due_date < today
                ? "overdue"
                : debt.due_date === today
                  ? "due_today"
                  : "due_soon",
          link: { path: "/dividas", params: { q: debt.id } },
        });
      }
    }

    const readHistoryItems = [...activeRead, ...historicalRead].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    const read = readHistoryItems.length;

    return {
      allItems: derived,
      items: unread,
      scheduledPayableItems,
      readHistoryItems,
      readCount: read,
    };
  }, [
    preferences,
    cardsQuery.isLoading,
    cardExpensesQuery.isLoading,
    cardPaymentsQuery.isLoading,
    debtsQuery.isLoading,
    splitSharesQuery.isLoading,
    statesQuery.isLoading,
    prefsQuery.isLoading,
    cardsQuery.data,
    cardExpensesQuery.data,
    cardPaymentsQuery.data,
    debtsQuery.data,
    splitSharesQuery.data,
    statesQuery.data,
    today,
  ]);

  const payableItems = useMemo(
    () => items.filter((i) => (i.direction ?? "payable") === "payable"),
    [items],
  );
  const receivableItems = useMemo(
    () => items.filter((i) => i.direction === "receivable"),
    [items],
  );

  const overdueCount = payableItems.filter((i) => i.status === "overdue").length;
  const dueTodayCount = payableItems.filter((i) => i.status === "due_today").length;
  const dueSoonCount = payableItems.filter((i) => i.status === "due_soon").length;
  const receivableCount = receivableItems.length;
  const urgentCount = overdueCount + dueTodayCount;

  return {
    items,
    allItems,
    payableItems,
    scheduledPayableItems,
    receivableItems,
    readHistoryItems,
    totalCount: items.length,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
    receivableCount,
    urgentCount,
    readCount,
    preferences,
    isLoading,
    error,
  };
}
