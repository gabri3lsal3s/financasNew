/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useUserSubscription } from "./queries/use-user-subscription";

export interface SubscriptionContextValue {
  isPro: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPro: false,
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useUserSubscription();
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
