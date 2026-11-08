/**
 * Motor Puro de Discriminação de Obrigações do Ciclo & Visão de Longo Prazo.
 *
 * Apura detalhadamente:
 *  - As faturas de cartão de crédito em aberto do ciclo atual (por cartão);
 *  - As contas e dívidas a pagar com vencimento no mês corrente (ou atrasadas);
 *  - Os recebíveis previstos do mês (se houver);
 *  - O somatório e quantitativo de dívidas futuras (médio/longo prazo);
 *  - Garante invariantes de soma com o Safe-to-Spend.
 */

import { autoSelectBillMonth, buildCompetenceSummaries, invoiceDueDate } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";
import { shiftMonth } from "@/lib/date";

export interface CycleInvoiceItem {
  cardId: string;
  cardName: string;
  cardColor: string | null;
  competenceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  saldoCents: number;
}

export interface CycleDebtItem {
  id: string;
  name: string;
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
  isOverdue: boolean;
  type: "payable" | "receivable";
}

export interface CycleFutureDebtsSummary {
  count: number;
  totalCents: number;
}

export interface CycleObligationsBreakdown {
  invoices: CycleInvoiceItem[];
  openInvoicesCents: number;
  payableDebts: CycleDebtItem[];
  payableDebtsCents: number;
  committedObligationsCents: number;
  receivableDebts: CycleDebtItem[];
  receivablePendingCents: number;
  futureDebts: CycleFutureDebtsSummary;
}

export interface BreakdownCycleObligationsParams {
  cards: readonly {
    id: string;
    name: string;
    due_day: number;
    color?: string | null;
    is_active?: boolean;
  }[];
  cardExpenses: readonly {
    card_id: string | null;
    bill_competence: string | null;
    value: number;
    report_weight: number;
  }[];
  cardPayments: readonly {
    card_id: string;
    competence_month: string;
    amount: number;
  }[];
  debts: readonly {
    id: string;
    name: string;
    amount: number;
    due_date: string;
    type: "payable" | "receivable";
    paid_at: string | null;
  }[];
  referenceDate?: string; // YYYY-MM-DD (defaults to todayISO())
}

export function breakdownCycleObligations(
  params: BreakdownCycleObligationsParams,
): CycleObligationsBreakdown {
  const {
    cards,
    cardExpenses,
    cardPayments,
    debts,
    referenceDate = todayISO(),
  } = params;

  const currentMonthStr = referenceDate.slice(0, 7);
  const currentMonthRangeEnd = `${shiftMonth(currentMonthStr, 1)}-01`;

  // 1. Apuração de faturas de cartão de crédito no ciclo
  const activeCards = cards.filter((c) => c.is_active !== false);
  const invoiceItems: CycleInvoiceItem[] = [];
  let openInvoicesCents = 0;

  for (const card of activeCards) {
    const cardExp = cardExpenses.filter((e) => e.card_id === card.id);
    const cardPay = cardPayments.filter((p) => p.card_id === card.id);
    const summaries = buildCompetenceSummaries(cardExp, cardPay);
    if (summaries.length === 0) continue;

    const month = autoSelectBillMonth(summaries, referenceDate);
    const summary = summaries.find((s) => s.month === month);
    if (summary && summary.saldoCents > 0) {
      const dueDate = invoiceDueDate(month, card.due_day);
      invoiceItems.push({
        cardId: card.id,
        cardName: card.name,
        cardColor: card.color ?? null,
        competenceMonth: month,
        dueDate,
        saldoCents: summary.saldoCents,
      });
      openInvoicesCents += summary.saldoCents;
    }
  }

  // Ordena faturas pela data de vencimento
  invoiceItems.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  // 2. Apuração de dívidas a pagar e a receber do ciclo
  const payableDebts: CycleDebtItem[] = [];
  let payableDebtsCents = 0;

  const receivableDebts: CycleDebtItem[] = [];
  let receivablePendingCents = 0;

  let futureDebtsCount = 0;
  let futureDebtsCents = 0;

  for (const debt of debts) {
    if (debt.paid_at !== null) continue;

    const amountCents = Math.max(0, numberToCents(debt.amount));

    if (debt.type === "payable") {
      if (debt.due_date <= currentMonthRangeEnd) {
        payableDebts.push({
          id: debt.id,
          name: debt.name,
          dueDate: debt.due_date,
          amountCents,
          isOverdue: debt.due_date < referenceDate,
          type: "payable",
        });
        payableDebtsCents += amountCents;
      } else {
        futureDebtsCount += 1;
        futureDebtsCents += amountCents;
      }
    } else if (debt.type === "receivable") {
      if (debt.due_date <= currentMonthRangeEnd) {
        receivableDebts.push({
          id: debt.id,
          name: debt.name,
          dueDate: debt.due_date,
          amountCents,
          isOverdue: debt.due_date < referenceDate,
          type: "receivable",
        });
        receivablePendingCents += amountCents;
      }
    }
  }

  // Ordena dívidas por vencimento (mais antigas/atrasadas primeiro)
  payableDebts.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  receivableDebts.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const committedObligationsCents = openInvoicesCents + payableDebtsCents;

  return {
    invoices: invoiceItems,
    openInvoicesCents,
    payableDebts,
    payableDebtsCents,
    committedObligationsCents,
    receivableDebts,
    receivablePendingCents,
    futureDebts: {
      count: futureDebtsCount,
      totalCents: futureDebtsCents,
    },
  };
}
