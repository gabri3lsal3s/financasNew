import { useId } from "react";
import { CheckCircle2, Shield, Sparkles } from "lucide-react";
import { Badge, Button, Checkbox, MoneyText } from "@/components/ui";
import type { PortfolioPositionRowLike } from "@/domain/projection";
import type { EmergencySelectionMode } from "@/types";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import { EMERGENCY_SELECTION_MODES } from "./emergency-fund-constants";

export interface EmergencyAssetsSelectorListProps {
  selectionMode: EmergencySelectionMode;
  onSelectMode: (mode: EmergencySelectionMode) => void;
  portfolioRows: PortfolioPositionRowLike[];
  selectedAssetIds: string[];
  onToggleAsset: (assetId: string) => void;
  availableClasses: string[];
  selectedClasses: string[];
  onToggleClass: (className: string) => void;
  useNetValue: boolean;
  onSuggestReserveAssets: () => void;
  onSelectAllAssets: () => void;
  onClearAssets: () => void;
}

export function EmergencyAssetsSelectorList({
  selectionMode,
  onSelectMode,
  portfolioRows,
  selectedAssetIds,
  onToggleAsset,
  availableClasses,
  selectedClasses,
  onToggleClass,
  useNetValue,
  onSuggestReserveAssets,
  onSelectAllAssets,
  onClearAssets,
}: EmergencyAssetsSelectorListProps) {
  const baseId = useId();
  const eligibleRows = portfolioRows.filter((r) => r.quantity > 0 && (r.valueBRL ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Investimentos na Reserva</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {EMERGENCY_SELECTION_MODES.map((mode) => {
          const isSelected = selectionMode === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => {
                triggerSensory("selection");
                onSelectMode(mode.value);
              }}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col text-left p-3 rounded-lg border transition-all min-w-0 cursor-pointer",
                isSelected ? "border-primary bg-primary/5 shadow-xs" : "border-border/80 hover:bg-surface-hover hover:border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-xs font-semibold", isSelected ? "text-primary-strong" : "text-foreground")}>
                  {mode.title}
                </span>
                {isSelected && <CheckCircle2 className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{mode.description}</span>
            </button>
          );
        })}
      </div>

      {selectionMode === "selected_assets" && (
        <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-border/80">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Selecione os Ativos da Carteira ({selectedAssetIds.length} selecionado{selectedAssetIds.length === 1 ? "" : "s"}):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button type="button" variant="ghost" size="sm" onClick={onSuggestReserveAssets} className="text-primary-strong hover:text-primary-strong gap-1">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Sugerir Liquidez Diária</span>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onSelectAllAssets} className="text-muted-foreground">
                Marcar Todos
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClearAssets} className="text-muted-foreground">
                Limpar
              </Button>
            </div>
          </div>

          {eligibleRows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Nenhum ativo com saldo em custódia encontrado na carteira.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {eligibleRows.map((row) => {
                const checkboxId = `${baseId}-asset-${row.assetId}`;
                const isChecked = selectedAssetIds.includes(row.assetId);
                const isLikely = row.isCash || /SELIC|CDI|LFT/i.test(row.ticker);
                const netVal = row.netValueBRL ?? row.valueBRL ?? 0;

                return (
                  <div
                    key={row.assetId}
                    className={cn(
                      "flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors text-xs",
                      isChecked ? "border-primary/50 bg-primary/5" : "border-border/80 hover:bg-surface-hover",
                    )}
                  >
                    <Checkbox id={checkboxId} checked={isChecked} onCheckedChange={() => onToggleAsset(row.assetId)} aria-label={`Selecionar ${row.ticker}`} />
                    <label htmlFor={checkboxId} className="flex flex-1 items-center justify-between gap-3 cursor-pointer min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-semibold text-foreground truncate">{row.ticker}</span>
                        {row.assetClass && <Badge variant="muted" size="xs">{row.assetClass}</Badge>}
                        {isLikely && <Badge variant="positive" size="xs">Liquidez Diária</Badge>}
                        {row.isMatured && <Badge variant="warning" size="xs">Vencido</Badge>}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <MoneyText cents={Math.round(netVal * 100)} tone={isChecked ? "positive" : "default"} className="font-semibold" />
                        {useNetValue && row.netValueBRL && row.valueBRL && row.netValueBRL !== row.valueBRL && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            Bruto: <MoneyText cents={Math.round(row.valueBRL * 100)} tone="default" variant="caption" />
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectionMode === "selected_classes" && (
        <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-border/80">
          <span className="text-xs font-semibold text-foreground">Selecione as Classes que Pertencem à Reserva:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableClasses.map((cls) => {
              const checkboxId = `${baseId}-class-${cls}`;
              const isChecked = selectedClasses.some((c) => c.trim().toLowerCase() === cls.trim().toLowerCase());
              return (
                <div
                  key={cls}
                  className={cn(
                    "flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors text-xs",
                    isChecked ? "border-primary/50 bg-primary/5" : "border-border/80 hover:bg-surface-hover",
                  )}
                >
                  <label htmlFor={checkboxId} className="flex-1 cursor-pointer font-medium text-foreground select-none">{cls}</label>
                  <Checkbox id={checkboxId} checked={isChecked} onCheckedChange={() => onToggleClass(cls)} aria-label={`Selecionar classe ${cls}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
