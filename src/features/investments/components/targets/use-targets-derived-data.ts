import { useMemo } from "react";
import {
  inferSectorFromTicker,
  isCashAssetClass,
  validateClassSectorTargetsSum,
  validateTargetsSum,
} from "@/domain/portfolio";
import {
  buildEffectiveTargetsAndScoreRows,
  buildStoredSectorMaps,
  resolveDraftClassTarget,
  resolveDraftSectorTarget,
} from "@/domain/portfolio/target-draft-math";
import type { TargetDraftPositionRow } from "@/domain/portfolio/target-draft-math";
import type { GroupTarget, PortfolioAsset } from "@/types";
import type { TargetAssetScoreRow } from "./target-assets-card";

export interface UseTargetsDerivedDataParams<TRow extends TargetDraftPositionRow> {
  rows: readonly TRow[];
  assets: readonly PortfolioAsset[] | undefined;
  classTargets: readonly GroupTarget[] | undefined;
  sectorTargets: readonly GroupTarget[] | undefined;
  classDraft: Readonly<Record<string, number>>;
  sectorDraft: Readonly<Record<string, number>>;
  selectedSectorClass: string | null;
  onEvaluateAsset: (asset: PortfolioAsset) => void;
}

export function useTargetsDerivedData<TRow extends TargetDraftPositionRow>({
  rows,
  assets,
  classTargets,
  sectorTargets,
  classDraft,
  sectorDraft,
  selectedSectorClass,
  onEvaluateAsset,
}: UseTargetsDerivedDataParams<TRow>) {
  const investableRows = useMemo(
    () =>
      rows.filter(
        (r) => !isCashAssetClass(r.assetClass) && r.ticker.trim().toUpperCase() !== "CAIXA",
      ),
    [rows],
  );
  const investableTotalBRL = useMemo(
    () => investableRows.reduce((acc, r) => acc + r.valueBRL, 0),
    [investableRows],
  );
  const classes = useMemo(
    () => [
      ...new Set(
        investableRows
          .map((r) => r.assetClass)
          .filter((c): c is string => Boolean(c && !isCashAssetClass(c))),
      ),
    ],
    [investableRows],
  );

  const storedClassTargets = useMemo(
    () => new Map((classTargets ?? []).map((t) => [t.name, t.target_percentage])),
    [classTargets],
  );
  const storedSectorMaps = useMemo(
    () => buildStoredSectorMaps(sectorTargets ?? []),
    [sectorTargets],
  );
  const assetMap = useMemo(
    () => new Map((assets ?? []).map((a) => [a.id, a])),
    [assets],
  );

  const classTargetOf = (className: string) =>
    resolveDraftClassTarget(className, classDraft, storedClassTargets);

  const activeSectorClass =
    selectedSectorClass && classes.includes(selectedSectorClass)
      ? selectedSectorClass
      : (classes[0] ?? "Ações");

  const availableSectors = useMemo(
    () => [
      ...new Set(
        investableRows
          .filter((r) => r.assetClass === activeSectorClass)
          .map((r) => r.sector?.trim() || inferSectorFromTicker(r.ticker, activeSectorClass))
          .filter(Boolean),
      ),
    ],
    [investableRows, activeSectorClass],
  );

  const activeClassStoredSectors = useMemo(() => {
    const scoped = new Map(storedSectorMaps.byClass.get(activeSectorClass) ?? []);
    for (const sec of availableSectors) {
      if (!scoped.has(sec) && storedSectorMaps.legacyFallback.has(sec)) {
        scoped.set(sec, storedSectorMaps.legacyFallback.get(sec)!);
      }
    }
    return scoped;
  }, [storedSectorMaps, activeSectorClass, availableSectors]);

  const sectorTargetOf = (sectorName: string, className = activeSectorClass) =>
    resolveDraftSectorTarget(sectorName, className, sectorDraft, storedSectorMaps);

  const classSum = validateTargetsSum(classes.map((c) => ({ target: classTargetOf(c) })));
  const sectorSum = validateClassSectorTargetsSum(
    availableSectors.map((s) => ({ target: sectorTargetOf(s, activeSectorClass) })),
    activeSectorClass,
  );

  const assetScoreRows: TargetAssetScoreRow[] = useMemo(() => {
    const { assetScoreRows: computed } = buildEffectiveTargetsAndScoreRows({
      classes,
      investableRows,
      investableTotalBRL,
      assetMap,
      classDraft,
      sectorDraft,
      storedClassTargets,
      storedSectorMaps,
    });
    return computed.map((item) => {
      const asset = assetMap.get(item.assetId);
      return {
        ...item,
        onEvaluate: asset ? () => onEvaluateAsset(asset) : undefined,
      };
    });
  }, [
    classes,
    investableRows,
    investableTotalBRL,
    assetMap,
    classDraft,
    sectorDraft,
    storedClassTargets,
    storedSectorMaps,
    onEvaluateAsset,
  ]);

  return {
    investableRows,
    investableTotalBRL,
    classes,
    storedClassTargets,
    assetMap,
    classTargetOf,
    activeSectorClass,
    availableSectors,
    activeClassStoredSectors,
    sectorTargetOf,
    classSum,
    sectorSum,
    assetScoreRows,
  };
}
