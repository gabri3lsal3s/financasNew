import { useState } from "react";
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
  const [assetClassFilter, setAssetClassFilter] = useState<string | null>(null);
  const [selectedSectorClass, setSelectedSectorClass] = useState<string | null>(null);

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

  return {
    position,
    classTargetsQuery,
    sectorTargetsQuery,
    ...derived,
    ...mutations,
    loading: position.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading,
    loadError: position.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error,
    error,
    subTab,
    handleSubTabChange,
    setSelectedSectorClass,
    setClassTarget: (c: string, v: number) => setClassDraft((prev) => ({ ...prev, [c]: v })),
    handleNormalizeClasses: () => {
      setError(null);
      setClassDraft((prev) => ({
        ...prev,
        ...buildNormalizedDraftPatch(derived.classes, derived.classTargetOf),
      }));
    },
    handleDistributeClassesEqually: () => {
      setError(null);
      setClassDraft((prev) => ({ ...prev, ...buildEqualDraftPatch(derived.classes) }));
    },
    handleDistributeRemainingClasses: () => {
      setError(null);
      const patch = buildRemainingDraftPatch(derived.classes, derived.classTargetOf);
      if (Object.keys(patch).length > 0) setClassDraft((prev) => ({ ...prev, ...patch }));
    },
    handleResetClassesZero: () => {
      setError(null);
      setClassDraft((prev) => ({ ...prev, ...buildZeroDraftPatch(derived.classes) }));
    },
    setSectorTarget: (s: string, v: number) =>
      setSectorDraft((prev) => ({ ...prev, [sectorDraftKey(derived.activeSectorClass, s)]: v })),
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
    handleDistributeSectorsEqually: () => {
      setError(null);
      setSectorDraft((prev) => ({
        ...prev,
        ...buildEqualDraftPatch(derived.availableSectors, (s) =>
          sectorDraftKey(derived.activeSectorClass, s),
        ),
      }));
    },
    handleResetSectorsZero: () => {
      setError(null);
      setSectorDraft((prev) => ({
        ...prev,
        ...buildZeroDraftPatch(derived.availableSectors, (s) =>
          sectorDraftKey(derived.activeSectorClass, s),
        ),
      }));
    },
    hasDraftChanges: Object.keys(classDraft).length > 0 || Object.keys(sectorDraft).length > 0,
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
