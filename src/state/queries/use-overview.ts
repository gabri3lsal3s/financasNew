import { useQuery } from "@tanstack/react-query";
import { listAllCardExpenses } from "@/data/repositories/expenses";
import { listAllCardPayments } from "@/data/repositories/card-payments";
import { cardExpensesKey, cardPaymentsKey } from "@/state/queries/use-card-payments";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedAllCardExpenses, useSimulatedAllCardPayments } from "./use-simulated-queries";

/** Todas as despesas de cartão (faturas em aberto — visão consolidada). */
export function useAllCardExpenses() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllCardExpenses();
  const real = useQuery({
    queryKey: [...cardExpensesKey],
    queryFn: () => listAllCardExpenses(),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Todos os pagamentos/estornos de cartão (faturas em aberto). */
export function useAllCardPayments() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllCardPayments();
  const real = useQuery({
    queryKey: [...cardPaymentsKey],
    queryFn: () => listAllCardPayments(),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}
