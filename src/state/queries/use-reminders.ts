import { useMemo } from "react";
import { buildCompetenceSummaries } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { applyReminderState, deriveReminderItems, sortReminders, type ReminderItem } from "@/domain/reminders";
import { formatCentsAsBRL } from "@/services/masks";
import { useCreditCards } from "@/state/queries/use-credit-cards";
import { useAllCardExpenses, useAllCardPayments } from "@/state/queries/use-overview";
import { useDebts } from "@/state/queries/use-debts";
import { useReminderStates } from "@/state/queries/use-reminder-states";
import { useUserPreferences } from "@/state/queries/use-user-preferences";

export interface RemindersData {
  items: ReminderItem[];
  allItems: ReminderItem[];
  totalCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
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
  const statesQuery = useReminderStates();
  const prefsQuery = useUserPreferences();

  const isLoading =
    cardsQuery.isLoading ||
    cardExpensesQuery.isLoading ||
    cardPaymentsQuery.isLoading ||
    debtsQuery.isLoading ||
    statesQuery.isLoading ||
    prefsQuery.isLoading;

  const error = (cardsQuery.error ??
    cardExpensesQuery.error ??
    cardPaymentsQuery.error ??
    debtsQuery.error ??
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

  const { allItems, items, readCount } = useMemo(() => {
    if (!preferences.enabled) {
      return { allItems: [], items: [], readCount: 0 };
    }

    const cards = cardsQuery.data ?? [];
    const allExpenses = cardExpensesQuery.data ?? [];
    const allPayments = cardPaymentsQuery.data ?? [];
    const allDebts = debtsQuery.data ?? [];
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
            title: `Fatura ${card.name} · ${summary.month}`,
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
        dueDate: d.due_date,
        amountCents: Math.round(d.amount * 100),
        paidAt: null,
        link: { path: "/dividas", params: { q: d.id } },
      }));

    const derived = deriveReminderItems({ bills, debts, preferences, today });
    const unread = sortReminders(applyReminderState(derived, states, today));
    const stateMap = new Map(states.map((s) => [s.key, s.kind]));
    const read = derived.filter((item) => stateMap.get(item.key) === "read").length;

    return { allItems: derived, items: unread, readCount: read };
  }, [
    preferences,
    cardsQuery.data,
    cardExpensesQuery.data,
    cardPaymentsQuery.data,
    debtsQuery.data,
    statesQuery.data,
    today,
  ]);

  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const dueTodayCount = items.filter((i) => i.status === "due_today").length;
  const dueSoonCount = items.filter((i) => i.status === "due_soon").length;
  const urgentCount = overdueCount + dueTodayCount;

  return {
    items,
    allItems,
    totalCount: items.length,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
    urgentCount,
    readCount,
    preferences,
    isLoading,
    error,
  };
}
