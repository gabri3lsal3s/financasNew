import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";
import type { Database } from "@/types/database";
import type { InstallmentDeleteMode } from "@/types";

/**
 * Wrappers tipados dos RPCs transacionais (D1).
 *
 * Regras:
 *   • Escritas compostas SEMPRE via RPC (atomicidade — nunca múltiplas
 *     chamadas na UI);
 *   • Derivados calculados no cliente (D12) e validados no servidor;
 *   • Erro normalizado pelo gateway (services/errors) e relançado como
 *     AppError para o contrato de estado.
 */

type Functions = Database["public"]["Functions"];
type FnArgs<K extends keyof Functions> = Functions[K]["Args"];
type FnReturn<K extends keyof Functions> = Functions[K]["Returns"];

type RpcResult<T> = { data: T | null; error: unknown };

/**
 * Chama um RPC com tipagem controlada pelo `Database` (fonte única).
 * O cast é necessário porque o overload genérico do supabase-js é frágil
 * com schemas grandes — os tipos reais vêm daqui, não da inferência dele.
 */
function callRpc<K extends keyof Functions>(fn: K, args: FnArgs<K>): PromiseLike<RpcResult<FnReturn<K>>> {
  return getSupabase().rpc(fn, args as never) as unknown as PromiseLike<RpcResult<FnReturn<K>>>;
}

async function unwrapRpc<T>(promise: PromiseLike<RpcResult<T>>, allowNull = false): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  if (data === null && !allowNull) {
    throw new AppError("unknown", "Resposta vazia do servidor.", null);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Parcelas calculadas no cliente (D12) — um item por mês
// ---------------------------------------------------------------------------
export interface InstallmentInput {
  date: string;
  value: number;
  /** Competência de fatura (snapshot) quando cartão — calculada no cliente. */
  billCompetence?: string | null;
}

export interface CreateExpenseWithDebtParams {
  value: number;
  date: string;
  categoryId: string;
  paymentMethod: string;
  cardId?: string | null;
  description?: string | null;
  reportWeight?: number;
  installments: InstallmentInput[];
  debtName?: string | null;
  debtAmount?: number | null;
  debtDueDate?: string | null;
}

/** Despesa + cobrança vinculada em uma única transação (D1/§3.2.4). */
export async function createExpenseWithDebt(params: CreateExpenseWithDebtParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_expense_with_debt", {
      p_value: params.value,
      p_date: params.date,
      p_category_id: params.categoryId,
      p_payment_method: params.paymentMethod,
      p_card_id: params.cardId ?? null,
      p_description: params.description ?? null,
      p_report_weight: params.reportWeight ?? 1,
      p_installments: params.installments.map((item) => ({
        date: item.date,
        value: item.value,
        bill_competence: item.billCompetence ?? null,
      })),
      p_debt_name: params.debtName ?? null,
      p_debt_amount: params.debtAmount ?? null,
      p_debt_due_date: params.debtDueDate ?? null,
    }),
  );
}

export interface CreateRefundParams {
  cardId: string;
  competenceMonth: string;
  amount: number;
  date: string;
  note?: string | null;
}

/** Estorno de fatura → renda automática na categoria reservada "Estorno" (§3.3.3). */
export async function createRefund(params: CreateRefundParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_refund", {
      p_card_id: params.cardId,
      p_competence_month: params.competenceMonth,
      p_amount: params.amount,
      p_date: params.date,
      p_note: params.note ?? null,
    }),
  );
}

/** Exclusão de parcela(s) em 3 modos + cascata de dívidas pendentes (§3.2.2). */
export async function deleteExpenseInstallments(expenseId: string, mode: InstallmentDeleteMode): Promise<number> {
  return unwrapRpc(
    callRpc("delete_expense_installments", {
      p_expense_id: expenseId,
      p_mode: mode,
    }),
  );
}

/** Quitação de dívida a pagar (+ criar despesa opcional — §3.4). */
export async function payDebt(
  debtId: string,
  options: { createExpense: boolean; expenseCategoryId?: string | null },
): Promise<string> {
  return unwrapRpc(
    callRpc("pay_debt", {
      p_debt_id: debtId,
      p_create_expense: options.createExpense,
      p_expense_category_id: options.expenseCategoryId ?? null,
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

/** Exclui categoria, migrando itens para outra do mesmo tipo quando informada. */
export async function deleteCategoryMigrate(categoryId: string, migrateTo?: string | null): Promise<void> {
  await unwrapRpc(
    callRpc("delete_category_migrate", {
      p_category_id: categoryId,
      p_migrate_to: migrateTo ?? null,
    }),
    true,
  );
}

/** Upsert de orçamento por categoria + mês. */
export async function setBudgetLimit(categoryId: string, month: string, limit: number): Promise<void> {
  await unwrapRpc(
    callRpc("set_budget_limit", {
      p_category_id: categoryId,
      p_month: month,
      p_limit: limit,
    }),
    true,
  );
}

/** Upsert de meta de renda por categoria + mês. */
export async function setIncomeGoal(categoryId: string, month: string, expected: number): Promise<void> {
  await unwrapRpc(
    callRpc("set_income_goal", {
      p_category_id: categoryId,
      p_month: month,
      p_expected: expected,
    }),
    true,
  );
}

/** Recálculo controlado das competências de fatura de um cartão (D3/§1.5). */
export async function recalculateBillCompetences(cardId: string): Promise<number> {
  return unwrapRpc(
    callRpc("recalculate_bill_competences", {
      p_card_id: cardId,
    }),
  );
}

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

/** Realocação atômica de limite entre categorias (D1/§3.5.2). */
export async function reallocateBudget(params: {
  fromCategoryId: string;
  toCategoryId: string;
  month: string;
  amount: number;
}): Promise<void> {
  await unwrapRpc(
    callRpc("reallocate_budget", {
      p_from_category_id: params.fromCategoryId,
      p_to_category_id: params.toCategoryId,
      p_month: params.month,
      p_amount: params.amount,
    }),
    true,
  );
}
