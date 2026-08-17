import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { updateExpense } from "@/data/repositories/expenses";
import { createExpenseWithDebt, deleteExpenseInstallments, updateExpenseInstallmentsGroup } from "@/data/rpc";
import type { CreateExpenseWithDebtParams, RecurrenceGroupFields } from "@/data/rpc";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { resolveExpenseDeleteIds } from "@/domain/expenses";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import {
  applyExpenseUpdate,
  removeExpenses,
  restoreQueries,
  snapshotQueries,
} from "./optimistic-cache";
import type { DbUpdate, Expense, InstallmentDeleteMode } from "@/types";

/**
 * Mutations de despesa (Online First — mutações SEM retry automático;
 * o QueryClient já define retry: false). Invalidação dirigida por chave
 * estável (docs/ARCHITECTURE.md §5).
 *
 * Edição e exclusão usam **atualização otimista** (F30 — padrão onMutate/
 * onError/onSettled): o cache reflete a mudança na hora, com rollback seguro
 * + toast em caso de falha. Os totais (Extrato, KPIs, faturas) derivam das
 * listas em cache e recalculam instantaneamente.
 */

const FINANCE_KEYS = [
  expensesKey,
  cardExpensesKey,
  incomesKey,
  ["debts"],
  ["insights"],
  ["overview"],
] as const satisfies readonly (readonly string[])[];

/** Snapshot das listas de despesas (mês/range/cartão) para rollback. */
function snapshotExpenseCaches(queryClient: QueryClient) {
  return [
    ...snapshotQueries(queryClient, expensesKey),
    ...snapshotQueries(queryClient, cardExpensesKey),
  ];
}

/** Invalida todos os agregados financeiros após sucesso/erro (onSettled). */
function invalidateFinanceAggregates(queryClient: QueryClient) {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
}

/** Cria despesa (+ parcelas + cobrança vinculada) numa única transação (D1). */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateExpenseWithDebtParams) => createExpenseWithDebt(params),
    onSuccess: () => invalidateFinanceAggregates(queryClient),
  });
}

/** Exclusão de parcela(s) com modo single/all/subsequent + cascata (RPC). */
export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, mode }: { expenseId: string; mode: InstallmentDeleteMode }) =>
      deleteExpenseInstallments(expenseId, mode),
    onMutate: async ({ expenseId, mode }) => {
      // Cancela leituras em voo para não sobrescreverem a atualização otimista.
      await queryClient.cancelQueries({ queryKey: expensesKey });
      await queryClient.cancelQueries({ queryKey: cardExpensesKey });
      const snapshot = snapshotExpenseCaches(queryClient);

      // Resolve os ids afetados pelo modo (single/all/subsequent) a partir
      // de qualquer lista em cache; fallback seguro para [expenseId].
      let affected: string[] = [expenseId];
      for (const [, data] of snapshotQueries(queryClient, expensesKey)) {
        if (Array.isArray(data) && data.length > 0) {
          affected = resolveExpenseDeleteIds(data as Expense[], expenseId, mode);
          break;
        }
      }
      removeExpenses(queryClient, new Set(affected));
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível excluir a despesa",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateFinanceAggregates(queryClient),
  });
}

/**
 * Edição em grupo de despesa parcelada (single/all/subsequent, Fase 32) —
 * `value` atualiza `base_amount` junto (auditoria de pesos consistente).
 * Despesas avulsas caem em `single` (apenas a linha informada).
 */
export function useUpdateExpenseGrouped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode, fields }: { id: string; mode: InstallmentDeleteMode; fields: RecurrenceGroupFields }) =>
      updateExpenseInstallmentsGroup(id, mode, fields),
    onMutate: async ({ id, mode, fields }) => {
      await queryClient.cancelQueries({ queryKey: expensesKey });
      await queryClient.cancelQueries({ queryKey: cardExpensesKey });
      const snapshot = snapshotExpenseCaches(queryClient);

      let affected: string[] = [id];
      for (const [, data] of snapshotQueries(queryClient, expensesKey)) {
        if (Array.isArray(data) && data.length > 0) {
          affected = resolveExpenseDeleteIds(data as Expense[], id, mode);
          break;
        }
      }
      const patch = compactGroupFields(fields);
      for (const expenseId of affected) {
        applyExpenseUpdate(queryClient, expenseId, patch as Partial<Expense>);
      }
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível salvar a despesa",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateFinanceAggregates(queryClient),
  });
}

/** Edição de uma despesa (sem troca de grupo de parcelas neste fluxo). */
export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Expense> }) => updateExpense(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: expensesKey });
      await queryClient.cancelQueries({ queryKey: cardExpensesKey });
      const snapshot = snapshotExpenseCaches(queryClient);
      applyExpenseUpdate(queryClient, id, input);
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível salvar a despesa",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateFinanceAggregates(queryClient),
  });
}

/** Remove nulos/undefined do patch de edição em grupo (ausentes não sobrescrevem). */
function compactGroupFields(fields: RecurrenceGroupFields): Partial<Expense> {
  const patch: Partial<Expense> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) patch[key as keyof Expense] = value as never;
  }
  return patch;
}
