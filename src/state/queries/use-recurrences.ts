import { useQuery } from "@tanstack/react-query";
import { listRecurrences } from "@/data/repositories/recurrences";
import { STALE_TIMES } from "@/state/cache-policy";
import type { RecurrenceKind } from "@/types";

export const recurrencesKey = ["recurrences"] as const;

/** Templates de recorrência do usuário (fonte da verdade — Fase 32). */
export function useRecurrences(kind?: RecurrenceKind) {
  return useQuery({
    queryKey: [...recurrencesKey, kind ?? "all"],
    queryFn: () => listRecurrences(kind),
    staleTime: STALE_TIMES.transactional,
  });
}
