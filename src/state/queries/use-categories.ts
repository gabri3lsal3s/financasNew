import { useQuery } from "@tanstack/react-query";
import { getCategoryUsage, listAllCategories, listCategories } from "@/data/repositories/categories";
import type { CategoryType } from "@/types";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";
import { useDemoSession } from "@/state/demo-mode";
import { useSimulatedCategories } from "./use-simulated-queries";

export const categoriesKey = ["categories"] as const;

/** Categorias ativas — opcionalmente filtradas por tipo. */
export function useCategories(type?: CategoryType, options?: { enabled?: boolean }) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCategories(type);
  const real = useQuery({
    queryKey: [...categoriesKey, type ?? "all"],
    queryFn: () => listCategories(type),
    enabled: (options?.enabled ?? true) && !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Todas as categorias (ativas e inativas) — gestão de categorias. */
export function useAllCategories(type?: CategoryType) {
  const { isDemoActive } = useDemoSession();
  const simulated = useSimulatedCategories(type);
  const real = useQuery({
    queryKey: [...categoriesKey, "all", type ?? "all"],
    queryFn: () => listAllCategories(type),
    enabled: !isDemoActive,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });

  return isDemoActive ? simulated : real;
}

/** Contagem de lançamentos usando a categoria (fluxo de exclusão com migração). */
export function useCategoryUsage(categoryId: string | null) {
  return useQuery({
    queryKey: [...categoriesKey, "usage", categoryId],
    queryFn: () => getCategoryUsage(categoryId as string),
    enabled: categoryId !== null,
    staleTime: 0,
  });
}
