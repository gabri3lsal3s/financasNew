import { callRpc, unwrapRpc } from "./client";

export interface CreateCardPaymentParams {
  cardId: string;
  competenceMonth: string;
  amount: number;
  date: string;
  note?: string | null;
}

export interface CardBillChargeItem {
  charge_kind: "interest" | "fine" | "tax" | "bank_fee";
  amount: number;
  category_id?: string | null;
  description?: string | null;
  payment_date?: string | null;
}

export interface PayCardBillWithChargesParams {
  cardId: string;
  competenceMonth: string;
  nominalAmount: number;
  charges?: CardBillChargeItem[];
  chargeCompetenceMode?: "current" | "next";
  paymentDate?: string;
  note?: string | null;
}

export interface PayCardBillWithChargesResult {
  payment_id: string;
  total_paid: number;
  nominal_amount: number;
  charges_amount: number;
  charges_competence: string;
  created_expense_ids: string[];
}

/** Pagamento de fatura com encargos (Fase 1 do Blueprint v2.1) — RPC auditado. */
export async function payCardBillWithCharges(
  params: PayCardBillWithChargesParams,
): Promise<PayCardBillWithChargesResult> {
  return unwrapRpc(
    callRpc("pay_card_bill_with_charges", {
      p_card_id: params.cardId,
      p_competence_month: params.competenceMonth,
      p_nominal_amount: params.nominalAmount,
      p_charges: params.charges ?? [],
      p_charge_competence_mode: params.chargeCompetenceMode ?? "current",
      p_payment_date: params.paymentDate ?? new Date().toISOString().slice(0, 10),
      p_note: params.note ?? null,
    }),
  );
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
  scope?: "personal" | "business" | "mixed";
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
      ...(params.scope ? { p_scope: params.scope } : {}),
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
