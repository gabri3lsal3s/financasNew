import { useMemo, useState } from "react";
import { parseDecimalNumber } from "@/domain/money";
import type { ClassAporteSummary, SectorAporteSummary } from "@/domain/portfolio";
import { triggerSensory } from "@/services/sensory";
import type {
  AporteRouteRow,
  AporteTreeClassGroup,
  CustomAporteExecutionItem,
  EffectiveAporteRouteState,
} from "./aporte-result-types";

export interface UseAporteSimulationOverridesParams {
  aporte: number;
  initialTotalAllocated: number;
  initialLeftover: number;
  routes: AporteRouteRow[];
  classSummaries: ClassAporteSummary[];
  sectorSummaries: SectorAporteSummary[];
}

/**
 * Gerencia estado interativo de seleção de ativos, ajuste manual de cotas,
 * marcação de execução e árvore hierárquica sincronizada com os overrides.
 */
export function useAporteSimulationOverrides({
  aporte,
  initialTotalAllocated,
  initialLeftover,
  routes,
  classSummaries,
  sectorSummaries,
}: UseAporteSimulationOverridesParams) {
  const [completedTickers, setCompletedTickers] = useState<Set<string>>(() => new Set());
  const [excludedAssetIds, setExcludedAssetIds] = useState<Set<string>>(() => new Set());
  const [quantityOverrides, setQuantityOverrides] = useState<Map<string, number>>(() => new Map());
  const [quantityDrafts, setQuantityDrafts] = useState<Map<string, string>>(() => new Map());

  const toggleAssetSelection = (assetId: string, isChecked: boolean) => {
    setExcludedAssetIds((prev) => {
      const next = new Set(prev);
      if (isChecked) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const handleQuantityChange = (assetId: string, rawStr: string) => {
    setQuantityDrafts((prev) => {
      const next = new Map(prev);
      next.set(assetId, rawStr);
      return next;
    });
    const parsed = parseDecimalNumber(rawStr);
    const quantity = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setQuantityOverrides((prev) => {
      const next = new Map(prev);
      next.set(assetId, quantity);
      return next;
    });
    if (quantity > 0) {
      setExcludedAssetIds((prev) => {
        if (!prev.has(assetId)) return prev;
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const toggleTicker = (ticker: string) => {
    setCompletedTickers((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
        triggerSensory("selection");
      } else {
        next.add(ticker);
        triggerSensory("success");
      }
      return next;
    });
  };

  const hasCustomizations = excludedAssetIds.size > 0 || quantityOverrides.size > 0;

  const effectiveRouteMap = useMemo(() => {
    const map = new Map<string, EffectiveAporteRouteState>();
    for (const r of routes) {
      const isExcluded = excludedAssetIds.has(r.assetId);
      const customQty = quantityOverrides.get(r.assetId);
      const isQuantityCustom = customQty !== undefined && customQty !== r.quantity;
      const effectiveQty = customQty !== undefined ? customQty : r.quantity;
      const isSelected = !isExcluded && effectiveQty > 0;
      const quantityToApply = isSelected ? effectiveQty : 0;
      const effectiveAllocatedBRL = Math.round(quantityToApply * r.priceBRL * 100) / 100;

      map.set(r.assetId, {
        isSelected,
        effectiveQuantity: quantityToApply,
        effectiveAllocatedBRL,
        isQuantityCustom,
      });
    }
    return map;
  }, [routes, excludedAssetIds, quantityOverrides]);

  const effectiveTotalAllocated = useMemo(() => {
    if (!hasCustomizations && typeof initialTotalAllocated === "number") {
      return initialTotalAllocated;
    }
    let sum = 0;
    for (const r of routes) {
      const eff = effectiveRouteMap.get(r.assetId);
      if (eff?.isSelected) sum += eff.effectiveAllocatedBRL;
    }
    return Math.round(sum * 100) / 100;
  }, [hasCustomizations, initialTotalAllocated, routes, effectiveRouteMap]);

  const effectiveLeftover = useMemo(() => {
    if (!hasCustomizations && typeof initialLeftover === "number") {
      return initialLeftover;
    }
    return Math.max(0, Math.round((aporte - effectiveTotalAllocated) * 100) / 100);
  }, [hasCustomizations, initialLeftover, aporte, effectiveTotalAllocated]);

  const selectedExecutionItems: CustomAporteExecutionItem[] = useMemo(() => {
    const items: CustomAporteExecutionItem[] = [];
    for (const r of routes) {
      const eff = effectiveRouteMap.get(r.assetId);
      if (eff?.isSelected && eff.effectiveQuantity > 0) {
        items.push({
          assetId: r.assetId,
          ticker: r.ticker,
          quantity: eff.effectiveQuantity,
          priceBRL: r.priceBRL,
          allocatedBRL: eff.effectiveAllocatedBRL,
        });
      }
    }
    return items;
  }, [routes, effectiveRouteMap]);

  const sortedRoutes = useMemo(
    () =>
      [...routes].sort((a, b) => {
        if (b.allocatedBRL !== a.allocatedBRL) return b.allocatedBRL - a.allocatedBRL;
        return a.gapBRL - b.gapBRL;
      }),
    [routes],
  );

  // Árvore hierárquica sincronizada com effectiveRouteMap (exclusões e cotas customizadas)
  const treeGroups: AporteTreeClassGroup[] = useMemo(() => {
    const classMap = new Map<string, AporteTreeClassGroup>();
    for (const r of sortedRoutes) {
      const cls = r.assetClass?.trim() || "Outros";
      const sec = r.sector?.trim() || "Geral";
      const eff = effectiveRouteMap.get(r.assetId);
      const effectiveAllocated = eff ? eff.effectiveAllocatedBRL : r.allocatedBRL;

      let cGroup = classMap.get(cls);
      if (!cGroup) {
        cGroup = {
          className: cls,
          classSummary: classSummaries.find((cs) => cs.className === cls),
          totalAllocatedBRL: 0,
          totalGapBRL: 0,
          sectors: new Map(),
        };
        classMap.set(cls, cGroup);
      }

      cGroup.totalAllocatedBRL = Math.round((cGroup.totalAllocatedBRL + effectiveAllocated) * 100) / 100;
      cGroup.totalGapBRL += r.gapBRL;

      let sGroup = cGroup.sectors.get(sec);
      if (!sGroup) {
        sGroup = {
          sectorName: sec,
          sectorSummary: sectorSummaries.find((ss) => ss.className === cls && ss.sectorName === sec),
          totalAllocatedBRL: 0,
          totalGapBRL: 0,
          routes: [],
        };
        cGroup.sectors.set(sec, sGroup);
      }

      sGroup.totalAllocatedBRL = Math.round((sGroup.totalAllocatedBRL + effectiveAllocated) * 100) / 100;
      sGroup.totalGapBRL += r.gapBRL;
      sGroup.routes.push(r);
    }

    return Array.from(classMap.values());
  }, [sortedRoutes, classSummaries, sectorSummaries, effectiveRouteMap]);

  return {
    completedTickers,
    completedCount: completedTickers.size,
    quantityOverrides,
    quantityDrafts,
    effectiveRouteMap,
    effectiveTotalAllocated,
    effectiveLeftover,
    selectedExecutionItems,
    sortedRoutes,
    treeGroups,
    toggleAssetSelection,
    handleQuantityChange,
    toggleTicker,
  };
}
