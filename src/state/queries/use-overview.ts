import { useQuery } from "@tanstack/react-query";
import { listAllCardBillRollovers } from "@/data/repositories/card-bill-rollovers";
import { listAllCardExpenses } from "@/data/repositories/expenses";
import { listAllCardPayments } from "@/data/repositories/card-payments";
import { cardBillRolloversKey, cardExpensesKey, cardPaymentsKey } from "@/state/queries/use-card-payments";
import { STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import {
  useSimulatedAllCardBillRollovers,
  useSimulatedAllCardExpenses,
  useSimulatedAllCardPayments,
} from "./use-simulated-queries";

export interface UseAllCardQueryOptions {
  /**
   * Mês inicial (YYYY-MM) para corte temporal.
   * Se omitido, adota o padrão de 24 meses retroativos do repositório.
   * Se for null, realiza busca irrestrita em todo o histórico.
   */
  sinceMonth?: string | null;
  enabled?: boolean;
}

/** Todas as despesas de cartão (faturas na visão consolidada com janela de 24 meses ou customizada). */
export function useAllCardExpenses(options?: UseAllCardQueryOptions) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllCardExpenses();
  const real = useQuery({
    queryKey:
      options?.sinceMonth !== undefined
        ? [...cardExpensesKey, options.sinceMonth]
        : [...cardExpensesKey],
    queryFn: () =>
      options?.sinceMonth !== undefined
        ? listAllCardExpenses({ sinceMonth: options.sinceMonth })
        : listAllCardExpenses(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Todos os pagamentos/estornos de cartão (faturas na visão consolidada com janela de 24 meses ou customizada). */
export function useAllCardPayments(options?: UseAllCardQueryOptions) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllCardPayments();
  const real = useQuery({
    queryKey:
      options?.sinceMonth !== undefined
        ? [...cardPaymentsKey, options.sinceMonth]
        : [...cardPaymentsKey],
    queryFn: () =>
      options?.sinceMonth !== undefined
        ? listAllCardPayments({ sinceMonth: options.sinceMonth })
        : listAllCardPayments(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}

/** Todas as rolagens/parcelamentos de fatura do usuário (visão consolidada com janela de 24 meses ou customizada). */
export function useAllCardBillRollovers(options?: UseAllCardQueryOptions) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedAllCardBillRollovers();
  const real = useQuery({
    queryKey:
      options?.sinceMonth !== undefined
        ? [...cardBillRolloversKey, options.sinceMonth]
        : [...cardBillRolloversKey],
    queryFn: () =>
      options?.sinceMonth !== undefined
        ? listAllCardBillRollovers({ sinceMonth: options.sinceMonth })
        : listAllCardBillRollovers(),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.analytical,
  });

  return isDemoActive ? simulated : real;
}
