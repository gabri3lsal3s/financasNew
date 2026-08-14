/**
 * Faturas de cartão — ESPECIFICAÇÃO §3.3.3.
 *
 * Saldo aberto = `max(0, previsto − pago)` por competência — pagamento a
 * maior nunca gera saldo negativo. Status da fatura para lembretes/UI:
 * fechada (sem pendências), em aberto, vence em breve (janela configurável)
 * ou vencida.
 *
 * Motor puro — testável isoladamente.
 */

import { addDaysISO, todayISO } from "@/domain/debts";
import { clampDay } from "@/domain/competence";
import { APP_START_DATE } from "@/types";

/** Saldo aberto de uma fatura (previsto − pago, nunca negativo). */
export function invoiceBalance(previstoCents: number, pagoCents: number): number {
  return Math.max(0, previstoCents - pagoCents);
}

export type InvoiceStatus = "closed" | "open" | "near_due" | "overdue";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  closed: "Fechada",
  open: "Em aberto",
  near_due: "Vence em breve",
  overdue: "Vencida",
};

/**
 * Status da fatura de uma competência.
 * @param competenceMonth YYYY-MM da fatura
 * @param dueDay dia do vencimento (1–31, clampado ao mês)
 * @param balanceCents saldo aberto (previsto − pago)
 * @param today referência (YYYY-MM-DD) — injetável
 * @param nearDueDays janela de "vence em breve" (default 3)
 */
export function invoiceStatus(
  competenceMonth: string,
  dueDay: number,
  balanceCents: number,
  today: string = todayISO(),
  nearDueDays = 3,
): InvoiceStatus {
  if (balanceCents <= 0) return "closed";

  const [year, month] = competenceMonth.split("-").map(Number);
  const y = year ?? 0;
  const m = (month ?? 1) - 1;
  const dueDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(clampDay(dueDay, y, m)).padStart(2, "0")}`;

  if (dueDate < today) return "overdue";
  if (dueDate <= addDaysISO(today, nearDueDays)) return "near_due";
  return "open";
}

/** Desloca um mês YYYY-MM por `delta` meses (helper local puro). */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const total = (year ?? 0) * 12 + ((monthNum ?? 1) - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

export interface CompetenceSummary {
  /** YYYY-MM */
  month: string;
  /** Previsto = soma das despesas com peso aplicado (centavos). */
  previstoCents: number;
  /** Pago = soma dos pagamentos positivos (centavos). Estornos ficam à parte. */
  pagoCents: number;
  /** Soma dos estornos (valores absolutos, centavos). */
  estornoCents: number;
  /** Saldo aberto = max(0, previsto − pago) (centavos). */
  saldoCents: number;
}

/**
 * Resumos por competência a partir das despesas do cartão (com peso aplicado
 * e base_amount preservado) e dos pagamentos/estornos — ESPECIFICAÇÃO §3.3.3.
 * Motor puro: nenhuma consulta, apenas derivação exibível.
 */
export function buildCompetenceSummaries(
  expenses: readonly {
    bill_competence: string | null;
    value: number;
    report_weight: number;
  }[],
  payments: readonly { competence_month: string; amount: number }[],
): CompetenceSummary[] {
  const months = new Set<string>();
  for (const expense of expenses) {
    if (expense.bill_competence) months.add(expense.bill_competence);
  }
  for (const payment of payments) months.add(payment.competence_month);

  const summaries: CompetenceSummary[] = [];
  for (const month of months) {
    const previsto = expenses
      .filter((e) => e.bill_competence === month)
      .reduce((acc, e) => acc + Math.round(e.value * e.report_weight * 100), 0);
    const pago = payments
      .filter((p) => p.competence_month === month && p.amount > 0)
      .reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
    const estorno = payments
      .filter((p) => p.competence_month === month && p.amount < 0)
      .reduce((acc, p) => acc + Math.round(-p.amount * 100), 0);
    summaries.push({
      month,
      previstoCents: previsto,
      pagoCents: pago,
      estornoCents: estorno,
      saldoCents: invoiceBalance(previsto, pago),
    });
  }
  return summaries.sort((a, b) => (a.month < b.month ? 1 : -1));
}

/**
 * Seleção automática do mês de fatura — ESPECIFICAÇÃO §3.3.3:
 * mês atual se tiver pendências; senão varre para trás (até APP_START_DATE)
 * pelo mês mais recente com pendências; se nenhum, tenta o mês seguinte;
 * por fim, mês atual. Deep-links (?card= / ?month=) sobrepõem na UI.
 * @param summaries saldo por competência (derivado de despesas + pagamentos)
 * @param today referência (YYYY-MM-DD) — injetável
 */
export function autoSelectBillMonth(
  summaries: readonly { month: string; saldoCents: number }[],
  today: string = todayISO(),
): string {
  const current = today.slice(0, 7);
  const hasBalance = (month: string) => (summaries.find((s) => s.month === month)?.saldoCents ?? 0) > 0;

  if (hasBalance(current)) return current;

  // APP_START_DATE é YYYY-MM-DD; aqui comparamos meses (YYYY-MM).
  const startMonth = APP_START_DATE.slice(0, 7);
  const past = summaries
    .filter((s) => s.month < current && s.month >= startMonth && s.saldoCents > 0)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  if (past.length > 0) return past[0]?.month ?? current;

  if (hasBalance(shiftMonth(current, 1))) return shiftMonth(current, 1);
  return current;
}
