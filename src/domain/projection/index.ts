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
  /**
   * Base mensal de referência alternativa (centavos) quando a renda do mês ainda não foi lançada
   * (ex.: renda habitual esperada ou soma dos tetos de orçamento).
   */
  referenceBudgetCents?: number;
  /** Investimentos do mês (centavos). */
  investmentsCents: number;
  /** Despesas do mês (centavos) — presentes apenas em `current`/`past`. */
  expensesCents?: number;
  /** Custos fixos recorrentes ainda previstos e não lançados no mês (centavos) — reservados do diário livre. */
  pendingFixedCents?: number;
  /** Dia atual do mês (1..daysInMonth) — usado em `current`. */
  dayOfMonth?: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface DailyBudget {
  /**
   * Valor diário disponível (centavos) — `null` em mês encerrado ou quando
   * não houver nenhuma base de renda/orçamento configurada (evita exibir R$ 0,00/dia em cold start).
   */
  dailyCents: number | null;
  /** Saldo mensal líquido (base − investimentos − despesas − fixos pendentes). */
  monthlyNetCents: number;
  /** Dias restantes incluindo hoje — `null` fora do mês atual. */
  daysRemaining: number | null;
}

/**
 * Gasto disponível diário derivado:
 *   • atual:  sem base (incomesCents <= 0 && referenceBudgetCents <= 0) → dailyCents = null;
 *             mensalDisponível = base − investimentos − despesas − fixosPendentes;
 *             diário = max(0, mensalDisponível ÷ diasRestantes),
 *             diasRestantes = diasNoMês − diaAtual + 1 (inclui hoje);
 *   • futuro: diário = max(0, (base − investimentos) ÷ diasNoMês) (ou null sem base);
 *   • encerrado: sem valor diário (apenas o resultado real).
 */
