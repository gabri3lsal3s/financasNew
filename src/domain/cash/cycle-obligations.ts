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

import { resolveOpenCardInvoices } from "@/domain/cards";
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
  /** Faturas do próximo ciclo em acumulação (mês seguinte ao atual, ainda dentro do limite em aberto). */
  nextCycleInvoices?: CycleInvoiceItem[];
  nextCycleInvoicesCents?: number;
  /** Faturas futuras / parcelamentos posteriores (além do próximo ciclo). */
  futureInvoices?: CycleInvoiceItem[];
  futureInvoicesCents?: number;
  /** Soma total de compromissos em faturas fora do ciclo atual (`nextCycleInvoicesCents + futureInvoicesCents`). */
  totalUpcomingCardInvoicesCents?: number;
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
    closing_day?: number;
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
    is_refund?: boolean;
  }[];
  cardRollovers?: readonly {
    card_id: string;
    from_competence_month: string;
    to_competence_month: string;
    principal_amount: number;
    kind?: "rollover" | "refinance";
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
    cardRollovers = [],
    debts,
    referenceDate = todayISO(),
  } = params;

  const currentMonthStr = referenceDate.slice(0, 7);
  const nextMonthStr = shiftMonth(currentMonthStr, 1);
  const currentMonthRangeEnd = `${nextMonthStr}-01`;

  // 1. Apuração em 3 camadas de faturas de cartão de crédito em aberto (SSOT):
  //    (a) Ciclo atual (vencidas ou vencendo até o fim deste mês civil);
  //    (b) Próximo ciclo em acumulação (mês seguinte — reduz "Livre para gastar", não o Saldo Livre do ciclo);
  //    (c) Faturas futuras / parcelamentos posteriores (> próximo mês).
  const allOpenInvoices = resolveOpenCardInvoices({
    cards,
    expenses: cardExpenses,
    payments: cardPayments,
    rollovers: cardRollovers,
    today: referenceDate,
  });

  const toCycleInvoiceItem = (inv: (typeof allOpenInvoices)[number]): CycleInvoiceItem => ({
    cardId: inv.cardId,
    cardName: inv.cardName,
    cardColor: inv.cardColor,
    competenceMonth: inv.competenceMonth,
    dueDate: inv.effectiveDueDate,
    saldoCents: inv.saldoBrutoCents,
  });

  const invoiceItems: CycleInvoiceItem[] = [];
  const nextCycleInvoices: CycleInvoiceItem[] = [];
  const futureInvoices: CycleInvoiceItem[] = [];

  for (const inv of allOpenInvoices) {
    const item = toCycleInvoiceItem(inv);
    if (
      inv.isOverdue ||
      inv.competenceMonth <= currentMonthStr ||
      inv.effectiveDueDate < currentMonthRangeEnd
    ) {
      invoiceItems.push(item);
    } else if (inv.competenceMonth === nextMonthStr) {
      nextCycleInvoices.push(item);
    } else {
      futureInvoices.push(item);
    }
  }

  const openInvoicesCents = invoiceItems.reduce((acc, item) => acc + item.saldoCents, 0);
  const nextCycleInvoicesCents = nextCycleInvoices.reduce((acc, item) => acc + item.saldoCents, 0);
  const futureInvoicesCents = futureInvoices.reduce((acc, item) => acc + item.saldoCents, 0);
  const totalUpcomingCardInvoicesCents = nextCycleInvoicesCents + futureInvoicesCents;

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
    nextCycleInvoices,
    nextCycleInvoicesCents,
    futureInvoices,
    futureInvoicesCents,
    totalUpcomingCardInvoicesCents,
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
