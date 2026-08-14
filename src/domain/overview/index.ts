/**
 * Visão Consolidada — ESPECIFICAÇÃO §3.6.
 *
 * Motores puros (testáveis isoladamente):
 *   • KPIs fundamentais (rendas, despesas, investimentos, saldo, savings rate);
 *   • Saldo líquido de Contas (a receber − a pagar − faturas em aberto);
 *   • Fluxo diário (barras empilhadas por dia do mês);
 *   • Comparativo com o período anterior.
 */

import { autoSelectBillMonth, buildCompetenceSummaries } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { monthRange, shiftMonth } from "@/lib/date";

// ---------------------------------------------------------------------------
// KPIs fundamentais (§3.6) — valores com peso de relatório aplicado na borda
// ---------------------------------------------------------------------------

export interface OverviewTotals {
  incomeCents: number;
  expenseCents: number;
  investmentCents: number;
  /** saldo = rendas − despesas − investimentos. */
  balanceCents: number;
  /** savingsRate = saldo ÷ rendas (percentual, pode ser negativo). */
  savingsRatePercent: number;
}

/** Calcula os KPIs do período a partir dos totais (centavos). */
export function computeOverview(
  incomeCents: number,
  expenseCents: number,
  investmentCents: number,
): OverviewTotals {
  const balance = incomeCents - expenseCents - investmentCents;
  const savingsRate = incomeCents > 0 ? (balance / incomeCents) * 100 : 0;
  return {
    incomeCents,
    expenseCents,
    investmentCents,
    balanceCents: balance,
    savingsRatePercent: savingsRate,
  };
}

/** Variação percentual do período atual vs anterior (null sem base anterior). */
export function percentChange(currentCents: number, previousCents: number): number | null {
  if (previousCents === 0) return null;
  return ((currentCents - previousCents) / Math.abs(previousCents)) * 100;
}

// ---------------------------------------------------------------------------
// Saldo líquido de Contas (§3.6)
// ---------------------------------------------------------------------------

/**
 * Saldo líquido de Contas = total a receber (pendentes do mês) − total a
 * pagar (pendentes do mês) − total de faturas em aberto.
 */
export function accountsNet(
  receivablePendingCents: number,
  payablePendingCents: number,
  openInvoicesCents: number,
): number {
  return receivablePendingCents - payablePendingCents - openInvoicesCents;
}

/**
 * Total de faturas em aberto (todas as competências, por cartão):
 * para cada cartão, a competência é escolhida pela regra de seleção
 * automática (§3.3.3) e o saldo é `max(0, previsto − pago)`.
 */
