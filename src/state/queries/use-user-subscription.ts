import { useMemo } from "react";
import { useUserAccess } from "./use-user-access";
import type { SubscriptionStatus, SubscriptionTier, SubscriptionPlan } from "@/types";

/**
 * Hook de estado central da assinatura do usuário.
 *
 * Deriva `SubscriptionStatus` a partir do perfil e feature flags do `useUserAccess`.
 * Enquanto o backend de pagamento não está integrado, usa uma simulação determinística
 * baseada em `profile.created_at` para o cálculo dos dias de trial.
 *
 * A UI consume este hook como única fonte de verdade sobre acesso — nunca
 * verificar `tier` ou `status` diretamente nas telas.
 */
export function useUserSubscription(): SubscriptionStatus {
  const { profile, isLoading } = useUserAccess();

  return useMemo((): SubscriptionStatus => {
    // Estado inicial (loading) — permissivo para evitar flash de paywall
    if (isLoading || !profile) {
      return buildStatus("trial", profile?.created_at ?? null);
    }

    // TODO: quando o backend de pagamento estiver integrado,
    // buscar o tier real de `profiles.subscription_tier` ou tabela dedicada.
    // Por ora, simula o trial de 30 dias a partir do created_at.
    return buildStatus("trial", profile.created_at);
  }, [profile, isLoading]);
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function buildStatus(tier: SubscriptionTier, createdAt: string | null): SubscriptionStatus {
  const trialEndsAt = computeTrialEnd(createdAt);
  const trialDaysRemaining = computeTrialDaysRemaining(trialEndsAt);

  const isTrial = tier === "trial" && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const isReadOnly =
    tier === "read_only" || (tier === "trial" && trialDaysRemaining !== null && trialDaysRemaining <= 0);
  const isPro = tier === "pro_monthly" || tier === "pro_annual";
  const isFullAccess = isTrial || isPro;

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
    isReadOnly,
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
