/**
 * Confiança — ESPECIFICAÇÃO §3.7.4.
 *
 * confiança = base + bônus não-linear por meses de histórico − penalidade
 * de variância (0.3× para subscription, 0.8× para recurring/similar).
 * Motor puro — os pontos extremos da curva (2m:+0.05, 5m:+0.28) são
 * definidos pela especificação; os intermediários são interpolados.
 */

export type RecurrenceKind = "subscription" | "recurring" | "similar";

/** Bônus por meses de histórico (curva não-linear, pontos 2m e 5m do spec). */
const MONTH_BONUS: Record<number, number> = {
  1: 0,
  2: 0.05,
  3: 0.12,
  4: 0.2,
  5: 0.28,
};

/** Penalidade de variância por nível (spec: 0.3× subscription, 0.8× recurring). */
const VARIANCE_PENALTY: Record<RecurrenceKind, number> = {
  subscription: 0.3,
  recurring: 0.8,
  similar: 0.8,
};

export interface ConfidenceParams {
  /** Confiança-base (0–1) do padrão (ex.: sinais da assinatura). */
  base: number;
  /** Quantidade de meses com histórico. */
  monthsHistory: number;
  /** Nível de recorrência (define a penalidade de variância). */
  kind: RecurrenceKind;
  /** Variância observada (0–1); 0 = valores idênticos. */
  variance?: number;
}

/** Bônus não-linear por meses de histórico (estaciona em 5+ meses). */
export function historyBonus(monthsHistory: number): number {
  if (monthsHistory <= 0) return 0;
  const clamped = Math.min(5, Math.floor(monthsHistory));
  return MONTH_BONUS[clamped] ?? 0;
}

/** Confiança final, limitada a [0, 1]. */
export function confidenceScore(params: ConfidenceParams): number {
  const bonus = historyBonus(params.monthsHistory);
  const variance = params.variance ?? 0;
  const score = params.base + bonus - VARIANCE_PENALTY[params.kind] * variance;
  return Math.min(1, Math.max(0, score));
}

/** Coeficiente de variação (variância normalizada 0–1) de valores em centavos. */
export function varianceOf(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  if (mean === 0) return 0;
  const deviations = values.map((v) => Math.abs(v - mean) / mean);
  const cv = deviations.reduce((acc, d) => acc + d, 0) / deviations.length;
  return Math.min(1, cv);
}
