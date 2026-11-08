import { useMemo } from "react";
import { auditSubscriptions, type SubscriptionsAuditResult } from "@/domain/subscriptions";
import { currentMonth, shiftMonth } from "@/lib/date";
import { numberToCents } from "@/domain/money";
import { useExpensesByRange } from "./use-expenses";

export function useSubscriptionsAudit(options?: { monthsLookback?: number }) {
  const lookback = options?.monthsLookback ?? 6;
  const curr = currentMonth();
  const start = `${shiftMonth(curr, -lookback)}-01`;
  const end = `${shiftMonth(curr, 1)}-01`;

  const expensesQuery = useExpensesByRange(start, end);

  const auditResult: SubscriptionsAuditResult = useMemo(() => {
    const rawExpenses = expensesQuery.data ?? [];
    const formatted = rawExpenses.map((exp) => ({
      id: exp.id,
      description: exp.description || "Despesa",
      amountCents: numberToCents(exp.value),
      date: exp.date,
      installments_total: exp.installments_total,
      categoryName: exp.category_id,
      paymentMethod: exp.payment_method,
      creditCardId: exp.card_id ?? undefined,
    }));

    return auditSubscriptions(formatted);
  }, [expensesQuery.data]);

  return {
    ...auditResult,
    isLoading: expensesQuery.isLoading,
    isError: expensesQuery.isError,
    error: expensesQuery.error,
    refetch: expensesQuery.refetch,
  };
}
