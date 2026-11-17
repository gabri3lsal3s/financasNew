import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Save } from "lucide-react";
import { Alert, Button, EmptyState, ErrorState, Tabs, TargetsSkeleton } from "@/components/ui";
import {
  calculateEffectiveAssetTargets,
  distributeEquallyTargets,
  inferSectorFromTicker,
  isCashAssetClass,
  normalizeAllocationTargets,
  sanitizeGroupTargetsForSave,
  validateClassSectorTargetsSum,
  validateTargetsSum,
} from "@/domain/portfolio";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { PortfolioAsset } from "@/types";
import {
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useRemoveGroupTarget,
  useSaveGroupTarget,
  useSaveHierarchyTargets,
} from "@/state";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import {
  AllocationBreakdownDialog,
  AssetDetailSheet,
  AssetScoreEvaluationDialog,
} from "../components";
import {
  TargetAssetsCard,
  TargetClassesCard,
  TargetSectorsCard,
  type TargetAssetScoreRow,
} from "../components/targets";

const sectorDraftKey = (className: string, sectorName: string) => `${className}::${sectorName}`;

/**
 * Governança hierárquica da carteira em 3 níveis (§3.11.1 · Plano 42):
 * 1. Classes: alocação macro (% do patrimônio investível, fora o Caixa);
 * 2. Setores: alocação meso opcional com escopo por classe (% dentro da classe);
 * 3. Ativos: Notas de Tese (0–10) + Status, com meta efetiva derivada automaticamente.
 */
