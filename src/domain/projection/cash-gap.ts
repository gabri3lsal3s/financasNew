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

export interface CashGapObligation {
  id: string;
  name: string;
  dueDate: string;
  amountCents: number;
  kind: "invoice" | "debt" | "expense";
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
  obligations: readonly CashGapObligation[];
  /** Receitas/entradas esperadas no período. */
  inflows: readonly CashGapInflow[];
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
  const { currentBalanceCents, today, obligations, inflows } = params;

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
