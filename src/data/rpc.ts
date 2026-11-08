import { getSupabase } from "@/data/client";
import { AppError, classifyError } from "@/services/errors";
import type { Database } from "@/types/database";
import type {
  DebtType,
  InstallmentDeleteMode,
  PaymentMethod,
  ReceiveType,
  RecurrenceFrequency,
  RecurrenceKind,
  SharedFamilyBudgetResult,
  SharedGoalTrackerResult,
  FamilyConsolidationResult,
  AcceptFamilyInviteResult,
  FamilyPixKeyType,
  FamilySettlementPaymentMethod,
  FamilySplitRule,
  InviteFamilyMemberResult,
  LeaveFamilyResult,
  RemoveFamilyMemberResult,
  FamilyIncomeRatioSuggestionItem,
  FamilyPortfolioSummary,
  ApproveDividendsBatchPayload,
  ApproveDividendsBatchResult,
  MonthlyClosingPayload,
  MonthlyClosingResult,
} from "@/types";
import type { Trip } from "@/types/trips";

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
  debtType?: DebtType | null;
  isFamily?: boolean;
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

export interface AllocationTargetItem {
  assetId: string;
  /** 0–100. */
  target: number;
}

/**
 * Substitui o conjunto de metas por ativo em UMA transação (D1/§3.11.1).
 * Valida a soma final ≤ 100% após o lote — excedeu, nada é salvo.
 */
export async function setAllocationTargets(targets: AllocationTargetItem[]): Promise<void> {
  await unwrapRpc(
    callRpc("set_allocation_targets", {
      p_targets: targets.map((t) => ({ asset_id: t.assetId, target_percentage: t.target })),
    }),
    true,
  );
}

/** Upsert de meta de grupo (classe ou setor) — §3.11.1. */
export async function setGroupTarget(
  groupType: "class" | "sector",
  name: string,
  target: number,
): Promise<void> {
  await unwrapRpc(
    callRpc("set_group_target", {
      p_group_type: groupType,
      p_name: name,
      p_target: target,
    }),
    true,
  );
}

/** Remove uma meta de grupo (classe ou setor). */
export async function removeGroupTarget(groupType: "class" | "sector", name: string): Promise<void> {
  await unwrapRpc(
    callRpc("remove_group_target", {
      p_group_type: groupType,
      p_name: name,
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

export interface ExecuteBatchAporteItemInput {
  asset_id: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ExecutePortfolioBatchAporteParams {
  items: ExecuteBatchAporteItemInput[];
  date: string;
  totalAmount: number;
  notes?: string | null;
}

/**
 * Executa aporte em lote de forma transacional e atômica (§F36).
 * Atualiza posições em `portfolio_assets`, insere compras em `portfolio_transactions`
 * e grava a contribuição em `portfolio_contributions`.
 */
export async function executePortfolioBatchAporte(params: ExecutePortfolioBatchAporteParams): Promise<boolean> {
  return unwrapRpc(
    callRpc("execute_portfolio_batch_aporte", {
      p_items: params.items,
      p_date: params.date,
      p_total_amount: params.totalAmount,
      p_notes: params.notes ?? null,
    }),
  );
}

// ---------------------------------------------------------------------------
// SaaS & Administração (Fase 43)
// ---------------------------------------------------------------------------

/**
 * Consulta o mapa de funcionalidades ativas/resolvidas para o usuário atual.
 */
export async function getMyFeatures(): Promise<Record<string, boolean>> {
  return unwrapRpc(callRpc("get_my_features", {}));
}

export interface AdminListUsersParams {
  search?: string | null;
  status?: string | null;
  role?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  suspended_reason: string | null;
  total_count: number;
}

/**
 * Lista usuários para o painel administrativo com paginação e filtros.
 */
export async function adminListUsers(params: AdminListUsersParams = {}): Promise<AdminUserRow[]> {
  return unwrapRpc(
    callRpc("admin_list_users", {
      p_search: params.search ?? null,
      p_status: params.status ?? null,
      p_role: params.role ?? null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    }),
  );
}

/**
 * Altera o status da conta de um usuário (Aprovação, Suspensão, Banimento, Reativação).
 */
export async function adminUpdateUserStatus(params: {
  userId: string;
  status: string;
  reason?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_update_user_status", {
      p_user_id: params.userId,
      p_status: params.status,
      p_reason: params.reason ?? null,
    }),
    true,
  );
}

/**
 * Altera o papel / role de um usuário (Superadmin only).
 */
export async function adminSetUserRole(params: {
  userId: string;
  role: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_role", {
      p_user_id: params.userId,
      p_role: params.role,
    }),
    true,
  );
}

/**
 * Aplica um override personalizado de feature flag para um usuário.
 */
export async function adminSetFeatureOverride(params: {
  userId: string;
  featureKey: string;
  enabled: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
      p_enabled: params.enabled,
    }),
    true,
  );
}

