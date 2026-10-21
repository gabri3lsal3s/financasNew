/**
 * Motor Puro de Radar Preditivo de Descasamento de Fluxo (Cash-Gap) & Runway Diário — FASE 51.
 *
 * Responsável por:
 *   • Simular a evolução diária do saldo bancário até o fim do mês (runway diário);
 *   • Cruzar datas de vencimento de faturas de cartão e dívidas a pagar com entradas esperadas;
 *   • Disparar alerta antecipado (5 a 10 dias) caso ocorra déficit temporário antes de um recebimento;
 *   • Propor ações de contingência (ex: realocação temporária de reserva/caixa).
 *
 * 100% puro — sem dependências de UI ou Supabase.
 */

import { invoiceDueDate, invoiceBalance } from "@/domain/cards";
import { resolveBillCompetence } from "@/domain/competence";

export interface CashGapObligation {
  id: string;
  name: string;
  dueDate: string;
  amountCents: number;
  kind: "invoice" | "debt" | "expense";
}

export interface CardBillMeta {
  id: string;
  name: string;
  due_day: number;
  closing_day?: number;
}

export interface CardExpenseProjectionItem {
  id?: string;
  card_id?: string | null;
  bill_competence?: string | null;
  value?: number;
  amountCents?: number;
  date: string; // Data da compra (ISO YYYY-MM-DD)
  report_weight?: number;
  description?: string | null;
  payment_method?: string;
}

export interface CardPaymentProjectionItem {
  id?: string;
  card_id: string;
  competence_month: string;
  amount?: number;
  amountCents?: number;
  is_refund?: boolean;
}

export interface ProjectCardInvoiceObligationsParams {
  cards: readonly CardBillMeta[];
  expenses: readonly CardExpenseProjectionItem[];
  payments: readonly CardPaymentProjectionItem[];
  today: string;
  currentMonth?: string;
}

/**
 * Converte despesas e faturas de cartão de crédito em obrigações de fluxo de caixa (CashGapObligation).
 *
 * REGRA DE CONGRUÊNCIA (§4.3 / D3 / D12):
 * A data de desembolso no caixa bancário é estritamente a data de vencimento da fatura (`invoiceDueDate`),
 * e NUNCA a data em que a compra física foi efetuada (`expense.date`).
 *
 * Adicionalmente:
 * - O valor cobrado é o montante BRUTO nominal integral (100%), pois o banco exige quitação total da fatura;
 * - Faturas em aberto vencidas antes de `today` possuem exigibilidade imediata (`dueDate = today`);
 * - Excedentes de pagamento em competências anteriores abatem faturas subsequentes via carryover credit.
 */
