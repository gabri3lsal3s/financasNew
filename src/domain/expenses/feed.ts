import type { Expense, Income } from "@/types";
import { numberToCents } from "@/domain/money";

export type FeedFilter = "all" | "incomes" | "expenses" | "installments" | "recurring";

export interface TransactionFeedItem {
  id: string;
  kind: "expense" | "income";
  description: string;
  date: string;
  amountCents: number;
  weightedCents: number;
  reportWeight: number;
  categoryId: string;
  recurrenceId?: string | null;
  paymentMethod?: string | null;
  creditCardId?: string | null;
  installmentNumber?: number;
  installmentsTotal?: number;
  rawExpense?: Expense;
  rawIncome?: Income;
}

export interface DailyFeedGroup {
  date: string;
  netCents: number;
  incomeCents: number;
  expenseCents: number;
  items: TransactionFeedItem[];
}

/**
 * Normaliza despesas e receitas em itens padronizados de feed e aplica o filtro selecionado.
 */
export function buildUnifiedFeedItems(
  expenses: readonly Expense[],
  incomes: readonly Income[],
  filter: FeedFilter = "all",
): TransactionFeedItem[] {
  const items: TransactionFeedItem[] = [];

  if (filter !== "incomes") {
    for (const exp of expenses) {
      const isRecurring = Boolean(exp.recurrence_id);
      const isInstallment = exp.installments_total > 1;

      if (filter === "recurring" && !isRecurring) continue;
      if (filter === "installments" && !isInstallment) continue;

      const amountCents = numberToCents(exp.value);
      const weightedCents = numberToCents(exp.value * exp.report_weight);

      items.push({
        id: exp.id,
        kind: "expense",
        description: exp.description || "",
        date: exp.date,
        amountCents,
        weightedCents,
        reportWeight: exp.report_weight,
        categoryId: exp.category_id,
        recurrenceId: exp.recurrence_id,
        paymentMethod: exp.payment_method,
        creditCardId: exp.card_id,
        installmentNumber: exp.installment_number,
        installmentsTotal: exp.installments_total,
        rawExpense: exp,
      });
    }
  }

  if (filter !== "expenses" && filter !== "installments") {
    for (const inc of incomes) {
      const isRecurring = Boolean(inc.recurrence_id);
      if (filter === "recurring" && !isRecurring) continue;

      const amountCents = numberToCents(inc.value);
      const weightedCents = numberToCents(inc.value * inc.report_weight);

      items.push({
        id: inc.id,
        kind: "income",
        description: inc.description || "",
        date: inc.date,
        amountCents,
        weightedCents,
        reportWeight: inc.report_weight,
        categoryId: inc.category_id,
        recurrenceId: inc.recurrence_id,
        rawIncome: inc,
      });
    }
  }

  // Ordenação estável: data decrescente.
  // Em empate de data: receitas primeiro (ordem de saldo do dia), seguido de valor desc.
  return items.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    if (a.kind !== b.kind) {
      return a.kind === "income" ? -1 : 1;
    }
    return b.amountCents - a.amountCents;
  });
}

/**
 * Agrupa itens de feed ordenados por dia (data ISO YYYY-MM-DD),
 * calculando os totalizadores de receitas, despesas e saldo líquido do dia.
 */
export function groupFeedByDay(items: readonly TransactionFeedItem[]): DailyFeedGroup[] {
  const groups: DailyFeedGroup[] = [];
  let currentGroup: DailyFeedGroup | null = null;

  for (const item of items) {
    if (!currentGroup || currentGroup.date !== item.date) {
      currentGroup = {
        date: item.date,
        netCents: 0,
        incomeCents: 0,
        expenseCents: 0,
        items: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.items.push(item);
    if (item.kind === "income") {
      currentGroup.incomeCents += item.amountCents;
      currentGroup.netCents += item.amountCents;
    } else {
      currentGroup.expenseCents += item.amountCents;
      currentGroup.netCents -= item.amountCents;
    }
  }

  return groups;
}