/**
 * Remove o override de feature flag de um usuário (revertendo ao padrão global).
 */
export async function adminRemoveFeatureOverride(params: {
  userId: string;
  featureKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_feature_override", {
      p_user_id: params.userId,
      p_feature_key: params.featureKey,
    }),
    true,
  );
}

/**
 * Alterna a ativação global de uma funcionalidade (Kill-Switch).
 */
export async function adminToggleGlobalFeature(params: {
  featureKey: string;
  enabled: boolean;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_toggle_global_feature", {
      p_feature_key: params.featureKey,
      p_enabled: params.enabled,
    }),
    true,
  );
}

/**
 * Cria um novo convite de acesso na allowlist.
 */
export async function adminCreateInvite(params: {
  code: string;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_invite", {
      p_code: params.code,
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
    }),
  );
}

/**
 * Revoga um convite de acesso.
 */
export async function adminRevokeInvite(params: { inviteId: string }): Promise<void> {
  await unwrapRpc(
    callRpc("admin_revoke_invite", {
      p_invite_id: params.inviteId,
    }),
    true,
  );
}

export interface AdminMetricsResult {
  total_users: number;
  active_users: number;
  pending_users: number;
  suspended_users: number;
  total_invites: number;
  used_invites: number;
}

/**
 * Obtém métricas executivas do SaaS para a aba de Visão Geral.
 */
export async function adminGetMetrics(): Promise<AdminMetricsResult> {
  return unwrapRpc(callRpc("admin_get_metrics", {}));
}

/**
 * Consulta agregada de status da assinatura e permissões do usuário autenticado.
 */
export async function getMySubscription(): Promise<{
  tier: string;
  status: string;
  plan_id: string;
  starts_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  trial_days_remaining: number | null;
  cancel_at_period_end: boolean;
  is_full_access: boolean;
  is_trial: boolean;
  is_pro: boolean;
  is_lifetime: boolean;
  is_read_only: boolean;
  can_write: boolean;
  module_permissions: Record<string, string>;
} | null> {
  return unwrapRpc(callRpc("get_my_subscription", {}), true);
}

/**
 * Superadmin ou Admin altera o plano/tier/status da assinatura de um usuário.
 */
export async function adminSetUserSubscription(params: {
  userId: string;
  planId: string;
  tier: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_subscription", {
      p_user_id: params.userId,
      p_plan_id: params.planId,
      p_tier: params.tier,
      p_status: params.status,
      p_trial_ends_at: params.trialEndsAt ?? null,
      p_current_period_end: params.currentPeriodEnd ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin define override de permissão por módulo para um usuário.
 */
export async function adminSetUserModulePermission(params: {
  userId: string;
  moduleKey: string;
  accessLevel: string;
  expiresAt?: string | null;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_set_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
      p_access_level: params.accessLevel,
      p_expires_at: params.expiresAt ?? null,
    }),
    true,
  );
}

/**
 * Superadmin ou Admin remove override de permissão de módulo para um usuário.
 */
