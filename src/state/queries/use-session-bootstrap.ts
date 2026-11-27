import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyFeatures, getMyProfile } from "@/data/repositories/access";
import { getMySubscription, mapRawSubscriptionToStatus } from "@/data/repositories/subscriptions";
import { getUserPreferences, mapPreferences } from "@/data/repositories/user-preferences";
import { getMySessionBootstrap } from "@/data/rpc/session";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import {
  userAccessQueryKey,
  userFeaturesQueryKey,
  userSubscriptionQueryKey,
} from "./use-user-access";
import { userPreferencesQueryKey } from "./use-user-preferences";
import type { Profile, SubscriptionStatus, UserPreferences } from "@/types";

export const SESSION_BOOTSTRAP_KEY = ["session_bootstrap"] as const;

export const sessionBootstrapQueryKey = (userId: string | null) =>
  [...SESSION_BOOTSTRAP_KEY, userId] as const;

export interface SessionBootstrapData {
  profile: Profile | null;
  features: Record<string, boolean>;
  subscription: SubscriptionStatus | null;
  preferences: UserPreferences | null;
}

function isMissingBootstrapRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown; cause?: unknown };
  const cause = err.cause && typeof err.cause === "object" ? (err.cause as { code?: unknown; message?: unknown }) : null;
  const code = String(cause?.code ?? err.code ?? "");
  const message = String(cause?.message ?? err.message ?? "");

  if (code === "PGRST202" || code === "42883") return true;
  return (
    message.includes("get_my_session_bootstrap") &&
    (message.includes("Could not find") ||
      message.includes("does not exist") ||
      message.includes("not found"))
  );
}

/**
 * Executa o bootstrap consolidado da sessão autenticada em 1 única RPC (`get_my_session_bootstrap`)
 * e semeia as 4 chaves individuais no TanStack Query (`user_access`, `user_features`,
 * `user_subscription`, `user-preferences`) para preservar 100% das mutations e optimistic updates.
 * Inclui fallback automático para as 4 chamadas legadas caso a migration ainda não esteja aplicada.
 */
export function useSessionBootstrap(userId?: string | null) {
  const queryClient = useQueryClient();
  const resolvedUserId = userId ?? null;
  const enabled = Boolean(resolvedUserId);

  return useQuery<SessionBootstrapData | null>({
    queryKey: sessionBootstrapQueryKey(resolvedUserId),
    enabled,
    staleTime: STALE_TIMES.static,
    gcTime: STATIC_GC_TIME,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!resolvedUserId) return null;

      let resolved: SessionBootstrapData;
      try {
        const raw = await getMySessionBootstrap();
        resolved = {
          profile: raw?.profile ?? null,
          features: raw?.features ?? {},
          subscription: mapRawSubscriptionToStatus(raw?.subscription ?? null),
          preferences: raw?.preferences ? mapPreferences(raw.preferences) : null,
        };
      } catch (error) {
        if (!isMissingBootstrapRpcError(error)) {
          throw error;
        }
        const [profile, features, subscription, preferences] = await Promise.all([
          getMyProfile(),
          getMyFeatures(),
          getMySubscription(),
          getUserPreferences(),
        ]);
        resolved = {
          profile,
          features,
          subscription,
          preferences,
        };
      }

      // Cache seeding atômico nas 4 chaves individuais antes de liberar a UI
      queryClient.setQueryData(userAccessQueryKey(resolvedUserId), resolved.profile);
      queryClient.setQueryData(userFeaturesQueryKey(resolvedUserId), resolved.features);
      queryClient.setQueryData(userSubscriptionQueryKey(resolvedUserId), resolved.subscription);
      queryClient.setQueryData(userPreferencesQueryKey(resolvedUserId), resolved.preferences);

      return resolved;
    },
  });
}
