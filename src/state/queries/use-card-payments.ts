import { useQuery } from "@tanstack/react-query";
import { listCardPayments } from "@/data/repositories/card-payments";
import { listExpensesByCard } from "@/data/repositories/expenses";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

export const cardPaymentsKey = ["card_payments"] as const;
export const cardExpensesKey = ["card_expenses"] as const;

/** Pagamentos e estornos de um cartão (todas as competências). */
export function useCardPayments(cardId: string | null) {
  return useQuery({
    queryKey: [...cardPaymentsKey, cardId],
    queryFn: () => listCardPayments(cardId as string),
    enabled: cardId !== null,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Despesas de um cartão (todas as competências — derivação da fatura). */
export function useCardExpenses(cardId: string | null) {
  return useQuery({
    queryKey: [...cardExpensesKey, cardId],
    queryFn: () => listExpensesByCard(cardId as string),
    enabled: cardId !== null,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}