export async function adminRemoveUserModulePermission(params: {
  userId: string;
  moduleKey: string;
}): Promise<void> {
  await unwrapRpc(
    callRpc("admin_remove_user_module_permission", {
      p_user_id: params.userId,
      p_module_key: params.moduleKey,
    }),
    true,
  );
}

/**
 * Criação de convite avançado com preset de plano e matriz de módulos.
 */
export async function adminCreateModularInvite(params: {
  code: string;
  targetTier?: string;
  customTrialDays?: number | null;
  moduleGrants?: Record<string, string>;
  maxUses?: number;
  expiresAt?: string | null;
  targetEmail?: string | null;
  notes?: string | null;
}): Promise<string> {
  return unwrapRpc(
    callRpc("admin_create_modular_invite", {
      p_code: params.code,
      p_target_tier: params.targetTier ?? "trial",
      p_custom_trial_days: params.customTrialDays ?? null,
      p_module_grants: params.moduleGrants ?? {},
      p_max_uses: params.maxUses ?? 1,
      p_expires_at: params.expiresAt ?? null,
      p_target_email: params.targetEmail ?? null,
      p_notes: params.notes ?? null,
    }),
  );
}

/**
 * Exclui a conta do usuário autenticado e todos os seus dados em ordem topológica reversa (LGPD Art. 18, VI).
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  await unwrapRpc(callRpc("delete_current_user_account", {}), true);
}

/**
 * Alias de retrocompatibilidade para deleteCurrentUserAccount().
 */
export async function deleteOwnAccount(): Promise<void> {
  return deleteCurrentUserAccount();
}

/**
 * Superadmin exclui definitivamente um usuário e todos os seus dados do sistema.
 */
export async function adminDeleteUser(params: { targetUserId: string }): Promise<void> {
  await unwrapRpc(
    callRpc("admin_delete_user", {
      target_user_id: params.targetUserId,
    }),
    true,
  );
}

/**
 * Consulta pública e segura do Orçamento Familiar compartilhado (/orcamento-familiar/:token).
 */
export async function getSharedFamilyBudget(params: {
  token: string;
  month?: string | null;
}): Promise<SharedFamilyBudgetResult | null> {
  return unwrapRpc(
    callRpc("get_shared_family_budget", {
      p_token: params.token,
      p_month: params.month ?? null,
    }),
    true,
  );
}

/**
 * Consulta pública e segura do Termômetro de Meta Coletiva compartilhado (/meta/:token).
 */
export async function getSharedGoalTracker(params: {
  token: string;
}): Promise<SharedGoalTrackerResult | null> {
  return unwrapRpc(
    callRpc("get_shared_goal_tracker", {
      p_token: params.token,
    }),
    true,
  );
}

/**
 * Sinalização pública e segura de que um convidado pagou via Pix ou salvou a despesa (/r/:token).
 */
export async function signalSplitPayment(params: {
  token: string;
  participantName: string;
  amountCents: number;
  participantId?: string | null;
}): Promise<{
  success: boolean;
  signal_id: string;
  participant_matched: boolean;
  deduplicated?: boolean;
}> {
  return unwrapRpc(
    callRpc("signal_split_payment", {
      p_token: params.token,
      p_participant_name: params.participantName,
      p_amount_cents: params.amountCents,
      p_participant_id: params.participantId ?? null,
    }),
  );
}

/**
 * Descarta uma sinalização de pagamento pelo anfitrião caso não tenha sido confirmada.
 */
export async function dismissSplitPaymentSignal(params: {
  shareId: string;
  signalId: string;
}): Promise<{ success: boolean }> {
  return unwrapRpc(
    callRpc("dismiss_split_payment_signal", {
      p_share_id: params.shareId,
      p_signal_id: params.signalId,
    }),
  );
}

// ---------------------------------------------------------------------------
// Modo Família Colaborativo Multi-Contas (Plano 03 / Tarefa 1.2)
// ---------------------------------------------------------------------------

export interface GetFamilyConsolidationParams {
  familyId?: string | null;
  month?: string | null;
}

