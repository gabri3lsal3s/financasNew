import { useEffect, useRef, useState } from "react";
import { Equal, RotateCcw, Save, Scale, Trash2 } from "lucide-react";
import { Alert, Button, EmptyState, NumberStepperInput, Progress, SkeletonList, SkeletonTable, Tabs } from "@/components/ui";
import { PresetSelectorBar, SavePresetDialog, TargetEditor } from "@/components/modules";
import {
  SYSTEM_PRESET_TEMPLATES,
  applyPresetToPosition,
  createPresetSnapshot,
  distributeEquallyTargets,
  mirrorCurrentPositionTargets,
  normalizeAllocationTargets,
  parseTargetInput,
  validateTargetsSum,
} from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { cn } from "@/lib/utils";
import {
  useAllocationPresets,
  useAllocationTargets,
  useCreateAllocationPreset,
  useDeleteAllocationPreset,
  useGroupTargets,
  usePortfolioPosition,
  useRemoveGroupTarget,
  useSaveAllocationTargets,
  useSaveGroupTarget,
  useUpdateAllocationPreset,
} from "@/state";

/**
 * Metas de alocação (§3.11.1 e §F39) — edição em lote por ativo com barra de soma
 * (≤ 100%, validada na UI e no banco via RPC), normalização em 1-clique contextual,
 * distribuição 1/N, espelhamento da carteira real, metas por classe, cenários estratégicos (presets)
 * e travas setoriais.
 */
