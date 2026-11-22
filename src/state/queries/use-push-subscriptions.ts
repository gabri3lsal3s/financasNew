import { useQuery } from "@tanstack/react-query";
import { listMyPushSubscriptions } from "@/data/repositories/push-subscriptions";

export const pushSubscriptionsKey = ["push-subscriptions"] as const;

export function useMyPushSubscriptions() {
  return useQuery({
    queryKey: pushSubscriptionsKey,
    queryFn: listMyPushSubscriptions,
    staleTime: 1000 * 60 * 5,
  });
}
