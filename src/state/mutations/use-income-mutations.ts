import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createIncome, deleteIncome, updateIncome } from "@/data/repositories/incomes";
import { createIncomeInstallments, deleteIncomeInstallments, updateIncomeInstallmentsGroup } from "@/data/rpc";
import type { CreateIncomeInstallmentsParams, RecurrenceGroupFields } from "@/data/rpc";
import { resolveInstallmentGroupDeleteIds } from "@/domain/expenses";
import type { InstallmentLike } from "@/domain/expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { expensesKey } from "@/state/queries/use-expenses";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import {
  applyIncomeUpdate,
  removeIncomes,
  restoreQueries,
  snapshotQueries,
} from "./optimistic-cache";
import type { DbUpdate, Income, InstallmentDeleteMode } from "@/types";

/**
 * Mutations de renda. Rendas automáticas (source_ref, ex.: [REFUND]) são
 * somente-leitura (§3.1) — a exclusão nunca as alcança (guard no repository).
 *
 * Edição e exclusão usam **atualização otimista** (padrão onMutate/onError/
 * onSettled): o cache reflete a mudança na hora, com rollback seguro + toast
 * em caso de falha; totais do Extrato/KPIs recalculam instantaneamente.
 */

function invalidateIncomeAggregates(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: incomesKey });
  void queryClient.invalidateQueries({ queryKey: expensesKey });
  void queryClient.invalidateQueries({ queryKey: ["insights"] });
  void queryClient.invalidateQueries({ queryKey: ["overview"] });
}

function invalidateIncomeOverview(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: incomesKey });
  void queryClient.invalidateQueries({ queryKey: ["overview"] });
}

/** Cria renda parcelada (1–60) numa única transação (D12 — Fase 32). */
export function useCreateIncomeInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateIncomeInstallmentsParams) => createIncomeInstallments(params),
    onSuccess: () => invalidateIncomeAggregates(queryClient),
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof createIncome>[0], "user_id">) => createIncome(input),
    onSuccess: () => invalidateIncomeAggregates(queryClient),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIncome(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: incomesKey });
      const snapshot = snapshotQueries(queryClient, incomesKey);
      removeIncomes(queryClient, new Set([id]));
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível excluir a receita",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateIncomeOverview(queryClient),
  });
}

/**
 * Exclusão em grupo de renda parcelada (single/all/subsequent, Fase 32).
 * Rendas automáticas (source_ref) são somente-leitura — nunca alcançadas.
 */
export function useDeleteIncomeGrouped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: InstallmentDeleteMode }) => deleteIncomeInstallments(id, mode),
    onMutate: async ({ id, mode }) => {
      await queryClient.cancelQueries({ queryKey: incomesKey });
      const snapshot = snapshotQueries(queryClient, incomesKey);

      let affected: string[] = [id];
      for (const [, data] of snapshotQueries(queryClient, incomesKey)) {
        if (Array.isArray(data) && data.length > 0) {
          affected = resolveInstallmentGroupDeleteIds(data as unknown as InstallmentLike[], id, mode);
          break;
        }
      }
      removeIncomes(queryClient, new Set(affected));
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível excluir a receita",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateIncomeOverview(queryClient),
  });
}

/** Edição em grupo de renda parcelada (single/all/subsequent, Fase 32). */
export function useUpdateIncomeGrouped() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mode,
      fields,
    }: {
      id: string;
      mode: InstallmentDeleteMode;
      fields: RecurrenceGroupFields;
    }) => updateIncomeInstallmentsGroup(id, mode, fields),
    onMutate: async ({ id, mode, fields }) => {
      await queryClient.cancelQueries({ queryKey: incomesKey });
      const snapshot = snapshotQueries(queryClient, incomesKey);

      let affected: string[] = [id];
      for (const [, data] of snapshotQueries(queryClient, incomesKey)) {
        if (Array.isArray(data) && data.length > 0) {
          affected = resolveInstallmentGroupDeleteIds(data as unknown as InstallmentLike[], id, mode);
          break;
        }
      }
      const patch: Partial<Income> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) patch[key as keyof Income] = value as never;
      }
      for (const incomeId of affected) {
        applyIncomeUpdate(queryClient, incomeId, patch);
      }
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível salvar a receita",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateIncomeAggregates(queryClient),
  });
}

/** Edição de uma renda (rendas automáticas com source_ref são somente-leitura). */
export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DbUpdate<Income> }) => updateIncome(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: incomesKey });
      const snapshot = snapshotQueries(queryClient, incomesKey);
      applyIncomeUpdate(queryClient, id, input);
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível salvar a receita",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateIncomeAggregates(queryClient),
  });
}
