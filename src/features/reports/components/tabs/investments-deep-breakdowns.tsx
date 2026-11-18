import { useState } from "react";
import {
  ReportAllocationDonuts,
  ReportFiiBreakdownCard,
  ReportFixedIncomeBreakdownCard,
  ReportInternationalBreakdownCard,
  ReportStocksBreakdownCard,
} from "@/components/modules/reports";
import { AllocationBreakdownDialog, AssetDetailSheet } from "@/features/investments/components";
import type { AllocationDonutSegment } from "@/domain/reports";
import type { PortfolioPositionRow } from "@/state";
import type { GroupTarget, PortfolioAsset } from "@/types";

export interface InvestmentsDeepBreakdownsProps {
  classSegments?: readonly AllocationDonutSegment[];
  sectorSegments?: readonly AllocationDonutSegment[];
  totalPatrimonyBRL: number;
  fallbackTotalBRL: number;
  totalUniqueSectors?: number;
  breakdownRows: PortfolioPositionRow[];
  assetsMetadata: readonly PortfolioAsset[];
  classTargets: readonly GroupTarget[];
  sectorTargets: readonly GroupTarget[];
}

/**
 * Gráficos de alocação por classe/setor, 4 Raios-X de subalocação profunda e diálogos drilldown.
 */
export function InvestmentsDeepBreakdowns({
  classSegments,
  sectorSegments,
  totalPatrimonyBRL,
  fallbackTotalBRL,
  totalUniqueSectors,
  breakdownRows,
  assetsMetadata,
  classTargets,
  sectorTargets,
}: InvestmentsDeepBreakdownsProps) {
  const [breakdownGroup, setBreakdownGroup] = useState<{
    type: "class" | "sector";
    name: string;
  } | null>(null);
  const [assetDetailId, setAssetDetailId] = useState<string | null>(null);

  const detailAsset = assetDetailId
    ? assetsMetadata.find((a) => a.id === assetDetailId) ?? null
    : null;

  return (
    <>
      {classSegments && classSegments.length > 0 ? (
        <ReportAllocationDonuts
          classSegments={classSegments}
          sectorSegments={sectorSegments ?? []}
          totalBRL={totalPatrimonyBRL}
          totalUniqueSectors={totalUniqueSectors}
          variant="screen"
          onClassClick={(className) => setBreakdownGroup({ type: "class", name: className })}
          onSectorClick={(sectorName) => setBreakdownGroup({ type: "sector", name: sectorName })}
        />
      ) : null}

      <div className="flex flex-col gap-4 w-full">
        <ReportStocksBreakdownCard positions={breakdownRows} />
        <ReportFiiBreakdownCard positions={breakdownRows} />
        <ReportFixedIncomeBreakdownCard
          positions={breakdownRows}
          assetsMetadata={assetsMetadata}
        />
        <ReportInternationalBreakdownCard positions={breakdownRows} />
      </div>

      <AllocationBreakdownDialog
        open={breakdownGroup !== null}
        onOpenChange={(open) => {
          if (!open) setBreakdownGroup(null);
        }}
        type={breakdownGroup?.type ?? "class"}
        groupName={breakdownGroup?.name ?? null}
        rows={breakdownRows}
        totalPortfolioBRL={totalPatrimonyBRL > 0 ? totalPatrimonyBRL : fallbackTotalBRL}
        targetPercent={
          breakdownGroup?.type === "class"
            ? classTargets.find((t) => t.name === breakdownGroup.name)?.target_percentage ?? null
            : breakdownGroup?.name
              ? sectorTargets.find((t) => t.name === breakdownGroup.name)?.target_percentage ?? null
              : null
        }
        onSelectAsset={(assetId) => setAssetDetailId(assetId)}
      />

      {detailAsset ? (
        <AssetDetailSheet
          open={assetDetailId !== null}
          onOpenChange={(open) => {
            if (!open) setAssetDetailId(null);
          }}
          asset={detailAsset}
        />
      ) : null}
    </>
  );
}
