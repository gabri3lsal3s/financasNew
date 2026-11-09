import { callRpc, unwrapRpc } from "./client";
import type { InstallmentDeleteMode } from "@/types";

/** Quitação de dívida a pagar (+ criar despesa opcional — §3.4). */
export async function payDebt(
  debtId: string,
  options: {
    createExpense: boolean;
    expenseCategoryId?: string | null;
    fineAmount?: number;
    interestAmount?: number;
    discountAmount?: number;
    totalPaid?: number | null;
  },
): Promise<string> {
  return unwrapRpc(
    callRpc("pay_debt", {
      p_debt_id: debtId,
      p_create_expense: options.createExpense,
      p_expense_category_id: options.expenseCategoryId ?? null,
      p_fine_amount: options.fineAmount ?? 0,
      p_interest_amount: options.interestAmount ?? 0,
      p_discount_amount: options.discountAmount ?? 0,
      p_total_paid: options.totalPaid ?? null,
    }),
  );
}

/** Criação atômica de contrato de empréstimo/financiamento com parcelas geradas em lote. */
export async function createLoanContract(input: {
  name: string;
  loanType: string;
  principalAmount: number;
  interestRateMonthly: number;
  amortizationSystem: string;
  totalInstallments: number;
  startDate: string;
  installments: Array<{ installment_number: number; due_date: string; amount: number }>;
}): Promise<string> {
  return unwrapRpc(
    callRpc("create_loan_contract", {
      p_name: input.name,
      p_loan_type: input.loanType,
      p_principal_amount: input.principalAmount,
      p_interest_rate_monthly: input.interestRateMonthly,
      p_amortization_system: input.amortizationSystem,
      p_total_installments: input.totalInstallments,
      p_start_date: input.startDate,
      p_installments: input.installments,
    }),
  );
}

/** Edição, recálculo e repactuação de contrato de empréstimo. */
export async function renegotiateLoanContract(input: {
  loanId: string;
  name: string;
  loanType: string;
  principalAmount: number;
  interestRateMonthly: number;
  amortizationSystem: string;
  totalInstallments: number;
  startDate: string;
  strategy: string;
  installments: Array<{ installment_number: number; due_date: string; amount: number }>;
}): Promise<boolean> {
  return unwrapRpc(
    callRpc("renegotiate_loan_contract", {
      p_loan_id: input.loanId,
      p_name: input.name,
      p_loan_type: input.loanType,
      p_principal_amount: input.principalAmount,
      p_interest_rate_monthly: input.interestRateMonthly,
      p_amortization_system: input.amortizationSystem,
      p_total_installments: input.totalInstallments,
      p_start_date: input.startDate,
      p_strategy: input.strategy,
      p_installments: input.installments,
    }),
  );
}

/** Amortização extraordinária de parcelas de empréstimo com desconto transacional. */
export async function earlyAmortizeLoan(input: {
  loanId: string;
  debtIds: string[];
  createExpense: boolean;
  expenseCategoryId?: string | null;
  totalPaid: number;
  discountTotal: number;
}): Promise<boolean> {
  return unwrapRpc(
    callRpc("early_amortize_loan", {
      p_loan_id: input.loanId,
      p_debt_ids: input.debtIds,
      p_create_expense: input.createExpense,
      p_expense_category_id: input.expenseCategoryId ?? null,
      p_total_paid: input.totalPaid,
      p_discount_total: input.discountTotal,
    }),
  );
}

/** Quitação de dívida a receber (+ criar renda opcional — §3.4). */
export async function receiveDebt(
  debtId: string,
  options: { createIncome: boolean; incomeCategoryId?: string | null },
): Promise<string> {
  return unwrapRpc(
    callRpc("receive_debt", {
      p_debt_id: debtId,
      p_create_income: options.createIncome,
      p_income_category_id: options.incomeCategoryId ?? null,
    }),
  );
}

/** Recebimento integrado: reduz o valor da despesa no relatório (§3.4). */
export async function settleIntegratedReceivable(debtId: string, result: number): Promise<void> {
  await unwrapRpc(
    callRpc("settle_integrated_receivable", {
      p_debt_id: debtId,
      p_result: result,
    }),
    true,
  );
}

/** Exclusão de parcela(s) de dívida em 3 modos (single/all/subsequent). */
export async function deleteDebtInstallments(debtId: string, mode: InstallmentDeleteMode): Promise<number> {
  return unwrapRpc(
    callRpc("delete_debt_installments", {
      p_debt_id: debtId,
      p_mode: mode,
    }),
  );
}

/** Exclusão de contrato de empréstimo com exclusão opcional das parcelas vinculadas. */
export async function deleteLoanContract(loanId: string, deleteDebts: boolean = true): Promise<boolean> {
  return unwrapRpc(
    callRpc("delete_loan_contract", {
      p_loan_id: loanId,
      p_delete_debts: deleteDebts,
    }),
  );
}
