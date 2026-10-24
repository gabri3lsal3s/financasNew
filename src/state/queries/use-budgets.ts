import { useQuery } from "@tanstack/react-query";
import { listBudgets } from "@/data/repositories/budgets";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedBudgets } from "./use-simulated-queries";

export const budgetsKey = ["budgets"] as const;

/** Todos os orçamentos do usuário (dados cadastrais com staleTime de 5 min — FASE 1 Tarefa 1.2). */
export function useBudgets() {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedBudgets();
  const real = useQuery({
    queryKey: [...budgetsKey],
    queryFn: () => listBudgets(),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}
