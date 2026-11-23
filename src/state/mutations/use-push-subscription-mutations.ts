import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deactivatePushSubscriptionByEndpoint,
  deactivatePushSubscriptionByFcmToken,
  upsertFcmPushSubscription,
  upsertWebPushSubscription,
  type SaveFcmSubscriptionInput,
  type SaveWebPushSubscriptionInput,
} from "@/data/repositories/push-subscriptions";
import { pushSubscriptionsKey } from "@/state/queries/use-push-subscriptions";

export function useEnableWebPushSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWebPushSubscriptionInput) => upsertWebPushSubscription(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pushSubscriptionsKey });
    },
  });
}

export function useDisableWebPushSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (endpoint?: string | null) => {
      // Desativa exclusivamente a inscrição do aparelho atual para não desligar outros dispositivos
      if (endpoint) {
        await deactivatePushSubscriptionByEndpoint(endpoint);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pushSubscriptionsKey });
    },
  });
}

export function useRegisterFcmToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveFcmSubscriptionInput) => upsertFcmPushSubscription(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pushSubscriptionsKey });
    },
  });
}

export function useDisableFcmToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fcmToken?: string | null) => {
      if (fcmToken) {
        await deactivatePushSubscriptionByFcmToken(fcmToken);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pushSubscriptionsKey });
    },
  });
}
