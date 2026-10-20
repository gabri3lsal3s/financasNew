import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/data/repositories/subscriptions";
import { getCachedIconTier } from "@/services/native/app-icon";
import { STALE_TIMES, STATIC_GC_TIME } from "@/state/cache-policy";
import { useUserAccess, USER_SUBSCRIPTION_KEY, userSubscriptionQueryKey } from "./use-user-access";
import type { SubscriptionStatus, SubscriptionTier, SubscriptionPlan } from "@/types";

export { USER_SUBSCRIPTION_KEY, userSubscriptionQueryKey };

/**
 * Hook de estado central da assinatura do usuário.
 *
 * Consulta o backend (`get_my_subscription`) via TanStack Query e sincroniza em tempo real.
 * A UI consome este hook como única fonte de verdade sobre acesso — nunca
 * verificar `tier` ou `status` diretamente nas telas.
 */
export function useUserSubscription(): SubscriptionStatus {
  const { profile } = useUserAccess();

  const { data: subData } = useQuery({
    queryKey: userSubscriptionQueryKey(profile?.id ?? null),
    queryFn: getMySubscription,
    enabled: Boolean(profile?.id),
    staleTime: STALE_TIMES.static, // 5 minutos (300_000 ms)
    gcTime: STATIC_GC_TIME,
  });

  return useMemo((): SubscriptionStatus => {
    // Se o dado real do backend já carregou, utiliza-o diretamente
    if (subData) {
      return subData;
    }

    // Estado inicial (loading) — se o cache já indica status PRO, honra visualmente
    // para evitar piscadas e atrasos nas logos da aplicação durante a inicialização
    const cachedTier = getCachedIconTier();
    const fallbackTier = cachedTier === "PRO" ? "pro_monthly" : "trial";

    return buildFallbackStatus(fallbackTier, profile?.created_at ?? null);
  }, [subData, profile?.created_at]);
}

// ---------------------------------------------------------------------------
// Helpers internos de fallback
// ---------------------------------------------------------------------------

function buildFallbackStatus(tier: SubscriptionTier, createdAt: string | null): SubscriptionStatus {
  const trialEndsAt = computeTrialEnd(createdAt);
  const trialDaysRemaining = computeTrialDaysRemaining(trialEndsAt);

  const isTrial = tier === "trial" && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const isReadOnly =
    tier === "read_only" || (tier === "trial" && trialDaysRemaining !== null && trialDaysRemaining <= 0);
  const isPro = tier === "pro_monthly" || tier === "pro_annual";
  const isLifetime = tier === "lifetime";
  // Fail-closed durante o fallback de carregamento: permissões de escrita e acesso total
  // só devem ser liberadas após a confirmação dos dados reais pelo backend (§D15).
  const isFullAccess = false;
  const canWrite = false;

  const plan: SubscriptionPlan | null =
    tier === "pro_monthly" ? "monthly" : tier === "pro_annual" ? "annual" : null;

  return {
    tier,
    trialDaysRemaining: isTrial ? trialDaysRemaining : null,
    trialEndsAt: trialEndsAt ?? null,
    currentPeriodEnd: null,
    plan,
    cancelAtPeriodEnd: false,
    isFullAccess,
    isTrial,
    isPro,
    isLifetime,
    isReadOnly,
    canWrite,
    moduleAccess: {},
  };
}

function computeTrialEnd(createdAt: string | null): string | null {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return end.toISOString();
}

function computeTrialDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
