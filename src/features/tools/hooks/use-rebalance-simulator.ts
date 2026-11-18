import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { AllocationSlice } from "@/components/modules/allocation-donut";
import {
  simulateStrategyAporte,
  STRATEGY_PRESETS_LIST,
  type StrategyClassItem,
} from "@/domain/portfolio";
import {
  buildStatefulUrl,
  decodeRebalanceSimulatorState,
  type PendingRebalanceSimulation,
  type RebalanceSimulatorShareState,
} from "@/domain/share";
import { getPublicAppUrl } from "@/services/app-url";
import type { SimClassAsset } from "../components/rebalance/rebalance-asset-row-list";
import type { SimClassItem } from "../components/rebalance/rebalance-class-card";

function getDefaultAssetsForClassKey(key: string): SimClassAsset[] {
  if (key === "fiis") {
    return [
      { id: `${key}_1`, ticker: "HGLG11", score: 9 },
      { id: `${key}_2`, ticker: "MXRF11", score: 7 },
    ];
  }
  if (key === "acoes") {
    return [
      { id: `${key}_1`, ticker: "BBAS3", score: 8 },
      { id: `${key}_2`, ticker: "WEGE3", score: 9 },
    ];
  }
  if (key === "rf") {
    return [{ id: `${key}_1`, ticker: "CDB 110% CDI", score: 9 }];
  }
  if (key === "global") {
    return [{ id: `${key}_1`, ticker: "IVVB11", score: 9 }];
  }
  return [];
}

function hydratePresetClasses(items: readonly StrategyClassItem[]): SimClassItem[] {
  return items.map((c) => ({
    ...c,
    assets: getDefaultAssetsForClassKey(c.key),
  }));
}

export function useRebalanceSimulator() {
  const [searchParams] = useSearchParams();

  const sharedState = useMemo(() => {
    const param = searchParams.get("s");
    return param ? decodeRebalanceSimulatorState(param) : null;
  }, [searchParams]);

  const [patrimonyBaseCents, setPatrimonyBaseCents] = useState<number>(
    () => sharedState?.patrimonyBaseCents ?? 5000000,
  );
  const [aporteAmountCents, setAporteAmountCents] = useState<number>(
    () => sharedState?.aporteAmountCents ?? 300000,
  );
  const [classes, setClasses] = useState<SimClassItem[]>(
    () =>
      sharedState?.classes.map((c) => ({
        key: c.key,
        name: c.name,
        targetPercent: c.targetPercent,
        currentProportion: c.currentProportion,
        yieldRate: c.yieldRate ?? 0.06,
        assets: c.assets ?? getDefaultAssetsForClassKey(c.key),
      })) ?? hydratePresetClasses(STRATEGY_PRESETS_LIST[0]!.classes),
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(
    () => sharedState?.selectedPreset ?? (sharedState ? "custom" : "dividendos"),
  );

  const handleApplyPreset = (presetId: string) => {
    const found = STRATEGY_PRESETS_LIST.find((p) => p.id === presetId);
    if (found) {
      setSelectedPreset(found.id);
      setClasses(hydratePresetClasses(found.classes));
    }
  };

  const handleAddClass = () => {
    setSelectedPreset("custom");
    setClasses((prev) => [
      ...prev,
      {
        key: `cls_${Date.now()}`,
        name: `Classe ${prev.length + 1}`,
        targetPercent: 10,
        currentProportion: 0,
        yieldRate: 0.06,
        assets: [],
      },
    ]);
  };

  const handleRemoveClass = (key: string) => {
    setSelectedPreset("custom");
    setClasses((prev) => prev.filter((c) => c.key !== key));
  };

  const handleUpdateClass = (key: string, updates: Partial<SimClassItem>) => {
    setSelectedPreset("custom");
    setClasses((prev) => prev.map((c) => (c.key === key ? { ...c, ...updates } : c)));
  };

  const handleAddClassAsset = (classKey: string) => {
    setSelectedPreset("custom");
    setClasses((prev) =>
      prev.map((c) =>
        c.key === classKey
          ? {
              ...c,
              assets: [
                ...c.assets,
                { id: `asset_${Date.now()}_${c.assets.length}`, ticker: "", score: null },
              ],
            }
          : c,
      ),
    );
  };

  const handleUpdateClassAsset = (
    classKey: string,
    assetId: string,
    updates: Partial<SimClassAsset>,
  ) => {
    setSelectedPreset("custom");
    setClasses((prev) =>
      prev.map((c) =>
        c.key === classKey
          ? {
              ...c,
              assets: c.assets.map((a) => (a.id === assetId ? { ...a, ...updates } : a)),
            }
          : c,
      ),
    );
  };

  const handleRemoveClassAsset = (classKey: string, assetId: string) => {
    setSelectedPreset("custom");
    setClasses((prev) =>
      prev.map((c) =>
        c.key === classKey ? { ...c, assets: c.assets.filter((a) => a.id !== assetId) } : c,
      ),
    );
  };

  const totalTargetPercent = useMemo(
    () => classes.reduce((sum, c) => sum + c.targetPercent, 0),
    [classes],
  );

  const simulation = useMemo(
    () =>
      simulateStrategyAporte({
        patrimonyBase: patrimonyBaseCents / 100,
        aporteAmount: aporteAmountCents / 100,
        classes,
      }),
    [patrimonyBaseCents, aporteAmountCents, classes],
  );

  const donutSlices: AllocationSlice[] = useMemo(
    () =>
      simulation.allocations.map((cls) => ({
        key: cls.key,
        label: cls.name,
        valueCents: Math.round(cls.finalValue * 100),
        subtitle: `Meta: ${cls.targetPercent}% · Pós-Aporte: ${cls.finalPct}%`,
      })),
    [simulation.allocations],
  );

  const getShareUrl = () => {
    const state: RebalanceSimulatorShareState = {
      patrimonyBaseCents,
      aporteAmountCents,
      classes,
      selectedPreset,
    };
    return buildStatefulUrl(getPublicAppUrl("ferramentas/rebalanceamento"), state);
  };

  const simulationPayload: PendingRebalanceSimulation = useMemo(
    () => ({
      type: "rebalance_simulator",
      classes: classes.map((c) => ({ name: c.name, targetPercent: c.targetPercent })),
      patrimonyBaseCents,
      aporteAmountCents,
      selectedPreset,
    }),
    [classes, patrimonyBaseCents, aporteAmountCents, selectedPreset],
  );

  return {
    sharedState,
    patrimonyBaseCents,
    setPatrimonyBaseCents,
    aporteAmountCents,
    setAporteAmountCents,
    classes,
    selectedPreset,
    totalTargetPercent,
    isTarget100: Math.abs(totalTargetPercent - 100) < 0.1,
    simulation,
    donutSlices,
    getShareUrl,
    simulationPayload,
    handleApplyPreset,
    handleAddClass,
    handleRemoveClass,
    handleUpdateClass,
    handleAddClassAsset,
    handleUpdateClassAsset,
    handleRemoveClassAsset,
  };
}
