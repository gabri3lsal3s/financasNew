/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useUserSubscription } from "./queries/use-user-subscription";
import { useSubscriptionBoundaryTimer } from "./hooks/use-subscription-boundary-timer";
import { setCachedIconTier } from "@/services/native/app-icon";
import { SubscriptionContext, type SubscriptionContextValue } from "./subscription-context-def";

export type { SubscriptionContextValue };
export { SubscriptionContext };

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useUserSubscription();

  // Monitoramento reativo das fronteiras temporais (virada instantânea de trial/período sem F5)
  useSubscriptionBoundaryTimer({
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });

  const isProOrLifetime = Boolean(subscription.isPro || subscription.isLifetime);

  // Mantém o cache local sincronizado com a confirmação da assinatura
  useEffect(() => {
    setCachedIconTier(isProOrLifetime ? "PRO" : "FREE");
  }, [isProOrLifetime]);

  const value = useMemo(
    (): SubscriptionContextValue => ({
      isPro: isProOrLifetime,
      isLifetime: Boolean(subscription.isLifetime),
      isTrial: Boolean(subscription.isTrial),
      isReadOnly: Boolean(subscription.isReadOnly),
      subscription,
    }),
    [isProOrLifetime, subscription],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export { useIsPro } from "@/hooks/use-is-pro";
