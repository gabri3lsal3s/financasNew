import { useQuery } from "@tanstack/react-query";
import { listCardPayments } from "@/data/repositories/card-payments";
import { listExpensesByCard } from "@/data/repositories/expenses";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedCardExpenses, useSimulatedCardPayments } from "./use-simulated-queries";

export const cardPaymentsKey = ["card_payments"] as const;
export const cardExpensesKey = ["card_expenses"] as const;

export interface UseCardQueryOptions {
  /**
   * Mês inicial (YYYY-MM) para corte temporal.
   * Se omitido, adota o padrão de 24 meses retroativos do repositório.
   * Se for null, realiza busca irrestrita em todo o histórico.
   */
  sinceMonth?: string | null;
  enabled?: boolean;
}

/** Pagamentos e estornos de um cartão (todas as competências com janela de 24 meses ou customizada). */
export function useCardPayments(cardId: string | null, options?: UseCardQueryOptions) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCardPayments(cardId);
  const real = useQuery({
    queryKey:
      options?.sinceMonth !== undefined
        ? [...cardPaymentsKey, cardId, options.sinceMonth]
        : [...cardPaymentsKey, cardId],
    queryFn: () =>
      options?.sinceMonth !== undefined
        ? listCardPayments(cardId as string, { sinceMonth: options.sinceMonth })
        : listCardPayments(cardId as string),
    enabled: (options?.enabled ?? true) && cardId !== null && !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Despesas de um cartão (todas as competências com janela de 24 meses ou customizada — derivação da fatura). */
export function useCardExpenses(cardId: string | null, options?: UseCardQueryOptions) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCardExpenses(cardId);
  const real = useQuery({
    queryKey:
      options?.sinceMonth !== undefined
        ? [...cardExpensesKey, cardId, options.sinceMonth]
        : [...cardExpensesKey, cardId],
    queryFn: () =>
      options?.sinceMonth !== undefined
        ? listExpensesByCard(cardId as string, { sinceMonth: options.sinceMonth })
        : listExpensesByCard(cardId as string),
    enabled: (options?.enabled ?? true) && cardId !== null && !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}
