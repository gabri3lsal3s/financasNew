/**
 * Motor de Análise de Defasagem de Alocação (Target vs. Actual) — Consultoria de Carteira (§F42).
 *
 * Função pura e determinística que compara a alocação atual da carteira com as metas
 * definidas pelo investidor (por Macroclasse e por Ativo individual), calculando os
 * gaps financeiros em BRL e o score de aderência patrimonial (0–100%).
 */

export interface AllocationPositionInput {
  id: string;
  ticker: string;
  name?: string | null;
  assetClass: string;
  valueBRL: number;
  isCash?: boolean;
}

export interface ClassTargetInput {
  assetClass: string;
  targetPercentage: number;
}

export interface AssetTargetInput {
  assetId: string;
  targetPercentage: number;
}

export type GapStatus = "deficit" | "balanced" | "surplus";

export interface ClassAllocationGap {
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  recommendedOrder: number;
}

export interface AssetAllocationGap {
  assetId: string;
  ticker: string;
  assetClass: string;
  currentBRL: number;
  currentPct: number;
  targetPct: number;
  gapBRL: number;
  gapPct: number;
  status: GapStatus;
  recommendedOrder: number;
}

export interface AllocationAnalysisResult {
  totalBRL: number;
  alignmentScore: number;
  classGaps: ClassAllocationGap[];
  assetGaps: AssetAllocationGap[];
  topDeficitClass: ClassAllocationGap | null;
  topDeficitAsset: AssetAllocationGap | null;
}

function divideSafe(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

/** Tolerância percentual para considerar uma alocação equilibrada (ex.: ±0.5%). */
const BALANCE_TOLERANCE_PCT = 0.5;

export function calculateAllocationGaps(
  positions: readonly AllocationPositionInput[],
  classTargets: readonly ClassTargetInput[] = [],
  assetTargets: readonly AssetTargetInput[] = [],
): AllocationAnalysisResult {
  const totalBRL = positions.reduce((acc, pos) => acc + Math.max(0, pos.valueBRL), 0);

  // 1. Agrupar posições por classe
  const classValueMap = new Map<string, number>();
  for (const pos of positions) {
    const cls = pos.assetClass || (pos.isCash ? "Caixa" : "Outros");
    classValueMap.set(cls, (classValueMap.get(cls) ?? 0) + Math.max(0, pos.valueBRL));
  }

  // Coletar todas as classes únicas (das posições e das metas)
  const allClasses = new Set<string>([...classValueMap.keys(), ...classTargets.map((ct) => ct.assetClass)]);
  const classTargetMap = new Map<string, number>(classTargets.map((ct) => [ct.assetClass, ct.targetPercentage]));

  const classGaps: ClassAllocationGap[] = [];
  let totalAbsoluteClassDeviations = 0;

  for (const cls of allClasses) {
    const currentBRL = classValueMap.get(cls) ?? 0;
    const currentPct = divideSafe(currentBRL, totalBRL) * 100;
    const targetPct = classTargetMap.get(cls) ?? 0;
    const targetIdealBRL = totalBRL * (targetPct / 100);
    const gapBRL = targetIdealBRL - currentBRL;
    const gapPct = targetPct - currentPct;

    let status: GapStatus = "balanced";
    if (gapPct > BALANCE_TOLERANCE_PCT) {
      status = "deficit";
    } else if (gapPct < -BALANCE_TOLERANCE_PCT) {
      status = "surplus";
    }

    totalAbsoluteClassDeviations += Math.abs(gapPct);

    classGaps.push({
      assetClass: cls,
      currentBRL,
      currentPct,
      targetPct,
      gapBRL,
      gapPct,
      status,
      recommendedOrder: 0,
    });
  }

  // Ordenar classes: maiores déficits primeiro (gapBRL decrescente)
  classGaps.sort((a, b) => b.gapBRL - a.gapBRL);
  classGaps.forEach((cg, idx) => {
    cg.recommendedOrder = idx + 1;
  });

  // 2. Análise por Ativo Individual
  const assetTargetMap = new Map<string, number>(assetTargets.map((at) => [at.assetId, at.targetPercentage]));
  const assetGaps: AssetAllocationGap[] = [];

  const nonCashPositions = positions.filter((p) => !p.isCash);
  for (const pos of nonCashPositions) {
    const currentBRL = Math.max(0, pos.valueBRL);
    const currentPct = divideSafe(currentBRL, totalBRL) * 100;
    const targetPct = assetTargetMap.get(pos.id) ?? 0;
    const targetIdealBRL = totalBRL * (targetPct / 100);
    const gapBRL = targetIdealBRL - currentBRL;
    const gapPct = targetPct - currentPct;

    let status: GapStatus = "balanced";
    if (targetPct > 0) {
      if (gapPct > BALANCE_TOLERANCE_PCT) {
        status = "deficit";
      } else if (gapPct < -BALANCE_TOLERANCE_PCT) {
        status = "surplus";
      }
    }

    assetGaps.push({
      assetId: pos.id,
      ticker: pos.ticker,
      assetClass: pos.assetClass,
      currentBRL,
      currentPct,
      targetPct,
      gapBRL,
      gapPct,
      status,
      recommendedOrder: 0,
    });
  }

  // Ordenar ativos: maiores déficits primeiro
  assetGaps.sort((a, b) => b.gapBRL - a.gapBRL);
  assetGaps.forEach((ag, idx) => {
    ag.recommendedOrder = idx + 1;
  });

  // 3. Score de aderência patrimonial (100% - desvios médios absolutos, limitado entre 0 e 100)
  const hasTargets = classTargets.length > 0;
  const alignmentScore = hasTargets && totalBRL > 0
    ? Math.max(0, Math.min(100, Math.round(100 - totalAbsoluteClassDeviations / 2)))
    : 100;

  const topDeficitClass = classGaps.find((c) => c.status === "deficit" && c.gapBRL > 0) ?? null;
  const topDeficitAsset = assetGaps.find((a) => a.status === "deficit" && a.gapBRL > 0) ?? null;

  return {
    totalBRL,
    alignmentScore,
    classGaps,
    assetGaps,
    topDeficitClass,
    topDeficitAsset,
  };
}
