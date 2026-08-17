import type { QueryClient } from "@tanstack/react-query";
import { expensesKey } from "@/state/queries/use-expenses";
import { incomesKey } from "@/state/queries/use-incomes";
import { recurrencesKey } from "@/state/queries/use-recurrences";
import { cardExpensesKey, cardPaymentsKey } from "@/state/queries/use-card-payments";
import type { CardPayment, Expense, Income, Recurrence } from "@/types";

/**
 * Helpers de atualização otimista do cache (AGENTS §5 / docs/ARCHITECTURE §5):
 * snapshot + rollback + aplicação dirigida por chave estável. Os motores
 * financeiros permanecem no domínio — aqui só navegamos/transformamos o cache.
 */

/** Snapshot de todas as queries que casam (parcialmente) com a chave raiz. */
export function snapshotQueries(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): Array<[readonly unknown[], unknown]> {
  return queryClient.getQueriesData({ queryKey });
}

/** Restaura o snapshot anterior (rollback seguro). */
export function restoreQueries(
  queryClient: QueryClient,
  snapshot: Array<[readonly unknown[], unknown]>,
): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}

type ListShape = readonly { id: string }[] | null | undefined;

/** Aplica um updater em todas as listas sob a chave raiz (mês/range/cartão). */
function applyToListCaches(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (list: ListShape) => ListShape,
): void {
  for (const [cachedKey, data] of snapshotQueries(queryClient, queryKey)) {
    if (Array.isArray(data)) {
      queryClient.setQueryData(cachedKey, updater(data as ListShape));
    }
  }
}

/**
 * Mescla um patch otimista na despesa em todas as listas de despesas
 * (`expenses` por mês/range e `card_expenses` por cartão) e na query
 * singular `["expenses", id]`. Itens não encontrados ficam intactos.
 */
export function applyExpenseUpdate(
  queryClient: QueryClient,
  id: string,
  patch: Partial<Expense>,
): void {
  for (const root of [expensesKey, cardExpensesKey]) {
    applyToListCaches(queryClient, root, (list) =>
      (list ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }
  for (const [cachedKey, data] of snapshotQueries(queryClient, expensesKey)) {
    if (data !== null && typeof data === "object" && "id" in (data as object) && (data as { id: string }).id === id) {
      queryClient.setQueryData(cachedKey, { ...(data as object), ...patch });
    }
  }
}

/** Remove os ids informados de todas as listas de despesas + query singular. */
export function removeExpenses(
  queryClient: QueryClient,
  ids: ReadonlySet<string>,
): void {
  for (const root of [expensesKey, cardExpensesKey]) {
    applyToListCaches(queryClient, root, (list) => (list ?? []).filter((item) => !ids.has(item.id)));
    for (const [cachedKey, data] of snapshotQueries(queryClient, root)) {
      if (data !== null && typeof data === "object" && "id" in (data as object) && ids.has((data as { id: string }).id)) {
        queryClient.setQueryData(cachedKey, null);
      }
    }
  }
}

/** Mescla um patch otimista na renda em todas as listas de rendas. */
export function applyIncomeUpdate(
  queryClient: QueryClient,
  id: string,
  patch: Partial<Income>,
): void {
  applyToListCaches(queryClient, incomesKey, (list) =>
    (list ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
}

/** Remove os ids informados de todas as listas de rendas. */
export function removeIncomes(
  queryClient: QueryClient,
  ids: ReadonlySet<string>,
): void {
  applyToListCaches(queryClient, incomesKey, (list) =>
    (list ?? []).filter((item) => !ids.has(item.id)),
  );
}

/** Mescla um patch otimista no template de recorrência (Fase 32). */
export function applyRecurrenceUpdate(
  queryClient: QueryClient,
  id: string,
  patch: Partial<Recurrence>,
): void {
  applyToListCaches(queryClient, recurrencesKey, (list) =>
    (list ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
  );
}

/** Remove os templates informados de todas as listas de recorrências. */
export function removeRecurrences(
  queryClient: QueryClient,
  ids: ReadonlySet<string>,
): void {
  applyToListCaches(queryClient, recurrencesKey, (list) =>
    (list ?? []).filter((item) => !ids.has(item.id)),
  );
}

/** Remove rendas automáticas com o source_ref exato (ex.: estorno `[REFUND]{id}`). */
export function removeIncomesBySourceRef(
  queryClient: QueryClient,
  sourceRef: string,
): void {
  applyToListCaches(queryClient, incomesKey, (list) =>
    (list ?? []).filter((item) => (item as Income).source_ref !== sourceRef),
  );
}

/** Remove os ids informados de todas as listas de pagamentos/estornos de cartão. */
export function removeCardPayments(
  queryClient: QueryClient,
  ids: ReadonlySet<string>,
): void {
  applyToListCaches(queryClient, cardPaymentsKey, (list) =>
    (list ?? []).filter((item) => !ids.has((item as CardPayment).id)),
  );
}
