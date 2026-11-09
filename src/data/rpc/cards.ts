import { callRpc, unwrapRpc } from "./client";

export interface CreateCardPaymentParams {
  cardId: string;
  competenceMonth: string;
  amount: number;
  date: string;
  note?: string | null;
}

/** Pagamento de fatura — RPC auditado (D2/§3.3.3). Estorno usa `createRefund`. */
export async function createCardPayment(params: CreateCardPaymentParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_card_payment", {
      p_card_id: params.cardId,
      p_competence_month: params.competenceMonth,
      p_amount: params.amount,
      p_date: params.date,
      p_note: params.note ?? null,
    }),
  );
}

export interface UpdateCreditCardParams {
  cardId: string;
  name: string;
  brand: string | null;
  creditLimit: number | null;
  closingDay: number;
  dueDay: number;
  color: string | null;
  isActive: boolean;
  lastFourDigits?: string | null;
}

/** Alteração de regras do cartão — RPC auditado (D2). */
export async function updateCreditCardRpc(params: UpdateCreditCardParams): Promise<void> {
  await unwrapRpc(
    callRpc("update_credit_card", {
      p_card_id: params.cardId,
      p_name: params.name,
      p_brand: params.brand,
      p_credit_limit: params.creditLimit,
      p_closing_day: params.closingDay,
      p_due_day: params.dueDay,
      p_color: params.color,
      p_is_active: params.isActive,
      p_last_four_digits: params.lastFourDigits ?? null,
    }),
    true,
  );
}

/** Exclusão definitiva de cartão — RPC auditado; FK bloqueia se houver histórico. */
export async function deleteCreditCardRpc(cardId: string): Promise<void> {
  await unwrapRpc(
    callRpc("delete_credit_card", {
      p_card_id: cardId,
    }),
    true,
  );
}

/**
 * Exclusão de pagamento/estorno — RPC transacional (migração 0011): remove
 * o pagamento e a renda automática [REFUND] associada num único passo.
 */
export async function deleteCardPaymentRpc(paymentId: string): Promise<void> {
  await unwrapRpc(
    callRpc("delete_card_payment", {
      p_payment_id: paymentId,
    }),
    true,
  );
}

/** Refinanciamento e parcelamento de saldo devedor de fatura de cartão. */
export async function refinanceCreditCardBill(input: {
  cardId: string;
  competenceMonth: string;
  initialPaymentAmount: number;
  interestInstallments: Array<{
    amount: number;
    date: string;
    installments_total: number;
    installment_number: number;
    bill_competence: string;
  }>;
  expenseCategoryId: string;
}): Promise<boolean> {
  return unwrapRpc(
    callRpc("refinance_credit_card_bill", {
      p_card_id: input.cardId,
      p_competence_month: input.competenceMonth,
      p_initial_payment_amount: input.initialPaymentAmount,
      p_interest_installments: input.interestInstallments,
      p_expense_category_id: input.expenseCategoryId,
    }),
  );
}
