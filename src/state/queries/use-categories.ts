import { useQuery } from "@tanstack/react-query";
import { listCategories } from "@/data/repositories/categories";
import type { CategoryType } from "@/types";

export const categoriesKey = ["categories"] as const;

/** Categorias ativas — opcionalmente filtradas por tipo. */
export function useCategories(type?: CategoryType) {
  return useQuery({
    queryKey: [...categoriesKey, type ?? "all"],
    queryFn: () => listCategories(type),
    staleTime: 60_000,
  });
}
