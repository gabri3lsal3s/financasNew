/**
 * Motor Puro de Regime de Caixa & Saldo Bancário Real — FASE 49.
 *
 * Responsável por:
 *   • Apurar o Saldo em Caixa Real em contas correntes (Balanço/Liquidez);
 *   • Aplicar o Regime de Caixa Estrito (PIX, débito, pagamentos de fatura, aportes);
 *   • Desacoplar compras no cartão de crédito do caixa diário;
 *   • Ancorar o saldo via Checkpoints ("Bater com o banco");
 *   • Calcular o Saldo Livre Real (Safe-to-Spend).
 *
 * Motor 100% puro — testável isoladamente sem Supabase ou dependências de UI.
 */

import { todayISO } from "@/domain/debts";
import { numberToCents } from "@/domain/money";

export interface CashCheckpointData {
  id?: string;
  date: string; // YYYY-MM-DD
  balanceCents: number;
  notes?: string | null;
  createdAt?: string | null;
}

export type CashEventKind =
  | "checkpoint"
  | "income"
  | "cash_expense"
  | "card_payment"
  | "card_refund"
  | "debt_payment"
  | "debt_receipt"
  | "contribution";

export type CashFlowDirection = "in" | "out" | "neutral";

export interface CashLedgerEvent {
  id: string;
  kind: CashEventKind;
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  flow: CashFlowDirection;
  createdAt?: string | null;
}

export interface RealCashBalanceResult {
  /** Saldo bancário consolidado na data de referência (em centavos). */
  currentBalanceCents: number;
  /** Último checkpoint utilizado como âncora (null se não houver). */
  latestCheckpoint: CashCheckpointData | null;
  /** Saldo de partida na data do checkpoint (em centavos). */
  checkpointBalanceCents: number;
  /** Total de entradas ocorridas após o checkpoint (em centavos). */
  inflowSinceCheckpointCents: number;
  /** Total de saídas ocorridas após o checkpoint (em centavos). */
  outflowSinceCheckpointCents: number;
  /** Eventos cronológicos computados após o checkpoint. */
  eventsSinceCheckpoint: CashLedgerEvent[];
}

export interface CalculateCashBalanceParams {
  checkpoint?: CashCheckpointData | null;
  incomes?: readonly {
    id?: string;
    date: string;
    value: number;
    description?: string | null;
    created_at?: string | null;
    source_ref?: string | null;
    tax_withheld?: number | null;
  }[];
  expenses?: readonly {
    id?: string;
    date: string;
    value: number;
    payment_method: string;
    card_id?: string | null;
    description?: string | null;
    created_at?: string | null;
  }[];
  cardPayments?: readonly {
    id?: string;
    date: string;
    amount: number;
    is_refund?: boolean;
    note?: string | null;
  }[];
  debts?: readonly {
    id?: string;
    name?: string;
    type: "payable" | "receivable" | string;
    amount: number;
    paid_at: string | null;
    expense_id?: string | null;
    created_at?: string | null;
  }[];
  contributions?: readonly {
    id?: string;
    date: string;
    amount: number;
    notes?: string | null;
    created_at?: string | null;
  }[];
  /** Data limite para apuração (YYYY-MM-DD). Transações posteriores são desconsideradas no saldo de hoje. */
  referenceDate: string;
}

/**
 * Normaliza e resolve todos os eventos de caixa que impactam o saldo bancário.
 * Filtra compras no crédito (não afetam caixa) e transações futuras (> referenceDate).
 */
