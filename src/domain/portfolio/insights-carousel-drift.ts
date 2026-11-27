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
  unallocatedClassesBRL: number;
  unallocatedClassNames: string[];
  driftSummaryText: string;
  driftFingerprint: string;
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
      unallocatedClassesBRL: 0,
      unallocatedClassNames: [],
      driftSummaryText: "Alguns ativos ou classes estão fora da tolerância estipulada.",
      driftFingerprint: "",
    };
  }

  const targetClassNamesLower = new Set(
    validClassTargets.map((ct) => normalizeAllocationClassName(ct.name).toLowerCase()),
  );

  const driftItems = validClassTargets.map((ct) => {
    const normalizedTargetName = normalizeAllocationClassName(ct.name);
    const classRows = rows.filter((r) => {
      if (r.isCash) return false;
      const cls = normalizeAllocationClassName(r.assetClass?.trim() || "Sem classe");
      return (
        cls.toLowerCase() === normalizedTargetName.toLowerCase() ||
        (r.assetClass?.trim() || "").toLowerCase() === ct.name.trim().toLowerCase()
      );
    });
    const totalClassValBRL = classRows.reduce((acc, r) => acc + (r.valueBRL ?? 0), 0);
    return {
      id: ct.id,
      name: normalizedTargetName,
      currentValueCents: Math.round(totalClassValBRL * 100),
      targetPercent: Number(ct.target_percentage),
    };
  });

  let unallocatedClassesBRL = 0;
  const unallocatedNameSet = new Set<string>();
  for (const r of rows) {
    if (r.isCash) continue;
    const rawCls = r.assetClass?.trim() || "Sem classe";
    const normCls = normalizeAllocationClassName(rawCls);
    const matched =
      targetClassNamesLower.has(normCls.toLowerCase()) ||
      validClassTargets.some((ct) => ct.name.trim().toLowerCase() === rawCls.toLowerCase());
    if (!matched && r.valueBRL > 0) {
      unallocatedClassesBRL += r.valueBRL;
      unallocatedNameSet.add(normCls);
    }
  }

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

  const sortedUnderweight = [...allocationDrift.underweightItems].sort(
    (a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent),
  );
  const sortedOverweight = [...allocationDrift.overweightItems].sort(
    (a, b) => Math.abs(b.diffPercent) - Math.abs(a.diffPercent),
  );
  const orderedDrift: AllocationDriftAnalysis = {
    ...allocationDrift,
    underweightItems: sortedUnderweight,
    overweightItems: sortedOverweight,
  };

  const driftSummaryText = buildDriftSummaryText(orderedDrift);
  const driftFingerprint = orderedDrift.underweightItems
    .map((i) => `${i.id}:${Math.round(i.diffPercent)}`)
    .concat(orderedDrift.overweightItems.map((i) => `${i.id}:+${Math.round(i.diffPercent)}`))
    .join("|");

  return {
    allocationDrift: orderedDrift,
    targetsSumPct,
    unallocatedClassesBRL,
    unallocatedClassNames: Array.from(unallocatedNameSet),
    driftSummaryText,
    driftFingerprint,
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
