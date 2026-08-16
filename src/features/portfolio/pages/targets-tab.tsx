import { useEffect, useRef, useState } from "react";
import { Save, Shield, Trash2 } from "lucide-react";
import { Alert, Button, EmptyState, NumberStepperInput, SkeletonList, SkeletonTable } from "@/components/ui";
import { TargetEditor } from "@/components/modules";
import { parseTargetInput, validateTargetsSum } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { playSound } from "@/services/audio-fx";
import { formatCentsAsBRL } from "@/services/masks";
import { getErrorMessage } from "@/services/errors";
import { triggerHaptic } from "@/services/haptics";
import {
  useAllocationTargets,
  useGroupTargets,
  usePortfolioPosition,
  useRemoveGroupTarget,
  useSaveAllocationTargets,
  useSaveGroupTarget,
  useSectorCaps,
  useUpdateSectorCaps,
} from "@/state";

/**
 * Metas de alocação (§3.11.1) — edição em lote por ativo com barra de soma
 * (≤ 100%, validada na UI e no banco via RPC), metas por classe e travas
 * setoriais (max_sector_acoes / max_sector_fiis).
 */
export function TargetsTab({ onGoToPosition }: { onGoToPosition?: () => void }) {
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const capsQuery = useSectorCaps();

  const saveTargets = useSaveAllocationTargets();
  const saveClassTarget = useSaveGroupTarget("class");
  const removeClassTarget = useRemoveGroupTarget("class");
  const updateCaps = useUpdateSectorCaps();

  // Metas por ativo: edições locais sobrepõem o que veio do banco.
  const [assetDraft, setAssetDraft] = useState<Record<string, number>>({});
  const [classDraft, setClassDraft] = useState<Record<string, number>>({});
  const [capsDraft, setCapsDraft] = useState<{ acoes: string; fiis: string }>({ acoes: "", fiis: "" });
  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
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

  const assetRows = position.rows.map((row) => ({
    key: row.assetId,
    label: row.ticker,
    detail: `${formatCentsAsBRL(numberToCents(row.valueBRL))} · ${row.pct.toFixed(1)}% hoje`,
    target: assetTargetOf(row.assetId),
  }));

  const assetSum = validateTargetsSum(assetRows.map((r) => ({ target: r.target })));

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
      triggerHaptic("success");
      playSound("success", getVisualCustomization().soundEnabled);
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
      triggerHaptic("success");
      playSound("success", getVisualCustomization().soundEnabled);
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
      triggerHaptic("success");
      playSound("success", getVisualCustomization().soundEnabled);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingClass(null);
    }
  };

  const saveCaps = async () => {
    setCapsError(null);
    try {
      const parseCap = (raw: string) => {
        if (raw.trim() === "") return null;
        const value = Number(raw.replace(",", "."));
        return Number.isFinite(value) && value > 0 ? Math.min(100, value) : null;
      };
      await updateCaps.mutateAsync({
        maxSectorAcoes: parseCap(capsDraft.acoes),
        maxSectorFiis: parseCap(capsDraft.fiis),
      });
      triggerHaptic("success");
      playSound("success", getVisualCustomization().soundEnabled);
    } catch (err) {
      setCapsError(getErrorMessage(err));
    }
  };

  const loading = position.isLoading || targetsQuery.isLoading || classTargetsQuery.isLoading || capsQuery.isLoading;
  const loadError = position.error ?? targetsQuery.error ?? classTargetsQuery.error ?? capsQuery.error;

  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  const capsDefaults = capsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {loadError ? <Alert variant="error">{getErrorMessage(loadError)}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <SkeletonList rows={4} />
          <SkeletonTable rows={3} />
        </div>
      ) : position.rows.length === 0 ? (
        <EmptyState
          icon={<Save className="size-6" aria-hidden="true" />}
          title="Sem ativos para definir metas"
          description="Adicione ativos na aba Posição para definir as metas de alocação."
          tone="portfolio"
          headingLevel="h2"
          action={
            onGoToPosition ? (
              <Button type="button" onClick={onGoToPosition}>
                Ir para Posição
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TargetEditor
          rows={assetRows}
          heading="Metas por ativo (% do patrimônio)"
          onTargetChange={(key, value) =>
            setAssetDraft((prev) => ({ ...prev, [key]: parseTargetInput(Number.isFinite(value) ? String(value) : "0") }))
          }
          onSave={() => void saveAssets()}
          saving={saveTargets.isPending}
          saveLabel={saved ? "Metas salvas" : "Salvar metas por ativo"}
          sumPercent={assetSum.sum}
          sumError={assetSum.error}
          emptyMessage="Nenhum ativo na carteira."
        />
      )}

      {classes.length > 0 ? (
        <section aria-label="Metas por classe" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Metas por classe</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Usadas pela calculadora no modo por meta de classe. A meta da classe é distribuída
              proporcionalmente ao valor atual dos ativos.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {classes.map((className) => {
              const target = classTargetOf(className);
              const savedTarget = storedClassTargets.get(className) ?? 0;
              return (
                /* F28 — mobile: nome e controles empilham (sem overflow); sm+ em linha. */
                <div key={className} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <p className="truncate text-sm font-medium text-foreground">{className}</p>
                    <p className="text-xs text-muted-foreground">
                      {position.rows.filter((r) => r.assetClass === className).length} ativo(s)
                    </p>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="flex flex-1 items-center gap-2 sm:w-44 sm:flex-none">
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
                        className="[&_input]:text-right"
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">%</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={target > 0 ? "secondary" : "outline"}
                        disabled={savingClass === className}
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
                          disabled={savingClass === className}
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
        </section>
      ) : null}

      <section aria-label="Travas setoriais" className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio">
            <Shield className="size-3.5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Travas setoriais</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Teto de exposição (% do patrimônio) para as classes Ações e FIIs. A calculadora de
              aporte nunca aloca acima do teto (§3.11.3.5).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Máx. Ações (%)
            <NumberStepperInput
              value={capsDraft.acoes !== "" ? capsDraft.acoes : capsDefaults?.maxSectorAcoes ?? ""}
              min={0}
              max={100}
              step={1}
              placeholder="Sem trava"
              ariaLabel="Teto de exposição para Ações"
              onValueChange={(next) => setCapsDraft((prev) => ({ ...prev, acoes: next }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Máx. FIIs (%)
            <NumberStepperInput
              value={capsDraft.fiis !== "" ? capsDraft.fiis : capsDefaults?.maxSectorFiis ?? ""}
              min={0}
              max={100}
              step={1}
              placeholder="Sem trava"
              ariaLabel="Teto de exposição para FIIs"
              onValueChange={(next) => setCapsDraft((prev) => ({ ...prev, fiis: next }))}
            />
          </label>
        </div>
        {capsError ? <Alert variant="error">{capsError}</Alert> : null}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void saveCaps()} disabled={updateCaps.isPending}>
            {updateCaps.isPending ? "Salvando…" : "Salvar travas"}
          </Button>
        </div>
      </section>
    </div>
  );
}
