import { buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import type { CardInvoiceExpenseRow, CardInvoicePaymentRow } from "@/components/modules";
import type { CardLimitUsageEntry } from "@/components/modules/credit-card-wallet";
import { numberToCents } from "@/domain/money";
import { currentMonth } from "@/lib/date";
import type { CardPayment, Category, CreditCard, Expense } from "@/types";

export interface PriorityCardSelection {
  cardId: string | null;
  month: string | null;
}

/**
 * Prioriza o cartão principal ativo configurado ou a fatura em aberto
 * com vencimento mais próximo; sem pendências, escolhe o próximo vencimento.
 */
export function selectPriorityCardAndMonth(
  cards: readonly CreditCard[],
  allExpenses: readonly Expense[],
  allPayments: readonly CardPayment[],
  primaryCardId: string | null,
): PriorityCardSelection {
  if (cards.length === 0) return { cardId: null, month: null };

  if (primaryCardId) {
    const activePrimary = cards.find((c) => c.id === primaryCardId && c.is_active);
    if (activePrimary) {
      return { cardId: activePrimary.id, month: null };
    }
  }

  const openBills: Array<{ cardId: string; month: string; dueDate: string }> = [];

  for (const card of cards.filter((c) => c.is_active)) {
    const cExpenses = allExpenses.filter((e) => e.card_id === card.id);
    const cPayments = allPayments.filter((p) => p.card_id === card.id);
    const summaries = buildCompetenceSummaries(cExpenses, cPayments);

    for (const s of summaries) {
      if (s.saldoCents > 0) {
        openBills.push({
          cardId: card.id,
          month: s.month,
          dueDate: invoiceDueDate(s.month, card.due_day),
        });
      }
    }
  }

  if (openBills.length > 0) {
    openBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return { cardId: openBills[0]!.cardId, month: openBills[0]!.month };
  }

  const currM = currentMonth();
  const sortedByDue = [...cards.filter((c) => c.is_active)].sort((a, b) =>
    invoiceDueDate(currM, a.due_day).localeCompare(invoiceDueDate(currM, b.due_day)),
  );
  const fallbackCard = sortedByDue[0] ?? cards[0];
  return { cardId: fallbackCard?.id ?? null, month: null };
}

/** Calcula o saldo bruto e ponderado utilizado por cartão na competência ativa. */
export function buildUsedLimitMap(
  cards: readonly CreditCard[],
  allExpenses: readonly Expense[],
  allPayments: readonly CardPayment[],
  effectiveMonth: string,
): Record<string, CardLimitUsageEntry> {
  const map: Record<string, CardLimitUsageEntry> = {};
  for (const card of cards) {
    const cExpenses = allExpenses.filter((e) => e.card_id === card.id);
    const cPayments = allPayments.filter((p) => p.card_id === card.id);
    const cSum = buildCompetenceSummaries(cExpenses, cPayments).find((s) => s.month === effectiveMonth);
    if (cSum) {
      map[card.id] = {
        brutoCents: cSum.saldoBrutoCents,
        ponderadoCents: cSum.saldoPonderadoCents,
      };
    }
  }
  return map;
}

/** Converte despesas da fatura para o formato tabular de exportação CSV e impressão PDF. */
export function buildInvoiceExpenseRows(
  expenses: readonly Expense[],
  categoryById: Map<string, Category>,
): CardInvoiceExpenseRow[] {
  return expenses.map((expense) => ({
    date: expense.date,
    description: expense.description ?? "",
    categoryName: categoryById.get(expense.category_id)?.name ?? "Sem categoria",
    valueCents: numberToCents(expense.value),
    reportValueCents: numberToCents(expense.value * expense.report_weight),
    installments: expense.installments_total > 1 ? `${expense.installment_number}/${expense.installments_total}` : "—",
  }));
}

/** Converte pagamentos e estornos da competência para o formato imprimível. */
export function buildPrintPaymentRows(payments: readonly CardPayment[]): CardInvoicePaymentRow[] {
  return payments.map((payment) => ({
    date: payment.date,
    note: payment.note,
    amountCents: numberToCents(Math.abs(payment.amount)),
    isRefund: payment.amount < 0,
  }));
}

export function slugifyCardFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
