import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";
import { Alert, Button, EmptyState, ErrorState, SkeletonList, SkeletonTable, Tabs } from "@/components/ui";
import { PresetSelectorBar, SavePresetDialog } from "@/components/modules";
import {
  SYSTEM_PRESET_TEMPLATES,
  applyPresetToPosition,
  createPresetSnapshot,
  distributeEquallyTargets,
  inferSectorFromTicker,
  mirrorCurrentPositionTargets,
  normalizeAllocationTargets,
  parseTargetInput,
  validateClassSectorTargetsSum,
  validateTargetsSum,
} from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useAllocationPresets,
  useAllocationTargets,
  useCreateAllocationPreset,
  useDeleteAllocationPreset,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useRemoveGroupTarget,
  useSaveAllocationTargets,
  useSaveGroupTarget,
  useUpdateAllocationPreset,
} from "@/state";
import { AllocationBreakdownDialog, AssetDetailSheet } from "../components";
import { TargetAssetsCard, TargetClassesCard, TargetSectorsCard } from "../components/targets";

/**
 * Metas de alocação (§3.11.1 e §F39) — edição hierárquica em 3 níveis:
 * 1. Classes: alocação macro (% do patrimônio total);
 * 2. Setores: alocação meso por segmento/setor (% relativo da classe);
 * 3. Ativos: alocação micro individual (% do patrimônio).
 * Suporte a cenários estratégicos (presets), normalização em 1-clique e validações estritas (<= 100%).
 */
