/**
 * Motor puro de cálculo de desvio de alocação e sumário textual para o
 * carrossel de insights da carteira. Sem dependências de UI ou Supabase.
 */

import type { GroupTarget } from "@/types";
import {
  calculateAllocationDrift,
  normalizeAllocationClassName,
  type AllocationDriftAnalysis,
} from "./thresholds";
import { isCashAssetClass } from "./valuation";

export interface CarouselPositionRowInput {
  assetClass: string | null;
  valueBRL: number;
  isCash: boolean;
}

export interface CarouselAllocationDriftModel {
  allocationDrift: AllocationDriftAnalysis;
  targetsSumPct: number;
  hasInvalidTargetsSum: boolean;
  driftSummaryText: string;
  driftFingerprint: string;
  targetsSumFingerprint: string;
}

export function computePortfolioCarouselDrift({
  classTargets,
  rows,
  totalBRL,
  cashBRL,
}: {
  classTargets: readonly GroupTarget[];
  rows: readonly CarouselPositionRowInput[];
  totalBRL: number;
  cashBRL: number;
}): CarouselAllocationDriftModel {
  const validClassTargets = classTargets.filter(
    (ct) => !isCashAssetClass(ct.name) && ct.name.trim().toLowerCase() !== "caixa",
  );

  if (validClassTargets.length === 0) {
    return {
      allocationDrift: calculateAllocationDrift({ totalPortfolioCents: 0, items: [] }),
      targetsSumPct: 0,
      hasInvalidTargetsSum: false,
      driftSummaryText: "Alguns ativos ou classes estão fora da tolerância estipulada.",
      driftFingerprint: "",
      targetsSumFingerprint: "0",
    };
  }

  const driftItems = validClassTargets.map((ct) => {
    const classRows = rows.filter((r) => {
      if (r.isCash) return false;
      const cls = r.assetClass?.trim() || "Sem classe";
      return cls.toLowerCase() === ct.name.trim().toLowerCase();
    });
    const totalClassValBRL = classRows.reduce((acc, r) => acc + (r.valueBRL ?? 0), 0);
    return {
      id: ct.id,
      name: normalizeAllocationClassName(ct.name),
      currentValueCents: Math.round(totalClassValBRL * 100),
      targetPercent: Number(ct.target_percentage),
    };
  });

  const investableRowsSumBRL = rows
    .filter((r) => !r.isCash)
    .reduce((acc, r) => acc + (r.valueBRL ?? 0), 0);
  const investablePortfolioBRL =
    investableRowsSumBRL > 0 ? investableRowsSumBRL : Math.max(0, totalBRL - cashBRL);

  const targetsSum = validClassTargets.reduce(
    (acc, ct) => acc + Number(ct.target_percentage || 0),
    0,
  );
  const targetsSumPct = Math.round(targetsSum * 10) / 10;

  const allocationDrift = calculateAllocationDrift({
    totalPortfolioCents: Math.round(investablePortfolioBRL * 100),
    items: driftItems,
  });

  const driftSummaryText = buildDriftSummaryText(allocationDrift);
  const driftFingerprint = allocationDrift.underweightItems
    .map((i) => `${i.id}:${Math.round(i.diffPercent)}`)
    .concat(allocationDrift.overweightItems.map((i) => `${i.id}:+${Math.round(i.diffPercent)}`))
    .join("|");

  return {
    allocationDrift,
    targetsSumPct,
    hasInvalidTargetsSum: allocationDrift.hasTargets && Math.abs(targetsSumPct - 100) > 0.1,
    driftSummaryText,
    driftFingerprint,
    targetsSumFingerprint: String(targetsSumPct),
  };
}

function buildDriftSummaryText(allocationDrift: AllocationDriftAnalysis): string {
  const deficits = allocationDrift.underweightItems.slice(0, 2);
  if (deficits.length > 0) {
    const labels = deficits.map(
      (item) => `${normalizeAllocationClassName(item.name)} (${item.diffPercent.toFixed(0)} p.p.)`,
    );
    const extra = allocationDrift.underweightItems.length - deficits.length;
    return `Abaixo da meta: ${labels.join(", ")}${extra > 0 ? ` e +${extra}` : ""}. Priorize novos aportes.`;
  }

  const excesses = allocationDrift.overweightItems.slice(0, 2);
  if (excesses.length > 0) {
    const labels = excesses.map(
      (item) => `${normalizeAllocationClassName(item.name)} (+${item.diffPercent.toFixed(0)} p.p.)`,
    );
    return `Acima da meta: ${labels.join(", ")}. Considere pausar novos aportes nessas classes.`;
  }

  return "Alguns ativos ou classes estão fora da tolerância estipulada.";
}
