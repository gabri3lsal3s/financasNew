import { useQuery } from "@tanstack/react-query";
import { listAllCardExpenses } from "@/data/repositories/expenses";
import { listAllCardPayments } from "@/data/repositories/card-payments";
import { cardExpensesKey, cardPaymentsKey } from "@/state/queries/use-card-payments";

/** Todas as despesas de cartão (faturas em aberto — visão consolidada). */
export function useAllCardExpenses() {
  return useQuery({
    queryKey: [...cardExpensesKey],
    queryFn: () => listAllCardExpenses(),
    staleTime: 60_000,
  });
}

/** Todos os pagamentos/estornos de cartão (faturas em aberto). */
export function useAllCardPayments() {
  return useQuery({
    queryKey: [...cardPaymentsKey],
    queryFn: () => listAllCardPayments(),
    staleTime: 60_000,
  });
}