export function resolveCashFlowEvents(params: CalculateCashBalanceParams): CashLedgerEvent[] {
  const {
    incomes = [],
    expenses = [],
    cardPayments = [],
    debts = [],
    contributions = [],
    referenceDate,
  } = params;

  const events: CashLedgerEvent[] = [];

  // 1. Receitas (Entradas de Caixa)
  const debtIdsWithIncome = new Set<string>();
  for (const inc of incomes) {
    if (inc.source_ref?.startsWith("[DEBT]")) {
      const debtId = inc.source_ref.slice(6);
      if (debtId) debtIdsWithIncome.add(debtId);
    }
    if (inc.date > referenceDate) continue;
    // Rendas automáticas de estorno [REFUND] são contrapartidas contábeis;
    // não devem duplicar no caixa se o estorno já estiver nos pagamentos do cartão.
    if (inc.source_ref?.startsWith("[REFUND]")) continue;
    // Desconta retenções tributárias na fonte (IRRF / ISS de autônomo e Simples),
    // refletindo estritamente a entrada física de caixa na conta corrente.
    const rawCents = numberToCents(inc.value);
    const taxWithheldCents = inc.tax_withheld ? numberToCents(inc.tax_withheld) : 0;
    const amountCents = Math.max(0, rawCents - taxWithheldCents);
    if (amountCents <= 0) continue;
    events.push({
      id: inc.id ?? `inc-${inc.date}-${amountCents}`,
      kind: "income",
      date: inc.date,
      description: inc.description || "Receita",
      amountCents,
      flow: "in",
      createdAt: inc.created_at,
    });
  }

  // 2. Despesas à Vista / Débito / PIX (Saídas de Caixa)
  // Ignora cartão de crédito ('credit_card', 'credit' ou com card_id vinculado)
  // Compras no cartão só saem do caixa no pagamento da fatura (card_payments)
  for (const exp of expenses) {
    if (exp.date > referenceDate) continue;
    const isCreditCard =
      exp.payment_method === "credit_card" ||
      exp.payment_method === "credit" ||
      Boolean(exp.card_id);
    if (isCreditCard) continue;

    const amountCents = numberToCents(exp.value);
    if (amountCents <= 0) continue;
    events.push({
      id: exp.id ?? `exp-${exp.date}-${amountCents}`,
      kind: "cash_expense",
      date: exp.date,
      description: exp.description || "Despesa",
      amountCents,
      flow: "out",
      createdAt: exp.created_at,
    });
  }

  // 3. Pagamentos e Estornos de Fatura de Cartão
  for (const pay of cardPayments) {
    if (pay.date > referenceDate) continue;
    const amountCents = numberToCents(pay.amount);
    if (amountCents === 0) continue;

    if (pay.is_refund || amountCents < 0) {
      // Estorno de cartão reduz apenas o saldo da fatura; é neutro para o saldo em conta corrente (BUG-02)
      continue;
    } else {
      // Pagamento de fatura debitado da conta corrente
      events.push({
        id: pay.id ?? `pay-${pay.date}-${amountCents}`,
        kind: "card_payment",
        date: pay.date,
        description: pay.note || "Pagamento de fatura",
        amountCents,
        flow: "out",
      });
    }
  }

  // 4. Dívidas / Empréstimos Efetivamente Pagos ou Recebidos
  for (const debt of debts) {
    if (!debt.paid_at) continue;
    const paidDate = debt.paid_at.slice(0, 10);
    if (paidDate > referenceDate) continue;
    const amountCents = numberToCents(debt.amount);
    if (amountCents <= 0) continue;

    if (debt.type === "payable") {
      // Invariante Contábil (§F49/JORNADA360-03): Se a dívida possui despesa vinculada (debt.expense_id),
      // o desembolso financeiro já foi computado como cash_expense no passo 2 acima. Não duplicar saída!
      if (debt.expense_id) continue;

      events.push({
        id: debt.id ?? `debt-${paidDate}-${amountCents}`,
        kind: "debt_payment",
        date: paidDate,
        description: debt.name || "Pagamento de dívida",
        amountCents,
        flow: "out",
        createdAt: debt.created_at,
      });
    } else if (debt.type === "receivable") {
      // Invariante Contábil (§F49/JORNADA360-03): Se o recebimento já gerou renda correspondente
      // (source_ref [DEBT]{id}), a entrada já foi computada como income no passo 1. Não duplicar entrada!
      if (debt.id && debtIdsWithIncome.has(debt.id)) continue;

      events.push({
        id: debt.id ?? `debt-${paidDate}-${amountCents}`,
        kind: "debt_receipt",
        date: paidDate,
        description: debt.name || "Recebimento de dívida",
        amountCents,
        flow: "in",
        createdAt: debt.created_at,
      });
    }
  }

  // 5. Aportes de Investimento (Saída de Caixa da Conta para Corretora)
  for (const contrib of contributions) {
    if (contrib.date > referenceDate) continue;
    const amountCents = numberToCents(contrib.amount);
    if (amountCents <= 0) continue;
    events.push({
      id: contrib.id ?? `contrib-${contrib.date}-${amountCents}`,
      kind: "contribution",
      date: contrib.date,
      description: contrib.notes || "Aporte em investimentos",
      amountCents,
      flow: "out",
      createdAt: contrib.created_at,
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Determina se um evento ocorreu estritamente após o checkpoint.
 */
function isEventAfterCheckpoint(event: CashLedgerEvent, checkpoint: CashCheckpointData): boolean {
  if (event.date > checkpoint.date) return true;
  if (event.date < checkpoint.date) return false;

  // Mesma data: se ambos têm timestamp de criação, compara milissegundos
  if (event.createdAt && checkpoint.createdAt) {
    return event.createdAt > checkpoint.createdAt;
  }

  // Se não há timestamp para desempate no mesmo dia, considera que o checkpoint
  // já representava o saldo fechado/ajustado daquele dia.
  return false;
}

/**
 * Calcula o saldo bancário consolidado em regime de caixa estrito com suporte a checkpoints.
 */
export function calculateRealCashBalance(params: CalculateCashBalanceParams): RealCashBalanceResult {
  const { checkpoint = null } = params;
  const allEvents = resolveCashFlowEvents(params);

  const checkpointBalanceCents = checkpoint ? checkpoint.balanceCents : 0;
  const relevantEvents = checkpoint
    ? allEvents.filter((ev) => isEventAfterCheckpoint(ev, checkpoint))
    : allEvents;

  let inflowSinceCheckpointCents = 0;
  let outflowSinceCheckpointCents = 0;

  for (const event of relevantEvents) {
    if (event.flow === "in") {
      inflowSinceCheckpointCents += event.amountCents;
    } else if (event.flow === "out") {
      outflowSinceCheckpointCents += event.amountCents;
    }
  }

  const currentBalanceCents = checkpointBalanceCents + inflowSinceCheckpointCents - outflowSinceCheckpointCents;

  return {
    currentBalanceCents,
    latestCheckpoint: checkpoint,
    checkpointBalanceCents,
    inflowSinceCheckpointCents,
    outflowSinceCheckpointCents,
    eventsSinceCheckpoint: relevantEvents,
  };
}

// ---------------------------------------------------------------------------
// Previsão de Liquidez & Safe-to-Spend
// ---------------------------------------------------------------------------

export interface SafeToSpendParams {
  realCashBalanceCents: number;
  openInvoicesCents: number;
  payablePendingCents: number;
  receivablePendingCents?: number;
  essentialBudgetsRemainingCents?: number;
  /**
   * Saldo operacional do negócio (Caixa Derivado PJ) em conta bancária única/compartilhada.
   * Quando positivo, é estritamente deduzido do Safe-to-Spend pessoal para evitar
   * que dinheiro da empresa apareça como disponível para lazer ou gastos da família.
   */
  derivedBusinessCashCents?: number;
  /** Faturas de cartão do próximo ciclo em acumulação (além do mês atual, em centavos). */
  nextCycleInvoicesCents?: number;
  /** Faturas futuras / parcelamentos posteriores de cartão (além do próximo ciclo, em centavos). */
  futureInvoicesCents?: number;
}

export interface SafeToSpendResult {
  /** Saldo em conta real hoje. */
  realCashBalanceCents: number;
  /** Total de faturas de cartão abertas que vencerão no ciclo. */
  openInvoicesCents: number;
  /** Dívidas/boletos a pagar pendentes do ciclo. */
  payablePendingCents: number;
  /** Dívidas/valores a receber previstos do ciclo. */
  receivablePendingCents: number;
  /** Orçamentos de categorias essenciais ainda não consumidos. */
  essentialBudgetsRemainingCents: number;
  /** Caixa operacional da empresa reservado na conta compartilhada. */
  derivedBusinessCashCents?: number;
  /** Total de obrigações comprometidas (faturas + dívidas a pagar + reserva de caixa PJ). */
  committedObligationsCents: number;
  /**
   * Saldo Livre Real conservador:
   *   Saldo Real − Faturas Abertas − Dívidas a Pagar − Caixa PJ em conta única.
   */
  safeToSpendCents: number;
  /**
   * Saldo Livre com margem de orçamentos essenciais:
   *   safeToSpendCents − essentialBudgetsRemainingCents.
   */
  safeToSpendWithBudgetsCents: number;
  /**
   * Saldo Livre otimista (incluindo receitas a receber garantidas):
   *   safeToSpendCents + receivablePendingCents.
   */
  safeToSpendWithReceivablesCents: number;
  /** Faturas de cartão do próximo ciclo em acumulação (centavos). */
  nextCycleInvoicesCents?: number;
  /** Faturas futuras / parcelamentos posteriores de cartão (centavos). */
  futureInvoicesCents?: number;
  /** Soma total de faturas fora do ciclo atual (`nextCycleInvoicesCents + futureInvoicesCents`). */
  totalUpcomingCardInvoicesCents?: number;
  /** Resultado com sinal após considerar as próximas faturas (`safeToSpendCents - nextCycleInvoicesCents`). */
  safeToSpendAfterNextInvoicesCents?: number;
  /**
   * Valor efetivamente livre para consumo discricionário (`max(0, safeToSpendCents - nextCycleInvoicesCents)`).
   * Evita falsa sensação de folga quando já há próxima fatura em acumulação.
   */
  freeToSpendCents?: number;
}

/**
 * Calcula o Saldo Livre Real (Safe-to-Spend) descontando compromissos já contratados
 * e garantindo a conservação exata de caixa (isolando o caixa da empresa em conta única).
 */
export function calculateSafeToSpend(params: SafeToSpendParams): SafeToSpendResult {
  const {
    realCashBalanceCents,
    openInvoicesCents,
    payablePendingCents,
    receivablePendingCents = 0,
    essentialBudgetsRemainingCents = 0,
    derivedBusinessCashCents = 0,
    nextCycleInvoicesCents = 0,
    futureInvoicesCents = 0,
  } = params;

  const businessCashReservationCents = Math.max(0, derivedBusinessCashCents);
  const committedObligationsCents =
    Math.max(0, openInvoicesCents) +
    Math.max(0, payablePendingCents) +
    businessCashReservationCents;

  const safeToSpendCents = realCashBalanceCents - committedObligationsCents;
  const safeToSpendWithBudgetsCents = safeToSpendCents - Math.max(0, essentialBudgetsRemainingCents);
  const safeToSpendWithReceivablesCents = safeToSpendCents + Math.max(0, receivablePendingCents);
  const safeNextCycleInvoicesCents = Math.max(0, nextCycleInvoicesCents);
  const safeFutureInvoicesCents = Math.max(0, futureInvoicesCents);
  const totalUpcomingCardInvoicesCents = safeNextCycleInvoicesCents + safeFutureInvoicesCents;
  const safeToSpendAfterNextInvoicesCents = safeToSpendCents - safeNextCycleInvoicesCents;
  const freeToSpendCents = Math.max(0, safeToSpendAfterNextInvoicesCents);

  return {
    realCashBalanceCents,
    openInvoicesCents: Math.max(0, openInvoicesCents),
    payablePendingCents: Math.max(0, payablePendingCents),
    receivablePendingCents: Math.max(0, receivablePendingCents),
    essentialBudgetsRemainingCents: Math.max(0, essentialBudgetsRemainingCents),
    derivedBusinessCashCents: businessCashReservationCents,
    committedObligationsCents,
    safeToSpendCents,
    safeToSpendWithBudgetsCents,
    safeToSpendWithReceivablesCents,
    nextCycleInvoicesCents: safeNextCycleInvoicesCents,
    futureInvoicesCents: safeFutureInvoicesCents,
    totalUpcomingCardInvoicesCents,
    safeToSpendAfterNextInvoicesCents,
    freeToSpendCents,
  };
}

export type IncomeAverageSource = "year_average" | "current_month" | "none";

export interface AverageMonthlyIncomeResult {
  averageMonthlyIncomeCents: number;
  monthsCount: number;
  source: IncomeAverageSource;
  year: string;
}

/**
 * Calcula a média mensal de receitas operacionais recebidas nos meses anteriores do ano corrente
 * (excluindo estornos `[REFUND]`), com fallback para o mês atual caso ainda não haja meses anteriores.
 */
export function calculateAverageMonthlyIncomeCents(
  incomes: readonly { date: string; value: number; tax_withheld?: number | null; source_ref?: string | null }[],
  referenceDate: string = todayISO(),
): AverageMonthlyIncomeResult {
  const year = referenceDate.slice(0, 4);
  const currentMonthStr = referenceDate.slice(0, 7);

  const priorByMonth = new Map<string, number>();
  let currentMonthCents = 0;

  for (const inc of incomes) {
    if (inc.source_ref?.startsWith("[REFUND]")) continue;
    if (!inc.date || !inc.date.startsWith(`${year}-`)) continue;
    const gross = numberToCents(inc.value);
    const withheld = inc.tax_withheld ? Math.max(0, numberToCents(inc.tax_withheld)) : 0;
    const netCents = Math.max(0, gross - withheld);
    if (netCents <= 0) continue;

    const m = inc.date.slice(0, 7);
    if (m < currentMonthStr) {
      priorByMonth.set(m, (priorByMonth.get(m) ?? 0) + netCents);
    } else if (m === currentMonthStr) {
      currentMonthCents += netCents;
    }
  }

  const priorValues = [...priorByMonth.values()].filter((v) => v > 0);
  if (priorValues.length > 0) {
    const sum = priorValues.reduce((acc, v) => acc + v, 0);
    return {
      averageMonthlyIncomeCents: Math.round(sum / priorValues.length),
      monthsCount: priorValues.length,
      source: "year_average",
      year,
    };
  }

  if (currentMonthCents > 0) {
    return {
      averageMonthlyIncomeCents: currentMonthCents,
      monthsCount: 1,
      source: "current_month",
      year,
    };
  }

  return {
    averageMonthlyIncomeCents: 0,
    monthsCount: 0,
    source: "none",
    year,
  };
}

export interface SafeDailySpendingParams {
  referenceDate?: string;
  safeToSpendCents: number;
  averageMonthlyIncomeCents: number;
  incomeMonthsCount?: number;
  incomeSource?: IncomeAverageSource;
  nextCycleInvoicesCents?: number;
  futureInvoicesCents?: number;
  nextMonthPayableDebtsCents?: number;
  /** Fração da renda média reservada como margem de lucro/poupança (default: 0.10 = 10%). */
  savingsMarginRate?: number;
}

export interface SafeDailySpendingResult {
  hasIncomeBase: boolean;
  incomeSource: IncomeAverageSource;
  incomeMonthsCount: number;
  horizonDays: number;
  safeToSpendCents: number;
  averageMonthlyIncomeCents: number;
  nextCycleInvoicesCents: number;
  futureInvoicesCents: number;
  nextMonthPayableDebtsCents: number;
  savingsMarginRate: number;
  savingsMarginCents: number;
  netBeforeMarginCents: number;
  netAfterMarginCents: number;
  /** Valor seguro para gastar por dia mantendo margem de sobra (null se sem base de renda). */
  safeDailyCents: number | null;
  /** Valor por dia para fechar exatamente no zero a zero sem margem de sobra. */
  breakEvenDailyCents: number | null;
}

/**
 * Calcula o Gasto Diário Seguro até o fechamento do próximo ciclo, cruzando:
 * Sobra do Ciclo Atual + Renda Média Mensal - Próximas Faturas - Contas do Próximo Mês - Margem de Sobra.
 */
export function calculateSafeDailySpending(
  params: SafeDailySpendingParams,
): SafeDailySpendingResult {
  const {
    referenceDate = todayISO(),
    safeToSpendCents,
    averageMonthlyIncomeCents,
    incomeMonthsCount = 0,
    incomeSource = "none",
    nextCycleInvoicesCents = 0,
    futureInvoicesCents = 0,
    nextMonthPayableDebtsCents = 0,
    savingsMarginRate = 0.1,
  } = params;

  const [yStr, mStr, dStr] = referenceDate.split("-");
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 1; // 1..12
  const d = Number(dStr) || 1;
  const daysInCurrentMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const daysRemainingCurrent = Math.max(1, daysInCurrentMonth - d + 1);
  const daysInNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const horizonDays = daysRemainingCurrent + daysInNextMonth;

  const safeIncome = Math.max(0, averageMonthlyIncomeCents);
  const safeNextInvoices = Math.max(0, nextCycleInvoicesCents);
  const safeFutureInvoices = Math.max(0, futureInvoicesCents);
  const safeNextDebts = Math.max(0, nextMonthPayableDebtsCents);
  const effectiveMarginRate = Math.max(0, Math.min(0.5, savingsMarginRate));

  const hasIncomeBase = safeIncome > 0;
  const totalResourcesCents = safeToSpendCents + safeIncome;
  const totalCommitmentsCents = safeNextInvoices + safeNextDebts;
  const netBeforeMarginCents = totalResourcesCents - totalCommitmentsCents;
  const savingsMarginCents = hasIncomeBase ? Math.round(safeIncome * effectiveMarginRate) : 0;
  const netAfterMarginCents = netBeforeMarginCents - savingsMarginCents;

  const safeDailyCents =
    hasIncomeBase && horizonDays > 0 ? Math.max(0, Math.floor(netAfterMarginCents / horizonDays)) : null;
  const breakEvenDailyCents =
    hasIncomeBase && horizonDays > 0 ? Math.max(0, Math.floor(netBeforeMarginCents / horizonDays)) : null;

  return {
    hasIncomeBase,
    incomeSource,
    incomeMonthsCount,
    horizonDays,
    safeToSpendCents,
    averageMonthlyIncomeCents: safeIncome,
    nextCycleInvoicesCents: safeNextInvoices,
    futureInvoicesCents: safeFutureInvoices,
    nextMonthPayableDebtsCents: safeNextDebts,
    savingsMarginRate: effectiveMarginRate,
    savingsMarginCents,
    netBeforeMarginCents,
    netAfterMarginCents,
    safeDailyCents,
    breakEvenDailyCents,
  };
}
