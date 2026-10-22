import { useQuery } from "@tanstack/react-query";
import { getUserPreferences } from "@/data/repositories/user-preferences";
import type { UserPreferences } from "@/types";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { getActiveUserId } from "@/services/user-storage";

export const userPreferencesKey = ["user-preferences"] as const;

/** Preferências do usuário logado (tema, lembretes, travas setoriais). */
export function useUserPreferences(options?: { enabled?: boolean }) {
  const activeUserId = getActiveUserId();
  return useQuery<UserPreferences | null>({
    queryKey: userPreferencesKey,
    queryFn: () => getUserPreferences(),
    enabled: options?.enabled ?? Boolean(activeUserId),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}
