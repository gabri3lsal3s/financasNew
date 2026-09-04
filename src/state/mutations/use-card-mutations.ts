import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCreditCard,
  deleteCreditCard,
  updateCreditCard,
  type CreditCardForm,
} from "@/data/repositories/credit-cards";
import { createPayment, createRefundPayment, deleteCardPayment } from "@/data/repositories/card-payments";
import { creditCardsKey } from "@/state/queries/use-credit-cards";
import { cardPaymentsKey, cardExpensesKey } from "@/state/queries/use-card-payments";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import {
  removeCardPayments,
  removeIncomesBySourceRef,
  restoreQueries,
  snapshotQueries,
} from "./optimistic-cache";

/**
 * Mutations de cartões (Online First — sem retry automático).
 * Invalidação dirigida: cartões, pagamentos, despesas do cartão e rendas
 * (estorno gera renda automática — §3.3.3).
 *
 * Exclusão de pagamento/estorno usa **atualização otimista**: o registro sai
 * da lista na hora (e a renda automática do estorno, quando houver), com
 * rollback seguro + toast em caso de falha.
 */

export function useCreateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreditCardForm, "is_active">) =>
      createCreditCard({ ...input, is_active: true }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: creditCardsKey }),
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreditCardForm }) => updateCreditCard(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creditCardsKey });
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCreditCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: creditCardsKey }),
  });
}

export function useCreateCardPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createPayment>[0]) => createPayment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardPaymentsKey });
      pushToast({ title: "Pagamento registrado", variant: "default" });
    },
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createRefundPayment>[0]) => createRefundPayment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardPaymentsKey });
      // Estorno gera renda automática somente-leitura (source_ref [REFUND]).
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      pushToast({ title: "Estorno registrado", variant: "default" });
    },
  });
}

export function useDeleteCardPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => deleteCardPayment(paymentId),
    onMutate: async (paymentId) => {
      await queryClient.cancelQueries({ queryKey: cardPaymentsKey });
      await queryClient.cancelQueries({ queryKey: incomesKey });
      const snapshot = [
        ...snapshotQueries(queryClient, cardPaymentsKey),
        ...snapshotQueries(queryClient, incomesKey),
      ];
      removeCardPayments(queryClient, new Set([paymentId]));
      // Estorno → remove a renda automática correspondente ([REFUND]{id}).
      removeIncomesBySourceRef(queryClient, `[REFUND]${paymentId}`);
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível excluir o pagamento",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cardPaymentsKey });
      void queryClient.invalidateQueries({ queryKey: incomesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useRefinanceCreditCardBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof import("@/data/rpc").refinanceCreditCardBill>[0]) =>
      import("@/data/rpc").then((m) => m.refinanceCreditCardBill(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardPaymentsKey });
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      pushToast({ title: "Parcelamento de fatura registrado", variant: "default" });
    },
  });
}
