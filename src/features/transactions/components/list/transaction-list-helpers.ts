import {
  buildUnifiedFeedItems,
  groupFeedByDay,
  type DailyFeedGroup,
  type FeedFilter,
  type TransactionFeedItem,
} from "@/domain/expenses";
import { serializeUnifiedTransactionsCsv, type ExportUnifiedTransactionRow } from "@/domain/export";
import { evaluateExpensePriceEvolution, type ExpensePriceEvolution } from "@/domain/insights";
import { sumGrossCents, sumWeightedCents } from "@/domain/money";
import { PAYMENT_METHOD_LABELS, RECEIVE_TYPE_LABELS } from "@/lib/labels";
import { downloadCsv } from "@/services/export-actions";
import type { Category, Expense, Income } from "@/types";

export const TRANSACTIONS_PAGE_SIZE = 50;

export function resolveInitialFeedFilter(paramFilter: string | null): FeedFilter {
  if (paramFilter === "incomes" || paramFilter === "receitas") return "incomes";
  if (paramFilter === "expenses" || paramFilter === "despesas") return "expenses";
  if (paramFilter === "installments" || paramFilter === "parceladas") return "installments";
  if (paramFilter === "recurring" || paramFilter === "recorrentes") return "recurring";
  return "all";
}

export function buildPriceEvolutionMap(
  expenses: readonly Expense[],
  allHistoryExpenses: readonly Expense[],
): Map<string, ExpensePriceEvolution> {
  const map = new Map<string, ExpensePriceEvolution>();
  for (const exp of expenses) {
    const evo = evaluateExpensePriceEvolution(exp, allHistoryExpenses);
    if (evo?.hasPriceIncrease) map.set(exp.id, evo);
  }
  return map;
}

export function computeTransactionTotals(expenses: readonly Expense[], incomes: readonly Income[]) {
  const incomesTotalCents = sumGrossCents(incomes);
  const expensesTotalCents = sumGrossCents(expenses);
  const incomesWeightedCents = sumWeightedCents(incomes);
  const expensesWeightedCents = sumWeightedCents(expenses);
  return {
    incomesTotalCents,
    expensesTotalCents,
    incomesWeightedCents,
    expensesWeightedCents,
    balanceCents: incomesTotalCents - expensesTotalCents,
    balanceWeightedCents: incomesWeightedCents - expensesWeightedCents,
  };
}

export function computePagedFeed(params: {
  expenses: readonly Expense[];
  incomes: readonly Income[];
  filter: FeedFilter;
  searchQuery: string;
  categoryById: Map<string, Category>;
  highlightId: string | null;
  visibleCount: number;
}): {
  filteredFeedItems: TransactionFeedItem[];
  effectiveVisibleCount: number;
  hasMore: boolean;
  feedGroups: DailyFeedGroup[];
} {
  const { expenses, incomes, filter, searchQuery, categoryById, highlightId, visibleCount } = params;
  const feedItems = buildUnifiedFeedItems(expenses, incomes, filter);
  const q = searchQuery.trim().toLowerCase();
  const filteredFeedItems = q
    ? feedItems.filter((item) => {
        const desc = (item.description ?? "").toLowerCase();
        const catName = (categoryById.get(item.categoryId)?.name ?? "").toLowerCase();
        return desc.includes(q) || catName.includes(q);
      })
    : feedItems;

  const highlightIndex = highlightId
    ? filteredFeedItems.findIndex((it) => it.id === highlightId)
    : -1;
  const effectiveVisibleCount =
    highlightIndex >= 0 && highlightIndex >= visibleCount
      ? Math.ceil((highlightIndex + 1) / TRANSACTIONS_PAGE_SIZE) * TRANSACTIONS_PAGE_SIZE
      : visibleCount;

  const visibleFeedItems = filteredFeedItems.slice(0, effectiveVisibleCount);
  return {
    filteredFeedItems,
    effectiveVisibleCount,
    hasMore: filteredFeedItems.length > effectiveVisibleCount,
    feedGroups: groupFeedByDay(visibleFeedItems),
  };
}

export function exportTransactionsToCsv(params: {
  items: TransactionFeedItem[];
  month: string;
  filter: FeedFilter;
  categoryById: Map<string, Category>;
  cardById: Map<string, string>;
  recurrenceLabel: (recurrenceId: string | null | undefined) => string | undefined;
}): void {
  const { items, month, filter, categoryById, cardById, recurrenceLabel } = params;
  if (items.length === 0) return;

  const rows: ExportUnifiedTransactionRow[] = items.map((item) => {
    const exp = item.rawExpense ?? null;
    const inc = item.rawIncome ?? null;
    const catId = exp?.category_id ?? inc?.category_id ?? item.categoryId;
    return {
      date: item.date,
      type: item.kind,
      description: item.description,
      categoryName: (catId ? categoryById.get(catId)?.name : null) ?? "Sem categoria",
      valueCents: item.amountCents,
      reportValueCents: Math.round(item.amountCents * (item.reportWeight ?? 1)),
      detailsOrMethod:
        item.kind === "expense"
          ? exp ? (PAYMENT_METHOD_LABELS[exp.payment_method] ?? exp.payment_method) : ""
          : inc ? (RECEIVE_TYPE_LABELS[inc.receive_type] ?? inc.receive_type) : "",
      cardName: exp?.card_id ? (cardById.get(exp.card_id) ?? null) : null,
      installments:
        exp && exp.installments_total > 1 ? `${exp.installment_number}/${exp.installments_total}` : "—",
      recurrenceLabel: recurrenceLabel(exp?.recurrence_id ?? inc?.recurrence_id ?? item.recurrenceId),
    };
  });

  const filterSlug = filter === "all" ? "todas" : filter;
  downloadCsv(`transacoes_${month}_${filterSlug}.csv`, serializeUnifiedTransactionsCsv(rows));
}
