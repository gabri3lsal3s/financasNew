/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useUserSubscription } from "./queries/use-user-subscription";
import { setCachedIconTier } from "@/services/native/app-icon";

export interface SubscriptionContextValue {
  isPro: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useUserSubscription();

  // Mantém o cache local sincronizado com a confirmação da assinatura
  useEffect(() => {
    if (typeof subscription.isPro === "boolean") {
      setCachedIconTier(subscription.isPro ? "PRO" : "FREE");
    }
  }, [subscription.isPro]);

  const value = useMemo(
    () => ({ isPro: Boolean(subscription.isPro) }),
    [subscription.isPro],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export { useIsPro } from "@/hooks/use-is-pro";
