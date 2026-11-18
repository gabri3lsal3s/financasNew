import { useCallback, useMemo } from "react";
import {
  normalizeGroupTargets,
  validateClassSectorTargetsSum,
  validateTargetsSum,
} from "@/domain/portfolio/allocation";
import { inferSectorFromTicker } from "@/domain/portfolio/tickers-catalog";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
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

  const classTargetOf = useCallback(
    (className: string) => resolveDraftClassTarget(className, classDraft, storedClassTargets),
    [classDraft, storedClassTargets],
  );

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

  const sectorTargetOf = useCallback(
    (sectorName: string, className = activeSectorClass) =>
      resolveDraftSectorTarget(sectorName, className, sectorDraft, storedSectorMaps),
    [activeSectorClass, sectorDraft, storedSectorMaps],
  );

  // Metas de classes normalizadas automaticamente para somar rigorosamente 100%
  const normalizedClassTargets = useMemo(() => {
    const rawList: Array<{ name: string; target: number }> = classes.map((c) => ({
      name: c,
      target: classTargetOf(c),
    }));
    return new Map(normalizeGroupTargets(rawList).map((item) => [item.name, item.normalizedTarget]));
  }, [classes, classTargetOf]);

  const effectiveClassTargetOf = (className: string) =>
    normalizedClassTargets.get(className) ?? classTargetOf(className);

  // Metas de setores normalizadas automaticamente dentro da classe ativa para somar 100%
  const normalizedSectorTargets = useMemo(() => {
    const rawList: Array<{ name: string; target: number }> = availableSectors.map((s) => ({
      name: s,
      target: sectorTargetOf(s, activeSectorClass),
    }));
    return new Map(normalizeGroupTargets(rawList).map((item) => [item.name, item.normalizedTarget]));
  }, [availableSectors, activeSectorClass, sectorTargetOf]);

  const effectiveSectorTargetOf = (sectorName: string, className = activeSectorClass) => {
    if (className === activeSectorClass) {
      return normalizedSectorTargets.get(sectorName) ?? sectorTargetOf(sectorName, className);
    }
    return sectorTargetOf(sectorName, className);
  };

  const rawClassSum = validateTargetsSum(classes.map((c) => ({ target: classTargetOf(c) })));
  const classSum = { sum: rawClassSum.sum, error: null };

  const rawSectorSum = validateClassSectorTargetsSum(
    availableSectors.map((s) => ({ target: sectorTargetOf(s, activeSectorClass) })),
    activeSectorClass,
  );
  const sectorSum = { sum: rawSectorSum.sum, error: null };

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
    effectiveClassTargetOf,
    activeSectorClass,
    availableSectors,
    activeClassStoredSectors,
    sectorTargetOf,
    effectiveSectorTargetOf,
    classSum,
    sectorSum,
    assetScoreRows,
  };
}