export function projectCardInvoiceObligations(
  params: ProjectCardInvoiceObligationsParams,
): CashGapObligation[] {
  const { cards, expenses, payments, today, currentMonth } = params;
  const obligations: CashGapObligation[] = [];

  for (const card of cards) {
    const cardExpenses = expenses.filter(
      (e) => e.card_id === card.id || (e.payment_method === "credit_card" && e.card_id === card.id),
    );
    const cardPayments = payments.filter((p) => p.card_id === card.id);

    // Identifica todas as competências que possuem lançamentos ou pagamentos
    const competencesSet = new Set<string>();
    for (const exp of cardExpenses) {
      const comp =
        exp.bill_competence ||
        (card.closing_day
          ? resolveBillCompetence(exp.date, card.closing_day)
          : exp.date.slice(0, 7));
      if (comp) competencesSet.add(comp);
    }
    for (const pay of cardPayments) {
      if (pay.competence_month) competencesSet.add(pay.competence_month);
    }
    if (currentMonth) {
      competencesSet.add(currentMonth);
    }

    if (competencesSet.size === 0) continue;

    // Ordenação cronológica para propagação exata de créditos excedentes de pagamento
    const sortedCompetences = Array.from(competencesSet).sort((a, b) => a.localeCompare(b));
    let carryoverCreditCents = 0;

    for (const competence of sortedCompetences) {
      const monthExpenses = cardExpenses.filter((e) => {
        const comp =
          e.bill_competence ||
          (card.closing_day
            ? resolveBillCompetence(e.date, card.closing_day)
            : e.date.slice(0, 7));
        return comp === competence;
      });

      // Valor bruto nominal (100% bancário)
      const expTotalCents = monthExpenses.reduce((acc, e) => {
        const cents = e.amountCents ?? (e.value !== undefined ? Math.round(e.value * 100) : 0);
        return acc + cents;
      }, 0);

      const monthPayments = cardPayments.filter((p) => p.competence_month === competence);
      const payTotalCents = monthPayments
        .filter((p) => !p.is_refund && (p.amountCents ?? (p.amount !== undefined ? Math.round(p.amount * 100) : 0)) > 0)
        .reduce((acc, p) => {
          const cents = p.amountCents ?? (p.amount !== undefined ? Math.round(p.amount * 100) : 0);
          return acc + cents;
        }, 0);

      const refundTotalCents = monthPayments
        .filter((p) => p.is_refund || (p.amountCents ?? (p.amount !== undefined ? Math.round(p.amount * 100) : 0)) < 0)
        .reduce((acc, p) => {
          const raw = p.amountCents ?? (p.amount !== undefined ? Math.round(p.amount * 100) : 0);
          return acc + Math.abs(raw);
        }, 0);

      const saldoAbertoCents = invoiceBalance(expTotalCents, payTotalCents, refundTotalCents, carryoverCreditCents);

      // Atualiza crédito excedente que transborda para o próximo ciclo
      const totalDisponivel = payTotalCents + refundTotalCents + carryoverCreditCents;
      carryoverCreditCents = Math.max(0, totalDisponivel - expTotalCents);

      if (saldoAbertoCents <= 0) continue;

      // O vencimento canônico da fatura:
      const nominalDueDate = invoiceDueDate(competence, card.due_day);
      // Se já venceu no passado e continua em aberto, a exigibilidade de caixa é imediata (hoje)
      const effectiveDueDate = nominalDueDate < today ? today : nominalDueDate;

      obligations.push({
        id: `invoice-${card.id}-${competence}`,
        name: competence === currentMonth ? `Fatura ${card.name}` : `Fatura ${card.name} (${competence})`,
        dueDate: effectiveDueDate,
        amountCents: saldoAbertoCents,
        kind: "invoice",
      });
    }
  }

  return obligations;
}

export interface CardInstallmentPlanItem {
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  billCompetence: string;
  purchaseDate?: string;
  description?: string | null;
}

export interface ProjectInstallmentCashFlowsParams {
  card: {
    id: string;
    name: string;
    due_day: number;
  };
  installments: readonly CardInstallmentPlanItem[];
  today?: string;
}

export interface InstallmentCashFlowDisbursement {
  installmentNumber: number;
  totalInstallments: number;
  billCompetence: string;
  /**
   * Data em que o desembolso financeiro efetivamente ocorre na conta corrente.
   * Alinhada estritamente com o vencimento da fatura (`invoiceDueDate`), NUNCA com a data da compra.
   */
  disbursementDate: string;
  amountCents: number;
  description: string;
}

/**
 * Mapeia as parcelas futuras de uma compra parcelada no cartão para seus respectivos desembolsos de caixa.
 * Garante que a data de saída de caixa de cada parcela $k$ seja a data de vencimento da fatura (`invoiceDueDate`)
 * da respectiva competência (`billCompetence`), e nunca a data em que a compra foi realizada.
 */
