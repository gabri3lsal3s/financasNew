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

/** Saldo aberto de uma fatura (totalFatura − pago − estorno − creditoAnterior − principalRoladoEnviado, nunca negativo). */
export function invoiceBalance(
  previstoCents: number,
  pagoCents: number,
  estornoCents = 0,
  creditoAnteriorCents = 0,
  principalRoladoEnviadoCents = 0,
): number {
  return Math.max(
    0,
    previstoCents - pagoCents - estornoCents - creditoAnteriorCents - principalRoladoEnviadoCents,
  );
}

export type InvoiceStatus =
  | "rolled_over"
  | "empty"
  | "paid"
  | "overdue"
  | "near_due"
  | "closed"
  | "open";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  rolled_over: "Rolada",
  empty: "Sem lançamentos",
  paid: "Paga",
  overdue: "Vencida",
  near_due: "Vence em breve",
  closed: "Fechada",
  open: "Aberta",
};

/**
 * Data de vencimento nominal de uma competência (YYYY-MM-DD), com dia clampado
 * ao mês (dia 31 em fevereiro → último dia).
 */
export function invoiceDueDate(competenceMonth: string, dueDay: number): string {
  const [year, month] = competenceMonth.split("-").map(Number);
  const y = year ?? 0;
  const m = (month ?? 1) - 1;
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(clampDay(dueDay, y, m)).padStart(2, "0")}`;
}

/**
 * Data de vencimento efetiva (YYYY-MM-DD) com prorrogação bancária de fim de semana:
 * sábado (+2 dias) ou domingo (+1 dia) → segunda-feira.
 */
export function effectiveInvoiceDueDate(competenceMonth: string, dueDay: number): string {
  const nominal = invoiceDueDate(competenceMonth, dueDay);
  const [year, month, day] = nominal.split("-").map(Number);
  const localDate = new Date(year ?? 2000, (month ?? 1) - 1, day ?? 1);
  const dayOfWeek = localDate.getDay();
  if (dayOfWeek === 6) return addDaysISO(nominal, 2);
  if (dayOfWeek === 0) return addDaysISO(nominal, 1);
  return nominal;
}

/**
 * Resolve a data civil (YYYY-MM-DD) de fechamento da fatura de uma competência.
 * Quando closingDay >= dueDay, o corte ocorre no mês anterior ao vencimento.
 */
export function invoiceClosingDate(
  competenceMonth: string,
  closingDay: number,
  dueDay: number,
): string {
  const closingMonth =
    closingDay >= dueDay ? shiftMonth(competenceMonth, -1) : competenceMonth;
  return invoiceDueDate(closingMonth, closingDay);
}

export interface InvoiceStatusOptions {
  closingDay?: number;
  totalFaturaBrutoCents?: number;
  principalRoladoEnviadoCents?: number;
}

/**
 * Status da fatura de uma competência seguindo estritamente a precedência canônica:
 * 1. `rolled_over`: saldo === 0 e principalRoladoEnviadoCents > 0 (prevalece sobre paid)
 * 2. `empty`: saldo === 0 e totalFaturaBrutoCents === 0
 * 3. `paid`: saldo === 0 (com fatura > 0 ou sem metadata)
 * 4. `overdue`: saldo > 0 e today > effectiveDueDate
 * 5. `near_due`: saldo > 0 e effectiveDueDate <= today + nearDueDays
 * 6. `closed`: saldo > 0, closingDay informado e today >= closingDate
 * 7. `open`: saldo > 0 (em acumulação)
 */
export function invoiceStatus(
  competenceMonth: string,
  dueDay: number,
  balanceCents: number,
  today: string = todayISO(),
  nearDueDays = 3,
  options?: InvoiceStatusOptions,
): InvoiceStatus {
  if (balanceCents <= 0) {
    if ((options?.principalRoladoEnviadoCents ?? 0) > 0) return "rolled_over";
    if (options?.totalFaturaBrutoCents !== undefined && options.totalFaturaBrutoCents <= 0) {
      return "empty";
    }
    return "paid";
  }

  const dueDate = effectiveInvoiceDueDate(competenceMonth, dueDay);

  if (today > dueDate) return "overdue";
  if (dueDate <= addDaysISO(today, nearDueDays)) return "near_due";

  if (options?.closingDay !== undefined) {
    const closingDate = invoiceClosingDate(competenceMonth, options.closingDay, dueDay);
    if (today >= closingDate) return "closed";
  }

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

export interface CardBillRolloverLike {
  from_competence_month: string;
  to_competence_month: string;
  principal_amount: number;
  kind?: "rollover" | "refinance";
}

export interface CompetenceSummary {
  /** YYYY-MM */
  month: string;
  /** Previsto Bruto = soma nominal das despesas lançadas na competência (100%, centavos). */
  previstoBrutoCents: number;
  /** Previsto Ponderado = soma das despesas com peso de relatório aplicado (centavos). */
  previstoPonderadoCents: number;
  /** Previsto = soma das despesas (alias compatível, centavos). */
  previstoCents: number;
  /** Principal recebido via rolagem/parcelamento de faturas anteriores (centavos). */
  principalRoladoRecebidoCents: number;
  /** Principal enviado via rolagem/parcelamento para faturas posteriores (centavos). */
  principalRoladoEnviadoCents: number;
  /** Total da Fatura Bruto = previstoBrutoCents + principalRoladoRecebidoCents (centavos). */
  totalFaturaBrutoCents: number;
  /** Pago = soma dos pagamentos positivos (centavos). Estornos ficam à parte. */
  pagoCents: number;
  /** Soma dos estornos (valores absolutos, centavos). */
  estornoCents: number;
  /** Crédito herdado de excesso de pagamentos/estornos de competências anteriores (centavos). */
  creditoAnteriorCents: number;
  /** Crédito restante após abater esta competência, que transborda para a seguinte (centavos). */
  creditoRestanteCents: number;
  /** Saldo aberto bruto = max(0, totalFaturaBruto − pago − estorno − creditoAnterior − principalRoladoEnviado) (centavos). */
  saldoBrutoCents: number;
  /** Saldo aberto ponderado = max(0, (previstoPonderado + principalRoladoRecebido) − pago − estorno − creditoAnterior − principalRoladoEnviado) (centavos). */
  saldoPonderadoCents: number;
  /** Saldo aberto = saldoBrutoCents (alias compatível, centavos). */
  saldoCents: number;
}

/**
 * Resumos por competência a partir das despesas do cartão, pagamentos/estornos
 * e rolagens/parcelamentos (`card_bill_rollovers`) — Equação Contábil Única.
 * Motor puro: nenhuma consulta, apenas derivação exibível.
 */
export function buildCompetenceSummaries(
  expenses: readonly {
    bill_competence: string | null;
    value: number;
    report_weight: number;
  }[],
  payments: readonly {
    competence_month: string;
    amount: number;
    is_refund?: boolean;
  }[],
  rollovers: readonly CardBillRolloverLike[] = [],
): CompetenceSummary[] {
  const months = new Set<string>();
  for (const expense of expenses) {
    if (expense.bill_competence) months.add(expense.bill_competence);
  }
  for (const payment of payments) months.add(payment.competence_month);
  for (const rollover of rollovers) {
    months.add(rollover.from_competence_month);
    months.add(rollover.to_competence_month);
  }

  if (months.size === 0) return [];

  // Ordena cronologicamente crescente para propagar créditos de excesso de pagamento
  const sortedMonths = Array.from(months).sort((a, b) => a.localeCompare(b));

  let carryoverCredit = 0;
  const summaries: CompetenceSummary[] = [];

  for (const month of sortedMonths) {
    const monthExpenses = expenses.filter((e) => e.bill_competence === month);
    const previstoBruto = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * 100), 0);
    const previstoPonderado = monthExpenses.reduce((acc, e) => acc + Math.round(e.value * e.report_weight * 100), 0);

    const principalRoladoRecebido = rollovers
      .filter((r) => r.to_competence_month === month)
      .reduce((acc, r) => acc + Math.round(r.principal_amount * 100), 0);
    const principalRoladoEnviado = rollovers
      .filter((r) => r.from_competence_month === month)
      .reduce((acc, r) => acc + Math.round(r.principal_amount * 100), 0);

    const totalFaturaBruto = previstoBruto + principalRoladoRecebido;
    const totalFaturaPonderado = previstoPonderado + principalRoladoRecebido;

    const monthPayments = payments.filter((p) => p.competence_month === month);
    const isRefund = (p: { amount: number; is_refund?: boolean }) =>
      p.is_refund === true || p.amount < 0;

    const pago = monthPayments
      .filter((p) => !isRefund(p) && p.amount > 0)
      .reduce((acc, p) => acc + Math.round(p.amount * 100), 0);
    const estorno = monthPayments
      .filter(isRefund)
      .reduce((acc, p) => acc + Math.round(Math.abs(p.amount) * 100), 0);

    const creditoAnterior = carryoverCredit;
    const totalDisponivel = pago + estorno + creditoAnterior;

    const saldoBruto = invoiceBalance(
      totalFaturaBruto,
      pago,
      estorno,
      creditoAnterior,
      principalRoladoEnviado,
    );
    const saldoPonderado = invoiceBalance(
      totalFaturaPonderado,
      pago,
      estorno,
      creditoAnterior,
      principalRoladoEnviado,
    );

    // Excesso de pagamento/estorno além da parcela não rolada transborda como crédito para a competência seguinte
    const netTargetBeforeRollout = Math.max(0, totalFaturaBruto - principalRoladoEnviado);
    carryoverCredit = Math.max(0, totalDisponivel - netTargetBeforeRollout);

    summaries.push({
      month,
      previstoBrutoCents: previstoBruto,
      previstoPonderadoCents: previstoPonderado,
      previstoCents: previstoBruto,
      principalRoladoRecebidoCents: principalRoladoRecebido,
      principalRoladoEnviadoCents: principalRoladoEnviado,
      totalFaturaBrutoCents: totalFaturaBruto,
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
          principalRoladoRecebidoCents: 0,
          principalRoladoEnviadoCents: 0,
          totalFaturaBrutoCents: 0,
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

export interface ResolveOpenCardInvoicesParams {
  cards: readonly {
    id: string;
    name: string;
    due_day: number;
    closing_day?: number;
    color?: string | null;
    is_active?: boolean;
  }[];
  expenses: readonly {
    card_id?: string | null;
    bill_competence?: string | null;
    value: number;
    report_weight?: number;
  }[];
  payments: readonly {
    card_id: string;
    competence_month: string;
    amount: number;
    is_refund?: boolean;
  }[];
  rollovers?: readonly {
    card_id: string;
    from_competence_month: string;
    to_competence_month: string;
    principal_amount: number;
    kind?: "rollover" | "refinance";
  }[];
  today?: string;
  nearDueDays?: number;
  maxCompetenceMonth?: string;
}

export interface OpenCardInvoice {
  cardId: string;
  cardName: string;
  cardColor: string | null;
  isCardActive: boolean;
  competenceMonth: string;
  dueDay: number;
  nominalDueDate: string;
  effectiveDueDate: string;
  saldoBrutoCents: number;
  saldoPonderadoCents: number;
  status: InvoiceStatus;
  isOverdue: boolean;
}

/**
 * Fonte Única de Verdade (SSOT) para faturas em aberto em todo o sistema
 * (Cash-Gap, Safe-to-Spend, Lembretes, Radar Semanal e Limite Comprometido).
 *
 * - Blindagem #9: nunca omite cartão `is_active === false` que tenha `saldoBrutoCents > 0`;
 * - Blindagem #11: calcula sempre com 100% das despesas/pagamentos/rollovers do `card_id`.
 */
export function resolveOpenCardInvoices(
  params: ResolveOpenCardInvoicesParams,
): OpenCardInvoice[] {
  const {
    cards,
    expenses,
    payments,
    rollovers = [],
    today = todayISO(),
    nearDueDays = 3,
    maxCompetenceMonth,
  } = params;

  const openInvoices: OpenCardInvoice[] = [];

  for (const card of cards) {
    const cardExpenses = expenses
      .filter((e) => e.card_id === card.id)
      .map((e) => ({
        bill_competence: e.bill_competence ?? null,
        value: e.value,
        report_weight: e.report_weight ?? 1,
      }));
    const cardPayments = payments.filter((p) => p.card_id === card.id);
    const cardRollovers = rollovers.filter((r) => r.card_id === card.id);

    const summaries = buildCompetenceSummaries(cardExpenses, cardPayments, cardRollovers);

    for (const summary of summaries) {
      if (summary.saldoBrutoCents <= 0) continue;
      if (maxCompetenceMonth && summary.month > maxCompetenceMonth) continue;

      const nominalDueDate = invoiceDueDate(summary.month, card.due_day);
      const effectiveDueDate = effectiveInvoiceDueDate(summary.month, card.due_day);
      const status = invoiceStatus(
        summary.month,
        card.due_day,
        summary.saldoBrutoCents,
        today,
        nearDueDays,
        {
          closingDay: card.closing_day,
          totalFaturaBrutoCents: summary.totalFaturaBrutoCents,
          principalRoladoEnviadoCents: summary.principalRoladoEnviadoCents,
        },
      );

      openInvoices.push({
        cardId: card.id,
        cardName: card.name,
        cardColor: card.color ?? null,
        isCardActive: card.is_active !== false,
        competenceMonth: summary.month,
        dueDay: card.due_day,
        nominalDueDate,
        effectiveDueDate,
        saldoBrutoCents: summary.saldoBrutoCents,
        saldoPonderadoCents: summary.saldoPonderadoCents,
        status,
        isOverdue: status === "overdue",
      });
    }
  }

  return openInvoices.sort((a, b) => {
    if (a.effectiveDueDate !== b.effectiveDueDate) {
      return a.effectiveDueDate.localeCompare(b.effectiveDueDate);
    }
    return b.saldoBrutoCents - a.saldoBrutoCents;
  });
}

export interface InvoiceExpensePartition<T> {
  /** Parceladas (installments_total > 1 && charge_kind === 'regular') — compras herdadas de faturamentos anteriores. */
  installments: T[];
  /** À vista de consumo (1 parcela && charge_kind === 'regular') — gastos do próprio mês da fatura. */
  regular: T[];
  /** Encargos e tarifas financeiras (charge_kind !== 'regular') — juros, multas, IOF e taxas. */
  charges: T[];
}

/** Mínimo necessário para particionar a fatura (data + total de parcelas + tipo de encargo opcional). */
type InvoiceExpensePartitionInput = {
  date: string;
  installments_total: number;
  charge_kind?: string | null;
};

/**
 * Particiona as despesas da fatura em **três blocos segregados**:
 * 1. Parceladas (compras herdadas de consumo)
 * 2. À vista (compras do mês de consumo)
 * 3. Encargos (juros, multas, IOF e tarifas bancárias)
 *
 * Cada grupo é ORDENADO por data decrescente (mais recentes primeiro — ordem
 * natural de extrato). Encargos são expressamente segregados das compras de consumo.
 * Motor puro.
 */
export function partitionInvoiceExpenses<T extends InvoiceExpensePartitionInput>(
  expenses: readonly T[],
): InvoiceExpensePartition<T> {
  const byDateDesc = (a: T, b: T) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const isCharge = (e: T) => Boolean(e.charge_kind && e.charge_kind !== "regular");

  const charges = expenses.filter(isCharge).sort(byDateDesc);
  const consumption = expenses.filter((e) => !isCharge(e));

  const installments = consumption.filter((e) => e.installments_total > 1).sort(byDateDesc);
  const regular = consumption.filter((e) => e.installments_total <= 1).sort(byDateDesc);

  return { installments, regular, charges };
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

export interface CardOrderingOptions {
  primaryCardId?: string | null;
  cardOrder?: string[];
}

/**
 * Ordena a lista de cartões com base na preferência do usuário:
 * 1. O cartão indicado em `primaryCardId` é colocado obrigatoriamente na primeira posição (índice 0).
 * 2. Se houver `cardOrder` (lista de IDs), os demais cartões seguem a ordem especificada.
 * 3. Cartões não presentes em `cardOrder` (ex.: recém-criados) mantêm a ordem original ao final da lista.
 * 4. A ordenação é puramente funcional e não muta a lista original.
 */
export function sortCardsByPreference<T extends { id: string }>(
  cards: T[],
  options?: CardOrderingOptions,
): T[] {
  if (!cards || cards.length <= 1) return [...(cards ?? [])];

  const primaryCardId = options?.primaryCardId;
  const cardOrder = options?.cardOrder ?? [];

  const remainingCards = [...cards];

  let primaryCard: T | null = null;
  if (primaryCardId) {
    const pIdx = remainingCards.findIndex((c) => c.id === primaryCardId);
    if (pIdx !== -1) {
      primaryCard = remainingCards.splice(pIdx, 1)[0] ?? null;
    }
  }

  if (cardOrder.length > 0) {
    const orderMap = new Map<string, number>();
    cardOrder.forEach((id, idx) => {
      orderMap.set(id, idx);
    });

    remainingCards.sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return 0;
    });
  }

  return primaryCard ? [primaryCard, ...remainingCards] : remainingCards;
}

export * from "./charges";
export * from "./refinancing";
export * from "./schemas";
