import { useQuery } from "@tanstack/react-query";
import { getCategoryUsage, listAllCategories, listCategories } from "@/data/repositories/categories";
import type { CategoryType } from "@/types";
import { STATIC_GC_TIME, STALE_TIMES } from "@/state/cache-policy";

export const categoriesKey = ["categories"] as const;

/** Categorias ativas — opcionalmente filtradas por tipo. */
export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: [...categoriesKey, type ?? "all"],
    queryFn: () => listCategories(type),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}

/** Todas as categorias (ativas e inativas) — gestão de categorias. */
export function useAllCategories(type?: CategoryType) {
  return useQuery({
    queryKey: [...categoriesKey, "all", type ?? "all"],
    queryFn: () => listAllCategories(type),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
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