export function projectInstallmentCashFlows(
  params: ProjectInstallmentCashFlowsParams,
): InstallmentCashFlowDisbursement[] {
  const { card, installments, today } = params;

  return installments.map((inst) => {
    const nominalDueDate = invoiceDueDate(inst.billCompetence, card.due_day);
    const disbursementDate = today && nominalDueDate < today ? today : nominalDueDate;
    const desc =
      inst.description ||
      `Parcela ${inst.installmentNumber}/${inst.totalInstallments} (${card.name})`;

    return {
      installmentNumber: inst.installmentNumber,
      totalInstallments: inst.totalInstallments,
      billCompetence: inst.billCompetence,
      disbursementDate,
      amountCents: inst.amountCents,
      description: desc,
    };
  });
}

/**
 * Converte parcelas individuais de cartão em obrigações diretas de radar de descasamento (CashGapObligation).
 */
export function projectInstallmentsToObligations(
  params: ProjectInstallmentCashFlowsParams,
): CashGapObligation[] {
  const flows = projectInstallmentCashFlows(params);

  return flows.map((f) => ({
    id: `installment-${params.card.id}-${f.billCompetence}-${f.installmentNumber}`,
    name: `${f.description} - ${params.card.name}`,
    dueDate: f.disbursementDate,
    amountCents: f.amountCents,
    kind: "invoice",
  }));
}

export interface CashGapInflow {
  id: string;
  name: string;
  expectedDate: string;
  amountCents: number;
}

export interface CashGapParams {
  /** Saldo bancário real em conta hoje (centavos). */
  currentBalanceCents: number;
  /** Data de referência ("hoje", formato YYYY-MM-DD). */
  today: string;
  /** Total de dias a projetar à frente (padrão: até o final do mês corrente ou min 15 dias). */
  daysAhead?: number;
  /** Obrigações futuras contratadas (faturas de cartão em aberto, dívidas a pagar). */
  obligations?: readonly CashGapObligation[];
  /** Receitas/entradas esperadas no período. */
  inflows: readonly CashGapInflow[];
  /**
   * Opcional: Projeção de faturas de cartão e parcelamentos futuros calculada pelo motor.
   * Suas obrigações serão unificadas com `obligations` usando o vencimento de fatura (`invoiceDueDate`).
   */
  cardProjection?: ProjectCardInvoiceObligationsParams;
}

export interface DailyRunwayPoint {
  date: string;
  dayOfMonth: number;
  projectedBalanceCents: number;
  inflowCents: number;
  outflowCents: number;
  events: string[];
  isDeficit: boolean;
}

export type CashGapSeverity = "none" | "warning" | "critical";

export interface CashGapAnalysisResult {
  /** Indica se haverá descasamento de caixa (saldo negativo em algum dia da projeção). */
  isCashGapDetected: boolean;
  /** Nível de criticidade do alerta. */
  severity: CashGapSeverity;
  /** Data do primeiro dia em que o saldo fica negativo (null se não houver déficit). */
  gapDate: string | null;
  /** Dias restantes a partir de hoje até o início do déficit. */
  daysUntilGap: number | null;
  /** Maior déficit acumulado (em centavos, valor positivo representando o valor faltante). */
  maxDeficitCents: number;
  /** Data prevista da próxima entrada financeira que pode cobrir o déficit (se houver). */
  nextInflowDate: string | null;
  /** Lista de obrigações que desencadearam o descasamento temporal. */
  causingObligations: CashGapObligation[];
  /** Proposta de contingência e recomendação em pt-BR. */
  recommendationMessage: string | null;
  /** Série diária da projeção de liquidez (runway). */
  runway: DailyRunwayPoint[];
}

/**
 * Analisa cronologicamente os fluxos diários e identifica eventuais descasamentos temporais de liquidez.
 */
