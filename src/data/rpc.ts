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
} from "@/types";

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




