import { callRpc, unwrapRpc } from "./client";
import type {
  DebtType,
  InstallmentDeleteMode,
  PaymentMethod,
  ReceiveType,
  RecurrenceFrequency,
  RecurrenceKind,
} from "@/types";

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
  debtType?: DebtType | null;
  isFamily?: boolean;
  debtInstallmentMode?: "single_total" | "per_installment" | null;
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
      p_debt_type: params.debtType ?? null,
      p_is_family: params.isFamily ?? false,
      p_debt_installment_mode: params.debtInstallmentMode ?? "per_installment",
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

// ---------------------------------------------------------------------------
// Recorrências (Fase 32 — migration 0013)
// ---------------------------------------------------------------------------

/** Campos editáveis em grupo (single/all/subsequent) de parcelas e recorrências. */
export type RecurrenceGroupFields = {
  value?: number | null;
  category_id?: string | null;
  description?: string | null;
  report_weight?: number | null;
  payment_method?: string | null;
  card_id?: string | null;
  receive_type?: string | null;
  bill_competence?: string | null;
  is_family?: boolean | null;
  family_id?: string | null;
};

export interface CreateRecurrenceParams {
  kind: RecurrenceKind;
  frequency: RecurrenceFrequency;
  value: number;
  categoryId: string;
  startDate: string;
  /** Fim sempre definido: exatamente um entre `endDate` e `occurrencesTotal`. */
  endDate?: string | null;
  occurrencesTotal?: number | null;
  paymentMethod?: PaymentMethod | null;
  cardId?: string | null;
  receiveType?: ReceiveType | null;
  description?: string | null;
  reportWeight?: number;
  isFamily?: boolean;
}

/** Ocorrência a materializar (D12 — datas calculadas no cliente). */
export interface RecurrenceMaterializeItem {
  recurrenceId: string;
  /** YYYY-MM-DD. */
  date: string;
  occurrenceNumber: number;
  value: number;
  /** Competência de fatura (snapshot) quando cartão. */
  billCompetence?: string | null;
}

/** Cria o template de recorrência (não materializa — sob demanda, §3.2.5). */
export async function createRecurrence(params: CreateRecurrenceParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_recurrence", {
      p_kind: params.kind,
      p_frequency: params.frequency,
      p_value: params.value,
      p_category_id: params.categoryId,
      p_start_date: params.startDate,
      p_end_date: params.endDate ?? null,
      p_occurrences_total: params.occurrencesTotal ?? null,
      p_payment_method: params.paymentMethod ?? null,
      p_card_id: params.cardId ?? null,
      p_receive_type: params.receiveType ?? null,
      p_description: params.description ?? null,
      p_report_weight: params.reportWeight ?? 1,
      p_is_family: params.isFamily ?? false,
    }),
  );
}

/**
 * Materialização idempotente de ocorrências de um mês/range (D12): o cliente
 * calcula as datas com `domain/recurrences` e o servidor insere as faltantes,
 * respeitando `recurrence_skips` e o unique (recurrence_id, date).
 */
export async function materializeRecurrences(items: RecurrenceMaterializeItem[]): Promise<number> {
  return unwrapRpc(
    callRpc("materialize_recurrences", {
      p_items: items.map((item) => ({
        recurrence_id: item.recurrenceId,
        date: item.date,
        occurrence_number: item.occurrenceNumber,
        value: item.value,
        bill_competence: item.billCompetence ?? null,
      })),
    }),
  );
}

/** Exclusão de ocorrência(s) em 3 modos + truncamento do template (Fase 32). */
export async function deleteRecurrenceOccurrences(
  occurrenceId: string,
  mode: InstallmentDeleteMode,
): Promise<number> {
  return unwrapRpc(
    callRpc("delete_recurrence_occurrences", {
      p_occurrence_id: occurrenceId,
      p_mode: mode,
    }),
  );
}

/** Edição em grupo de ocorrências + sincronização do template (Fase 32). */
export async function updateRecurrenceOccurrences(
  occurrenceId: string,
  mode: InstallmentDeleteMode,
  fields: RecurrenceGroupFields,
): Promise<number> {
  return unwrapRpc(
    callRpc("update_recurrence_occurrences", {
      p_occurrence_id: occurrenceId,
      p_mode: mode,
      p_fields: fields,
    }),
  );
}

// ---------------------------------------------------------------------------
// Rendas parceladas (Fase 32 — migration 0013)
// ---------------------------------------------------------------------------

