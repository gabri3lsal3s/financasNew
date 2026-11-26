import { calculateEffectiveAssetTargets } from "@/domain/portfolio/allocation";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import type { PointInTimeResult } from "@/domain/portfolio";
import type { AssetAllocationStatus, GroupTarget, PortfolioAsset, PortfolioSnapshot } from "@/types";
import { buildAllocationDonutSegments } from "./allocation-donuts";
import { calculateAllocationGaps } from "./allocation-gaps";
import { calculateConcentrationRisk } from "./concentration-risk";
import type { ReportPeriodMode } from "./report-mappers";

export interface InvestmentRowInput {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency?: string | null;
  quantity: number;
  valueBRL: number;
  isCash?: boolean;
  score?: number | null;
  allocationStatus?: AssetAllocationStatus | null;
}

export function resolveSelectedPortfolioSnapshot(params: {
  snapshots: readonly PortfolioSnapshot[];
  mode: ReportPeriodMode;
  month: string;
  year: number;
  debouncedCustomEnd: string;
}): PortfolioSnapshot | null {
  const { snapshots, mode, month, year, debouncedCustomEnd } = params;
  if (mode === "month") return snapshots.find((s) => s.month === month) ?? null;
  if (mode === "year") {
    return (
      snapshots
        .filter((s) => s.month.startsWith(String(year)))
        .sort((a, b) => b.month.localeCompare(a.month))[0] ?? null
    );
  }
  if (mode === "custom" && debouncedCustomEnd) {
    const customEndMonth = debouncedCustomEnd.slice(0, 7);
    return (
      snapshots
        .filter((s) => s.month <= customEndMonth)
        .sort((a, b) => b.month.localeCompare(a.month))[0] ?? null
    );
  }
  return null;
}

export function resolvePeriodPatrimonyAndCost(params: {
  isCurrentPeriod: boolean;
  currentTotalBRL: number;
  currentCostBRL: number;
  historicalPit: PointInTimeResult | null | undefined;
  selectedSnapshot: PortfolioSnapshot | null;
}): { totalPatrimonyBRL: number; totalInvestedCostBRL: number } {
  const { isCurrentPeriod, currentTotalBRL, currentCostBRL, historicalPit, selectedSnapshot } = params;

  let totalPatrimonyBRL = 0;
  if (isCurrentPeriod) {
    totalPatrimonyBRL = currentTotalBRL;
  } else if (historicalPit) {
    if (historicalPit.monthlyStatement?.endBalanceBRL && historicalPit.fidelity?.snapshotTotalValue) {
      totalPatrimonyBRL = historicalPit.monthlyStatement.endBalanceBRL;
    } else {
      totalPatrimonyBRL = historicalPit.fidelity?.snapshotTotalValue ?? historicalPit.totalValueBRL;
    }
  } else if (selectedSnapshot) {
    totalPatrimonyBRL = Number(selectedSnapshot.total_value);
  }

  let totalInvestedCostBRL = 0;
  if (isCurrentPeriod) {
    totalInvestedCostBRL = currentCostBRL;
  } else if (historicalPit) {
    totalInvestedCostBRL = historicalPit.totalCostBRL;
  } else if (selectedSnapshot) {
    totalInvestedCostBRL = Number(selectedSnapshot.total_cost);
  }

  return { totalPatrimonyBRL, totalInvestedCostBRL };
}

export function buildReportAllocationAnalysis(params: {
  positionRows: readonly InvestmentRowInput[];
  assets: readonly PortfolioAsset[];
  classTargets: readonly GroupTarget[];
  sectorTargets: readonly { className?: string; sectorName: string; targetPercentage: number }[];
}) {
  const { positionRows, assets, classTargets, sectorTargets } = params;
  const classTargetMap = Object.fromEntries(classTargets.map((ct) => [ct.name, ct.target_percentage]));
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const derivedTargets = calculateEffectiveAssetTargets({
    assets: positionRows
      .filter((r) => !r.isCash && r.quantity > 0)
      .map((r) => {
        const matched =
          assetById.get(r.assetId) ??
          assets.find((a) => a.ticker.toUpperCase() === r.ticker.toUpperCase());
        return {
          id: r.assetId ?? r.ticker,
          assetClass: r.assetClass ?? "Outros",
          sector: r.sector ?? null,
          score: matched?.score ?? r.score ?? null,
          allocation_status: matched?.allocation_status ?? r.allocationStatus ?? "active",
        };
      }),
    classTargets: classTargetMap,
    sectorTargets,
  }).map((t) => ({ assetId: t.assetId, targetPercentage: t.effectiveTargetPct }));

  return calculateAllocationGaps(
    positionRows.map((r) => ({
      id: r.assetId ?? r.ticker,
      ticker: r.ticker,
      assetClass: r.assetClass ?? "outros",
      sector: r.sector,
      valueBRL: r.valueBRL,
      isCash: isCashAssetClass(r.assetClass),
    })),
    classTargets.map((ct) => ({ assetClass: ct.name, targetPercentage: ct.target_percentage })),
    derivedTargets,
    sectorTargets,
  );
}

export function buildReportConcentrationAndDonuts(params: {
  positionRows: readonly InvestmentRowInput[];
  cashBalanceBRL: number;
}) {
  const { positionRows, cashBalanceBRL } = params;
  const concentrationRisk = calculateConcentrationRisk(
    positionRows.map((r) => ({
      id: r.assetId ?? r.ticker,
      ticker: r.ticker,
      assetClass: r.assetClass ?? "outros",
      sector: r.sector,
      currency: (r.currency as "BRL" | "USD") ?? "BRL",
      valueBRL: r.valueBRL,
      isCash: isCashAssetClass(r.assetClass),
    })),
  );
  const investmentDonutData = buildAllocationDonutSegments({
    positions: positionRows
      .filter((r) => !r.isCash && r.quantity > 0)
      .map((r) => ({ assetClass: r.assetClass, sector: r.sector, valueBRL: r.valueBRL })),
    cashBalanceBRL,
    includeCash: cashBalanceBRL > 0,
  });

  return { concentrationRisk, investmentDonutData };
}
