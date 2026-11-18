import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, NumberStepperInput } from "@/components/ui";
import { parseTargetInput } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface TargetDistributionRowProps {
  name: string;
  target: number;
  savedTarget: number;
  currentPct: number;
  currentSuffix?: string;
  secondaryPctText?: string;
  membersCount: number;
  isSelected: boolean;
  isSavingRow: boolean;
  isSavingAny: boolean;
  stepperAriaLabel: string;
  detailAriaLabel: string;
  detailIcon?: ReactNode;
  onSelectToggle: () => void;
  onFocusSelect: () => void;
  onTargetChange: (next: number) => void;
  onSave: () => void;
  onRemove: () => void;
  onOpenDetail?: () => void;
}

export function TargetDistributionRow({
  name,
  target,
  savedTarget,
  currentPct,
  currentSuffix,
  secondaryPctText,
  membersCount,
  isSelected,
  isSavingRow,
  isSavingAny,
  stepperAriaLabel,
  detailAriaLabel,
  detailIcon,
  onSelectToggle,
  onFocusSelect,
  onTargetChange,
  onSave,
  onRemove,
  onOpenDetail,
}: TargetDistributionRowProps) {
  const gap = target - currentPct;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between min-w-0 transition-colors",
        isSelected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30 shadow-xs"
          : "border-border/80 bg-surface-raised/30",
      )}
    >
      <div
        className="flex min-w-0 flex-1 flex-col gap-1 cursor-pointer"
        onClick={onSelectToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          {onOpenDetail && detailIcon ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              sensoryIntent="selection"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              className="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
              title={detailAriaLabel}
              aria-label={detailAriaLabel}
            >
              {detailIcon}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-mono text-muted-foreground tabular-nums">
            Atual: <strong className="text-foreground font-semibold">{currentPct.toFixed(1)}%</strong>
            {currentSuffix ? ` ${currentSuffix}` : ""}
            {secondaryPctText ? (
              <span className="text-muted-foreground font-normal"> ({secondaryPctText})</span>
            ) : null}
          </span>
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            Meta: <strong className="text-foreground font-semibold">{target.toFixed(1)}%</strong>
          </span>
          {target > 0 ? (
            <Badge variant={gap > 0 ? "positive" : "muted"} size="xs" className="font-mono">
              {gap > 0 ? `+${gap.toFixed(1)}% (Aporte)` : `${gap.toFixed(1)}% (Acima)`}
            </Badge>
          ) : null}
          <span className="text-muted-foreground" aria-hidden="true">
            ·
          </span>
          <span className="text-muted-foreground">{membersCount} ativo(s)</span>
        </div>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div
          className="flex flex-1 items-center gap-2 sm:w-52 sm:flex-none min-w-0"
          onFocusCapture={onFocusSelect}
        >
          <NumberStepperInput
            value={target}
            min={0}
            max={100}
            step={0.5}
            ariaLabel={stepperAriaLabel}
            onValueChange={(next) => onTargetChange(parseTargetInput(next))}
            className="flex-1 min-w-0 [&_input]:text-right"
          />
          <span className="shrink-0 text-sm font-semibold text-muted-foreground select-none">%</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant={target > 0 ? "secondary" : "outline"}
            disabled={isSavingRow || isSavingAny}
            onClick={onSave}
          >
            {isSavingRow ? "Salvando…" : "Salvar"}
          </Button>
          {savedTarget > 0 ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              sensoryIntent="destructive"
              aria-label={`Remover meta de ${name}`}
              disabled={isSavingRow || isSavingAny}
              onClick={onRemove}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
