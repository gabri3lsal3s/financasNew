/**
 * Diagnósticos adicionais — ESPECIFICAÇÃO §3.7.6.
 * Motores puros: concentração de renda, tendência, gastos de fim de
 * semana e saúde da poupança.
 */

export type SavingsHealth = "indefinido" | "critico" | "baixo" | "moderado" | "saudavel" | "forte";

export const SAVINGS_HEALTH_LABELS: Record<SavingsHealth, string> = {
  indefinido: "Aguardando renda",
  critico: "Crítico",
  baixo: "Baixo",
  moderado: "Moderado",
  saudavel: "Saudável",
  forte: "Forte",
};

/** Saúde da poupança por faixa de savings rate (%). */
export function savingsHealth(savingsRatePercent: number | null | undefined, hasIncome = true): SavingsHealth {
  if (!hasIncome || savingsRatePercent == null || Number.isNaN(savingsRatePercent)) return "indefinido";
  if (savingsRatePercent < 0) return "critico";
  if (savingsRatePercent < 10) return "baixo";
  if (savingsRatePercent < 20) return "moderado";
  if (savingsRatePercent < 30) return "saudavel";
  return "forte";
}

export interface IncomeConcentration {
  /** Maior fonte como % da renda total (0–100). */
  topSharePercent: number;
  /** Alerta quando uma única fonte > 60% da renda. */
  alert: boolean;
}

export interface IncomeConcentrationOptions {
  /** Indica se todas as rendas provêm de uma única fonte salarial/CLT estável conhecida. */
  isSingleSalarySource?: boolean;
}

/** Concentração de renda: alerta quando 1 fonte > 60% da renda (a menos que seja apenas salário único declarado e o usuário seja assalariado). */
export function incomeConcentration(
  incomeBySourceCents: readonly number[],
  options?: IncomeConcentrationOptions,
): IncomeConcentration {
  const total = incomeBySourceCents.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return { topSharePercent: 0, alert: false };
  const top = Math.max(...incomeBySourceCents);
  const share = (top / total) * 100;
  // Se houver apenas 1 fonte e for salário estável/única renda, não alarmar como risco desproporcional
  const shouldAlert = share > 60 && !options?.isSingleSalarySource;
  return { topSharePercent: share, alert: shouldAlert };
}

export interface WeekdayTotalItem {
  ponderadoCents: number;
}

export interface WeekdayAverageOptions {
  /** Quantidade real de dias úteis decorridos no mês (default: 5 se nulo/omitido). */
  elapsedWeekdaysCount?: number;
  /** Quantidade real de dias de fim de semana decorridos no mês (default: 2 se nulo/omitido). */
  elapsedWeekendDaysCount?: number;
}

/**
 * Calcula a média diária de gastos em dias úteis e fins de semana.
 * Permite calibrar pela quantidade real de dias decorridos de cada tipo no mês.
 */
export function calculateWeekdayWeekendDailyAverages(
  weekdayTotals: readonly WeekdayTotalItem[],
  options?: WeekdayAverageOptions,
): { weekdayDailyCents: number; weekendDailyCents: number } {
  const weekdayDays = Math.max(1, options?.elapsedWeekdaysCount ?? 5);
  const weekendDays = Math.max(1, options?.elapsedWeekendDaysCount ?? 2);

  const weekdaySum = weekdayTotals.slice(0, 5).reduce((acc, w) => acc + w.ponderadoCents, 0);
  const weekendSum = weekdayTotals.slice(5).reduce((acc, w) => acc + w.ponderadoCents, 0);

  const weekdayDailyCents = weekdaySum / weekdayDays;
  const weekendDailyCents = weekendSum / weekendDays;

  return {
    weekdayDailyCents,
    weekendDailyCents,
  };
}

/**
 * Gastos de fim de semana: ratio fim de semana/dia útil > 1.5 → alerta.
 * Os valores devem ser por DIA (média diária) para comparação justa.
 */
export function weekendSpendingRatio(weekdayDailyCents: number, weekendDailyCents: number): number {
  if (weekdayDailyCents <= 0) return weekendDailyCents > 0 ? Number.POSITIVE_INFINITY : 0;
  return weekendDailyCents / weekdayDailyCents;
}

export const WEEKEND_RATIO_LIMIT = 1.5;

export interface WeekendComparisonContext {
  totalExpenseCount: number;
  elapsedWeekdaysCount: number;
  elapsedWeekendDaysCount: number;
  weekdayDailyCents: number;
}

