import { useQuery } from "@tanstack/react-query";
import { listActiveCreditCards, listCreditCards } from "@/data/repositories/credit-cards";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { getActiveUserId } from "@/services/user-storage";

export const creditCardsKey = ["credit_cards"] as const;

/** Todos os cartões (ativos e inativos) — página de cartões. */
export function useCreditCards(options?: { enabled?: boolean }) {
  const activeUserId = getActiveUserId();
  return useQuery({
    queryKey: [...creditCardsKey],
    queryFn: () => listCreditCards(),
    enabled: options?.enabled ?? Boolean(activeUserId),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Apenas cartões ativos (para seleção em formulários). */
export function useActiveCreditCards(options?: { enabled?: boolean }) {
  const activeUserId = getActiveUserId();
  return useQuery({
    queryKey: [...creditCardsKey, { active: true }],
    queryFn: () => listActiveCreditCards(),
    enabled: options?.enabled ?? Boolean(activeUserId),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}
