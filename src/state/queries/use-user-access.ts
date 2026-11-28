import { useEffect, useState } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/data/client";
import { listSystemFeatures, listUserFeatureOverrides } from "@/data/repositories/admin";
import { getMyFeatures, getMyProfile } from "@/data/repositories/access";
import { getMySubscription } from "@/data/repositories/subscriptions";
import { useAuth } from "@/hooks/use-auth";
import { getActiveUserId, subscribeActiveUserId } from "@/services/user-storage";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { isQueryPending } from "@/state/query-readiness";
import type { Profile, SystemFeature, SystemFeatureKey, UserFeatureOverride, UserRole, UserStatus } from "@/types";
import { ADMIN_FEATURES_KEY, ADMIN_USER_OVERRIDES_KEY } from "./use-admin";

export const USER_ACCESS_KEY = ["user_access"] as const;
export const USER_FEATURES_KEY = ["user_features"] as const;
export const USER_SUBSCRIPTION_KEY = ["user_subscription"] as const;

export const userAccessQueryKey = (userId: string | null) => [...USER_ACCESS_KEY, userId] as const;
export const userFeaturesQueryKey = (userId: string | null) => [...USER_FEATURES_KEY, userId] as const;
export const userSubscriptionQueryKey = (userId: string | null) => [...USER_SUBSCRIPTION_KEY, userId] as const;

let activeChannel: RealtimeChannel | null = null;
let activeUserId: string | null = null;
let subscriberCount = 0;

/**
 * Indica se a subscrição de canais WebSockets Realtime está habilitada.
 * Desabilitada por padrão (fail-safe) para evitar falhas de conexão (HTTP 500 / Cloudflare error 1101),
 * rejeição de cookies __cf_bm e loops de reconexão em navegadores onde o serviço de Realtime não está ativo.
 */
export function isRealtimeAccessEnabled(): boolean {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.VITE_ENABLE_REALTIME === "true";
  }
  return false;
}

/**
 * Gerenciador singleton de canais Supabase Realtime para evitar duplicação de canais
 * e erro de múltiplos `.subscribe()` / `.on()` na mesma sessão de usuário.
 */
