/**
 * Projeção e prospecção de gastos — ESPECIFICAÇÃO §3.8.
 *
 * Motores puros (testáveis isoladamente):
 *   • Gasto disponível diário (orçamento derivado) — atual/futuro/encerrado;
 *   • Ritmo de gastos (spending pace) — ativa a partir do 8º dia e quando
 *     a fração decorrida do mês ≥ 30%;
 *   • Projeção de fim de mês — exige dia ≥ 3; burn rate, superávit e trilha;
 *   • Projeção de pendências — dívidas pagáveis/recebíveis do período.
 *
 * Todas as funções recebem o contexto de data por parâmetro (dia do mês,
 * dias no mês, fase) para permanecerem puras e determinísticas.
 */

// ---------------------------------------------------------------------------
// Gasto disponível diário (§3.8)
// ---------------------------------------------------------------------------

export type MonthPhase = "current" | "future" | "past";

export interface DailyBudgetInput {
  /** Fase do mês em relação a hoje. */
  phase: MonthPhase;
  /** Rendas do mês (centavos). */
  incomesCents: number;
  /** Investimentos do mês (centavos). */
  investmentsCents: number;
  /** Despesas do mês (centavos) — presentes apenas em `current`/`past`. */
  expensesCents?: number;
  /** Dia atual do mês (1..daysInMonth) — usado em `current`. */
  dayOfMonth?: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface DailyBudget {
  /**
   * Valor diário disponível (centavos) — `null` em mês encerrado
   * (resultado real, sem orçamento derivado).
   */
  dailyCents: number | null;
  /** Saldo mensal líquido (rendas − investimentos − despesas). */
  monthlyNetCents: number;
  /** Dias restantes incluindo hoje — `null` fora do mês atual. */
  daysRemaining: number | null;
}

/**
 * Gasto disponível diário derivado:
 *   • atual:  mensalDisponível = rendas − investimentos − despesas;
 *             diário = max(0, mensalDisponível ÷ diasRestantes),
 *             diasRestantes = diasNoMês − diaAtual + 1 (inclui hoje);
 *   • futuro: diário = max(0, (rendas − investimentos) ÷ diasNoMês);
 *   • encerrado: sem valor diário (apenas o resultado real).
 */
export function dailyBudget(input: DailyBudgetInput): DailyBudget {
  const expenses = input.expensesCents ?? 0;

  if (input.phase === "future") {
    const monthlyNet = input.incomesCents - input.investmentsCents;
    return {
      dailyCents: Math.max(0, Math.floor(monthlyNet / input.daysInMonth)),
      monthlyNetCents: monthlyNet,
      daysRemaining: null,
    };
  }

  if (input.phase === "past") {
    return {
      dailyCents: null,
      monthlyNetCents: input.incomesCents - input.investmentsCents - expenses,
      daysRemaining: null,
    };
  }

  const day = input.dayOfMonth ?? input.daysInMonth;
  const daysRemaining = input.daysInMonth - day + 1;
  const monthlyNet = input.incomesCents - input.investmentsCents - expenses;
  const daily = daysRemaining > 0 ? Math.floor(monthlyNet / daysRemaining) : monthlyNet;
  return {
    dailyCents: Math.max(0, daily),
    monthlyNetCents: monthlyNet,
    daysRemaining,
  };
}

// ---------------------------------------------------------------------------
// Ritmo de gastos (spending pace) (§3.8)
// ---------------------------------------------------------------------------

export interface SpendingPaceInput {
  /** Despesas acumuladas do mês (centavos). */
  spentCents: number;
  /** Total mensal disponível: rendas − investimentos (centavos). */
  monthlyBudgetCents: number;
  /** Dia atual do mês. */
  dayOfMonth: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface SpendingPace {
  /** Ritmo está ativo (dia ≥ 8 e fração decorrida ≥ 30%)? */
  active: boolean;
  /** % do orçamento já gasto (0–100+). */
  spentPercent: number;
  /** % do mês já decorrido (0–100). */
  elapsedPercent: number;
  /** Diferença em pontos: spentPercent − elapsedPercent. */
  gapPoints: number;
  /** Acima do ritmo esperado (gasto além da fração decorrida)? */
  ahead: boolean;
}

/** Ritmo ativo apenas a partir do 8º dia. */
export const PACE_MIN_DAY = 8;
/** Ritmo ativo apenas quando a fração decorrida do mês ≥ 30%. */
const PACE_MIN_ELAPSED_PERCENT = 0.3;

/**
 * Compara o acumulado do mês com a fração esperada (dia decorrido).
 * Inativo (active=false) antes do 8º dia ou com fração decorrida < 30% —
 * evita alarme falso no início do mês. `ahead` só é relevante quando ativo.
 */
export function spendingPace(input: SpendingPaceInput): SpendingPace {
  const elapsedPercent = Math.min(100, (input.dayOfMonth / input.daysInMonth) * 100);
  const spentPercent = input.monthlyBudgetCents > 0 ? (input.spentCents / input.monthlyBudgetCents) * 100 : 0;

  const active =
    input.dayOfMonth >= PACE_MIN_DAY && input.dayOfMonth / input.daysInMonth >= PACE_MIN_ELAPSED_PERCENT;

  return {
    active,
    spentPercent,
    elapsedPercent,
    gapPoints: spentPercent - elapsedPercent,
    ahead: spentPercent > elapsedPercent,
  };
}

// ---------------------------------------------------------------------------
// Projeção de fim de mês (§3.8)
// ---------------------------------------------------------------------------

export interface EndOfMonthInput {
  phase: MonthPhase;
  /** Rendas do mês (centavos). */
  incomesCents: number;
  /** Investimentos do mês (centavos). */
  investmentsCents: number;
  /** Despesas acumuladas (centavos) — em `current`/`past`. */
  expensesCents?: number;
  /** Dia atual do mês. */
  dayOfMonth: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface EndOfMonthProjection {
  /**
   * Projeção de despesas do mês — `null` quando não aplicável
   * (mês futuro, ou mês atual com dia < 3).
   */
  projectedExpensesCents: number | null;
  /** Superávit projetado (rendas − investimentos − projeção). */
  surplusCents: number | null;
  /** No trilho (superávit ≥ 0)? `null` quando não aplicável. */
  onTrack: boolean | null;
  /** Burn rate diário (despesas ÷ dias decorridos) — mês atual apenas. */
  burnRateCents: number | null;
}

/** Projeção de fim de mês exige dia ≥ 3. */
export const PROJECTION_MIN_DAY = 3;

/**
 * Projeção de fim de mês:
 *   • atual:  burnRate = despesas ÷ diasDecorridos;
 *             projeção = burnRate × diasNoMês;
 *             superávit = rendas − investimentos − projeção;
 *             noTrilho = superávit ≥ 0 (exige dia ≥ 3);
 *   • passado: valores reais (noTrilho = saldo real ≥ 0);
 *   • futuro:  não aplicável.
 */
export function endOfMonthProjection(input: EndOfMonthInput): EndOfMonthProjection {
  const expenses = input.expensesCents ?? 0;
  const available = input.incomesCents - input.investmentsCents;

  if (input.phase === "future") {
    return { projectedExpensesCents: null, surplusCents: null, onTrack: null, burnRateCents: null };
  }

  if (input.phase === "past") {
    const surplus = available - expenses;
    return {
      projectedExpensesCents: expenses,
      surplusCents: surplus,
      onTrack: surplus >= 0,
      burnRateCents: null,
    };
  }

  if (input.dayOfMonth < PROJECTION_MIN_DAY) {
    return { projectedExpensesCents: null, surplusCents: null, onTrack: null, burnRateCents: null };
  }

  const burnRate = Math.floor(expenses / input.dayOfMonth);
  const projected = burnRate * input.daysInMonth;
  const surplus = available - projected;
  return {
    projectedExpensesCents: projected,
    surplusCents: surplus,
    onTrack: surplus >= 0,
    burnRateCents: burnRate,
  };
}

// ---------------------------------------------------------------------------
// Projeção de pendências (§3.8)
// ---------------------------------------------------------------------------

export interface PendingDebt {
  id: string;
  /** Pagável (a pagar) ou recebível (a receber). */
  kind: "payable" | "receivable";
  /** Valor restante pendente (centavos). */
  remainingCents: number;
}

export interface PendingProjection {
  /** Total de recebíveis pendentes (centavos). */
  receivablesCents: number;
  /** Total de pagáveis pendentes (centavos). */
  payablesCents: number;
  /** Projeção de saldo = recebíveis − pagáveis. */
  balanceCents: number;
}

/**
 * Projeção de pendências do período: soma os recebíveis e pagáveis
 * pendentes e projeta o saldo líquido (recebíveis − pagáveis).
 */
export function pendingProjection(debts: readonly PendingDebt[]): PendingProjection {
  let receivables = 0;
  let payables = 0;
  for (const debt of debts) {
    if (debt.kind === "receivable") receivables += debt.remainingCents;
    else payables += debt.remainingCents;
  }
  return {
    receivablesCents: receivables,
    payablesCents: payables,
    balanceCents: receivables - payables,
  };
}

export * from "./cash-gap";

