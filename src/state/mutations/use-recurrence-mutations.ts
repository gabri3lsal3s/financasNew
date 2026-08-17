import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createRecurrence, deleteRecurrenceOccurrences, updateRecurrenceOccurrences } from "@/data/rpc";
import type { CreateRecurrenceParams, RecurrenceGroupFields } from "@/data/rpc";
import { recurrencesKey } from "@/state/queries/use-recurrences";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { cardExpensesKey } from "@/state/queries/use-card-payments";
import { resolveOccurrenceDeleteIds } from "@/domain/recurrences";
import type { RecurrenceOccurrence } from "@/domain/recurrences";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import {
  applyExpenseUpdate,
  applyIncomeUpdate,
  applyRecurrenceUpdate,
  removeExpenses,
  removeIncomes,
  removeRecurrences,
  restoreQueries,
  snapshotQueries,
} from "./optimistic-cache";
import type { Expense, Income, InstallmentDeleteMode, Recurrence } from "@/types";

/**
 * Mutations de recorrência (Fase 32 — Online First, padrão otimista F30):
 * onMutate/onError/onSettled com rollback seguro + toast em falha. A exclusão
 * e a edição em grupo (single/all/subsequent) refletem no cache na hora,
 * resolvendo os ids afetados com os motores puros de `domain/recurrences`.
 */

const FINANCE_KEYS = [
  recurrencesKey,
  expensesKey,
  incomesKey,
  cardExpensesKey,
  ["debts"],
  ["insights"],
  ["overview"],
] as const satisfies readonly (readonly string[])[];

function invalidateFinanceAggregates(queryClient: QueryClient) {
  for (const key of FINANCE_KEYS) void queryClient.invalidateQueries({ queryKey: key });
}

/** Forma mínima das linhas de ledger (despesa/renda) com vínculo de recorrência. */
type LedgerRow = Pick<Expense, "id" | "recurrence_id" | "occurrence_number" | "date">;

/** Linhas do ledger → ocorrências de domínio (para resolução de grupo). */
function toOccurrences(rows: readonly LedgerRow[]): RecurrenceOccurrence[] {
  return rows
    .filter((row) => row.recurrence_id != null && row.occurrence_number != null)
    .map((row) => ({
      id: row.id,
      recurrenceId: row.recurrence_id as string,
      date: row.date,
      occurrenceNumber: row.occurrence_number as number,
      valueCents: 0,
    }));
}

/** Snapshot de todas as listas afetadas por recorrência (rollback). */
function snapshotRecurrenceCaches(queryClient: QueryClient) {
  return [
    ...snapshotQueries(queryClient, recurrencesKey),
    ...snapshotQueries(queryClient, expensesKey),
    ...snapshotQueries(queryClient, incomesKey),
    ...snapshotQueries(queryClient, cardExpensesKey),
  ];
}

/** Coleta as linhas de ledger em cache (qualquer mês/range/cartão). */
function collectLedgerRows(queryClient: QueryClient): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const [, data] of snapshotQueries(queryClient, expensesKey)) {
    if (Array.isArray(data)) rows.push(...(data as Expense[]));
  }
  for (const [, data] of snapshotQueries(queryClient, incomesKey)) {
    if (Array.isArray(data)) rows.push(...(data as Income[]));
  }
  return rows;
}

/** Remove nulos/undefined do patch (campos ausentes não devem sobrescrever). */
function compactFields(fields: RecurrenceGroupFields): Partial<Recurrence> {
  const patch: Partial<Recurrence> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) patch[key as keyof Recurrence] = value as never;
  }
  return patch;
}

/** Cria o template de recorrência (não materializa — sob demanda). */
export function useCreateRecurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateRecurrenceParams) => createRecurrence(params),
    onSuccess: () => invalidateFinanceAggregates(queryClient),
  });
}

/** Exclusão de ocorrência(s) em 3 modos (single → skip; all/subsequent → template). */
export function useDeleteRecurrenceOccurrences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ occurrenceId, mode }: { occurrenceId: string; mode: InstallmentDeleteMode }) =>
      deleteRecurrenceOccurrences(occurrenceId, mode),
    onMutate: async ({ occurrenceId, mode }) => {
      await queryClient.cancelQueries({ queryKey: expensesKey });
      await queryClient.cancelQueries({ queryKey: incomesKey });
      await queryClient.cancelQueries({ queryKey: cardExpensesKey });
      const snapshot = snapshotRecurrenceCaches(queryClient);

      const rows = collectLedgerRows(queryClient);
      const target = rows.find((row) => row.id === occurrenceId);
      const recurrenceId = target?.recurrence_id ?? null;
      const affected =
        recurrenceId != null ? resolveOccurrenceDeleteIds(toOccurrences(rows), occurrenceId, mode) : [occurrenceId];

      removeExpenses(queryClient, new Set(affected));
      removeIncomes(queryClient, new Set(affected));

      // all (ou subsequent da 1ª ocorrência) remove o template do cache.
      const removesTemplate = mode === "all" || (mode === "subsequent" && target?.occurrence_number === 1);
      if (removesTemplate && recurrenceId != null) {
        removeRecurrences(queryClient, new Set([recurrenceId]));
      }
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível excluir a recorrência",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateFinanceAggregates(queryClient),
  });
}

/** Edição em grupo de ocorrências (single/all/subsequent) + sincronização do template. */
export function useUpdateRecurrenceOccurrences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      occurrenceId,
      mode,
      fields,
    }: {
      occurrenceId: string;
      mode: InstallmentDeleteMode;
      fields: RecurrenceGroupFields;
    }) => updateRecurrenceOccurrences(occurrenceId, mode, fields),
    onMutate: async ({ occurrenceId, mode, fields }) => {
      await queryClient.cancelQueries({ queryKey: expensesKey });
      await queryClient.cancelQueries({ queryKey: incomesKey });
      await queryClient.cancelQueries({ queryKey: cardExpensesKey });
      const snapshot = snapshotRecurrenceCaches(queryClient);

      const rows = collectLedgerRows(queryClient);
      const target = rows.find((row) => row.id === occurrenceId);
      const recurrenceId = target?.recurrence_id ?? null;
      const affected =
        recurrenceId != null ? resolveOccurrenceDeleteIds(toOccurrences(rows), occurrenceId, mode) : [occurrenceId];

      const patch = compactFields(fields);
      for (const id of affected) {
        applyExpenseUpdate(queryClient, id, patch as Partial<Expense>);
        applyIncomeUpdate(queryClient, id, patch as Partial<Income>);
      }
      // all/subsequent sincroniza o template (regra vale para as próximas).
      if (mode !== "single" && recurrenceId != null) {
        applyRecurrenceUpdate(queryClient, recurrenceId, patch);
      }
      return { snapshot };
    },
    onError: (error, _variables, context) => {
      if (context) restoreQueries(queryClient, context.snapshot);
      pushToast({
        title: "Não foi possível salvar a recorrência",
        description: `${getErrorMessage(error)} Os dados foram restaurados.`,
        variant: "destructive",
      });
    },
    onSettled: () => invalidateFinanceAggregates(queryClient),
  });
}