export function subscribeUserAccessRealtime(userId: string, queryClient: QueryClient): () => void {
  if (!isRealtimeAccessEnabled()) {
    return () => {};
  }

  subscriberCount++;

  // Se já existe um canal ativo para o mesmo usuário, compartilha a inscrição
  if (activeChannel && activeUserId === userId) {
    return () => {
      subscriberCount--;
      if (subscriberCount <= 0 && activeChannel) {
        const supabase = getSupabase();
        try {
          void supabase.removeChannel(activeChannel);
        } catch {
          // Fallback defensivo
        }
        activeChannel = null;
        activeUserId = null;
        subscriberCount = 0;
      }
    };
  }

  const supabase = getSupabase();
  if (activeChannel) {
    try {
      void supabase.removeChannel(activeChannel);
    } catch {
      // Fallback defensivo
    }
    activeChannel = null;
  }

  activeUserId = userId;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connectChannel = () => {
    activeChannel = supabase
      .channel(`user-access-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: USER_ACCESS_KEY });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_feature_overrides",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: USER_FEATURES_KEY });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_subscriptions",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      },
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_module_permissions",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        void queryClient.invalidateQueries({ queryKey: USER_FEATURES_KEY });
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        reconnectAttempt = 0;
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (activeChannel) {
          const sb = getSupabase();
          try {
            void sb.removeChannel(activeChannel);
          } catch {
            // Fallback silencioso
          }
          activeChannel = null;
        }
        if (subscriberCount > 0 && reconnectTimer === null && reconnectAttempt < 5) {
          const delayMs = Math.min(30_000, 1000 * Math.pow(2, reconnectAttempt));
          reconnectAttempt += 1;
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (subscriberCount > 0 && activeUserId === userId && !activeChannel) {
              connectChannel();
            }
          }, delayMs);
        }
      }
    });
  };

  const handleOnline = () => {
    if (subscriberCount > 0 && activeUserId === userId && !activeChannel) {
      reconnectAttempt = 0;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      connectChannel();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
  }
  connectChannel();

  return () => {
    subscriberCount--;
    if (subscriberCount <= 0) {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
      }
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeChannel) {
        const sb = getSupabase();
        try {
          void sb.removeChannel(activeChannel);
        } catch {
          // Fallback defensivo
        }
        activeChannel = null;
      }
      activeUserId = null;
      subscriberCount = 0;
    }
  };
}

export interface UserAccessResult {
  profile: Profile | null;
  role: UserRole;
  status: UserStatus;
  features: Record<string, boolean>;
  inspectedAccessSources?: {
    features: SystemFeature[] | undefined;
    overrides: UserFeatureOverride[] | undefined;
  };
  isPendingApproval: boolean;
  isActive: boolean;
  isSuspended: boolean;
  isBanned: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  hasFeature: (featureKey: SystemFeatureKey | string) => boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Hook central de controle de acesso, status da conta, feature flags e permissões modulares (§F43).
 * Sincroniza em tempo real via canais Postgres Changes do Supabase com gerenciamento singleton.
 * Opera sob política estrita de Fail-Closed e isolamento de cache parametrizado por userId.
 */
export function useUserAccess(
  targetUserId?: string,
  { inspectUserId }: { inspectUserId?: string } = {},
): UserAccessResult {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [storageUserId, setStorageUserId] = useState<string | null>(() => {
    return targetUserId ?? getActiveUserId() ?? null;
  });

  useEffect(() => {
    if (targetUserId) {
      return;
    }
    return subscribeActiveUserId(setStorageUserId);
  }, [targetUserId]);

  const activeUserId = targetUserId ?? authUser?.id ?? storageUserId ?? getActiveUserId() ?? null;
  const isAuthResolved = Boolean(activeUserId);

  const profileQuery = useQuery({
    queryKey: userAccessQueryKey(activeUserId),
    queryFn: getMyProfile,
    enabled: isAuthResolved,
    staleTime: STALE_TIMES.static, // 5 minutos (300_000 ms)
    gcTime: STATIC_GC_TIME,
    retry: 1,
  });

  const featuresQuery = useQuery({
    queryKey: userFeaturesQueryKey(activeUserId),
    queryFn: getMyFeatures,
    enabled: isAuthResolved,
    staleTime: STALE_TIMES.static, // 5 minutos (300_000 ms)
    gcTime: STATIC_GC_TIME,
    retry: 1,
  });

  const subscriptionQuery = useQuery({
    queryKey: userSubscriptionQueryKey(activeUserId),
    queryFn: getMySubscription,
    enabled: isAuthResolved,
    staleTime: 30_000, // 30 segundos para reatividade de faturamento
    refetchOnWindowFocus: false,
    gcTime: STATIC_GC_TIME,
    retry: 1,
  });

  const profile = profileQuery.data ?? null;
  const role: UserRole = profile?.role ?? "user";
  const status: UserStatus = profile?.status ?? "active"; // Fallback permissivo para sessões existentes até refetch
  const features: Record<string, boolean> = featuresQuery.data ?? {};
  const subscription = subscriptionQuery.data ?? null;

  const isPendingApproval = status === "pending_approval";
  const isActive = status === "active";
  const isSuspended = status === "suspended";
  const isBanned = status === "banned";

  const isSuperAdmin = role === "superadmin";
  const isAdmin = isSuperAdmin || role === "admin";

  const inspectedUserId = isAdmin ? inspectUserId : undefined;
  const globalFeaturesQuery = useQuery({
    queryKey: ADMIN_FEATURES_KEY,
    queryFn: listSystemFeatures,
    enabled: Boolean(inspectedUserId),
    staleTime: 60_000,
  });
  const individualFlagsQuery = useQuery({
    queryKey: [...ADMIN_USER_OVERRIDES_KEY, inspectedUserId],
    queryFn: inspectedUserId ? () => listUserFeatureOverrides(inspectedUserId) : skipToken,
    staleTime: 10_000,
  });

  const isLoading = isAuthResolved
    ? isQueryPending(profileQuery) || isQueryPending(featuresQuery) || isQueryPending(subscriptionQuery)
    : false;

  const hasFeature = (featureKey: SystemFeatureKey | string): boolean => {
    const isExpansion = featureKey === "family" || featureKey === "trips" || featureKey === "business";
    if ((isExpansion || featureKey === "ai_extraction") && features[featureKey] === false) return false;

    // Os módulos existentes preservam o acesso administrativo.
    if (isAdmin) return true;

    // 2. Kill-Switch global ou desativação explícita de feature flag
    if (features[featureKey] === false) {
      return false;
    }

    // 3. Fail-Closed durante inicialização, ausência de autenticação ou dados ainda não resolvidos
    if (
      !isAuthResolved ||
      isLoading ||
      featuresQuery.data === undefined ||
      subscriptionQuery.data === undefined
    ) {
      return false;
    }

    const moduleAccess = subscription?.moduleAccess;

    // 4. Funcionalidades Beta / Early Access (restritas a usuários com concessão explícita)
    if (featureKey === "bank_notification_listener") {
      const explicitLevel = moduleAccess?.[featureKey];
      return explicitLevel !== undefined && explicitLevel !== "none";
    }

    // 5. Override modular explícito para o módulo solicitado
    if (moduleAccess && moduleAccess[featureKey] !== undefined) {
      return moduleAccess[featureKey] !== "none";
    }

    if (isExpansion && moduleAccess?.transactions === "none") {
      return false;
    }

    // 6. Visão Geral (Overview)
    if (featureKey === "overview") {
      return features.overview !== false;
    }

    // 7. Fallback seguro para planos e features gerais (core habilitado por padrão)
    if (features[featureKey] === undefined) {
      return true; // Fallback ativo se não listado em kill-switch
    }
    return Boolean(features[featureKey]);
  };

  // Canal Realtime para atualizações imediatas de status e permissões
  useEffect(() => {
    const channelUserId = activeUserId ?? profile?.id;
    if (!channelUserId) return;
    const unsubscribe = subscribeUserAccessRealtime(channelUserId, queryClient);
    return () => {
      unsubscribe();
    };
  }, [activeUserId, profile?.id, queryClient]);

  const error =
    (profileQuery.error as Error | null) ??
    (featuresQuery.error as Error | null) ??
    (subscriptionQuery.error as Error | null);

  const refetch = async () => {
    await Promise.all([
      profileQuery.refetch(),
      featuresQuery.refetch(),
      subscriptionQuery.refetch(),
    ]);
  };

  return {
    profile,
    role,
    status,
    features,
    inspectedAccessSources: inspectedUserId ? {
      features: globalFeaturesQuery.data,
      overrides: individualFlagsQuery.data,
    } : undefined,
    isPendingApproval,
    isActive,
    isSuspended,
    isBanned,
    isAdmin,
    isSuperAdmin,
    hasFeature,
    isLoading,
    error,
    refetch,
  };
}
