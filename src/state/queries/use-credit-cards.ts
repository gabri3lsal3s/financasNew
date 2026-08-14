import { useQuery } from "@tanstack/react-query";
import { listActiveCreditCards, listCreditCards } from "@/data/repositories/credit-cards";

export const creditCardsKey = ["credit_cards"] as const;

/** Todos os cartões (ativos e inativos) — página de cartões. */
export function useCreditCards() {
  return useQuery({
    queryKey: [...creditCardsKey],
    queryFn: () => listCreditCards(),
    staleTime: 60_000,
  });
}

/** Apenas cartões ativos (para seleção em formulários). */
export function useActiveCreditCards() {
  return useQuery({
    queryKey: [...creditCardsKey, { active: true }],
    queryFn: () => listActiveCreditCards(),
    staleTime: 60_000,
  });
}