/**
 * RPC Transacional de Consolidação Familiar Multi-Contas (D4 / F1).
 *
 * Agrega e consolida com blindagem RLS:
 *   • Total gasto e teto orçamentário da casa;
 *   • Fatias de contribuição de cada participante;
 *   • Despesas enriquecidas com categoria e pagador (omitindo contas e cartões bancários — F3);
 *   • Status de liquidação/acerto de contas do mês e aviso de movimentações pós-acerto (F5).
 */
export async function getFamilyConsolidation(
  params?: GetFamilyConsolidationParams,
): Promise<FamilyConsolidationResult | null> {
  return unwrapRpc(
    callRpc("get_family_consolidation", {
      p_family_id: params?.familyId ?? null,
      p_month: params?.month ?? null,
    }),
    true,
  );
}

// ---------------------------------------------------------------------------
// Modo Família Colaborativo Multi-Contas — Gestão de Família (Plano 03 / Tarefa 1.3)
// ---------------------------------------------------------------------------

export interface CreateFamilyParams {
  name: string;
  monthlyBudget?: number | null;
  splitRule?: FamilySplitRule;
  displayName?: string | null;
  pixKey?: string | null;
  pixKeyType?: FamilyPixKeyType | null;
}

/**
 * Cria uma nova unidade familiar e vincula o criador atomicamente como proprietário (D1).
 * Invariante: participante único em família ativa (uq_family_members_user).
 */
export async function createFamily(params: CreateFamilyParams): Promise<string> {
  return unwrapRpc(
    callRpc("create_family", {
      p_name: params.name,
      p_monthly_budget: params.monthlyBudget ?? null,
      p_split_rule: params.splitRule ?? "equal",
      p_display_name: params.displayName ?? null,
      p_pix_key: params.pixKey ?? null,
      p_pix_key_type: params.pixKeyType ?? null,
    }),
  );
}

export interface InviteFamilyMemberParams {
  familyId?: string | null;
  invitedEmail?: string | null;
  role?: "member" | "admin";
  token?: string | null;
}

/**
 * Gera um convite seguro com token criptográfico e validade de 7 dias para novo parceiro/membro.
 * Autorização restrita a proprietário ou administrador da família.
 */
export async function inviteFamilyMember(
  params?: InviteFamilyMemberParams,
): Promise<InviteFamilyMemberResult> {
  return unwrapRpc(
    callRpc("invite_family_member", {
      p_family_id: params?.familyId ?? null,
      p_invited_email: params?.invitedEmail ?? null,
      p_role: params?.role ?? "member",
      p_token: params?.token ?? null,
    }),
  );
}

export interface GetFamilyInvitePreviewParams {
  token: string;
}

export interface FamilyInvitePreviewResult {
  id: string;
  family_id: string;
  invited_by: string;
  invited_email?: string | null;
  token: string;
  status: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
  family_name: string;
  inviter_name: string;
}

/**
 * Consulta pública e segura das informações de um convite familiar via token criptográfico.
 * Retorna dados de recepção do parceiro (Zero Data Bleed).
 */
export async function getFamilyInvitePreview(
  params: GetFamilyInvitePreviewParams,
): Promise<FamilyInvitePreviewResult | null> {
  const result = await unwrapRpc(
    callRpc("get_family_invite_preview", {
      p_token: params.token,
    }),
    true,
  );
  return result as FamilyInvitePreviewResult | null;
}

export interface AcceptFamilyInviteParams {
  token: string;
  displayName?: string | null;
  pixKey?: string | null;
  pixKeyType?: FamilyPixKeyType | null;
}

/**
 * Vincula atomicamente o parceiro autenticado à família via token de convite.
 * Invariante: participante único em família ativa (rejeita se já for membro de qualquer família).
 */
export async function acceptFamilyInvite(
  params: AcceptFamilyInviteParams,
): Promise<AcceptFamilyInviteResult> {
  return unwrapRpc(
    callRpc("accept_family_invite", {
      p_token: params.token,
      p_display_name: params.displayName ?? null,
      p_pix_key: params.pixKey ?? null,
      p_pix_key_type: params.pixKeyType ?? null,
    }),
  );
}

