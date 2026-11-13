import { createContext } from "react";

export interface SubscriptionContextValue {
  isPro: boolean;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