export function openInvoicesTotal(
  expenses: readonly {
    card_id: string | null;
    bill_competence: string | null;
    value: number;
    report_weight: number;
  }[],
  payments: readonly { card_id: string; competence_month: string; amount: number }[],
  today: string = todayISO(),
): number {
  const cards = new Set<string>();
  for (const expense of expenses) {
    if (expense.card_id) cards.add(expense.card_id);
  }
  for (const payment of payments) cards.add(payment.card_id);

  let total = 0;
  for (const cardId of cards) {
    const cardExpenses = expenses.filter((e) => e.card_id === cardId);
    const cardPayments = payments.filter((p) => p.card_id === cardId);
    const summaries = buildCompetenceSummaries(cardExpenses, cardPayments);
    if (summaries.length === 0) continue;
    const month = autoSelectBillMonth(summaries, today);
    const summary = summaries.find((s) => s.month === month);
    if (summary) total += summary.saldoCents;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Fluxo diário (§3.6) — barras empilhadas por dia do mês
// ---------------------------------------------------------------------------

export type DailyFlowKind = "income" | "expense" | "investment";

export interface DailyFlowItem {
  /** YYYY-MM-DD */
  day: string;
  /** Dia do mês (1–31). */
  dayOfMonth: number;
  incomeCents: number;
  expenseCents: number;
  investmentCents: number;
  /** Máximo diário do mês (para escala da barra). */
  maxCents: number;
}

/**
 * Agrega lançamentos por dia do mês (dias sem movimento ficam zerados) e
 * retorna o maior total diário para a escala das barras.
 */
export function buildDailyFlow(
  month: string,
  items: readonly { date: string; kind: DailyFlowKind; amountCents: number }[],
): DailyFlowItem[] {
  const range = monthRange(month);
  const byDay = new Map<string, DailyFlowItem>();
  const daysInMonth = (() => {
    const [year, monthNum] = month.split("-").map(Number);
    return new Date(year ?? 0, (monthNum ?? 1), 0).getDate();
  })();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    byDay.set(iso, { day: iso, dayOfMonth: day, incomeCents: 0, expenseCents: 0, investmentCents: 0, maxCents: 0 });
  }

  for (const item of items) {
    if (item.date < range.start || item.date >= range.end) continue;
    const entry = byDay.get(item.date);
    if (!entry) continue;
    if (item.kind === "income") entry.incomeCents += item.amountCents;
    else if (item.kind === "expense") entry.expenseCents += item.amountCents;
    else entry.investmentCents += item.amountCents;
  }

  const flows = [...byDay.values()].sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  let maxCents = 0;
  for (const flow of flows) {
    const total = flow.incomeCents + flow.expenseCents + flow.investmentCents;
    if (total > maxCents) maxCents = total;
  }
  for (const flow of flows) flow.maxCents = maxCents;
  return flows;
}

// ---------------------------------------------------------------------------
// Série mensal (micro-sparklines dos KPIs — F8) e curva de saldo acumulado
// ---------------------------------------------------------------------------

export interface MonthlySeriesPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
  /** saldo = rendas − despesas − investimentos. */
  balanceCents: number;
}

/**
 * Agrega lançamentos em totais mensais (do mês mais antigo para o mais
 * recente) — alimenta os micro-sparklines dos KPIs da Visão Geral (F8).
 */
export function monthlySeries(
  items: readonly { date: string; kind: DailyFlowKind; amountCents: number }[],
  startMonth: string,
  monthCount: number,
): MonthlySeriesPoint[] {
  const points: MonthlySeriesPoint[] = [];
  let month = startMonth;
  for (let index = 0; index < monthCount; index += 1) {
    points.push({ month, incomeCents: 0, expenseCents: 0, balanceCents: 0 });
    month = shiftMonth(month, 1);
  }

  for (const item of items) {
    const key = item.date.slice(0, 7);
    const point = points.find((candidate) => candidate.month === key);
    if (!point) continue;
    if (item.kind === "income") point.incomeCents += item.amountCents;
    else if (item.kind === "expense") point.expenseCents += item.amountCents;
    else point.balanceCents -= item.amountCents; // investimento reduz o saldo
  }

  for (const point of points) point.balanceCents += point.incomeCents - point.expenseCents;
  return points;
}

export interface CumulativePoint {
  /** YYYY-MM-DD */
  day: string;
  dayOfMonth: number;
  /** Saldo acumulado até o dia (rendas − despesas − investimentos). */
  balanceCents: number;
}

/**
 * Curva de saldo acumulado a partir do fluxo diário (F8) — ponto por dia,
 * saldo cumulativo (pode ficar negativo em dias de pico de despesa).
 */
export function cumulativeBalance(dailyFlow: readonly DailyFlowItem[]): CumulativePoint[] {
  let running = 0;
  return dailyFlow.map((flow) => {
    running += flow.incomeCents - flow.expenseCents - flow.investmentCents;
    return { day: flow.day, dayOfMonth: flow.dayOfMonth, balanceCents: running };
  });
}

// ---------------------------------------------------------------------------
// Saúde da poupança — meses de reserva (F8)
// ---------------------------------------------------------------------------

/**
 * Meses de reserva que a renda mensal cobre de despesas (income ÷ expense).
 * `null` sem despesas (não faz sentido dividir por zero).
 */
export function runwayMonths(incomeCents: number, expenseCents: number): number | null {
  if (expenseCents <= 0) return null;
  return incomeCents / expenseCents;
}