/**
 * Exige massa crítica mínima (>= 4 despesas, >= 2 dias úteis e >= 1 dia de fim de semana decorrido)
 * antes de exibir comparação entre dias úteis e fins de semana.
 */
export function isWeekendComparisonReliable(ctx: WeekendComparisonContext): boolean {
  return (
    ctx.totalExpenseCount >= 4 &&
    ctx.elapsedWeekdaysCount >= 2 &&
    ctx.elapsedWeekendDaysCount >= 1 &&
    ctx.weekdayDailyCents > 0
  );
}

/**
 * Comprometimento Essencial: calcula a fração de gastos em categorias essenciais vs. base de referência.
 * Recomendação financeira clássica (Regra 50/30/20): gastos essenciais até 50% da renda/despesas.
 */
export interface EssentialSpendingResult {
  essentialCents: number;
  totalCents: number;
  ratioPercent: number;
  status: "adequado" | "moderado" | "elevado" | "em_formacao";
  hasCriticalMass: boolean;
}

export interface EssentialSpendingOptions {
  /** Quantidade de lançamentos considerados no mês (exige >= 3 para sair de "em_formacao"). */
  transactionCount?: number;
  /** Renda de referência do mês em centavos; quando > 0, usa max(renda, despesas). */
  referenceIncomeCents?: number;
}

export function essentialSpendingRatio(
  essentialCents: number,
  totalExpensesCents: number,
  options?: EssentialSpendingOptions,
): EssentialSpendingResult {
  const hasCriticalMass =
    totalExpensesCents > 0 &&
    (options?.transactionCount === undefined || options.transactionCount >= 3);

  const denominatorCents =
    options?.referenceIncomeCents && options.referenceIncomeCents > 0
      ? Math.max(options.referenceIncomeCents, totalExpensesCents)
      : totalExpensesCents;

  if (!hasCriticalMass || denominatorCents <= 0) {
    return {
      essentialCents,
      totalCents: denominatorCents,
      ratioPercent: 0,
      status: options?.transactionCount !== undefined && options.transactionCount < 3 ? "em_formacao" : "adequado",
      hasCriticalMass: false,
    };
  }

  const ratioPercent = Math.min(100, Math.max(0, (essentialCents / denominatorCents) * 100));
  const status: "adequado" | "moderado" | "elevado" =
    ratioPercent <= 50 ? "adequado" : ratioPercent <= 70 ? "moderado" : "elevado";

  return {
    essentialCents,
    totalCents: denominatorCents,
    ratioPercent,
    status,
    hasCriticalMass: true,
  };
}

export const ESSENTIAL_STATUS_LABELS: Record<"adequado" | "moderado" | "elevado" | "em_formacao", string> = {
  adequado: "Equilibrado",
  moderado: "Atenção",
  elevado: "Elevado",
  em_formacao: "Em formação",
};

/** Tendência vs mês anterior é significativa quando variação > 15%. */
export function isSignificantTrend(currentCents: number, previousCents: number, thresholdPercent = 15): boolean {
  if (previousCents === 0) return false;
  const change = Math.abs((currentCents - previousCents) / previousCents) * 100;
  return change > thresholdPercent;
}

export interface ProRataTrendResult {
  /** Se existe base comparável do mês anterior (> 0). */
  hasPreviousBase: boolean;
  /** Variação percentual pro-rata: ((atual - anteriorProRata) / anteriorProRata) * 100 */
  percentChange: number;
  /** Se a variação é estatisticamente significativa (> thresholdPercent). */
  isSignificant: boolean;
  /** Valor comparativo base do mês anterior pro-rata (centavos). */
  previousComparableCents: number;
}

/**
 * Calcula a tendência de gastos comparando períodos equivalentes (pro-rata).
 * Por exemplo, do dia 1 ao dia D do mês atual vs. do dia 1 ao dia D do mês anterior,
 * evitando falsas anomalias causadas pela diferença de dias decorridos.
 */
export function calculateProRataTrend(
  currentExpensesToDateCents: number,
  previousExpensesToSameDateCents: number,
  thresholdPercent = 15,
): ProRataTrendResult {
  if (previousExpensesToSameDateCents <= 0) {
    return {
      hasPreviousBase: false,
      percentChange: 0,
      isSignificant: false,
      previousComparableCents: 0,
    };
  }

  const percentChange =
    ((currentExpensesToDateCents - previousExpensesToSameDateCents) / previousExpensesToSameDateCents) * 100;
  const isSignificant = Math.abs(percentChange) > thresholdPercent;

  return {
    hasPreviousBase: true,
    percentChange,
    isSignificant,
    previousComparableCents: previousExpensesToSameDateCents,
  };
}

