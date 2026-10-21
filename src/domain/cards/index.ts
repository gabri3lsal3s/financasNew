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
import { clampDay, resolveBillCompetence } from "@/domain/competence";
import { addMonthsClamped, splitCents, toISODate } from "@/domain/money/parcelar";
import { APP_START_DATE } from "@/types";

/** Saldo aberto de uma fatura (previsto − pago − estorno − creditoAnterior, nunca negativo). */
export function invoiceBalance(
  previstoCents: number,
  pagoCents: number,
  estornoCents = 0,
  creditoAnteriorCents = 0,
): number {
  return Math.max(0, previstoCents - pagoCents - estornoCents - creditoAnteriorCents);
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

/** Desloca um mês YYYY-MM por `delta` meses (helper puro). */
export function shiftMonth(month: string, delta: number): string {
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
  /** Crédito herdado de excesso de pagamentos/estornos de competências anteriores (centavos). */
  creditoAnteriorCents: number;
  /** Crédito restante após abater esta competência, que transborda para a seguinte (centavos). */
  creditoRestanteCents: number;
  /** Saldo aberto bruto = max(0, previstoBruto − pago − estorno − creditoAnterior) (centavos). */
  saldoBrutoCents: number;
  /** Saldo aberto ponderado = max(0, previstoPonderado − pago − estorno − creditoAnterior) (centavos). */
  saldoPonderadoCents: number;
  /** Saldo aberto = max(0, previsto − pago − estorno − creditoAnterior) (alias compatível, centavos). */
  saldoCents: number;
}

/**
 * Resumos por competência a partir das despesas do cartão (com peso aplicado
 * e base_amount preservado) e dos pagamentos/estornos — ESPECIFICAÇÃO §3.3.3.
 * Pagamentos ou estornos a maior (pago + estorno > previsto) geram créditos
 * que transbordam para abater a fatura da competência posterior.
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

  if (months.size === 0) return [];

  // Ordena cronologicamente crescente para propagar créditos de excesso de pagamento
  const sortedMonths = Array.from(months).sort((a, b) => a.localeCompare(b));

  let carryoverCredit = 0;
  const summaries: CompetenceSummary[] = [];

  for (const month of sortedMonths) {
    const monthExpenses = expenses.filter((e) => e.bill_competence === month);
    const previstoBruto = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * 100), 0);
    const previstoPonderado = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * e.report_weight * 100), 0);
    const pago = payments
      .filter((p) => p.competence_month === month && p.amount > 0)
      .reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
    const estorno = payments
      .filter((p) => p.competence_month === month && p.amount < 0)
      .reduce((acc, p) => acc + Math.round(-p.amount * 100), 0);

    const creditoAnterior = carryoverCredit;
    const totalDisponivel = pago + estorno + creditoAnterior;

    const saldoBruto = invoiceBalance(previstoBruto, pago, estorno, creditoAnterior);
    const saldoPonderado = invoiceBalance(previstoPonderado, pago, estorno, creditoAnterior);

    // Excesso de pagamento bancário transborda como crédito para a competência seguinte
    carryoverCredit = Math.max(0, totalDisponivel - previstoBruto);

    summaries.push({
      month,
      previstoBrutoCents: previstoBruto,
      previstoPonderadoCents: previstoPonderado,
      previstoCents: previstoBruto,
      pagoCents: pago,
      estornoCents: estorno,
      creditoAnteriorCents: creditoAnterior,
      creditoRestanteCents: carryoverCredit,
      saldoBrutoCents: saldoBruto,
      saldoPonderadoCents: saldoPonderado,
      saldoCents: saldoBruto,
    });
  }

  // Se ainda houver crédito não absorvido após a última competência, cria a competência seguinte
  if (carryoverCredit > 0 && sortedMonths.length > 0) {
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    if (lastMonth) {
      const nextMonth = shiftMonth(lastMonth, 1);
      if (!months.has(nextMonth)) {
        summaries.push({
          month: nextMonth,
          previstoBrutoCents: 0,
          previstoPonderadoCents: 0,
          previstoCents: 0,
          pagoCents: 0,
          estornoCents: 0,
          creditoAnteriorCents: carryoverCredit,
          creditoRestanteCents: carryoverCredit,
          saldoBrutoCents: 0,
          saldoPonderadoCents: 0,
          saldoCents: 0,
        });
      }
    }
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

export interface CardInstallmentItem {
  /** Número da parcela (1..count, 1-based). */
  installmentNumber: number;
  /** Total de parcelas (1..60). */
  installmentsTotal: number;
  /** Valor da parcela em centavos (inteiro). */
  valueCents: number;
  /** Data da parcela em formato ISO local (YYYY-MM-DD). */
  date: string;
  /** Snapshot da competência de fatura (YYYY-MM), se closingDay for informado. */
  billCompetence: string | null;
}

export interface DivideIntoInstallmentsInput {
  /** Valor total da compra em centavos (inteiro >= 0). */
  totalCents: number;
  /** Quantidade de parcelas (1..60). */
  count: number;
  /** Data da primeira parcela (YYYY-MM-DD). */
  startDate: string;
  /** Dia de fechamento da fatura do cartão (1..31), opcional. */
  closingDay?: number | null;
}

