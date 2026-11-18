import { createContext } from "react";
import type { SubscriptionStatus } from "@/types";

export interface SubscriptionContextValue {
  isPro: boolean;
  isLifetime: boolean;
  isTrial: boolean;
  isReadOnly: boolean;
  subscription: SubscriptionStatus;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
