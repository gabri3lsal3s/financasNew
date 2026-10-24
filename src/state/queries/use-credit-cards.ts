import { useQuery } from "@tanstack/react-query";
import { listActiveCreditCards, listCreditCards } from "@/data/repositories/credit-cards";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { getActiveUserId } from "@/services/user-storage";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedCreditCards } from "./use-simulated-queries";

export const creditCardsKey = ["credit_cards"] as const;

/** Todos os cartões (ativos e inativos) — página de cartões. */
export function useCreditCards(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCreditCards();
  const activeUserId = getActiveUserId();
  const real = useQuery({
    queryKey: [...creditCardsKey],
    queryFn: () => listCreditCards(),
    enabled: (options?.enabled ?? Boolean(activeUserId)) && !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Apenas cartões ativos (para seleção em formulários). */
export function useActiveCreditCards(options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCreditCards({ activeOnly: true });
  const activeUserId = getActiveUserId();
  const real = useQuery({
    queryKey: [...creditCardsKey, { active: true }],
    queryFn: () => listActiveCreditCards(),
    enabled: (options?.enabled ?? Boolean(activeUserId)) && !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}
