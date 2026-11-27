import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  cancelSubscription,
  createCheckoutSession,
  createCumulativeCheckoutSession,
  schedulePlanChange,
  cancelScheduledPlanChange,
  updateSubscriptionCreditCard,
  type CheckoutParams,
  type CheckoutSessionResult,
  type CreateCumulativeCheckoutParams,
  type CreditCardPayload,
  type PixCheckoutResult,
} from "@/data/repositories/billing";
import { USER_SUBSCRIPTION_KEY } from "@/state/queries/use-user-access";
import { INVOICES_KEY } from "@/state/queries/use-invoices";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export type { PixCheckoutResult, CheckoutSessionResult, CreditCardPayload, CreateCumulativeCheckoutParams };

const UPDATE_CARD_MUTATION_KEY = ["billing", "update-card"] as const;
const CUMULATIVE_CHECKOUT_MUTATION_KEY = ["billing", "cumulative-checkout"] as const;
const CHECKOUT_MUTATION_KEY = ["billing", "checkout"] as const;

function scrubSensitiveRecordInPlace(target: unknown): void {
  if (!target || typeof target !== "object") return;
  const record = target as Record<string, unknown>;
  const sensitiveFields = [
    "number",
    "ccv",
    "expiryMonth",
    "expiryYear",
    "holderName",
    "password",
  ];
  for (const field of sensitiveFields) {
    if (field in record) {
      try {
        record[field] = "";
      } catch {
        // Ignora propriedades somente-leitura
      }
    }
  }
  if ("card" in record) scrubSensitiveRecordInPlace(record.card);
  if ("registration" in record) scrubSensitiveRecordInPlace(record.registration);
}

/**
 * Remove imediatamente PAN/CVV/senha das variáveis e descarta a entrada do MutationCache (D-09).
 */
function scrubAndEvictSensitiveMutation(
  queryClient: QueryClient,
  mutationKey: readonly string[],
  variables: unknown,
): void {
  scrubSensitiveRecordInPlace(variables);
  const cache = queryClient.getMutationCache();
  for (const mutation of cache.findAll({ mutationKey })) {
    scrubSensitiveRecordInPlace(mutation.state.variables);
  }
  setTimeout(() => {
    for (const mutation of cache.findAll({ mutationKey })) {
      const status = mutation.state.status;
      if (status === "success" || status === "error") {
        cache.remove(mutation);
      }
    }
  }, 0);
}

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
    mutationKey: UPDATE_CARD_MUTATION_KEY,
    gcTime: 0,
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
    onSettled: (_data, _error, variables) => {
      scrubAndEvictSensitiveMutation(queryClient, UPDATE_CARD_MUTATION_KEY, variables);
    },
  });
}

export function useSchedulePlanChangeMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean; message: string }, Error, "monthly" | "annual">({
    mutationFn: (targetPlan: "monthly" | "annual") => schedulePlanChange(targetPlan),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      triggerSensory("success");
      pushToast({
        title: "Mudança agendada",
        description: data.message,
        variant: "success",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível agendar a mudança",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useCancelScheduledPlanChangeMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean; message: string }, Error, void>({
    mutationFn: () => cancelScheduledPlanChange(),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      triggerSensory("selection");
      pushToast({
        title: "Agendamento cancelado",
        description: data.message,
        variant: "default",
      });
    },
    onError: (error) => {
      triggerSensory("destructive");
      pushToast({
        title: "Falha ao cancelar agendamento",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useCumulativeCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutSessionResult, Error, CreateCumulativeCheckoutParams>({
    mutationKey: CUMULATIVE_CHECKOUT_MUTATION_KEY,
    gcTime: 0,
    mutationFn: (params: CreateCumulativeCheckoutParams) => createCumulativeCheckoutSession(params),
    onSuccess: (data) => {
      if ("status" in data && data.status === "active") {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      }
    },
    onSettled: (_data, _error, variables) => {
      scrubAndEvictSensitiveMutation(queryClient, CUMULATIVE_CHECKOUT_MUTATION_KEY, variables);
    },
  });
}

export function useCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutSessionResult, Error, CheckoutParams>({
    mutationKey: CHECKOUT_MUTATION_KEY,
    gcTime: 0,
    mutationFn: (params: CheckoutParams) => createCheckoutSession(params),
    onSuccess: (data) => {
      const shouldInvalidate =
        ("status" in data &&
          (data.status === "active" ||
            data.status === "trialing" ||
            data.status === "incomplete")) ||
        ("phase" in data && (data.phase === "trial_scheduled" || data.phase === "plan_change_scheduled"));

      if (shouldInvalidate) {
        void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
        void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
      }
    },
    onSettled: (_data, _error, variables) => {
      scrubAndEvictSensitiveMutation(queryClient, CHECKOUT_MUTATION_KEY, variables);
    },
  });
}
