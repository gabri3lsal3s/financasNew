import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMySubscription } from "@/data/repositories/subscriptions";
import { useUserAccess } from "./use-user-access";
import type { SubscriptionStatus, SubscriptionTier, SubscriptionPlan } from "@/types";

export const USER_SUBSCRIPTION_KEY = ["user_subscription"] as const;

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
    queryKey: USER_SUBSCRIPTION_KEY,
    queryFn: getMySubscription,
    enabled: Boolean(profile?.id),
    staleTime: 1000 * 60 * 5, // 5 minutos (Realtime cuida de invalidações ativas)
  });

  return useMemo((): SubscriptionStatus => {
    // Se o dado real do backend já carregou, utiliza-o diretamente
    if (subData) {
      return subData;
    }

    // Estado inicial (loading) — permissivo com base em created_at para evitar flash de paywall
    return buildFallbackStatus("trial", profile?.created_at ?? null);
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
  const isFullAccess = isTrial || isPro || isLifetime;
  const canWrite = isFullAccess;

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
