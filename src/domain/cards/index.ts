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
 * Data de vencimento de uma competência (YYYY-MM-DD), com dia clampado
 * ao mês (dia 31 em fevereiro → último dia). Usada pelo status e lembretes.
 */
export function invoiceDueDate(competenceMonth: string, dueDay: number): string {
  const [year, month] = competenceMonth.split("-").map(Number);
  const y = year ?? 0;
  const m = (month ?? 1) - 1;
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(clampDay(dueDay, y, m)).padStart(2, "0")}`;
}

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

  const dueDate = invoiceDueDate(competenceMonth, dueDay);

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
  /** Previsto Bruto = soma nominal de todas as despesas lançadas (100%, centavos). */
  previstoBrutoCents: number;
  /** Previsto Ponderado = soma das despesas com peso de relatório aplicado (centavos). */
  previstoPonderadoCents: number;
  /** Previsto = soma das despesas com peso aplicado (alias compatível, centavos). */
  previstoCents: number;
  /** Pago = soma dos pagamentos positivos (centavos). Estornos ficam à parte. */
  pagoCents: number;
  /** Soma dos estornos (valores absolutos, centavos). */
  estornoCents: number;
  /** Saldo aberto bruto = max(0, previstoBruto − pago) (centavos). */
  saldoBrutoCents: number;
  /** Saldo aberto ponderado = max(0, previstoPonderado − pago) (centavos). */
  saldoPonderadoCents: number;
  /** Saldo aberto = max(0, previsto − pago) (alias compatível, centavos). */
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
    const monthExpenses = expenses.filter((e) => e.bill_competence === month);
    const previstoBruto = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * 100), 0);
    const previstoPonderado = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * e.report_weight * 100), 0);
    const pago = payments
      .filter((p) => p.competence_month === month && p.amount > 0)
      .reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
    const estorno = payments
      .filter((p) => p.competence_month === month && p.amount < 0)
      .reduce((acc, p) => acc + Math.round(-p.amount * 100), 0);

    summaries.push({
      month,
      previstoBrutoCents: previstoBruto,
      previstoPonderadoCents: previstoPonderado,
      previstoCents: previstoBruto,
      pagoCents: pago,
      estornoCents: estorno,
      saldoBrutoCents: invoiceBalance(previstoBruto, pago),
      saldoPonderadoCents: invoiceBalance(previstoPonderado, pago),
      saldoCents: invoiceBalance(previstoBruto, pago),
    });
  }
  return summaries.sort((a, b) => (a.month < b.month ? 1 : -1));
}

export interface InvoiceExpensePartition<T> {
  /** Parceladas (installments_total > 1) — compras herdadas de faturamentos anteriores. */
  installments: T[];
  /** À vista (1 parcela) — gastos do próprio mês da fatura. */
  regular: T[];
}

/** Mínimo necessário para particionar a fatura (data + total de parcelas). */
type InvoiceExpensePartitionInput = { date: string; installments_total: number };

/**
 * Particiona as despesas da fatura em **parceladas × à vista**, cada grupo
 * ORDENADO por data decrescente (mais recentes primeiro — ordem natural de
 * extrato, igual à atual). Permite separar os gastos herdados de meses
 * anteriores (parcelas) dos gastos do próprio mês (à vista). Motor puro.
 */
export function partitionInvoiceExpenses<T extends InvoiceExpensePartitionInput>(
  expenses: readonly T[],
): InvoiceExpensePartition<T> {
  const byDateDesc = (a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const installments = expenses.filter((e) => e.installments_total > 1).sort(byDateDesc);
  const regular = expenses.filter((e) => e.installments_total <= 1).sort(byDateDesc);
  return { installments, regular };
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

export interface CardLimitUsage {
  /** Limite total configurado no cartão em centavos, ou null se não informado. */
  totalLimitCents: number | null;
  /** Limite comprometido em centavos (soma de despesas abertas/previstas). */
  usedLimitCents: number;
  /** Limite disponível em centavos (max(0, total − used)), ou null se sem limite total. */
  availableLimitCents: number | null;
  /** Percentual de comprometimento do limite (0 a 100). */
  usagePercentage: number;
}

/**
 * Calcula o uso de limite de um cartão de crédito.
 * @param creditLimit Limite total cadastrado em reais (ex: 5000) ou null/undefined.
 * @param usedCents Total comprometido em centavos.
 */
export function cardLimitUsage(creditLimit: number | null | undefined, usedCents: number): CardLimitUsage {
  const safeUsed = Math.max(0, usedCents);
  if (creditLimit === null || creditLimit === undefined || creditLimit <= 0) {
    return {
      totalLimitCents: null,
      usedLimitCents: safeUsed,
      availableLimitCents: null,
      usagePercentage: 0,
    };
  }

  const totalLimitCents = Math.round(creditLimit * 100);
  const availableLimitCents = Math.max(0, totalLimitCents - safeUsed);
  const usagePercentage = totalLimitCents > 0 ? Math.min(100, Math.round((safeUsed / totalLimitCents) * 100)) : 0;

  return {
    totalLimitCents,
    usedLimitCents: safeUsed,
    availableLimitCents,
    usagePercentage,
  };
}

/**
 * Determina o melhor dia de compra para o cartão (dia subsequente ao fechamento).
 * Exemplo: fechamento dia 10 → melhor dia 11.
 * Exemplo: fechamento dia 31 → melhor dia 1.
 */
export function bestPurchaseDay(closingDay: number): number {
  if (closingDay >= 31 || closingDay < 1) return 1;
  return closingDay + 1;
}

/**
 * Calcula a quantidade de dias restantes até o vencimento da fatura.
 * Retorna valor positivo (dias restantes), 0 (vence hoje) ou negativo (dias de atraso).
 */
export function daysUntilDue(competenceMonth: string, dueDay: number, today: string = todayISO()): number {
  const dueDate = invoiceDueDate(competenceMonth, dueDay);
  const dueTime = new Date(`${dueDate}T00:00:00Z`).getTime();
  const todayTime = new Date(`${today}T00:00:00Z`).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((dueTime - todayTime) / msPerDay);
}

export * from "./refinancing";