/**
 * Divide uma compra parcelada de cartão em N parcelas com conservação estrita de centavos.
 * A soma de `valueCents` de todas as parcelas é matematicamente garantida
 * idêntica a `totalCents`, distribuindo o resto nas primeiras parcelas (§3.2.2 / D12).
 * Cada parcela calcula sua data mensal (clamped) e o snapshot da competência de fatura (bill_competence).
 */
export function divideIntoInstallments(input: DivideIntoInstallmentsInput): CardInstallmentItem[] {
  const { totalCents, count, startDate, closingDay } = input;
  const values = splitCents(totalCents, count);
  const [yearStr, monthStr, dayStr] = startDate.split("-");
  const baseYear = Number(yearStr);
  const baseMonth = (Number(monthStr) || 1) - 1;
  const baseDay = Number(dayStr) || 1;
  const baseDate = new Date(baseYear, baseMonth, baseDay);

  return values.map((valueCents, index) => {
    const installmentDateObj = addMonthsClamped(baseDate, index);
    const dateStr = toISODate(installmentDateObj);
    const billCompetence = closingDay != null ? resolveBillCompetence(dateStr, closingDay) : null;

    return {
      installmentNumber: index + 1,
      installmentsTotal: count,
      valueCents,
      date: dateStr,
      billCompetence,
    };
  });
}

export interface CardRefundRecord {
  id: string;
  card_id: string;
  competence_month: string;
  amount: number;
  date: string;
  is_refund?: boolean;
}

export interface RefundIncomeRecord {
  id?: string;
  value: number;
  date: string;
  source_ref: string | null;
  category_name?: string;
}

export interface RefundCongruenceResult {
  isCongruent: boolean;
  totalRefundsCents: number;
  totalIncomesCents: number;
  differenceCents: number;
  orphanedRefunds: string[];
  orphanedIncomes: string[];
  mismatchedAmounts: Array<{
    paymentId: string;
    paymentAmountCents: number;
    incomeValueCents: number;
  }>;
}

/**
 * Valida a congruência estrita entre estornos de fatura de cartão e receitas
 * automáticas registradas na categoria "Estorno" (ESPECIFICAÇÃO §3.3.3 / D1).
 *
 * Invariantes verificadas:
 * 1. Cada estorno no cartão (amount < 0 ou is_refund: true) deve possuir exatamente
 *    uma receita com source_ref [REFUND]{payment_id}.
 * 2. O valor nominal em centavos da receita deve ser estritamente igual ao valor do estorno.
 * 3. A soma total de estornos da fatura coincide centavo por centavo com as receitas de estorno.
 * 4. Nenhuma receita [REFUND] órfã deve existir sem seu respectivo estorno no cartão.
 */
export function assertRefundCongruence(
  payments: readonly CardRefundRecord[],
  incomes: readonly RefundIncomeRecord[],
): RefundCongruenceResult {
  const refunds = payments.filter((p) => p.is_refund === true || p.amount < 0);
  const refundIncomes = incomes.filter((inc) => inc.source_ref?.startsWith("[REFUND]"));

  let totalRefundsCents = 0;
  for (const r of refunds) {
    totalRefundsCents += Math.round(Math.abs(r.amount) * 100);
  }

  let totalIncomesCents = 0;
  for (const inc of refundIncomes) {
    totalIncomesCents += Math.round(inc.value * 100);
  }

  const orphanedRefunds: string[] = [];
  const orphanedIncomes: string[] = [];
  const mismatchedAmounts: Array<{
    paymentId: string;
    paymentAmountCents: number;
    incomeValueCents: number;
  }> = [];

  const incomeByPaymentId = new Map<string, RefundIncomeRecord>();
  for (const inc of refundIncomes) {
    if (inc.source_ref) {
      const paymentId = inc.source_ref.replace("[REFUND]", "");
      incomeByPaymentId.set(paymentId, inc);
    }
  }

  const matchedIncomeKeys = new Set<string>();

  for (const refund of refunds) {
    const matchedIncome = incomeByPaymentId.get(refund.id);
    if (!matchedIncome) {
      orphanedRefunds.push(refund.id);
      continue;
    }

    const incKey = matchedIncome.id ?? matchedIncome.source_ref ?? refund.id;
    matchedIncomeKeys.add(incKey);

    const refundCents = Math.round(Math.abs(refund.amount) * 100);
    const incomeCents = Math.round(matchedIncome.value * 100);

    if (refundCents !== incomeCents) {
      mismatchedAmounts.push({
        paymentId: refund.id,
        paymentAmountCents: refundCents,
        incomeValueCents: incomeCents,
      });
    }
  }

  for (const inc of refundIncomes) {
    const incKey = inc.id ?? inc.source_ref ?? "";
    if (!matchedIncomeKeys.has(incKey)) {
      const paymentId = inc.source_ref ? inc.source_ref.replace("[REFUND]", "") : "";
      if (!refunds.some((r) => r.id === paymentId)) {
        orphanedIncomes.push(incKey);
      }
    }
  }

  const differenceCents = Math.abs(totalRefundsCents - totalIncomesCents);
  const isCongruent =
    differenceCents === 0 &&
    orphanedRefunds.length === 0 &&
    orphanedIncomes.length === 0 &&
    mismatchedAmounts.length === 0;

  return {
    isCongruent,
    totalRefundsCents,
    totalIncomesCents,
    differenceCents,
    orphanedRefunds,
    orphanedIncomes,
    mismatchedAmounts,
  };
}

export * from "./refinancing";
export * from "./schemas";
