import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/data/client";
import { getMyFeatures, getMyProfile } from "@/data/repositories/access";
import type { Profile, SystemFeatureKey, UserRole, UserStatus } from "@/types";

export const USER_ACCESS_KEY = ["user_access"] as const;
export const USER_FEATURES_KEY = ["user_features"] as const;

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
 * Hook central de controle de acesso, status da conta e feature flags do usuário (§F43).
 * Sincroniza em tempo real via canais Postgres Changes do Supabase com gerenciamento singleton.
 */
export function useUserAccess(): UserAccessResult {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: USER_ACCESS_KEY,
    queryFn: getMyProfile,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const featuresQuery = useQuery({
    queryKey: USER_FEATURES_KEY,
    queryFn: getMyFeatures,
    staleTime: 1000 * 60 * 5,
  });

  const profile = profileQuery.data ?? null;
  const role: UserRole = profile?.role ?? "user";
  const status: UserStatus = profile?.status ?? "active"; // Fallback permissivo para sessões existentes até refetch
  const features: Record<string, boolean> = featuresQuery.data ?? {};

  const isPendingApproval = status === "pending_approval";
  const isActive = status === "active";
  const isSuspended = status === "suspended";
  const isBanned = status === "banned";

  const isSuperAdmin = role === "superadmin";
  const isAdmin = isSuperAdmin || role === "admin";

  const hasFeature = (featureKey: SystemFeatureKey | string): boolean => {
    if (features[featureKey] === undefined) {
      return true; // Fallback ativo se não listado
    }
    return Boolean(features[featureKey]);
  };

  // Canal Realtime para atualizações imediatas de status e permissões
  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = subscribeUserAccessRealtime(profile.id, queryClient);
    return () => {
      unsubscribe();
    };
  }, [profile?.id, queryClient]);

  const isLoading = profileQuery.isLoading || featuresQuery.isLoading;
  const error = (profileQuery.error as Error | null) ?? (featuresQuery.error as Error | null);

  const refetch = async () => {
    await Promise.all([profileQuery.refetch(), featuresQuery.refetch()]);
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
