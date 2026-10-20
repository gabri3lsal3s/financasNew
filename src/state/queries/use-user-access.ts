import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/data/client";
import { getMyFeatures, getMyProfile } from "@/data/repositories/access";
import { getMySubscription } from "@/data/repositories/subscriptions";
import { getActiveUserId, setActiveUserId, subscribeActiveUserId } from "@/services/user-storage";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import type { Profile, SystemFeatureKey, UserRole, UserStatus } from "@/types";

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
 * Gerenciador singleton de canais Supabase Realtime para evitar duplicação de canais
 * e erro de múltiplos `.subscribe()` / `.on()` na mesma sessão de usuário.
 */
function subscribeUserAccessRealtime(userId: string, queryClient: QueryClient): () => void {
  subscriberCount++;

  // Se já existe um canal ativo para o mesmo usuário, compartilha a inscrição
  if (activeChannel && activeUserId === userId) {
    return () => {
      subscriberCount--;
      if (subscriberCount <= 0 && activeChannel) {
        const supabase = getSupabase();
        void supabase.removeChannel(activeChannel);
        activeChannel = null;
        activeUserId = null;
        subscriberCount = 0;
      }
    };
  }

  const supabase = getSupabase();
  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  activeUserId = userId;
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
    .subscribe();

  return () => {
    subscriberCount--;
    if (subscriberCount <= 0 && activeChannel) {
      const sb = getSupabase();
      void sb.removeChannel(activeChannel);
      activeChannel = null;
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
export function useUserAccess(targetUserId?: string): UserAccessResult {
  const queryClient = useQueryClient();

  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    return targetUserId ?? getActiveUserId() ?? null;
  });

  useEffect(() => {
    if (targetUserId) {
      return;
    }

    // Sincroniza com as alterações de usuário ativo no storage
    const unsubscribeStorage = subscribeActiveUserId((uid) => {
      setSessionUserId(uid);
    });

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      return unsubscribeStorage;
    }

    if (!supabase?.auth) return unsubscribeStorage;

    let active = true;

    // Resolução inicial em cold start
    if (typeof supabase.auth.getSession === "function") {
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (!active) return;
          const uid = data?.session?.user?.id ?? null;
          if (uid) {
            setActiveUserId(uid);
            setSessionUserId(uid);
          }
        })
        .catch(() => {
          // Fallback silencioso
        });
    }

    // Monitoramento contínuo da sessão Supabase
    let unsubscribeAuth: (() => void) | undefined;
    if (typeof supabase.auth.onAuthStateChange === "function") {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        const uid = session?.user?.id ?? null;
        setActiveUserId(uid);
        setSessionUserId(uid);
      });
      unsubscribeAuth = () => authListener?.subscription?.unsubscribe();
    }

    return () => {
      active = false;
      unsubscribeStorage();
      unsubscribeAuth?.();
    };
  }, [targetUserId]);

  const activeUserId = targetUserId ?? sessionUserId ?? getActiveUserId() ?? null;
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
    staleTime: STALE_TIMES.static, // 5 minutos (300_000 ms)
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

  const isLoading =
    isAuthResolved
      ? profileQuery.isLoading || featuresQuery.isLoading || subscriptionQuery.isLoading
      : false;

  const hasFeature = (featureKey: SystemFeatureKey | string): boolean => {
    // 1. SuperAdmin e Admin têm acesso irrestrito a todas as funcionalidades
    if (isAdmin) return true;

    // 2. Kill-Switch global ou desativação explícita de feature flag
    if (features[featureKey] === false) {
      return false;
    }

    // 3. Fail-Closed durante inicialização ou ausência de autenticação
    if (!isAuthResolved || isLoading) {
      return false;
    }

    // 4. Se a assinatura for nula para usuário não-admin, Fail-Closed imediato
    if (!subscription) {
      return false;
    }

    const moduleAccess = subscription.moduleAccess;

    // 5. Regra de proteção da Visão Geral (Overview):
    // Se overview estiver explicitada no moduleAccess, respeita-a. Caso contrário, deriva do core financeiro.
    if (featureKey === "overview") {
      if (moduleAccess) {
        if (moduleAccess.overview !== undefined) {
          return moduleAccess.overview !== "none";
        }
        const hasAnyCoreFinance =
          (moduleAccess.transactions ?? "none") !== "none" ||
          (moduleAccess.cards ?? "none") !== "none" ||
          (moduleAccess.debts ?? "none") !== "none" ||
          (moduleAccess.budgets ?? "none") !== "none";
        return hasAnyCoreFinance;
      }
      return features.overview !== false;
    }

    // 6. Verifica modelo Whitelist Modular na assinatura (user_module_permissions)
    if (moduleAccess) {
      const hasAnyOverride = Object.keys(moduleAccess).length > 0;
      if (hasAnyOverride) {
        if (moduleAccess[featureKey] !== undefined) {
          return moduleAccess[featureKey] !== "none";
        }
        // Whitelist: se o usuário possui política de restrição modular (overrides),
        // qualquer módulo não explicitamente concedido torna-se bloqueado ('none').
        return false;
      }
    }

    // 7. Fallback seguro para planos sem overrides (features flags gerais)
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