export function analyzeCashGap(params: CashGapParams): CashGapAnalysisResult {
  const { currentBalanceCents, today, inflows, cardProjection } = params;
  const cardObligations = cardProjection ? projectCardInvoiceObligations(cardProjection) : [];
  const obligations = [...(params.obligations ?? []), ...cardObligations];

  const todayObj = new Date(`${today}T12:00:00Z`);
  const year = todayObj.getUTCFullYear();
  const month = todayObj.getUTCMonth(); // 0..11
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const currentDay = todayObj.getUTCDate();

  const defaultDaysAhead = Math.max(15, daysInMonth - currentDay + 1);
  const totalDays = params.daysAhead ?? defaultDaysAhead;

  let runningBalance = currentBalanceCents;
  const runway: DailyRunwayPoint[] = [];

  let firstGapDate: string | null = null;
  let firstGapDays: number | null = null;
  let maxDeficit = 0;
  const causingObligationsMap = new Map<string, CashGapObligation>();

  for (let offset = 0; offset < totalDays; offset++) {
    const targetDateObj = new Date(todayObj);
    targetDateObj.setUTCDate(todayObj.getUTCDate() + offset);
    const dateStr = targetDateObj.toISOString().slice(0, 10);
    const dayNum = targetDateObj.getUTCDate();

    // Entradas do dia
    const dayInflows = inflows.filter((inf) => inf.expectedDate === dateStr);
    const dayInflowTotal = dayInflows.reduce((acc, inf) => acc + inf.amountCents, 0);

    // Saídas do dia
    const dayOutflows = obligations.filter((ob) => ob.dueDate === dateStr);
    const dayOutflowTotal = dayOutflows.reduce((acc, ob) => acc + ob.amountCents, 0);

    runningBalance += dayInflowTotal - dayOutflowTotal;

    const events: string[] = [];
    dayInflows.forEach((inf) => events.push(`(+) ${inf.name}`));
    dayOutflows.forEach((ob) => events.push(`(-) ${ob.name}`));

    const isDeficit = runningBalance < 0;
    if (isDeficit) {
      const deficit = Math.abs(runningBalance);
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
      }
      if (!firstGapDate) {
        firstGapDate = dateStr;
        firstGapDays = offset;
      }
      dayOutflows.forEach((ob) => causingObligationsMap.set(ob.id, ob));
    }

    runway.push({
      date: dateStr,
      dayOfMonth: dayNum,
      projectedBalanceCents: runningBalance,
      inflowCents: dayInflowTotal,
      outflowCents: dayOutflowTotal,
      events,
      isDeficit,
    });
  }

  const isCashGapDetected = firstGapDate !== null;
  let severity: CashGapSeverity = "none";
  let nextInflowDate: string | null = null;

  if (isCashGapDetected) {
    if (firstGapDays !== null && firstGapDays <= 3) {
      severity = "critical";
    } else {
      severity = "warning";
    }

    // Próxima entrada após a data do gap
    const futureInflowsAfterGap = inflows
      .filter((inf) => inf.expectedDate > (firstGapDate as string))
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

    if (futureInflowsAfterGap.length > 0 && futureInflowsAfterGap[0]) {
      nextInflowDate = futureInflowsAfterGap[0].expectedDate;
    }
  }

  let recommendationMessage: string | null = null;
  if (isCashGapDetected && firstGapDate) {
    const formattedGapDate = `${firstGapDate.slice(8, 10)}/${firstGapDate.slice(5, 7)}`;
    if (nextInflowDate) {
      const formattedInflowDate = `${nextInflowDate.slice(8, 10)}/${nextInflowDate.slice(5, 7)}`;
      recommendationMessage = `Risco de saldo insuficiente a partir de ${formattedGapDate} antes do recebimento previsto para ${formattedInflowDate}. Considere transferir da reserva ou ajustar pagamentos.`;
    } else {
      recommendationMessage = `Risco de saldo insuficiente a partir de ${formattedGapDate}. Considere transferir da reserva de liquidez ou postergar despesas flexíveis.`;
    }
  }

  return {
    isCashGapDetected,
    severity,
    gapDate: firstGapDate,
    daysUntilGap: firstGapDays,
    maxDeficitCents: maxDeficit,
    nextInflowDate,
    causingObligations: Array.from(causingObligationsMap.values()),
    recommendationMessage,
    runway,
  };
}