export function TargetsTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const presetsQuery = useAllocationPresets();

  const saveTargets = useSaveAllocationTargets();
  const saveClassTarget = useSaveGroupTarget("class");
  const removeClassTarget = useRemoveGroupTarget("class");

  const createPreset = useCreateAllocationPreset();
  const updatePreset = useUpdateAllocationPreset();
  const deletePreset = useDeleteAllocationPreset();

  // Metas por ativo: edições locais sobrepõem o que veio do banco.
  const [assetDraft, setAssetDraft] = useState<Record<string, number>>({});
  const [classDraft, setClassDraft] = useState<Record<string, number>>({});
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>("official");
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [savingClass, setSavingClass] = useState<string | null>(null);
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

  const assetTargetOf = (assetId: string) => assetDraft[assetId] ?? storedAssetTargets.get(assetId) ?? 0;
  const classTargetOf = (className: string) => classDraft[className] ?? storedClassTargets.get(className) ?? 0;

  const [assetClassFilter, setAssetClassFilter] = useState<string | null>(null);

  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

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
      const items = visibleAssetRows.map((r) => ({ id: r.key, currentPct: r.currentPct ?? 0 }));
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
      // Feedback de escrita uniforme (F15) — mesmo padrão das demais ações.
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
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading;
  const loadError = position.error ?? targetsQuery.error ?? classTargetsQuery.error;

  const classRows = classes.map((c) => ({ key: c, label: c, target: classTargetOf(c) }));
  const classSum = validateTargetsSum(classRows.map((r) => ({ target: r.target })));

  const handleNormalizeClasses = () => {
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
    const nextDraft: Record<string, number> = {};
    classes.forEach((c) => {
      nextDraft[c] = 0;
    });
    setClassDraft((prev) => ({ ...prev, ...nextDraft }));
    triggerSensory("selection");
  };

  const saveAllClasses = async () => {
    setError(null);
    setSavingClass("all");
    try {
      for (const className of classes) {
        await saveClassTarget.mutateAsync({ name: className, target: classTargetOf(className) });
      }
      triggerSensory("success");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers de Cenários (Presets)
  // -------------------------------------------------------------------------
  const isUserPreset = selectedPresetId?.startsWith("user_") ?? false;
  const isSysPreset = selectedPresetId?.startsWith("sys_") ?? false;
  const rawUserPresetId = isUserPreset ? selectedPresetId!.replace("user_", "") : null;
  const rawSysPresetId = isSysPreset ? selectedPresetId!.replace("sys_", "") : null;

  const currentActiveUserPreset = rawUserPresetId
    ? (presetsQuery.data ?? []).find((p) => p.id === rawUserPresetId) ?? null
    : null;

  const currentActiveSysPreset = rawSysPresetId
    ? SYSTEM_PRESET_TEMPLATES.find((s) => s.id === rawSysPresetId || s.id === selectedPresetId) ?? null
    : null;

  const activePresetName = currentActiveUserPreset?.name ?? currentActiveSysPreset?.name ?? null;
  const activePresetDescription = currentActiveUserPreset?.description ?? currentActiveSysPreset?.description ?? null;
  const isSimulating = selectedPresetId !== null && selectedPresetId !== "official";

  const handleSelectPreset = (presetId: string) => {
    setError(null);
    setSaved(false);

    if (presetId === "official") {
      setSelectedPresetId("official");
      setAssetDraft({});
      setClassDraft({});
      triggerSensory("selection");
      return;
    }

    if (presetId.startsWith("sys_")) {
      const rawId = presetId.replace("sys_", "");
      const template = SYSTEM_PRESET_TEMPLATES.find((t) => t.id === rawId || t.id === presetId);
      if (template) {
        const applied = applyPresetToPosition(template, position.rows);
        setAssetDraft(applied.assetDraft);
        setClassDraft(applied.classDraft);
        setSelectedPresetId(presetId);
        triggerSensory("selection");
      }
      return;
    }

    if (presetId.startsWith("user_")) {
      const rawId = presetId.replace("user_", "");
      const preset = (presetsQuery.data ?? []).find((p) => p.id === rawId);
      if (preset) {
        const applied = applyPresetToPosition(preset, position.rows);
        setAssetDraft(applied.assetDraft);
        setClassDraft(applied.classDraft);
        setSelectedPresetId(presetId);
        triggerSensory("selection");
      }
    }
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

    const created = await createPreset.mutateAsync(snapshot);
    setSelectedPresetId(`user_${created.id}`);
    triggerSensory("success");
    pushToast({
      title: "Cenário salvo",
      description: `O cenário "${name}" foi salvo com sucesso.`,
      variant: "success",
    });
  };

  const handleOverwritePreset = async () => {
    if (!currentActiveUserPreset) return;
    setError(null);
    try {
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

      await updatePreset.mutateAsync({ id: currentActiveUserPreset.id, input: snapshot });
      triggerSensory("success");
      pushToast({
        title: "Cenário atualizado",
        description: `O cenário "${currentActiveUserPreset.name}" foi atualizado com as metas atuais.`,
        variant: "success",
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDeletePreset = async (id: string) => {
    setError(null);
    try {
      await deletePreset.mutateAsync(id);
      setSelectedPresetId("official");
      setAssetDraft({});
      setClassDraft({});
      triggerSensory("success");
      pushToast({
        title: "Cenário excluído",
        description: "O cenário de metas foi removido.",
        variant: "default",
      });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleResetToOfficial = () => {
    setSelectedPresetId("official");
    setAssetDraft({});
    setClassDraft({});
    setError(null);
    triggerSensory("selection");
  };

  const [subTab, setSubTab] = useState<"classes" | "assets">("classes");

  return (
    <div className="flex flex-col gap-6">
      {loadError ? <Alert variant="error">{getErrorMessage(loadError)}</Alert> : null}
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
          onValueChange={(val: string) => setSubTab(val as "classes" | "assets")}
          variant="pills"
          items={[
            {
              value: "classes",
              label: "Classes",
              content: (
                <div className="flex flex-col gap-6">
                  {classes.length > 0 ? (
                    <section aria-label="Metas por classe" className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between min-w-0">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground truncate">Metas por classe de ativo</h3>
                          <p className="text-xs text-muted-foreground">Defina a alocação macro ideal entre os tipos de investimentos.</p>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono font-medium">
                          {classes.length} {classes.length === 1 ? "classe" : "classes"}
                        </span>
                      </div>

                      {/* Barra de Progresso e Validação da Soma de Classes */}
                      <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface/70 p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">Soma das metas de classes</span>
                          <span className={cn("num font-bold", classSum.error ? "text-critical" : classSum.sum > 0 ? "text-foreground" : "")}>
                            {classSum.sum.toFixed(1)}% / 100%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, Math.max(0, classSum.sum))}
                          tone={classSum.error ? "critical" : "auto"}
                          aria-label={`Soma das classes: ${classSum.sum.toFixed(1)}%`}
                        />
                        {classSum.error ? <p className="text-xs text-critical font-medium">{classSum.error}</p> : null}
                        {classSum.error === null && classSum.sum < 100 ? (
                          <p className="text-xs text-muted-foreground">
                            Sobram {(100 - classSum.sum).toFixed(1)}% para caixa/reserva ou outras classes.
                          </p>
                        ) : null}
                      </div>

                      {/* Ações Rápidas de Classes */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleNormalizeClasses}
                          disabled={savingClass !== null}
                          className="gap-1.5 text-xs"
                        >
                          <Scale className="size-3.5 shrink-0" aria-hidden="true" />
                          Normalizar classes para 100%
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDistributeClassesEqually}
                          disabled={savingClass !== null}
                          className="gap-1.5 text-xs"
                        >
                          <Equal className="size-3.5 shrink-0" aria-hidden="true" />
                          Distribuir igualmente (1/N)
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleResetClassesZero}
                          disabled={savingClass !== null}
                          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
                          Zerar classes
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2 min-w-0">
                        {classes.map((className) => {
                          const target = classTargetOf(className);
                          const savedTarget = storedClassTargets.get(className) ?? 0;
                          return (
                            <div key={className} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface-hover/30 p-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                              <div className="flex min-w-0 flex-1 flex-col">
                                <p className="truncate text-sm font-medium text-foreground">{className}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {position.rows.filter((r) => r.assetClass === className).length} ativo(s)
                                </p>
                              </div>
                              <div className="flex w-full items-center gap-2 sm:w-auto">
                                <div className="flex flex-1 items-center gap-2 sm:w-52 sm:flex-none min-w-0">
                                  <NumberStepperInput
                                    value={target}
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    ariaLabel={`Meta da classe ${className} em %`}
                                    onValueChange={(next) =>
                                      setClassDraft((prev) => ({
                                        ...prev,
                                        [className]: parseTargetInput(next),
                                      }))
                                    }
                                    className="flex-1 min-w-0 [&_input]:text-right"
                                  />
                                  <span className="shrink-0 text-sm font-semibold text-muted-foreground select-none">%</span>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={target > 0 ? "secondary" : "outline"}
                                    disabled={savingClass === className || savingClass === "all"}
                                    onClick={() => void saveClass(className)}
                                  >
                                    {savingClass === className ? "Salvando…" : "Salvar"}
                                  </Button>
                                  {savedTarget > 0 ? (
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Remover meta da classe ${className}`}
                                      disabled={savingClass === className || savingClass === "all"}
                                      onClick={() => void removeClass(className)}
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Botão de Salvar Todas as Classes */}
                      <div className="flex items-center justify-end pt-2">
                        <Button
                          type="button"
                          onClick={() => void saveAllClasses()}
                          disabled={savingClass !== null || classSum.error !== null}
                        >
                          {savingClass === "all" ? "Salvando todas…" : "Salvar todas as classes"}
                        </Button>
                      </div>
                    </section>
                  ) : null}
                </div>
              ),
            },
            {
              value: "assets",
              label: "Ativos",
              content: (
                <div className="flex flex-col gap-4">
                  {classes.length > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAssetClassFilter(null);
                            triggerSensory("selection");
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                            assetClassFilter === null
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Todas as classes
                        </button>
                        {classes.map((cls) => (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => {
                              setAssetClassFilter((prev) => (prev === cls ? null : cls));
                              triggerSensory("selection");
                            }}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                              assetClassFilter === cls
                                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                : "bg-surface-hover/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>

                      {activeClassTargetSum !== null ? (
                        <span className="text-xs text-muted-foreground">
                          Soma {assetClassFilter}: <strong className="text-foreground">{activeClassTargetSum.toFixed(1)}%</strong>
                          {selectedClassTarget !== null ? (
                            <span className="ml-1 text-muted-foreground">/ meta {selectedClassTarget.toFixed(1)}%</span>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <TargetEditor
                    rows={visibleAssetRows}
                    heading="Metas por ativo (% do patrimônio)"
                    onTargetChange={(key, value) => {
                      setError(null);
                      setSaved(false);
                      setAssetDraft((prev) => ({ ...prev, [key]: parseTargetInput(Number.isFinite(value) ? String(value) : "0") }));
                    }}
                    onNormalize={handleNormalize}
                    normalizeLabel={normalizeLabel}
                    onNormalizeAll={handleNormalizeAll}
                    onDistributeEqually={handleDistributeEqually}
                    distributeLabel={distributeLabel}
                    onMirrorPosition={handleMirrorPosition}
                    onResetZero={handleResetZero}
                    onSave={() => void saveAssets()}
                    saving={saveTargets.isPending}
                    saveLabel={saved ? "Metas salvas" : "Salvar metas por ativo"}
                    sumPercent={assetSum.sum}
                    sumError={assetSum.error}
                    emptyMessage={assetClassFilter ? `Nenhum ativo na classe ${assetClassFilter}.` : "Nenhum ativo na carteira."}
                  />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
