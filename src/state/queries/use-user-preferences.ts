import { useQuery } from "@tanstack/react-query";
import { getUserPreferences } from "@/data/repositories/user-preferences";
import type { UserPreferences } from "@/types";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";

export const userPreferencesKey = ["user-preferences"] as const;

/** Preferências do usuário logado (tema, lembretes, travas setoriais). */
export function useUserPreferences() {
  return useQuery<UserPreferences | null>({
    queryKey: userPreferencesKey,
    queryFn: () => getUserPreferences(),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}
