import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  buildEqualDraftPatch,
  buildNormalizedDraftPatch,
  buildRemainingDraftPatch,
  buildZeroDraftPatch,
  sectorDraftKey,
} from "@/domain/portfolio/target-draft-math";
import { pushToast } from "@/services/toast";
import { useGroupTargets, usePortfolioAssets, usePortfolioPosition } from "@/state";
import type { PortfolioAsset } from "@/types";
import type { TargetSyncStatus } from "./target-distribution-card";
import { useTargetsDerivedData } from "./use-targets-derived-data";
import { useTargetsMutations } from "./use-targets-mutations";

export function useTargetsDraftState() {
  const position = usePortfolioPosition();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const assetsQuery = usePortfolioAssets();

  const [classDraft, setClassDraft] = useState<Record<string, number>>({});
  const [sectorDraft, setSectorDraft] = useState<Record<string, number>>({});
  const [breakdownGroup, setBreakdownGroup] = useState<{
    type: "class" | "sector";
    name: string;
    parentClass?: string;
  } | null>(null);
  const [assetDetailId, setAssetDetailId] = useState<string | null>(null);
  const [evaluatingAsset, setEvaluatingAsset] = useState<PortfolioAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<TargetSyncStatus>("idle");
  const [assetClassFilter, setAssetClassFilter] = useState<string | null>(null);
  const [selectedSectorClass, setSelectedSectorClass] = useState<string | null>(null);

  const classDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sectorDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const resetSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const classMap = classDebounceRef.current;
    const sectorMap = sectorDebounceRef.current;
    return () => {
      for (const timer of classMap.values()) clearTimeout(timer);
      for (const timer of sectorMap.values()) clearTimeout(timer);
      if (resetSyncTimerRef.current) clearTimeout(resetSyncTimerRef.current);
    };
  }, []);

  const markSavedWithDelay = () => {
    setSyncStatus("saved");
    if (resetSyncTimerRef.current) clearTimeout(resetSyncTimerRef.current);
    resetSyncTimerRef.current = setTimeout(() => {
      setSyncStatus("idle");
    }, 2500);
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const paramSubTab = searchParams.get("subtab");
  const [pickedSubTab, setPickedSubTab] = useState<"classes" | "sectors" | "assets">("classes");

  const subTab: "classes" | "sectors" | "assets" =
    paramSubTab === "assets" || paramSubTab === "ativos"
      ? "assets"
      : paramSubTab === "sectors" || paramSubTab === "setores"
        ? "sectors"
        : paramSubTab === "classes"
          ? "classes"
          : pickedSubTab;

  const handleSubTabChange = (next: "classes" | "sectors" | "assets") => {
    setPickedSubTab(next);
    if (paramSubTab) {
      setSearchParams(
        (prev) => {
          const updated = new URLSearchParams(prev);
          updated.delete("subtab");
          return updated;
        },
        { replace: true },
      );
    }
  };

  const derived = useTargetsDerivedData({
    rows: position.rows,
    assets: assetsQuery.data,
    classTargets: classTargetsQuery.data,
    sectorTargets: sectorTargetsQuery.data,
    classDraft,
    sectorDraft,
    selectedSectorClass,
    onEvaluateAsset: setEvaluatingAsset,
  });

  const mutations = useTargetsMutations({
    classes: derived.classes,
    activeSectorClass: derived.activeSectorClass,
    availableSectors: derived.availableSectors,
    storedClassTargetsData: classTargetsQuery.data,
    storedSectorTargetsData: sectorTargetsQuery.data,
    classTargetOf: derived.classTargetOf,
    sectorTargetOf: derived.sectorTargetOf,
    setClassDraft,
    setSectorDraft,
    setError,
  });

  const setClassTarget = (className: string, value: number) => {
    setClassDraft((prev) => ({ ...prev, [className]: value }));
    setSyncStatus("saving");

    const existing = classDebounceRef.current.get(className);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      try {
        await mutations.saveClassDirect(className, value);
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      } finally {
        classDebounceRef.current.delete(className);
      }
    }, 600);

    classDebounceRef.current.set(className, timer);
  };

  const setSectorTarget = (sectorName: string, value: number) => {
    const key = sectorDraftKey(derived.activeSectorClass, sectorName);
    setSectorDraft((prev) => ({ ...prev, [key]: value }));
    setSyncStatus("saving");

    const existing = sectorDebounceRef.current.get(key);
    if (existing) clearTimeout(existing);

    const currentClass = derived.activeSectorClass;
    const timer = setTimeout(async () => {
      try {
        await mutations.saveSectorDirect(sectorName, value, currentClass);
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      } finally {
        sectorDebounceRef.current.delete(key);
      }
    }, 600);

    sectorDebounceRef.current.set(key, timer);
  };

  return {
    position,
    classTargetsQuery,
    sectorTargetsQuery,
    ...derived,
    ...mutations,
    syncStatus,
    loading: position.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading,
    loadError: position.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error,
    error,
    subTab,
    handleSubTabChange,
    setSelectedSectorClass,
    setClassTarget,
    handleNormalizeClasses: () => {
      setError(null);
      setClassDraft((prev) => ({
        ...prev,
        ...buildNormalizedDraftPatch(derived.classes, derived.classTargetOf),
      }));
    },
    handleDistributeClassesEqually: async () => {
      setError(null);
      setSyncStatus("saving");
      const patch = buildEqualDraftPatch(derived.classes);
      setClassDraft((prev) => ({ ...prev, ...patch }));
      try {
        await mutations.saveAllClasses();
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      }
    },
    handleDistributeRemainingClasses: () => {
      setError(null);
      const patch = buildRemainingDraftPatch(derived.classes, derived.classTargetOf);
      if (Object.keys(patch).length > 0) setClassDraft((prev) => ({ ...prev, ...patch }));
    },
    handleResetClassesZero: async () => {
      setError(null);
      setSyncStatus("saving");
      const patch = buildZeroDraftPatch(derived.classes);
      setClassDraft((prev) => ({ ...prev, ...patch }));
      try {
        await mutations.saveAllClasses();
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      }
    },
    setSectorTarget,
    handleNormalizeSectors: () => {
      setError(null);
      setSectorDraft((prev) => ({
        ...prev,
        ...buildNormalizedDraftPatch(
          derived.availableSectors,
          (s) => derived.sectorTargetOf(s, derived.activeSectorClass),
          (s) => sectorDraftKey(derived.activeSectorClass, s),
        ),
      }));
    },
    handleDistributeSectorsEqually: async () => {
      setError(null);
      setSyncStatus("saving");
      const patch = buildEqualDraftPatch(derived.availableSectors, (s) =>
        sectorDraftKey(derived.activeSectorClass, s),
      );
      setSectorDraft((prev) => ({ ...prev, ...patch }));
      try {
        await mutations.saveAllSectorsForClass();
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      }
    },
    handleResetSectorsZero: async () => {
      setError(null);
      setSyncStatus("saving");
      const patch = buildZeroDraftPatch(derived.availableSectors, (s) =>
        sectorDraftKey(derived.activeSectorClass, s),
      );
      setSectorDraft((prev) => ({ ...prev, ...patch }));
      try {
        await mutations.saveAllSectorsForClass();
        markSavedWithDelay();
      } catch {
        setSyncStatus("error");
      }
    },
    hasDraftChanges: false,
    handleDiscardDraft: () => {
      setClassDraft({});
      setSectorDraft({});
      setError(null);
      pushToast({
        title: "Alterações descartadas",
        description: "Valores restaurados para a meta oficial salva no banco.",
        variant: "default",
      });
    },
    assetClassFilter,
    setAssetClassFilter,
    breakdownGroup,
    setBreakdownGroup,
    detailAsset: assetDetailId ? derived.assetMap.get(assetDetailId) ?? null : null,
    assetDetailId,
    setAssetDetailId,
    evaluatingAsset,
    setEvaluatingAsset,
  };
}
