import type { Expense, Income } from "@/types";
import { numberToCents } from "@/domain/money";

export type FeedFilter = "all" | "incomes" | "expenses" | "installments" | "recurring";

/** Escopo de visão do extrato (Fase 3 — Tarefa 3.3). */
export type VisionScope = "all" | "personal" | "family";

/**
 * Filtra despesas ou receitas pelo escopo de visão do usuário (Fase 3).
 * - "all": retorna todos os registros.
 * - "personal": retorna apenas despesas/receitas individuais (!is_family).
 * - "family": retorna apenas despesas/receitas do lar/orçamento familiar (is_family === true).
 */
export function filterByVisionScope<T extends { is_family?: boolean }>(
  items: readonly T[],
  scope: VisionScope = "all",
): T[] {
  if (scope === "personal") {
    return items.filter((item) => !item.is_family);
  }
  if (scope === "family") {
    return items.filter((item) => Boolean(item.is_family));
  }
  return [...items];
}

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
  /** Lançamento da casa / familiar compartilhado (Fase 3). */
  isFamily?: boolean;
}

export interface DailyFeedGroup {
  date: string;
  netCents: number;
  weightedNetCents: number;
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
        isFamily: Boolean(exp.is_family),
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
        isFamily: Boolean(inc.is_family),
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
        weightedNetCents: 0,
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
      currentGroup.weightedNetCents += item.weightedCents;
    } else {
      currentGroup.expenseCents += item.amountCents;
      currentGroup.netCents -= item.amountCents;
      currentGroup.weightedNetCents -= item.weightedCents;
    }
  }

  return groups;
}
