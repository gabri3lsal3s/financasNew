import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUserPreferences } from "@/data/repositories/user-preferences";
import type { UserPreferences } from "@/types";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { getActiveUserId, subscribeActiveUserId } from "@/services/user-storage";

export const USER_PREFERENCES_KEY = ["user-preferences"] as const;
export const userPreferencesKey = USER_PREFERENCES_KEY;
export const userPreferencesQueryKey = (userId: string | null) =>
  [...USER_PREFERENCES_KEY, userId] as const;

/** Preferências do usuário logado (tema, lembretes, travas setoriais). */
export function useUserPreferences(options?: { enabled?: boolean }) {
  const [activeUserId, setActiveUserId] = useState<string | null>(() => getActiveUserId());
  useEffect(() => subscribeActiveUserId(setActiveUserId), []);

  return useQuery<UserPreferences | null>({
    queryKey: userPreferencesQueryKey(activeUserId),
    queryFn: () => getUserPreferences(),
    enabled: options?.enabled ?? Boolean(activeUserId),
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
  });
}
