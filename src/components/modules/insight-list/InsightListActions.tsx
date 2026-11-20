import { CalendarPlus, Check, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { CalibrationDecision } from "@/domain/insights";
import { QualifiedDismissPopover } from "../qualified-dismiss-popover";

export interface InsightListActionsProps {
  itemKey: string;
  title: string;
  amountCents?: number;
  ignored: boolean;
  confirmed: boolean;
  isEssential: boolean;
  onIgnore?: (key: string) => void;
  onIgnoreWithReason?: (key: string, reason: CalibrationDecision) => void;
  onConfirm?: (key: string) => void;
  onRestore?: (key: string) => void;
  onConvert?: (key: string) => void;
}

export function InsightListActions({
  itemKey,
  title,
  amountCents,
  ignored,
  confirmed,
  isEssential,
  onIgnore,
  onIgnoreWithReason,
  onConfirm,
  onRestore,
  onConvert,
}: InsightListActionsProps) {
  if (ignored) {
    return (
      <div
        className="inline-flex items-center rounded-lg bg-surface-raised/80 p-0.5"
        role="group"
        aria-label={`Ações para ${title}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="action"
          onClick={() => onRestore?.(itemKey)}
          className="h-8 px-2.5 max-sm:min-h-11 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary-strong gap-1.5"
          aria-label={`Restaurar ${title}`}
          title={`Restaurar ${title}`}
        >
          <RotateCcw className="size-3.5 sm:size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Restaurar</span>
        </Button>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-1.5">
        {onConvert ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            sensoryIntent="action"
            onClick={() => onConvert(itemKey)}
            className="h-8 px-2.5 max-sm:min-h-11 text-xs font-medium gap-1.5"
            aria-label={`Fixar ${title} como Recorrência Formal`}
            title={`Fixar ${title} como Recorrência Formal`}
          >
            <CalendarPlus className="size-3.5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Fixar formal</span>
          </Button>
        ) : null}
        <div
          className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 p-0.5"
          role="group"
          aria-label={`Ações para ${title}`}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="action"
            onClick={() => onRestore?.(itemKey)}
            className="h-8 px-2.5 max-sm:min-h-11 text-xs font-medium text-primary-strong hover:bg-primary/20 hover:text-primary-strong gap-1.5"
            aria-label={`Confirmada (${title}) — clique para desmarcar`}
            title={`Confirmada (${title}) — clique para desmarcar`}
          >
            <Check className="size-3.5 animate-spring-pop sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Confirmada</span>
          </Button>
        </div>
      </div>
    );
  }

  if (isEssential) {
    return (
      <div
        className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 p-0.5"
        role="group"
        aria-label={`Ações para ${title}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          sensoryIntent="action"
          onClick={() => onRestore?.(itemKey)}
          className="h-8 px-2.5 max-sm:min-h-11 text-xs font-medium text-primary-strong hover:bg-primary/20 hover:text-primary-strong gap-1.5"
          aria-label={`Essencial (${title}) — clique para desmarcar`}
          title={`Essencial (${title}) — clique para desmarcar`}
        >
          <ShieldCheck className="size-3.5 animate-spring-pop sm:size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Essencial</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg bg-surface-raised/80 p-0.5"
      role="group"
      aria-label={`Ações para ${title}`}
    >
      <QualifiedDismissPopover
        occurrenceName={title}
        averageCents={amountCents}
        onSelectReason={(reason) => {
          if (onIgnoreWithReason) {
            onIgnoreWithReason(itemKey, reason);
          } else {
            onIgnore?.(itemKey);
          }
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          sensoryIntent="selection"
          className="size-8 max-sm:min-h-11 max-sm:min-w-11 text-muted-foreground hover:bg-negative/10 hover:text-negative-strong"
          aria-label={`Ignorar ${title}`}
          title={`Ignorar ${title}`}
        >
          <X className="size-3.5 sm:size-4" aria-hidden="true" />
        </Button>
      </QualifiedDismissPopover>
      <span className="h-3.5 w-px bg-border/60" aria-hidden="true" />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        sensoryIntent="success"
        onClick={() => onConfirm?.(itemKey)}
        className="size-8 max-sm:min-h-11 max-sm:min-w-11 text-muted-foreground hover:bg-positive/10 hover:text-positive-strong"
        aria-label={`Confirmar ${title}`}
        title={`Confirmar ${title}`}
      >
        <Check className="size-3.5 sm:size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
