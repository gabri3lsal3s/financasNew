import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCreditCard,
  deleteCreditCard,
  updateCreditCard,
  type CreditCardForm,
} from "@/data/repositories/credit-cards";
import { createPayment, createRefundPayment } from "@/data/repositories/card-payments";
import { creditCardsKey } from "@/state/queries/use-credit-cards";
import { cardPaymentsKey, cardExpensesKey } from "@/state/queries/use-card-payments";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";

/**
 * Mutations de cartões (Online First — sem retry automático).
 * Invalidação dirigida: cartões, pagamentos, despesas do cartão e rendas
 * (estorno gera renda automática — §3.3.3).
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
    },
  });
}
