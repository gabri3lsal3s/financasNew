/**
 * Motor Puro de Divisão de Despesa Mista (Split PF / PJ — Fase 1 / v2.1).
 *
 * Responsável por:
 *   • Dividir uma despesa compartilhada (ex.: internet de casa de R$ 200, usada 50% para a empresa e 50% para a casa);
 *   • Gerar duas linhas contábeis legítimas (uma com scope = 'personal' e outra com scope = 'business');
 *   • Fixar report_weight = 1.0 em ambas as pernas para não fraudar faturamento fiscal nem DRE;
 *   • Garantir a conservação exata de centavos (personalCents + businessCents === totalCents).
 *
 * 100% puro — sem dependências de React ou Supabase.
 */

export interface SplitMixedExpenseByPercentParams {
  totalCents: number;
  /** Percentual atribuído ao negócio (0 a 100). */
  businessPercent: number;
}

export interface SplitMixedExpenseByAmountParams {
  totalCents: number;
  businessCents: number;
}

export interface SplitMixedExpenseResult {
  totalCents: number;
  personalCents: number;
  businessCents: number;
  personalRatio: number;
  businessRatio: number;
  personalReportWeight: number; // sempre 1.0
  businessReportWeight: number; // sempre 1.0
}

/**
 * Divide uma despesa mista com base em percentuais inteiros ou decimais (ex.: 50% / 50%).
 */
export function splitMixedExpenseByPercent(
  params: SplitMixedExpenseByPercentParams,
): SplitMixedExpenseResult {
  const total = Math.max(0, Math.round(params.totalCents));
  const rawPct = Math.max(0, Math.min(100, params.businessPercent));

  // Calcula businessCents com arredondamento e deriva personal por diferença exata
  const businessCents = Math.round((total * rawPct) / 100);
  const personalCents = total - businessCents;

  const businessRatio = total > 0 ? Number((businessCents / total).toFixed(4)) : 0;
  const personalRatio = total > 0 ? Number((personalCents / total).toFixed(4)) : 0;

  return {
    totalCents: total,
    personalCents,
    businessCents,
    personalRatio,
    businessRatio,
    personalReportWeight: 1.0,
    businessReportWeight: 1.0,
  };
}

/**
 * Divide uma despesa mista com base em valores nominais em centavos.
 */
export function splitMixedExpenseByAmount(
  params: SplitMixedExpenseByAmountParams,
): SplitMixedExpenseResult {
  const total = Math.max(0, Math.round(params.totalCents));
  const businessCents = Math.max(0, Math.min(total, Math.round(params.businessCents)));
  const personalCents = total - businessCents;

  const businessRatio = total > 0 ? Number((businessCents / total).toFixed(4)) : 0;
  const personalRatio = total > 0 ? Number((personalCents / total).toFixed(4)) : 0;

  return {
    totalCents: total,
    personalCents,
    businessCents,
    personalRatio,
    businessRatio,
    personalReportWeight: 1.0,
    businessReportWeight: 1.0,
  };
}
