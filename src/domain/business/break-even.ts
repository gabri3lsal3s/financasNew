/**
 * Motor puro de Ponto de Equilíbrio do Negócio (Break-even — Fase 2B).
 *
 * Meta mínima de faturamento mensal = Custos Operacionais + Provisão Fiscal + Meta de Pró-Labore.
 */

export interface BusinessBreakEvenResult {
  breakEvenTargetCents: number;
  grossRevenueCents: number;
  progressPct: number;
  remainingCents: number;
  surplusAboveBreakEvenCents: number;
  isReached: boolean;
}

export function calculateBusinessBreakEven(params: {
  operationalCostsCents: number;
  estimatedTaxCents: number;
  targetProLaboreCents: number;
  grossRevenueCents: number;
}): BusinessBreakEvenResult {
  const costs = Math.max(0, Math.round(params.operationalCostsCents));
  const taxes = Math.max(0, Math.round(params.estimatedTaxCents));
  const proLabore = Math.max(0, Math.round(params.targetProLaboreCents));
  const gross = Math.max(0, Math.round(params.grossRevenueCents));

  const breakEvenTargetCents = costs + taxes + proLabore;
  const remainingCents = Math.max(0, breakEvenTargetCents - gross);
  const surplusAboveBreakEvenCents = Math.max(0, gross - breakEvenTargetCents);
  const progressPct =
    breakEvenTargetCents > 0
      ? Number(((gross / breakEvenTargetCents) * 100).toFixed(1))
      : gross > 0
        ? 100
        : 0;

  return {
    breakEvenTargetCents,
    grossRevenueCents: gross,
    progressPct,
    remainingCents,
    surplusAboveBreakEvenCents,
    isReached: breakEvenTargetCents > 0 ? gross >= breakEvenTargetCents : gross > 0,
  };
}
