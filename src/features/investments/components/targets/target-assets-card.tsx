import { TargetEditor, type TargetEditorRow } from "@/components/modules";
import { triggerSensory } from "@/services/sensory";

export interface TargetAssetsCardProps {
  classes: string[];
  assetClassFilter: string | null;
  activeClassTargetSum: number | null;
  selectedClassTarget: number | null;
  visibleAssetRows: TargetEditorRow[];

  normalizeLabel: string;
  distributeLabel: string;
  saved: boolean;
  isPending: boolean;
  assetSum: { sum: number; error: string | null };
  onAssetClassFilterChange: (cls: string | null) => void;
  onTargetChange: (key: string, value: number) => void;
  onNormalize: () => void;
  onNormalizeAll: () => void;
  onDistributeEqually: () => void;
  onMirrorPosition: () => void;
  onResetZero: () => void;
  onSave: () => void;
}

export function TargetAssetsCard({
  classes,
  assetClassFilter,
  activeClassTargetSum,
  selectedClassTarget,
  visibleAssetRows,
  normalizeLabel,
  distributeLabel,
  saved,
  isPending,
  assetSum,
  onAssetClassFilterChange,
  onTargetChange,
  onNormalize,
  onNormalizeAll,
  onDistributeEqually,
  onMirrorPosition,
  onResetZero,
  onSave,
}: TargetAssetsCardProps) {
  return (
    <div className="flex flex-col gap-4">
      {classes.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onAssetClassFilterChange(null);
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
                  onAssetClassFilterChange(assetClassFilter === cls ? null : cls);
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
        onTargetChange={onTargetChange}
        onNormalize={onNormalize}
        normalizeLabel={normalizeLabel}
        onNormalizeAll={onNormalizeAll}
        onDistributeEqually={onDistributeEqually}
        distributeLabel={distributeLabel}
        onMirrorPosition={onMirrorPosition}
        onResetZero={onResetZero}
        onSave={onSave}
        saving={isPending}
        saveLabel={saved ? "Metas salvas" : "Salvar metas por ativo"}
        sumPercent={assetSum.sum}
        sumError={assetSum.error}
        emptyMessage={assetClassFilter ? `Nenhum ativo na classe ${assetClassFilter}.` : "Nenhum ativo na carteira."}
      />
    </div>
  );
}
