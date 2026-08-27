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
  for (const inc of incomes) {
    if (inc.date > referenceDate) continue;
    const amountCents = numberToCents(inc.value);
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
      // Estorno creditado em conta corrente
      events.push({
        id: pay.id ?? `pay-${pay.date}-${Math.abs(amountCents)}`,
        kind: "card_refund",
        date: pay.date,
        description: pay.note || "Estorno de fatura",
        amountCents: Math.abs(amountCents),
        flow: "in",
      });
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
  /** Total de obrigações comprometidas (faturas + dívidas a pagar). */
  committedObligationsCents: number;
  /**
   * Saldo Livre Real conservador:
   *   Saldo Real − Faturas Abertas − Dívidas a Pagar.
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
}

/**
 * Calcula o Saldo Livre Real (Safe-to-Spend) descontando compromissos já contratados.
 */
export function calculateSafeToSpend(params: SafeToSpendParams): SafeToSpendResult {
  const {
    realCashBalanceCents,
    openInvoicesCents,
    payablePendingCents,
    receivablePendingCents = 0,
    essentialBudgetsRemainingCents = 0,
  } = params;

  const committedObligationsCents = Math.max(0, openInvoicesCents) + Math.max(0, payablePendingCents);
  const safeToSpendCents = realCashBalanceCents - committedObligationsCents;
  const safeToSpendWithBudgetsCents = safeToSpendCents - Math.max(0, essentialBudgetsRemainingCents);
  const safeToSpendWithReceivablesCents = safeToSpendCents + Math.max(0, receivablePendingCents);

  return {
    realCashBalanceCents,
    openInvoicesCents: Math.max(0, openInvoicesCents),
    payablePendingCents: Math.max(0, payablePendingCents),
    receivablePendingCents: Math.max(0, receivablePendingCents),
    essentialBudgetsRemainingCents: Math.max(0, essentialBudgetsRemainingCents),
    committedObligationsCents,
    safeToSpendCents,
    safeToSpendWithBudgetsCents,
    safeToSpendWithReceivablesCents,
  };
}