export function TargetsTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const presetsQuery = useAllocationPresets();

  const saveTargets = useSaveAllocationTargets();
  const saveClassTarget = useSaveGroupTarget("class");
  const removeClassTarget = useRemoveGroupTarget("class");
  const saveSectorTarget = useSaveGroupTarget("sector");
  const removeSectorTarget = useRemoveGroupTarget("sector");

  const createPreset = useCreateAllocationPreset();
  const updatePreset = useUpdateAllocationPreset();
  const deletePreset = useDeleteAllocationPreset();
  const assetsQuery = usePortfolioAssets();

  // Estados locais dos rascunhos de metas
  const [assetDraft, setAssetDraft] = useState<Record<string, number>>({});
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

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>("official");
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [savingSector, setSavingSector] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const storedAssetTargets = new Map((targetsQuery.data ?? []).map((t) => [t.asset_id, t.target_percentage]));
  const storedClassTargets = new Map((classTargetsQuery.data ?? []).map((t) => [t.name, t.target_percentage]));
  const storedSectorTargets = new Map((sectorTargetsQuery.data ?? []).map((t) => [t.name, t.target_percentage]));

  const assetTargetOf = (assetId: string) => assetDraft[assetId] ?? storedAssetTargets.get(assetId) ?? 0;
  const classTargetOf = (className: string) => classDraft[className] ?? storedClassTargets.get(className) ?? 0;
  const sectorTargetOf = (sectorName: string) => sectorDraft[sectorName] ?? storedSectorTargets.get(sectorName) ?? 0;

  const [assetClassFilter, setAssetClassFilter] = useState<string | null>(null);

  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  // Sub-aba de Setores: classe selecionada
  const [selectedSectorClass, setSelectedSectorClass] = useState<string | null>(null);
  const activeSectorClass = selectedSectorClass ?? classes[0] ?? "Ações";
  const availableSectors = [
    ...new Set(
      position.rows
        .filter((r) => r.assetClass === activeSectorClass)
        .map((r) => r.sector?.trim() || inferSectorFromTicker(r.ticker, activeSectorClass))
        .filter(Boolean),
    ),
  ];

  const sectorRows = availableSectors.map((s) => ({
    key: s,
    label: s,
    target: sectorTargetOf(s),
  }));
  const sectorSum = validateClassSectorTargetsSum(
    sectorRows.map((r) => ({ target: r.target })),
    activeSectorClass,
  );

  const assetRows = position.rows.map((row) => ({
    key: row.assetId,
    label: row.ticker,
    assetClass: row.assetClass ?? (row.isCash ? "Caixa" : "Sem classe"),
    detail: `${formatCentsAsBRL(numberToCents(row.valueBRL))} · ${row.pct.toFixed(1)}% hoje`,
    target: assetTargetOf(row.assetId),
    currentPct: row.pct,
  }));

  const assetSum = validateTargetsSum(assetRows.map((r) => ({ target: r.target })));

  const visibleAssetRows = assetClassFilter
    ? assetRows.filter((r) => r.assetClass === assetClassFilter)
    : assetRows;

  const activeClassTargetSum = assetClassFilter
    ? assetRows
        .filter((r) => r.assetClass === assetClassFilter)
        .reduce((acc, r) => acc + r.target, 0)
    : null;

  const otherClassesSum = assetClassFilter
    ? assetRows
        .filter((r) => r.assetClass !== assetClassFilter)
        .reduce((acc, r) => acc + r.target, 0)
    : 0;

  const maxAllowedForThisClass = Math.max(0, Math.round((100 - otherClassesSum) * 100) / 100);

  const selectedClassTarget = assetClassFilter
    ? (classTargetOf(assetClassFilter) > 0 ? classTargetOf(assetClassFilter) : null)
    : null;

  const targetCeiling = selectedClassTarget !== null
    ? selectedClassTarget
    : (activeClassTargetSum !== null && activeClassTargetSum > 0
        ? Math.min(activeClassTargetSum, maxAllowedForThisClass)
        : (classes.length > 1 ? maxAllowedForThisClass : 100));

  const normalizeLabel = assetClassFilter
    ? `Normalizar ${assetClassFilter} para ${targetCeiling.toFixed(1)}%`
    : "Normalizar para 100%";

  const distributeLabel = assetClassFilter
    ? `Distribuir igualmente (${targetCeiling.toFixed(1)}%)`
    : "Distribuir igualmente (1/N)";

  const handleNormalizeAll = () => {
    setError(null);
    setSaved(false);
    const items = position.rows.map((row) => ({
      id: row.assetId,
      targetPercentage: assetTargetOf(row.assetId),
    }));
    const normalized = normalizeAllocationTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    normalized.forEach((item) => {
      nextDraft[item.id] = item.targetPercentage;
    });
    setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleNormalize = () => {
    setError(null);
    setSaved(false);
    if (assetClassFilter) {
      const items = visibleAssetRows.map((r) => ({
        id: r.key,
        targetPercentage: r.target,
      }));
      const normalized = normalizeAllocationTargets(items, targetCeiling);
      const nextDraft: Record<string, number> = {};
      normalized.forEach((item) => {
        nextDraft[item.id] = item.targetPercentage;
      });
      setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    } else {
      handleNormalizeAll();
    }
    triggerSensory("selection");
  };

  const handleDistributeEqually = () => {
    setError(null);
    setSaved(false);
    if (assetClassFilter) {
      const items = visibleAssetRows.map((r) => ({ id: r.key }));
      const distributed = distributeEquallyTargets(items, targetCeiling);
      const nextDraft: Record<string, number> = {};
      distributed.forEach((item) => {
        nextDraft[item.id] = item.targetPercentage;
      });
      setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    } else {
      const items = position.rows.map((row) => ({ id: row.assetId }));
      const distributed = distributeEquallyTargets(items, 100);
      const nextDraft: Record<string, number> = {};
      distributed.forEach((item) => {
        nextDraft[item.id] = item.targetPercentage;
      });
      setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    }
    triggerSensory("selection");
  };

  const handleMirrorPosition = () => {
    setError(null);
    setSaved(false);
    if (assetClassFilter) {
      const items = visibleAssetRows.map((r) => ({ id: r.key, currentPct: r.currentPct }));
      const mirrored = mirrorCurrentPositionTargets(items, targetCeiling);
      const nextDraft: Record<string, number> = {};
      mirrored.forEach((item) => {
        nextDraft[item.id] = item.targetPercentage;
      });
      setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    } else {
      const items = position.rows.map((row) => ({ id: row.assetId, currentPct: row.pct }));
      const mirrored = mirrorCurrentPositionTargets(items, 100);
      const nextDraft: Record<string, number> = {};
      mirrored.forEach((item) => {
        nextDraft[item.id] = item.targetPercentage;
      });
      setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    }
    triggerSensory("selection");
  };

  const handleResetZero = () => {
    setError(null);
    setSaved(false);
    const nextDraft: Record<string, number> = {};
    if (assetClassFilter) {
      visibleAssetRows.forEach((r) => {
        nextDraft[r.key] = 0;
      });
    } else {
      position.rows.forEach((r) => {
        nextDraft[r.assetId] = 0;
      });
    }
    setAssetDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const saveAssets = async () => {
    setError(null);
    setSaved(false);
    try {
      await saveTargets.mutateAsync(
        position.rows.map((row) => ({ assetId: row.assetId, target: assetTargetOf(row.assetId) })),
      );
      setAssetDraft({});
      setSaved(true);
      triggerSensory("success");
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const saveClass = async (className: string) => {
    setError(null);
    setSavingClass(className);
    try {
      await saveClassTarget.mutateAsync({ name: className, target: classTargetOf(className) });
      setClassDraft((prev) => ({ ...prev, [className]: classTargetOf(className) }));
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const removeClass = async (className: string) => {
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

  const saveAllClasses = async () => {
    setError(null);
    setSavingClass("all");
    try {
      for (const className of classes) {
        await saveClassTarget.mutateAsync({ name: className, target: classTargetOf(className) });
      }
      setClassDraft({});
      triggerSensory("success");
      pushToast({ title: "Metas de classes salvas com sucesso!", variant: "success" });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const saveSector = async (sectorName: string) => {
    setError(null);
    setSavingSector(sectorName);
    try {
      await saveSectorTarget.mutateAsync({ name: sectorName, target: sectorTargetOf(sectorName) });
      setSectorDraft((prev) => ({ ...prev, [sectorName]: sectorTargetOf(sectorName) }));
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSector(null);
    }
  };

  const removeSector = async (sectorName: string) => {
    setError(null);
    setSavingSector(sectorName);
    try {
      await removeSectorTarget.mutateAsync(sectorName);
      setSectorDraft((prev) => {
        const next = { ...prev };
        delete next[sectorName];
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
    setError(null);
    setSavingSector("all");
    try {
      for (const sectorName of availableSectors) {
        await saveSectorTarget.mutateAsync({ name: sectorName, target: sectorTargetOf(sectorName) });
      }
      setSectorDraft({});
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
    const items = availableSectors.map((s) => ({ id: s, targetPercentage: sectorTargetOf(s) }));
    const normalized = normalizeAllocationTargets(items, 100);
    const nextDraft: Record<string, number> = {};
    normalized.forEach((item) => {
      nextDraft[item.id] = item.targetPercentage;
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
      nextDraft[item.id] = item.targetPercentage;
    });
    setSectorDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const handleResetSectorsZero = () => {
    setError(null);
    const nextDraft: Record<string, number> = {};
    availableSectors.forEach((s) => {
      nextDraft[s] = 0;
    });
    setSectorDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  // Gerenciamento de Presets / Cenários
  const userPresets = presetsQuery.data ?? [];
  const allTemplates = SYSTEM_PRESET_TEMPLATES;
  const currentActiveUserPreset = userPresets.find((p) => p.id === selectedPresetId);
  const currentActiveTemplate = allTemplates.find((t) => t.id === selectedPresetId);

  const activePresetName = selectedPresetId === "official"
    ? "Estratégia Atual (Oficial)"
    : currentActiveUserPreset?.name ?? currentActiveTemplate?.name ?? "Cenário Simulado";

  const activePresetDescription = selectedPresetId === "official"
    ? "Metas vigentes gravadas na sua carteira."
    : currentActiveUserPreset?.description ?? currentActiveTemplate?.description;

  const isSimulating = selectedPresetId !== "official";

  const handleSelectPreset = (presetId: string) => {
    setError(null);
    setSaved(false);
    setSelectedPresetId(presetId);

    if (presetId === "official") {
      setAssetDraft({});
      setClassDraft({});
      setSectorDraft({});
      triggerSensory("selection");
      return;
    }

    const template = SYSTEM_PRESET_TEMPLATES.find((t) => t.id === presetId);
    if (template) {
      const applied = applyPresetToPosition(
        template,
        position.rows.map((r) => ({
          assetId: r.assetId,
          ticker: r.ticker,
          assetClass: r.assetClass,
          pct: r.pct,
        })),
      );
      setClassDraft(applied.classDraft);
      setAssetDraft(applied.assetDraft);
      triggerSensory("selection");
      return;
    }

    const userPreset = userPresets.find((p) => p.id === presetId);
    if (userPreset) {
      const applied = applyPresetToPosition(
        userPreset,
        position.rows.map((r) => ({
          assetId: r.assetId,
          ticker: r.ticker,
          assetClass: r.assetClass,
          pct: r.pct,
        })),
      );
      setClassDraft(applied.classDraft);
      setAssetDraft(applied.assetDraft);
      triggerSensory("selection");
    }
  };

  const handleResetToOfficial = () => {
    handleSelectPreset("official");
  };

  const handleSaveNewPreset = async (name: string, description?: string | null) => {
    const snapshot = createPresetSnapshot({
      name,
      description,
      assetRows: position.rows.map((r) => ({
        assetId: r.assetId,
        ticker: r.ticker,
        target: assetTargetOf(r.assetId),
      })),
      classRows: classes.map((c) => ({
        name: c,
        target: classTargetOf(c),
      })),
    });

    const result = await createPreset.mutateAsync({
      name: snapshot.name,
      description: snapshot.description ?? undefined,
      class_targets: snapshot.class_targets,
      asset_targets: snapshot.asset_targets,
    });
    setSelectedPresetId(result.id);
    triggerSensory("success");
    pushToast({ title: `Cenário "${name}" salvo!`, variant: "success" });
  };

  const handleOverwritePreset = async () => {
    if (!currentActiveUserPreset) return;

    const snapshot = createPresetSnapshot({
      name: currentActiveUserPreset.name,
      description: currentActiveUserPreset.description,
      assetRows: position.rows.map((r) => ({
        assetId: r.assetId,
        ticker: r.ticker,
        target: assetTargetOf(r.assetId),
      })),
      classRows: classes.map((c) => ({
        name: c,
        target: classTargetOf(c),
      })),
    });

    await updatePreset.mutateAsync({
      id: currentActiveUserPreset.id,
      input: {
        name: snapshot.name,
        description: snapshot.description,
        class_targets: snapshot.class_targets,
        asset_targets: snapshot.asset_targets,
      },
    });
    triggerSensory("success");
    pushToast({ title: `Cenário "${currentActiveUserPreset.name}" atualizado!`, variant: "success" });
  };

  const handleDeletePreset = async (id: string) => {
    await deletePreset.mutateAsync(id);
    if (selectedPresetId === id) {
      handleSelectPreset("official");
    }
    triggerSensory("selection");
    pushToast({ title: "Cenário excluído.", variant: "default" });
  };

  const loading =
    position.isLoading ||
    targetsQuery.isLoading ||
    classTargetsQuery.isLoading ||
    sectorTargetsQuery.isLoading ||
    presetsQuery.isLoading;

  const loadError =
    position.error ??
    targetsQuery.error ??
    classTargetsQuery.error ??
    sectorTargetsQuery.error ??
    presetsQuery.error;

  const [subTab, setSubTab] = useState<"classes" | "sectors" | "assets">("classes");

  return (
    <div className="flex flex-col gap-6">
      {loadError ? (
        <ErrorState
          message={getErrorMessage(loadError)}
          onRetry={() => {
            position.refetch();
            void presetsQuery.refetch();
            void targetsQuery.refetch();
            void classTargetsQuery.refetch();
            void sectorTargetsQuery.refetch();
          }}
        />
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* Barra de Controle de Cenários / Presets */}
      {position.rows.length > 0 ? (
        <PresetSelectorBar
          userPresets={presetsQuery.data ?? []}
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectPreset}
          onSaveNewPreset={() => setSavePresetOpen(true)}
          onOverwritePreset={currentActiveUserPreset ? () => void handleOverwritePreset() : undefined}
          onDeletePreset={(id) => void handleDeletePreset(id)}
          onResetToOfficial={handleResetToOfficial}
          isSimulating={isSimulating}
          activePresetName={activePresetName}
          activePresetDescription={activePresetDescription}
        />
      ) : null}

      {/* Diálogo para salvar novo cenário */}
      <SavePresetDialog
        open={savePresetOpen}
        onOpenChange={setSavePresetOpen}
        onSave={handleSaveNewPreset}
        assetCount={assetRows.filter((r) => r.target > 0).length}
        classCount={classRows.filter((r) => r.target > 0).length}
        saving={createPreset.isPending}
      />

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <SkeletonList rows={4} />
          <SkeletonTable rows={3} />
        </div>
      ) : position.rows.length === 0 ? (
        <EmptyState
          icon={<Save className="size-6" aria-hidden="true" />}
          title="Sem ativos para definir metas"
          description="Adicione ativos na aba Resumo para definir as metas de alocação."
          tone="portfolio"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Resumo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Tabs
          value={subTab}
          onValueChange={(val: string) => setSubTab(val as "classes" | "sectors" | "assets")}
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
                  positionRows={position.rows}
                  classSum={classSum}
                  savingClass={savingClass}
                  onNormalizeClasses={handleNormalizeClasses}
                  onDistributeClassesEqually={handleDistributeClassesEqually}
                  onResetClassesZero={handleResetClassesZero}
                  onClassTargetChange={(c, v) => setClassDraft((prev) => ({ ...prev, [c]: v }))}
                  onSaveClass={(c) => void saveClass(c)}
                  onRemoveClass={(c) => void removeClass(c)}
                  onSaveAllClasses={() => void saveAllClasses()}
                  onOpenClassDetail={(cls) => setBreakdownGroup({ type: "class", name: cls })}
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
                  storedSectorTargets={storedSectorTargets}
                  positionRows={position.rows}
                  sectorTargetOf={sectorTargetOf}
                  sectorSum={sectorSum}
                  savingSector={savingSector}
                  onSelectSectorClass={(cls) => setSelectedSectorClass(cls)}
                  onNormalizeSectors={handleNormalizeSectors}
                  onDistributeSectorsEqually={handleDistributeSectorsEqually}
                  onResetSectorsZero={handleResetSectorsZero}
                  onSectorTargetChange={(s, v) => setSectorDraft((prev) => ({ ...prev, [s]: v }))}
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
                  activeClassTargetSum={activeClassTargetSum}
                  selectedClassTarget={selectedClassTarget}
                  visibleAssetRows={visibleAssetRows}
                  normalizeLabel={normalizeLabel}
                  distributeLabel={distributeLabel}
                  saved={saved}
                  isPending={saveTargets.isPending}
                  assetSum={assetSum}
                  onAssetClassFilterChange={(cls) => setAssetClassFilter(cls)}
                  onTargetChange={(key, value) => {
                    setError(null);
                    setSaved(false);
                    setAssetDraft((prev) => ({
                      ...prev,
                      [key]: parseTargetInput(Number.isFinite(value) ? String(value) : "0"),
                    }));
                  }}
                  onNormalize={handleNormalize}
                  onNormalizeAll={handleNormalizeAll}
                  onDistributeEqually={handleDistributeEqually}
                  onMirrorPosition={handleMirrorPosition}
                  onResetZero={handleResetZero}
                  onSave={() => void saveAssets()}
                />
              ),
            },
          ]}
        />
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
        rows={position.rows}
        totalPortfolioBRL={position.totalBRL}
        targetPercent={
          breakdownGroup?.type === "class"
            ? classTargetOf(breakdownGroup.name)
            : breakdownGroup?.name
              ? sectorTargetOf(breakdownGroup.name)
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
    </div>
  );
}