export interface LeaveFamilyParams {
  familyId?: string | null;
  transferToUserId?: string | null;
  disband?: boolean;
}

/**
 * Desvincula o usuário da família ou dissolve a unidade caso seja o proprietário.
 * Sanitiza lançamentos e categorias para garantir Zero Data Bleed pós-saída.
 */
export async function leaveFamily(params?: LeaveFamilyParams): Promise<LeaveFamilyResult> {
  return unwrapRpc(
    callRpc("leave_family", {
      p_family_id: params?.familyId ?? null,
      p_transfer_to_user_id: params?.transferToUserId ?? null,
      p_disband: params?.disband ?? false,
    }),
  );
}

export interface RemoveFamilyMemberParams {
  familyId: string;
  targetUserId: string;
}

/**
 * Remove um membro da unidade familiar exclusivamente pelo titular.
 * Desvincula lançamentos e categorias do membro removido para garantir Zero Data Bleed.
 */
export async function removeFamilyMember(
  params: RemoveFamilyMemberParams,
): Promise<RemoveFamilyMemberResult> {
  return unwrapRpc(
    callRpc("remove_family_member", {
      p_family_id: params.familyId,
      p_target_user_id: params.targetUserId,
    }),
  );
}

export interface RecordFamilySettlementParams {
  month: string;
  payerId: string;
  receiverId: string;
  amount: number;
  familyId?: string | null;
  paymentMethod?: FamilySettlementPaymentMethod;
  notes?: string | null;
  snapshot?: Record<string, unknown>;
}

/**
 * Registra o acerto de contas auditável entre membros da família para uma competência (mês).
 */
export async function recordFamilySettlement(
  params: RecordFamilySettlementParams,
): Promise<string> {
  return unwrapRpc(
    callRpc("record_family_settlement", {
      p_month: params.month,
      p_payer_id: params.payerId,
      p_receiver_id: params.receiverId,
      p_amount: params.amount,
      p_family_id: params.familyId ?? null,
      p_payment_method: params.paymentMethod ?? "pix",
      p_notes: params.notes ?? null,
      p_snapshot: params.snapshot ?? {},
    }),
  );
}

export interface GetFamilyIncomeRatioSuggestionParams {
  familyId?: string | null;
  lookbackMonths?: number;
}

/**
 * Consulta a sugestão inteligente de rateio baseada na média de receitas dos membros nos últimos meses.
 */
export async function getFamilyIncomeRatioSuggestion(
  params?: GetFamilyIncomeRatioSuggestionParams,
): Promise<FamilyIncomeRatioSuggestionItem[]> {
  const result = await unwrapRpc(
    callRpc("get_family_income_ratio_suggestion", {
      p_family_id: params?.familyId ?? null,
      p_lookback_months: params?.lookbackMonths ?? 3,
    }),
    true,
  );
  return (result ?? []) as FamilyIncomeRatioSuggestionItem[];
}

export interface GetFamilyPortfolioSummaryParams {
  familyId?: string | null;
}

/**
 * Consolida o patrimônio e a reserva de emergência compartilhados com a família.
 */
export async function getFamilyPortfolioSummary(
  params?: GetFamilyPortfolioSummaryParams,
): Promise<FamilyPortfolioSummary | null> {
  return unwrapRpc(
    callRpc("get_family_portfolio_summary", {
      p_family_id: params?.familyId ?? null,
    }),
    true,
  );
}

/**
 * Consolida atômica e transacionalmente o fechamento mensal da carteira.
 * Persiste cotações em portfolio_monthly_prices e o snapshot consolidado em portfolio_snapshots.
 */
export async function commitMonthlyClosingRpc(
  payload: MonthlyClosingPayload,
): Promise<MonthlyClosingResult> {
  return unwrapRpc(
    callRpc("commit_monthly_closing_atomic", {
      p_month: payload.month,
      p_closing_date: payload.closing_date,
      p_prices: payload.prices,
      p_total_value: payload.total_value,
      p_total_cost: payload.total_cost,
    }),
  );
}

