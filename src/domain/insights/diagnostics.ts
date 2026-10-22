/**
 * Diagnósticos adicionais — ESPECIFICAÇÃO §3.7.6.
 * Motores puros: concentração de renda, tendência, gastos de fim de
 * semana e saúde da poupança.
 */

export type SavingsHealth = "critico" | "baixo" | "moderado" | "saudavel" | "forte";

export const SAVINGS_HEALTH_LABELS: Record<SavingsHealth, string> = {
  critico: "Crítico",
  baixo: "Baixo",
  moderado: "Moderado",
  saudavel: "Saudável",
  forte: "Forte",
};

/** Saúde da poupança por faixa de savings rate (%). */
export function savingsHealth(savingsRatePercent: number): SavingsHealth {
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


/**
 * Comprometimento Essencial: calcula a fração de gastos em categorias essenciais vs. total de despesas.
 * Recomendação financeira clássica (Regra 50/30/20): gastos essenciais até 50% da renda/despesas.
 */
export interface EssentialSpendingResult {
  essentialCents: number;
  totalCents: number;
  ratioPercent: number;
  status: "adequado" | "moderado" | "elevado";
}

export function essentialSpendingRatio(
  essentialCents: number,
  totalCents: number,
): EssentialSpendingResult {
  if (totalCents <= 0) {
    return {
      essentialCents: 0,
      totalCents: 0,
      ratioPercent: 0,
      status: "adequado",
    };
  }
  const ratioPercent = Math.min(100, Math.max(0, (essentialCents / totalCents) * 100));
  const status: "adequado" | "moderado" | "elevado" =
    ratioPercent <= 50 ? "adequado" : ratioPercent <= 70 ? "moderado" : "elevado";

  return {
    essentialCents,
    totalCents,
    ratioPercent,
    status,
  };
}

export const ESSENTIAL_STATUS_LABELS: Record<"adequado" | "moderado" | "elevado", string> = {
  adequado: "Equilibrado",
  moderado: "Atenção",
  elevado: "Elevado",
};

/** Tendência vs mês anterior é significativa quando variação > 15%. */
export function isSignificantTrend(currentCents: number, previousCents: number, thresholdPercent = 15): boolean {
  if (previousCents === 0) return false;
  const change = Math.abs((currentCents - previousCents) / previousCents) * 100;
  return change > thresholdPercent;
}
