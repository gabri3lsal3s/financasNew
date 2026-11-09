import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelSubscription,
  createCheckoutSession,
  updateSubscriptionCreditCard,
  upgradeToAnnual,
  type CheckoutParams,
  type CheckoutSessionResult,
  type CreditCardPayload,
  type PixCheckoutResult,
} from "@/data/repositories/billing";
import { USER_SUBSCRIPTION_KEY } from "@/state/queries/use-user-access";
import { INVOICES_KEY } from "@/state/queries/use-invoices";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export type { PixCheckoutResult, CheckoutSessionResult, CreditCardPayload };

export function useCancelSubscriptionMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => cancelSubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      triggerSensory("selection");
      pushToast({
        title: "Renovação cancelada",
        description: "Sua assinatura não será renovada no próximo ciclo. O acesso Pro continuará ativo até o fim do período já pago.",
        variant: "default",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível cancelar a assinatura",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateSubscriptionCardMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreditCardPayload>({
    mutationFn: (card: CreditCardPayload) => updateSubscriptionCreditCard(card),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      triggerSensory("success");
      pushToast({
        title: "Cartão atualizado",
        description: "As próximas renovações da assinatura serão cobradas no novo cartão.",
        variant: "success",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Falha ao atualizar cartão",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpgradeToAnnualMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: () => upgradeToAnnual(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      triggerSensory("success");
      pushToast({
        title: "Upgrade realizado com sucesso",
        description: "Seu plano foi atualizado para o ciclo Anual com economia de 40%.",
        variant: "success",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Falha no upgrade para o plano anual",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutSessionResult, Error, CheckoutParams>({
    mutationFn: (params: CheckoutParams) => createCheckoutSession(params),
    onSuccess: (data) => {
      if ("status" in data && data.status === "active") {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      }
    },
  });
}