/**
 * Aprova múltiplos proventos de forma atômica no banco de dados.
 * Se sync_cash = true, realiza o UPSERT garantido no ativo CAIXA, criando-o caso inexista.
 */
export async function approveDividendsBatchRpc(
  payload: ApproveDividendsBatchPayload,
): Promise<ApproveDividendsBatchResult> {
  return unwrapRpc(
    callRpc("approve_dividends_batch_atomic", {
      p_dividends: payload.dividends,
      p_sync_cash: payload.sync_cash ?? false,
    }),
  );
}

/**
 * Registra atomicamente um aporte/depósito em uma meta via RPC allocate_goal_deposit (§Plano 12).
 */
export async function allocateGoalDeposit(input: {
  shareId: string;
  amountCents: number;
  contributorName?: string;
  sourceAccountId?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  share_id: string;
  new_current_cents: number;
  target_cents: number;
  is_completed: boolean;
}> {
  return unwrapRpc(
    callRpc("allocate_goal_deposit" as never, {
      p_share_id: input.shareId,
      p_amount_cents: input.amountCents,
      p_contributor_name: input.contributorName ?? "Você",
      p_source_account_id: input.sourceAccountId ?? null,
      p_notes: input.notes ?? null,
    } as never),
  );
}

/**
 * Retorna os dados públicos sanitizados do ledger da viagem via RPC get_public_trip_ledger.
 */
export async function getPublicTripLedger(
  token: string,
  passcode?: string,
): Promise<unknown> {
  return unwrapRpc(
    callRpc("get_public_trip_ledger" as never, {
      p_token: token,
      p_passcode: passcode ?? null,
    } as never),
    true,
  );
}

/**
 * Adiciona uma despesa via link público da viagem via RPC add_public_trip_expense.
 */
export async function addPublicTripExpense(input: {
  token: string;
  paidByMemberId: string;
  amountCents: number;
  description: string;
  categoryName?: string;
  expenseDate?: string;
  splitType?: string;
  splits: readonly { member_id: string; share_cents: number }[];
  receiptUrl?: string | null;
  createdByMemberId?: string | null;
}): Promise<{ success: boolean; expense_id: string }> {
  return unwrapRpc(
    callRpc("add_public_trip_expense" as never, {
      p_token: input.token,
      p_paid_by_member_id: input.paidByMemberId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_category_name: input.categoryName ?? "Geral",
      p_expense_date: input.expenseDate ?? new Date().toISOString().split("T")[0],
      p_split_type: input.splitType ?? "equal",
      p_splits: input.splits,
      p_receipt_url: input.receiptUrl ?? null,
      p_created_by_member_id: input.createdByMemberId ?? null,
    } as never),
  );
}

/**
 * Grava a liquidação líquida da viagem via RPC record_trip_settlements.
 */
export async function recordTripSettlementsRpc(
  tripId: string,
  settlements: readonly { from_member_id: string; to_member_id: string; amount_cents: number }[],
): Promise<{ success: boolean }> {
  return unwrapRpc(
    callRpc("record_trip_settlements" as never, {
      p_trip_id: tripId,
      p_settlements: settlements,
    } as never),
  );
}

/**
 * Cria uma viagem e cadastra o host e participantes de forma atômica via RPC create_trip.
 */
export async function createTripRpc(input: {
  title: string;
  destination?: string | null;
  startDate: string;
  endDate: string;
  currency?: string;
  coverPhotoUrl?: string | null;
  initialMembers?: readonly {
    name: string;
    pix_key?: string | null;
    pix_key_type?: string | null;
  }[];
}): Promise<Trip> {
  return unwrapRpc(
    callRpc("create_trip" as never, {
      p_title: input.title,
      p_destination: input.destination ?? null,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_currency: input.currency ?? "BRL",
      p_cover_photo_url: input.coverPhotoUrl ?? null,
      p_initial_members: input.initialMembers ?? [],
    } as never),
  );
}