export function TargetsTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "investments",
    defaultContext: "Definir Metas de Alocação",
  });
  const position = usePortfolioPosition();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const assetsQuery = usePortfolioAssets();

  const saveClassTarget = useSaveGroupTarget("class");
  const removeClassTarget = useRemoveGroupTarget("class");
  const saveSectorTarget = useSaveGroupTarget("sector");
  const removeSectorTarget = useRemoveGroupTarget("sector");
  const saveHierarchyTargets = useSaveHierarchyTargets();

  const [classDraft, setClassDraft] = useState<Record<string, number>>({});
  const [sectorDraft, setSectorDraft] = useState<Record<string, number>>({});

  const [breakdownGroup, setBreakdownGroup] = useState<{
    type: "class" | "sector";
    name: string;
    parentClass?: string;
  } | null>(null);
  const [assetDetailId, setAssetDetailId] = useState<string | null>(null);
  const detailAsset = assetDetailId
    ? (assetsQuery.data ?? []).find((a) => a.id === assetDetailId) ?? null
    : null;
  const [evaluatingAsset, setEvaluatingAsset] = useState<PortfolioAsset | null>(null);

  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [savingSector, setSavingSector] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetClassFilter, setAssetClassFilter] = useState<string | null>(null);
  const [selectedSectorClass, setSelectedSectorClass] = useState<string | null>(null);

  // Exclui Caixa das metas de classes e notas (Decisão 1 · Plano 42)
  const investableRows = useMemo(
    () =>
      position.rows.filter(
        (r) => !isCashAssetClass(r.assetClass) && r.ticker.trim().toUpperCase() !== "CAIXA",
      ),
    [position.rows],
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
    () => new Map((classTargetsQuery.data ?? []).map((t) => [t.name, t.target_percentage])),
    [classTargetsQuery.data],
  );

  const storedSectorMaps = useMemo(() => {
    const byClass = new Map<string, Map<string, number>>();
    const legacyFallback = new Map<string, number>();

    for (const item of sectorTargetsQuery.data ?? []) {
      const cls = item.class_name?.trim();
      if (cls) {
        const inner = byClass.get(cls) ?? new Map<string, number>();
        inner.set(item.name, item.target_percentage);
        byClass.set(cls, inner);
      } else {
        legacyFallback.set(item.name, item.target_percentage);
      }
    }

    return { byClass, legacyFallback };
  }, [sectorTargetsQuery.data]);

  const classTargetOf = (className: string) =>
    classDraft[className] ?? storedClassTargets.get(className) ?? 0;

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

  const sectorTargetOf = (sectorName: string, className = activeSectorClass): number => {
    const key = sectorDraftKey(className, sectorName);
    if (key in sectorDraft) return sectorDraft[key] ?? 0;
    const scoped = storedSectorMaps.byClass.get(className);
    if (scoped?.has(sectorName)) return scoped.get(sectorName) ?? 0;
    return storedSectorMaps.legacyFallback.get(sectorName) ?? 0;
  };

  const sectorRows = availableSectors.map((s) => ({
    key: s,
    label: s,
    target: sectorTargetOf(s, activeSectorClass),
  }));
  const sectorSum = validateClassSectorTargetsSum(
    sectorRows.map((r) => ({ target: r.target })),
    activeSectorClass,
  );

  const assetMap = useMemo(
    () => new Map((assetsQuery.data ?? []).map((a) => [a.id, a])),
    [assetsQuery.data],
  );

  const effectiveAssetTargetsMap = useMemo(() => {
    const effectiveClassTargets = classes.map((cls) => ({
      className: cls,
      targetPercentage: classTargetOf(cls),
    }));

    const effectiveSectorTargets: Array<{
      className?: string | null;
      sectorName: string;
      targetPercentage: number;
    }> = [];

    for (const cls of classes) {
      const sectorsInClass = new Set<string>();
      for (const row of investableRows) {
        if (row.assetClass === cls) {
          const sec = row.sector?.trim() || inferSectorFromTicker(row.ticker, cls);
          if (sec) sectorsInClass.add(sec);
        }
      }
      const storedForClass = storedSectorMaps.byClass.get(cls);
      if (storedForClass) {
        for (const sec of storedForClass.keys()) sectorsInClass.add(sec);
      }

      for (const sec of sectorsInClass) {
        const pct = sectorTargetOf(sec, cls);
        if (pct > 0) {
          effectiveSectorTargets.push({
            className: cls,
            sectorName: sec,
            targetPercentage: pct,
          });
        }
      }
    }

    const inputs = investableRows.map((row) => {
      const asset = assetMap.get(row.assetId);
      const sec =
        row.sector?.trim() ||
        asset?.sector?.trim() ||
        inferSectorFromTicker(row.ticker, row.assetClass);
      return {
        id: row.assetId,
        ticker: row.ticker,
        assetClass: row.assetClass ?? "Sem classe",
        sector: sec || null,
        score: asset?.score ?? null,
        allocation_status: asset?.allocation_status ?? "active",
      };
    });

    const results = calculateEffectiveAssetTargets({
      assets: inputs,
      classTargets: effectiveClassTargets,
      sectorTargets: effectiveSectorTargets,
    });

    return new Map(results.map((r) => [r.assetId, r]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, investableRows, assetMap, classDraft, sectorDraft, storedClassTargets, storedSectorMaps]);

  const assetScoreRows: TargetAssetScoreRow[] = useMemo(
    () =>
      investableRows.map((row) => {
        const asset = assetMap.get(row.assetId);
        const effective = effectiveAssetTargetsMap.get(row.assetId);
        const rawScore = asset?.score ?? null;
        const status = asset?.allocation_status ?? "active";
        const sector =
          row.sector?.trim() ||
          asset?.sector?.trim() ||
          inferSectorFromTicker(row.ticker, row.assetClass);

        return {
          assetId: row.assetId,
          ticker: row.ticker,
          assetClass: row.assetClass ?? "Sem classe",
          sector: sector || null,
          valueBRL: row.valueBRL,
          currentPct: investableTotalBRL > 0 ? (row.valueBRL / investableTotalBRL) * 100 : row.pct,
          rawScore: effective?.rawScore ?? rawScore,
          effectiveScore: effective?.effectiveScore ?? rawScore ?? 5,
          effectiveTargetPct: effective?.effectiveTargetPct ?? 0,
          status,
          formulaLabel: effective?.formulaLabel ?? "Defina a meta da classe para calcular",
          onEvaluate: asset ? () => setEvaluatingAsset(asset) : undefined,
        };
      }),
    [investableRows, assetMap, effectiveAssetTargetsMap, investableTotalBRL],
  );

  // Handlers de Classes
  const saveClass = async (className: string) => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Definir Metas de Classes");
      return;
    }
    setError(null);
    setSavingClass(className);
    try {
      await saveClassTarget.mutateAsync({ name: className, target: classTargetOf(className) });
      setClassDraft((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const removeClass = async (className: string) => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Remover Meta de Classe");
      return;
    }
    setError(null);
    setSavingClass(className);
    try {
      await removeClassTarget.mutateAsync(className);
      setClassDraft((prev) => {
        const next = { ...prev };
        delete next[className];
        return next;
      });
      triggerSensory("selection");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const buildStoredSectorsPayload = (overrideClass?: string, overrideSectors?: Array<{ name: string; target: number }>) => {
    const payload: Array<{ class_name: string; name: string; target_percentage: number }> = [];
    for (const item of sectorTargetsQuery.data ?? []) {
      const cls = item.class_name?.trim();
      if (!cls) continue;
      if (overrideClass && cls === overrideClass) continue;
      if (item.target_percentage > 0) {
        payload.push({
          class_name: cls,
          name: item.name,
          target_percentage: item.target_percentage,
        });
      }
    }
    if (overrideClass && overrideSectors) {
      for (const item of overrideSectors) {
        if (item.target > 0) {
          payload.push({
            class_name: overrideClass,
            name: item.name,
            target_percentage: item.target,
          });
        }
      }
    }
    return payload;
  };

  const saveAllClasses = async () => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Definir Metas de Classes");
      return;
    }
    setError(null);
    setSavingClass("all");
    try {
      const rawTargets = classes.map((className) => ({
        name: className,
        target: classTargetOf(className),
      }));
      const sanitized = sanitizeGroupTargetsForSave(rawTargets);

      await saveHierarchyTargets.mutateAsync({
        classes: sanitized
          .filter((item) => item.target > 0)
          .map((item) => ({ name: item.name, target_percentage: item.target })),
        sectors: buildStoredSectorsPayload(),
      });

      setClassDraft({});
      triggerSensory("success");
      pushToast({ title: "Metas de classes salvas com sucesso!", variant: "success" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  // Handlers de Setores
  const saveSector = async (sectorName: string) => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Definir Metas Setoriais");
      return;
    }
    setError(null);
    setSavingSector(sectorName);
    try {
      await saveSectorTarget.mutateAsync({
        name: sectorName,
        target: sectorTargetOf(sectorName, activeSectorClass),
        className: activeSectorClass,
      });
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorDraftKey(activeSectorClass, sectorName)];
        return next;
      });
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const removeSector = async (sectorName: string) => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Remover Meta Setorial");
      return;
    }
    setError(null);
    setSavingSector(sectorName);
    try {
      await removeSectorTarget.mutateAsync({
        name: sectorName,
        className: activeSectorClass,
      });
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorDraftKey(activeSectorClass, sectorName)];
        return next;
      });
      triggerSensory("selection");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const saveAllSectorsForClass = async () => {
    if (isReadOnlyMode) {
      guardAction(() => {}, "Definir Metas Setoriais");
      return;
    }
    setError(null);
    setSavingSector("all");
    try {
      const rawTargets = availableSectors.map((sectorName) => ({
        name: sectorName,
        target: sectorTargetOf(sectorName, activeSectorClass),
      }));
      const sanitized = sanitizeGroupTargetsForSave(rawTargets);

      const storedClasses = (classTargetsQuery.data ?? [])
        .filter((item) => item.target_percentage > 0)
        .map((item) => ({ name: item.name, target_percentage: item.target_percentage }));

      await saveHierarchyTargets.mutateAsync({
        classes: storedClasses,
        sectors: buildStoredSectorsPayload(activeSectorClass, sanitized),
      });

      setSectorDraft((prev) => {
        const prefix = `${activeSectorClass}::`;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (!k.startsWith(prefix)) next[k] = v;
        }
        return next;
      });
      triggerSensory("success");
      pushToast({ title: `Metas setoriais de ${activeSectorClass} salvas!`, variant: "success" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const classRows = classes.map((c) => ({
    name: c,
    key: c,
    label: c,
    target: classTargetOf(c),
  }));
  const classSum = validateTargetsSum(classRows.map((r) => ({ target: r.target })));

  const handleNormalizeClasses = () => {
    setError(null);
    const items = classes.map((c) => ({ id: c, targetPercentage: classTargetOf(c) }));
    const normalized = normalizeAllocationTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    normalized.forEach((item) => {
      nextDraft[item.id] = item.targetPercentage;
    });
    setClassDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleDistributeClassesEqually = () => {
    setError(null);
    const items = classes.map((c) => ({ id: c }));
    const distributed = distributeEquallyTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    distributed.forEach((item) => {
      nextDraft[item.id] = item.targetPercentage;
    });
    setClassDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleDistributeRemainingClasses = () => {
    setError(null);
    const sum = classRows.reduce((acc, r) => acc + r.target, 0);
    const remaining = Math.max(0, Math.round((100 - sum) * 100) / 100);
    if (!(remaining > 0)) return;

    const zeroClasses = classes.filter((c) => classTargetOf(c) === 0);
    const targetClasses = zeroClasses.length > 0 ? zeroClasses : classes;
    const perClass = Math.round((remaining / targetClasses.length) * 100) / 100;

    const nextDraft: Record<string, number> = {};
    let assigned = 0;
    targetClasses.forEach((c, idx) => {
      const isLast = idx === targetClasses.length - 1;
      const add = isLast ? Math.max(0, Math.round((remaining - assigned) * 100) / 100) : perClass;
      assigned += add;
      nextDraft[c] = Math.round((classTargetOf(c) + add) * 100) / 100;
    });

    const rawTargets = classes.map((c) => ({
      name: c,
      target: nextDraft[c] ?? classTargetOf(c),
    }));
    const sanitized = sanitizeGroupTargetsForSave(rawTargets);
    const finalDraft: Record<string, number> = {};
    sanitized.forEach((item) => {
      finalDraft[item.name] = item.target;
    });

    setClassDraft((prev) => ({ ...prev, ...finalDraft }));
    triggerSensory("selection");
  };

  const handleResetClassesZero = () => {
    setError(null);
    const nextDraft: Record<string, number> = {};
    classes.forEach((c) => {
      nextDraft[c] = 0;
    });
    setClassDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleNormalizeSectors = () => {
    setError(null);
    const items = availableSectors.map((s) => ({
      id: s,
      targetPercentage: sectorTargetOf(s, activeSectorClass),
    }));
    const normalized = normalizeAllocationTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    normalized.forEach((item) => {
      nextDraft[sectorDraftKey(activeSectorClass, item.id)] = item.targetPercentage;
    });
    setSectorDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleDistributeSectorsEqually = () => {
    setError(null);
    const items = availableSectors.map((s) => ({ id: s }));
    const distributed = distributeEquallyTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    distributed.forEach((item) => {
      nextDraft[sectorDraftKey(activeSectorClass, item.id)] = item.targetPercentage;
    });
    setSectorDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleResetSectorsZero = () => {
    setError(null);
    const nextDraft: Record<string, number> = {};
    availableSectors.forEach((s) => {
      nextDraft[sectorDraftKey(activeSectorClass, s)] = 0;
    });
    setSectorDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  // Rascunho Local & Descarte em 1 Toque (Salvaguarda S24)
  const hasDraftChanges =
    Object.keys(classDraft).length > 0 || Object.keys(sectorDraft).length > 0;

  const handleDiscardDraft = () => {
    setClassDraft({});
    setSectorDraft({});
    setError(null);
    triggerSensory("selection");
    pushToast({
      title: "Alterações descartadas",
      description: "Valores restaurados para a meta oficial salva no banco.",
      variant: "default",
    });
  };

  const loading =
    position.isLoading || classTargetsQuery.isLoading || sectorTargetsQuery.isLoading;

  const loadError =
    position.error ?? classTargetsQuery.error ?? sectorTargetsQuery.error;

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

  return (
    <div data-tour="investments-targets" className="flex flex-col gap-6">
      {loadError ? (
        <ErrorState
          message={getErrorMessage(loadError)}
          onRetry={() => {
            position.refetch();
            void classTargetsQuery.refetch();
            void sectorTargetsQuery.refetch();
          }}
        />
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* Barra de Rascunho & Descarte (Salvaguarda S24) */}
      {hasDraftChanges ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-warning/20 bg-warning/10">
          <span className="text-xs sm:text-sm font-medium text-warning-strong">
            Existem alterações não salvas no rascunho de metas.
          </span>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDiscardDraft}
              className="flex-1 sm:flex-none cursor-pointer"
            >
              Descartar alterações
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <TargetsSkeleton />
      ) : investableRows.length === 0 ? (
        <EmptyState
          icon={<Save className="size-6" aria-hidden="true" />}
          title={
            position.rows.length > 0
              ? "Apenas liquidez em Caixa no momento"
              : "Sem ativos para definir metas"
          }
          description={
            position.rows.length > 0
              ? "O Caixa fica fora das metas de alocação. Cadastre ativos investíveis (Ações, FIIs, Renda Fixa) para definir classes, setores e notas."
              : "Adicione ativos na carteira para configurar metas de classes, setores e notas."
          }
          tone="default"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Carteira
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="w-full">
          <Tabs
            value={subTab}
            onValueChange={(val: string) =>
              handleSubTabChange(val as "classes" | "sectors" | "assets")
            }
            variant="pills"
            items={[
              {
                value: "classes",
                label: "Classes",
                content: (
                  <TargetClassesCard
                    classes={classes}
                    classTargetOf={classTargetOf}
                    storedClassTargets={storedClassTargets}
                    positionRows={investableRows}
                    classSum={classSum}
                    savingClass={savingClass}
                    onNormalizeClasses={handleNormalizeClasses}
                    onDistributeClassesEqually={handleDistributeClassesEqually}
                    onDistributeRemaining={handleDistributeRemainingClasses}
                    onResetClassesZero={handleResetClassesZero}
                    onClassTargetChange={(c, v) =>
                      setClassDraft((prev) => ({ ...prev, [c]: v }))
                    }
                    onSaveClass={(c) => void saveClass(c)}
                    onRemoveClass={(c) => void removeClass(c)}
                    onSaveAllClasses={() => void saveAllClasses()}
                    onOpenClassDetail={(cls) =>
                      setBreakdownGroup({ type: "class", name: cls })
                    }
                  />
                ),
              },
              {
                value: "sectors",
                label: "Setores",
                content: (
                  <TargetSectorsCard
                    classes={classes}
                    activeSectorClass={activeSectorClass}
                    availableSectors={availableSectors}
                    storedSectorTargets={activeClassStoredSectors}
                    positionRows={investableRows}
                    sectorTargetOf={(s) => sectorTargetOf(s, activeSectorClass)}
                    sectorSum={sectorSum}
                    savingSector={savingSector}
                    onSelectSectorClass={(cls) => setSelectedSectorClass(cls)}
                    onNormalizeSectors={handleNormalizeSectors}
                    onDistributeSectorsEqually={handleDistributeSectorsEqually}
                    onResetSectorsZero={handleResetSectorsZero}
                    onSectorTargetChange={(s, v) =>
                      setSectorDraft((prev) => ({
                        ...prev,
                        [sectorDraftKey(activeSectorClass, s)]: v,
                      }))
                    }
                    onSaveSector={(s) => void saveSector(s)}
                    onRemoveSector={(s) => void removeSector(s)}
                    onSaveAllSectorsForClass={() => void saveAllSectorsForClass()}
                    onOpenSectorDetail={(sec, parentCls) =>
                      setBreakdownGroup({ type: "sector", name: sec, parentClass: parentCls })
                    }
                  />
                ),
              },
              {
                value: "assets",
                label: "Ativos",
                content: (
                  <TargetAssetsCard
                    classes={classes}
                    assetClassFilter={assetClassFilter}
                    rows={assetScoreRows}
                    onAssetClassFilterChange={(cls) => setAssetClassFilter(cls)}
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Raio-X Analítico de Classe e Setor */}
      <AllocationBreakdownDialog
        open={breakdownGroup !== null}
        onOpenChange={(open) => {
          if (!open) setBreakdownGroup(null);
        }}
        type={breakdownGroup?.type ?? "class"}
        groupName={breakdownGroup?.name ?? null}
        parentClassName={breakdownGroup?.parentClass}
        rows={investableRows}
        totalPortfolioBRL={investableTotalBRL}
        targetPercent={
          breakdownGroup?.type === "class"
            ? classTargetOf(breakdownGroup.name)
            : breakdownGroup?.name
              ? sectorTargetOf(
                  breakdownGroup.name,
                  breakdownGroup.parentClass ?? activeSectorClass,
                )
              : null
        }
        onSelectAsset={(assetId) => setAssetDetailId(assetId)}
      />

      {/* Ficha Completa do Ativo selecionado no Raio-X */}
      {detailAsset ? (
        <AssetDetailSheet
          open={assetDetailId !== null}
          onOpenChange={(open) => {
            if (!open) setAssetDetailId(null);
          }}
          asset={detailAsset}
        />
      ) : null}

      {/* Avaliação de Tese & Nota Holística */}
      <AssetScoreEvaluationDialog
        open={evaluatingAsset !== null}
        onOpenChange={(open) => {
          if (!open) setEvaluatingAsset(null);
        }}
        asset={evaluatingAsset}
      />

      {upgradeModal}
    </div>
  );
}