export function dailyBudget(input: DailyBudgetInput): DailyBudget {
  const expenses = input.expensesCents ?? 0;
  const pendingFixed = Math.max(0, input.pendingFixedCents ?? 0);
  const effectiveBase =
    input.referenceBudgetCents !== undefined && input.referenceBudgetCents > 0
      ? input.referenceBudgetCents
      : input.incomesCents;

  if (input.phase === "future") {
    const monthlyNet = effectiveBase - input.investmentsCents;
    return {
      dailyCents: effectiveBase > 0 ? Math.max(0, Math.floor(monthlyNet / input.daysInMonth)) : null,
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
  const monthlyNet = effectiveBase - input.investmentsCents - expenses - pendingFixed;

  if (effectiveBase <= 0) {
    return {
      dailyCents: null,
      monthlyNetCents: monthlyNet,
      daysRemaining,
    };
  }

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
  /** Total mensal disponível: base de referência − investimentos (centavos). Se <= 0, ritmo permanece inativo. */
  monthlyBudgetCents: number;
  /** Dia atual do mês. */
  dayOfMonth: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface SpendingPace {
  /** Ritmo está ativo (base > 0, dia ≥ 8 e fração decorrida ≥ 30%)? */
  active: boolean;
  /** % do orçamento já gasto (0–100+); sempre 0 quando `monthlyBudgetCents <= 0`. */
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
 * Inativo (`active=false`) quando `monthlyBudgetCents <= 0`, antes do 8º dia
 * ou com fração decorrida < 30% — evita divisão por zero/1 centavo e alarme falso no início do mês.
 */
export function spendingPace(input: SpendingPaceInput): SpendingPace {
  const elapsedPercent = Math.min(100, (input.dayOfMonth / input.daysInMonth) * 100);

  if (input.monthlyBudgetCents <= 0) {
    return {
      active: false,
      spentPercent: 0,
      elapsedPercent,
      gapPoints: 0,
      ahead: false,
    };
  }

  const spentPercent = (input.spentCents / input.monthlyBudgetCents) * 100;
  const active =
    input.dayOfMonth >= PACE_MIN_DAY && input.dayOfMonth / input.daysInMonth >= PACE_MIN_ELAPSED_PERCENT;

  return {
    active,
    spentPercent,
    elapsedPercent,
    gapPoints: spentPercent - elapsedPercent,
    ahead: active && spentPercent > elapsedPercent,
  };
}

// ---------------------------------------------------------------------------
// Projeção de fim de mês (§3.8 + Blended Shrinkage Quadrático — PLANO MESTRE FASE 1)
// ---------------------------------------------------------------------------

export interface EndOfMonthInput {
  phase: MonthPhase;
  /** Rendas do mês (centavos). */
  incomesCents: number;
  /**
   * Base mensal de referência alternativa (centavos) quando a renda do mês ainda não foi
   * totalmente lançada (ex.: renda habitual esperada, recebimento quinzenal ou tetos de orçamento).
   */
  referenceBudgetCents?: number;
  /** Investimentos do mês (centavos). */
  investmentsCents: number;
  /** Despesas acumuladas totais (centavos) — em `current`/`past` (modo legado/fallback). */
  expensesCents?: number;
  /**
   * Modo Híbrido / Blended (PLANO MESTRE FASE 1):
   * Quando informados, apenas `variableExpensesCents` sofre extrapolação suavizada.
   */
  fixedPaidCents?: number;
  /** Custos fixos previstos recorrentes ainda não lançados no mês (centavos). */
  pendingFixedCents?: number;
  /** Compras pontuais (`one_off` / `tx_one_off`) e despesas de viagem (`trip_id`) (centavos) — entram 1x. */
  oneOffAndTripCents?: number;
  /** Despesas cotidianas variáveis acumuladas no mês (centavos). */
  variableExpensesCents?: number;
  /** Mediana histórica dos gastos variáveis dos últimos 3 meses (centavos) para shrinkage quadrático. */
  historicalVariableMedianCents?: number;
  /** Crédito de estorno cross-month (ciclo anterior) que abate o saldo líquido sem distorcer o burn rate variável. */
  priorCycleRefundCreditCents?: number;
  /** Quantidade de transações variáveis no mês (guarda de cold start quando sem histórico). */
  variableTxCount?: number;
  /** Quantidade de dias distintos com transações variáveis (guarda de cold start quando sem histórico). */
  variableDaysCount?: number;
  /** Dia atual do mês. */
  dayOfMonth: number;
  /** Total de dias do mês. */
  daysInMonth: number;
}

export interface EndOfMonthProjection {
  /**
   * Projeção de despesas do mês — `null` quando não aplicável
   * (mês futuro, sem base de renda/orçamento, ou amostragem insuficiente no início do mês).
   */
  projectedExpensesCents: number | null;
  /** Superávit projetado (base − investimentos − projeção). */
  surplusCents: number | null;
  /** No trilho (superávit ≥ 0)? `null` quando não aplicável. */
  onTrack: boolean | null;
  /** Burn rate diário (despesas variáveis ÷ dias decorridos ou total ÷ dias no modo legado) — mês atual apenas. */
  burnRateCents: number | null;
  /** Parcela variável projetada via shrinkage quadrático (presente no modo híbrido/blended). */
  projectedVariableCents?: number | null;
  /** Peso quadrático `w = min(1, (d / 14)^2)` aplicado na mesclagem histórica (0..1). */
  blendedWeight?: number | null;
}

/** Projeção de fim de mês exige dia ≥ 3 no modo legado. */
export const PROJECTION_MIN_DAY = 3;
/** Horizonte de convergência (dias) do shrinkage quadrático: a partir do dia 14, peso = 1. */
export const BLENDED_CONVERGENCE_DAY = 14;

/**
 * Calcula a projeção de gastos variáveis com Shrinkage Quadrático no Total:
 *   `w = min(1, (dayOfMonth / 14)^2)`
 *   `projectedVariable = max(variableExpenseCents, round(w * (variableExpenseCents * daysInMonth / dayOfMonth) + (1 - w) * historicalVariableMedianCents))`
 */
export function computeBlendedVariableProjection(params: {
  variableExpenseCents: number;
  historicalVariableMedianCents: number;
  dayOfMonth: number;
  daysInMonth: number;
}): { projectedVariableCents: number; weight: number } {
  const { variableExpenseCents, historicalVariableMedianCents, dayOfMonth, daysInMonth } = params;
  const safeDay = Math.max(1, dayOfMonth);
  const safeVar = Math.max(0, Math.round(variableExpenseCents));
  const safeHist = Math.max(0, Math.round(historicalVariableMedianCents));

  const ratio = Math.min(1, safeDay / BLENDED_CONVERGENCE_DAY);
  const weight = Math.min(1, ratio * ratio);
  const extrapolated = (safeVar * daysInMonth) / safeDay;

  if (safeHist <= 0) {
    return {
      projectedVariableCents: Math.max(safeVar, Math.round(extrapolated)),
      weight: 1,
    };
  }

  const blended = Math.round(weight * extrapolated + (1 - weight) * safeHist);
  return {
    projectedVariableCents: Math.max(safeVar, blended),
    weight,
  };
}

/**
 * Projeção de fim de mês:
 *   • Sem base (`incomesCents <= 0 && referenceBudgetCents <= 0`): retorna tudo `null` (nunca inventa déficit em cold start);
 *   • Modo Híbrido / Blended (quando `fixedPaidCents` ou `variableExpensesCents` são informados):
 *       - Fixos pagos (`fixedPaidCents`) + Fixos pendentes (`pendingFixedCents`) + Pontuais/Viagens (`oneOffAndTripCents`) entram 1x;
 *       - Variáveis (`variableExpensesCents`) usam shrinkage quadrático com `historicalVariableMedianCents`;
 *       - Sem histórico variável (`historicalVariableMedianCents === 0`), exige `dayOfMonth >= 8` e amostragem mínima
 *         (`variableTxCount >= 3 && variableDaysCount >= 2` quando fornecidos) antes de extrapolar.
 *   • Modo Legado (compatível com chamadas antigas):
 *       - `burnRate = floor(expenses / dayOfMonth)`; `projected = burnRate * daysInMonth` (exige dia >= 3).
 *   • Passado: valores reais (`onTrack = surplus >= 0`);
 *   • Futuro: não aplicável.
 */
export function endOfMonthProjection(input: EndOfMonthInput): EndOfMonthProjection {
  const expenses = input.expensesCents ?? 0;
  const effectiveBase =
    input.referenceBudgetCents !== undefined && input.referenceBudgetCents > 0
      ? input.referenceBudgetCents
      : input.incomesCents;
  const available = effectiveBase - input.investmentsCents;

  if (input.phase === "future") {
    return {
      projectedExpensesCents: null,
      surplusCents: null,
      onTrack: null,
      burnRateCents: null,
      projectedVariableCents: null,
      blendedWeight: null,
    };
  }

  if (input.phase === "past") {
    const surplus = input.incomesCents - input.investmentsCents - expenses;
    return {
      projectedExpensesCents: expenses,
      surplusCents: surplus,
      onTrack: input.incomesCents > 0 ? surplus >= 0 : null,
      burnRateCents: null,
      projectedVariableCents: null,
      blendedWeight: null,
    };
  }

  // Sem nenhuma base de renda nem orçamento → projeção inativa (elimina falsos déficits de cold start)
  if (effectiveBase <= 0) {
    return {
      projectedExpensesCents: null,
      surplusCents: null,
      onTrack: null,
      burnRateCents: null,
      projectedVariableCents: null,
      blendedWeight: null,
    };
  }

  const isHybridMode =
    input.fixedPaidCents !== undefined ||
    input.variableExpensesCents !== undefined ||
    input.pendingFixedCents !== undefined ||
    input.oneOffAndTripCents !== undefined ||
    input.historicalVariableMedianCents !== undefined;

  if (isHybridMode) {
    const fixedPaid = Math.max(0, input.fixedPaidCents ?? 0);
    const pendingFixed = Math.max(0, input.pendingFixedCents ?? 0);
    const oneOffAndTrip = Math.max(0, input.oneOffAndTripCents ?? 0);
    const variableSpent = Math.max(0, input.variableExpensesCents ?? 0);
    const histMedian = Math.max(0, input.historicalVariableMedianCents ?? 0);
    const priorRefund = Math.max(0, input.priorCycleRefundCreditCents ?? 0);

    // Quando não há histórico variável, exige dia >= 8 e massa crítica mínima (se informada) antes de extrapolar
    const hasEnoughSampleWithoutHistory =
      input.dayOfMonth >= PACE_MIN_DAY &&
      (input.variableTxCount === undefined || input.variableTxCount >= 3) &&
      (input.variableDaysCount === undefined || input.variableDaysCount >= 2);

    if (histMedian <= 0 && !hasEnoughSampleWithoutHistory) {
      // Sem histórico e início do mês/amostra fraca: só projeta se já houver custos estruturais/comprometidos suficientes,
      // mas sem extrapolar gastos variáveis (evita explosão linear nos dias 1..7 sem histórico)
      if (input.dayOfMonth < PROJECTION_MIN_DAY) {
        return {
          projectedExpensesCents: null,
          surplusCents: null,
          onTrack: null,
          burnRateCents: null,
          projectedVariableCents: null,
          blendedWeight: null,
        };
      }
      const conservativeProjected = Math.max(
        0,
        fixedPaid + pendingFixed + oneOffAndTrip + variableSpent - priorRefund,
      );
      const surplus = available - conservativeProjected;
      return {
        projectedExpensesCents: conservativeProjected,
        surplusCents: surplus,
        onTrack: surplus >= 0,
        burnRateCents: input.dayOfMonth > 0 ? Math.floor(variableSpent / input.dayOfMonth) : 0,
        projectedVariableCents: variableSpent,
        blendedWeight: 0,
      };
    }

    const { projectedVariableCents, weight } = computeBlendedVariableProjection({
      variableExpenseCents: variableSpent,
      historicalVariableMedianCents: histMedian,
      dayOfMonth: input.dayOfMonth,
      daysInMonth: input.daysInMonth,
    });

    const projected = Math.max(
      0,
      fixedPaid + pendingFixed + oneOffAndTrip + projectedVariableCents - priorRefund,
    );
    const surplus = available - projected;
    const burnRate = input.dayOfMonth > 0 ? Math.floor(variableSpent / input.dayOfMonth) : 0;

    return {
      projectedExpensesCents: projected,
      surplusCents: surplus,
      onTrack: surplus >= 0,
      burnRateCents: burnRate,
      projectedVariableCents,
      blendedWeight: weight,
    };
  }

  if (input.dayOfMonth < PROJECTION_MIN_DAY) {
    return {
      projectedExpensesCents: null,
      surplusCents: null,
      onTrack: null,
      burnRateCents: null,
      projectedVariableCents: null,
      blendedWeight: null,
    };
  }

  const burnRate = Math.floor(expenses / input.dayOfMonth);
  const projected = burnRate * input.daysInMonth;
  const surplus = available - projected;
  return {
    projectedExpensesCents: projected,
    surplusCents: surplus,
    onTrack: surplus >= 0,
    burnRateCents: burnRate,
    projectedVariableCents: null,
    blendedWeight: null,
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
export * from "./emergency-fund";
export * from "./weekly-radar";

