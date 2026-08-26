import { useState } from "react";
import { Equal, RotateCcw, Scale, Trash2 } from "lucide-react";
import { Button, NumberStepperInput } from "@/components/ui";
import { InteractiveTargetDonut, type TargetDonutItem } from "@/components/modules";
import { parseTargetInput } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import type { PortfolioPositionRow } from "@/state";

export interface TargetClassesCardProps {
  classes: string[];
  classTargetOf: (className: string) => number;
  storedClassTargets: Map<string, number>;
  positionRows: PortfolioPositionRow[];
  classSum: { sum: number; error: string | null };
  savingClass: string | null;
  onNormalizeClasses: () => void;
  onDistributeClassesEqually: () => void;
  onResetClassesZero: () => void;
  onClassTargetChange: (className: string, val: number) => void;
  onSaveClass: (className: string) => void;
  onRemoveClass: (className: string) => void;
  onSaveAllClasses: () => void;
}

export function TargetClassesCard({
  classes,
  classTargetOf,
  storedClassTargets,
  positionRows,
  classSum,
  savingClass,
  onNormalizeClasses,
  onDistributeClassesEqually,
  onResetClassesZero,
  onClassTargetChange,
  onSaveClass,
  onRemoveClass,
  onSaveAllClasses,
}: TargetClassesCardProps) {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  if (classes.length === 0) return null;

  const donutItems: TargetDonutItem[] = classes.map((className) => ({
    key: className,
    label: className,
    targetPercent: classTargetOf(className),
    countAssets: positionRows.filter((r) => r.assetClass === className).length,
  }));

  return (
    <section
      aria-label="Metas por classe"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-border min-w-0 overflow-hidden"
    >
      <div className="flex items-center justify-between min-w-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground truncate">Metas por classe de ativo</h3>
          <p className="text-xs text-muted-foreground">
            Defina a alocação macro ideal (% do patrimônio total) entre as classes.
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono font-medium">
          {classes.length} {classes.length === 1 ? "classe" : "classes"}
        </span>
      </div>

      {/* Donut Interativo de Metas de Classes */}
      <InteractiveTargetDonut
        title="Alocação por Classe"
        items={donutItems}
        selectedKey={selectedClass}
        onSelectKey={setSelectedClass}
        onChangeTarget={(className, nextTarget) => onClassTargetChange(className, nextTarget)}
        totalCeiling={100}
        disabled={savingClass !== null}
      />

      {/* Validação de Erro da Soma de Classes */}
      {classSum.error ? (
        <div className="rounded-xl border border-critical/40 bg-critical/10 p-3 text-xs text-critical font-medium">
          {classSum.error}
        </div>
      ) : null}

      {/* Ações Rápidas de Classes */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNormalizeClasses}
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
          onClick={onDistributeClassesEqually}
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
          onClick={onResetClassesZero}
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
          const isSelected = selectedClass === className;
          return (
            <div
              key={className}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between min-w-0 transition-all",
                isSelected
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                  : "border-border/60 bg-surface-hover/30 hover:border-border/80",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col cursor-pointer" onClick={() => setSelectedClass(isSelected ? null : className)}>
                <p className="truncate text-sm font-medium text-foreground">{className}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {positionRows.filter((r) => r.assetClass === className).length} ativo(s)
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div
                  className="flex flex-1 items-center gap-2 sm:w-52 sm:flex-none min-w-0"
                  onFocusCapture={() => setSelectedClass(className)}
                >
                  <NumberStepperInput
                    value={target}
                    min={0}
                    max={100}
                    step={0.5}
                    ariaLabel={`Meta da classe ${className} em %`}
                    onValueChange={(next) => onClassTargetChange(className, parseTargetInput(next))}
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
                    onClick={() => onSaveClass(className)}
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
                      onClick={() => onRemoveClass(className)}
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
          onClick={onSaveAllClasses}
          disabled={savingClass !== null || classSum.error !== null}
        >
          {savingClass === "all" ? "Salvando todas…" : "Salvar todas as classes"}
        </Button>
      </div>
    </section>
  );
}
