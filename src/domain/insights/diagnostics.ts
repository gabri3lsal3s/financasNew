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

/** Concentração de renda: alerta quando 1 fonte > 60% da renda. */
export function incomeConcentration(incomeBySourceCents: readonly number[]): IncomeConcentration {
  const total = incomeBySourceCents.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return { topSharePercent: 0, alert: false };
  const top = Math.max(...incomeBySourceCents);
  const share = (top / total) * 100;
  return { topSharePercent: share, alert: share > 60 };
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

/** Tendência vs mês anterior é significativa quando variação > 15%. */
export function isSignificantTrend(currentCents: number, previousCents: number, thresholdPercent = 15): boolean {
  if (previousCents === 0) return false;
  const change = Math.abs((currentCents - previousCents) / previousCents) * 100;
  return change > thresholdPercent;
}
