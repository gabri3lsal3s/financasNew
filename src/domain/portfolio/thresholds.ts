/**
 * Motor de Monitoramento de Desvios de Alocação (Threshold Δ) — FASE 52.
 *
 * Analisa as metas de alocação por classe e por ativo contra a posição atual
 * em custódia, identificando desvios além do limiar de tolerância configurado.
 *
 * 100% puro — sem dependências de UI ou Supabase.
 */

export interface AllocationItem {
  id: string;
  name: string;
  currentValueCents: number;
  targetPercent: number; // 0..100
}

export interface AllocationDriftItem {
  id: string;
  name: string;
  currentValueCents: number;
  currentPercent: number; // 0..100
  targetPercent: number; // 0..100
  diffPercent: number; // currentPercent - targetPercent
  diffCents: number; // currentValueCents - targetValueCents
  status: "underweight" | "aligned" | "overweight";
  recommendedAporteCents: number;
}

export interface AllocationDriftAnalysis {
  hasTargets: boolean;
  totalPortfolioCents: number;
  tolerancePercent: number; // Ex: 5 (para ±5%)
  isBalanced: boolean;
  maxDriftPercent: number;
  underweightItems: AllocationDriftItem[];
  overweightItems: AllocationDriftItem[];
  items: AllocationDriftItem[];
}

export interface CalculateAllocationDriftParams {
  totalPortfolioCents: number;
  items: readonly AllocationItem[];
  /** Limiar de tolerância percentual absoluto (padrão: 5%). */
  tolerancePercent?: number;
}

/**
 * Calcula o desvio de alocação (drift) de cada ativo/classe em relação à meta.
 */
export function calculateAllocationDrift(params: CalculateAllocationDriftParams): AllocationDriftAnalysis {
  const { totalPortfolioCents, items, tolerancePercent = 5 } = params;

  if (!items || items.length === 0 || items.every((i) => i.targetPercent <= 0)) {
    return {
      hasTargets: false,
      totalPortfolioCents,
      tolerancePercent,
      isBalanced: true,
      maxDriftPercent: 0,
      underweightItems: [],
      overweightItems: [],
      items: [],
    };
  }

  const normalizedItems: AllocationDriftItem[] = items.map((item) => {
    const currentPercent = totalPortfolioCents > 0
      ? (item.currentValueCents / totalPortfolioCents) * 100
      : 0;

    const diffPercent = currentPercent - item.targetPercent;
    const targetValueCents = Math.round((item.targetPercent / 100) * totalPortfolioCents);
    const diffCents = item.currentValueCents - targetValueCents;

    let status: "underweight" | "aligned" | "overweight" = "aligned";
    if (diffPercent < -tolerancePercent) {
      status = "underweight";
    } else if (diffPercent > tolerancePercent) {
      status = "overweight";
    }

    const recommendedAporteCents = diffCents < 0 ? Math.abs(diffCents) : 0;

    return {
      id: item.id,
      name: item.name,
      currentValueCents: item.currentValueCents,
      currentPercent: Number(currentPercent.toFixed(2)),
      targetPercent: item.targetPercent,
      diffPercent: Number(diffPercent.toFixed(2)),
      diffCents,
      status,
      recommendedAporteCents,
    };
  });

  const underweightItems = normalizedItems.filter((i) => i.status === "underweight");
  const overweightItems = normalizedItems.filter((i) => i.status === "overweight");
  const maxDriftPercent = normalizedItems.reduce((max, i) => Math.max(max, Math.abs(i.diffPercent)), 0);
  const isBalanced = underweightItems.length === 0 && overweightItems.length === 0;

  return {
    hasTargets: true,
    totalPortfolioCents,
    tolerancePercent,
    isBalanced,
    maxDriftPercent: Number(maxDriftPercent.toFixed(2)),
    underweightItems,
    overweightItems,
    items: normalizedItems,
  };
}