export interface CreateIncomeInstallmentsParams {
  value: number;
  date: string;
  categoryId: string;
  receiveType: ReceiveType;
  description?: string | null;
  reportWeight?: number;
  installments: InstallmentInput[];
  isFamily?: boolean;
}

/** Renda parcelada (1–60) numa única transação — invariantes D12. */
export async function createIncomeInstallments(params: CreateIncomeInstallmentsParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_income_installments", {
      p_value: params.value,
      p_date: params.date,
      p_category_id: params.categoryId,
      p_receive_type: params.receiveType,
      p_description: params.description ?? null,
      p_report_weight: params.reportWeight ?? 1,
      p_installments: params.installments.map((item) => ({
        date: item.date,
        value: item.value,
      })),
      p_is_family: params.isFamily ?? false,
    }),
  );
}

/** Exclusão de parcela(s) de renda em 3 modos (source_ref é somente-leitura). */
export async function deleteIncomeInstallments(
  incomeId: string,
  mode: InstallmentDeleteMode,
): Promise<number> {
  return unwrapRpc(
    callRpc("delete_income_installments", {
      p_income_id: incomeId,
      p_mode: mode,
    }),
  );
}

/** Edição em grupo de renda parcelada (single/all/subsequent). */
export async function updateIncomeInstallmentsGroup(
  incomeId: string,
  mode: InstallmentDeleteMode,
  fields: RecurrenceGroupFields,
): Promise<number> {
  return unwrapRpc(
    callRpc("update_income_installments_group", {
      p_income_id: incomeId,
      p_mode: mode,
      p_fields: fields,
    }),
  );
}

/**
 * Edição em grupo de despesa parcelada (single/all/subsequent) — `value`
 * atualiza `base_amount` junto (auditoria de pesos consistente).
 */
export async function updateExpenseInstallmentsGroup(
  expenseId: string,
  mode: InstallmentDeleteMode,
  fields: RecurrenceGroupFields,
): Promise<number> {
  return unwrapRpc(
    callRpc("update_expense_installments_group", {
      p_expense_id: expenseId,
      p_mode: mode,
      p_fields: fields,
    }),
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

export interface BatchBudgetLimitItem {
  categoryId: string;
  limit: number;
}

/** Atualização em lote de orçamentos por mês — RPC transacional (§Tarefa 09). */
export async function setBatchBudgetLimits(
  month: string,
  items: readonly BatchBudgetLimitItem[],
): Promise<void> {
  await unwrapRpc(
    callRpc("set_batch_budget_limits", {
      p_month: month,
      p_items: items,
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

export interface StatementExpenseItemInput {
  date: string;
  value: number;
  category_id: string;
  description: string;
  installments_total?: number;
  installment_number?: number;
  report_weight?: number;
  statement_hash?: string;
}

export interface ImportStatementResult {
  success: boolean;
  inserted_count: number;
  skipped_count: number;
}

/**
 * Importa despesas de extrato/fatura em lote de forma atômica e idempotente (Fase 30).
 */
export async function importStatementExpenses(params: {
  cardId: string;
  competenceMonth: string;
  expenses: StatementExpenseItemInput[];
}): Promise<ImportStatementResult> {
  return unwrapRpc(
    callRpc("import_statement_expenses", {
      p_card_id: params.cardId,
      p_competence_month: params.competenceMonth,
      p_expenses: params.expenses,
    }),
  );
}

export interface StatementIncomeItemInput {
  category_id?: string;
  value: number;
  date: string;
  description: string;
  receive_type: string;
  statement_hash: string;
}

export interface BankExpenseItemInput {
  category_id: string;
  value: number;
  date: string;
  description: string;
  statement_hash: string;
  payment_method?: string;
  report_weight?: number;
}

export interface ImportBankTransactionsResult {
  success: boolean;
  expenses_inserted: number;
  expenses_skipped: number;
  incomes_inserted: number;
  incomes_skipped: number;
}

/**
 * Importa despesas e receitas de extrato bancário de forma atômica e idempotente (Fase 34).
 */
export async function importBankTransactions(params: {
  expenses: BankExpenseItemInput[];
  incomes: StatementIncomeItemInput[];
}): Promise<ImportBankTransactionsResult> {
  return unwrapRpc(
    callRpc("import_bank_transactions", {
      p_expenses: params.expenses,
      p_incomes: params.incomes,
    }),
  );
}
