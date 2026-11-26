import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminApproveStatementBlueprint,
  adminSuspendStatementBlueprint,
  recordStatementBlueprintOutcome,
  upsertStatementLayoutBlueprint,
  type RecordStatementBlueprintOutcomeParams,
  type UpsertStatementBlueprintParams,
} from "@/data/repositories/statement-blueprints";
import {
  commitStatementReconciliation,
  getStatementReconciliationReceipts,
  importStatementExpenses,
  type CommitStatementReconciliationParams,
  type CommitStatementReconciliationResult,
  type ImportStatementResult,
  type StatementExpenseItemInput,
} from "@/data/rpc";

export { getStatementReconciliationReceipts as fetchStatementReconciliationReceipts };
import { budgetsKey } from "@/state/queries/use-budgets";
import {
  cardExpensesKey,
  cardPaymentsKey,
} from "@/state/queries/use-card-payments";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import {
  adminStatementBlueprintsKey,
  statementBlueprintsKey,
} from "@/state/queries/use-statement-blueprints";
import type {
  StatementBlueprintOutcomeResult,
  StatementLayoutBlueprintRow,
  StatementLayoutBlueprintRules,
} from "@/types";

export type {
  CommitStatementReconciliationParams,
  CommitStatementReconciliationResult,
} from "@/data/rpc";

/**
 * Mutation para importação em lote de despesas de fatura/extrato de cartão (Fase 30).
 * O aprendizado limpo de estabelecimentos é disparado 1 única vez por item confirmado no fechamento do importador (G14).
 */
export function useImportStatementExpenses() {
  const queryClient = useQueryClient();

  return useMutation<
    ImportStatementResult,
    Error,
    { cardId: string; competenceMonth: string; expenses: StatementExpenseItemInput[] }
  >({
    mutationFn: (params) => importStatementExpenses(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: budgetsKey });
    },
  });
}

/**
 * Mutation transacional atômica (`commit_statement_reconciliation` — Onda 1 / D14 / G11)
 * executando exclusões cirúrgicas, ajustes, mudanças de competência, novas despesas,
 * parcelas futuras K+1..N e estornos em 1 única transação no PostgreSQL.
 */
export function useCommitStatementReconciliation() {
  const queryClient = useQueryClient();

  return useMutation<
    CommitStatementReconciliationResult,
    Error,
    CommitStatementReconciliationParams
  >({
    mutationFn: (params) => commitStatementReconciliation(params),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: cardExpensesKey });
      void queryClient.invalidateQueries({ queryKey: cardPaymentsKey });
      void queryClient.invalidateQueries({ queryKey: expensesKey });
      void queryClient.invalidateQueries({ queryKey: budgetsKey });
      if (result.refunds_count > 0) {
        void queryClient.invalidateQueries({ queryKey: incomesKey });
      }
    },
  });
}

/**
 * Persiste um blueprint validado via Shadow Replay no perfil do usuário (`scope = 'user'`).
 */
export function useUpsertStatementBlueprint() {
  const queryClient = useQueryClient();

  return useMutation<
    StatementLayoutBlueprintRow,
    Error,
    UpsertStatementBlueprintParams
  >({
    mutationFn: (params) => upsertStatementLayoutBlueprint(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: statementBlueprintsKey });
    },
  });
}

/**
 * Registra telemetria anônima anti-Sybil (sucesso/falha de checksum) para promoção global ou self-healing.
 */
export function useRecordStatementBlueprintOutcome() {
  const queryClient = useQueryClient();

  return useMutation<
    StatementBlueprintOutcomeResult,
    Error,
    RecordStatementBlueprintOutcomeParams
  >({
    mutationFn: (params) => recordStatementBlueprintOutcome(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: statementBlueprintsKey });
    },
  });
}

/**
 * Aprova e promove um layout pendente ou suspenso para global ativo no Painel Admin (D16).
 */
export function useAdminApproveStatementBlueprint() {
  const queryClient = useQueryClient();

  return useMutation<
    StatementLayoutBlueprintRow,
    Error,
    { blueprintId: string; rulesJson?: StatementLayoutBlueprintRules }
  >({
    mutationFn: ({ blueprintId, rulesJson }) =>
      adminApproveStatementBlueprint(blueprintId, rulesJson),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStatementBlueprintsKey });
      void queryClient.invalidateQueries({ queryKey: statementBlueprintsKey });
    },
  });
}

/**
 * Suspende um layout global problematico no Painel Admin (D16).
 */
export function useAdminSuspendStatementBlueprint() {
  const queryClient = useQueryClient();

  return useMutation<StatementLayoutBlueprintRow, Error, string>({
    mutationFn: (blueprintId) => adminSuspendStatementBlueprint(blueprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminStatementBlueprintsKey });
      void queryClient.invalidateQueries({ queryKey: statementBlueprintsKey });
    },
  });
}
