import { useQuery } from "@tanstack/react-query";
import { listBudgets } from "@/data/repositories/budgets";

export const budgetsKey = ["budgets"] as const;

/** Todos os orçamentos do usuário (herança de limite exige o histórico). */
export function useBudgets() {
  return useQuery({
    queryKey: [...budgetsKey],
    queryFn: () => listBudgets(),
    staleTime: 30_000,
  });
}
