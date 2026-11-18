import { RotateCcw } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import type { CalibrationDecision } from "@/domain/insights";

export interface CooldownMemoryItem {
  themeKey: string;
  expiry: number;
  name: string;
  detail?: string;
  formattedDate: string;
}

export interface FeedbackMemoryItem {
  key: string;
  decision: CalibrationDecision | "ignore";
  name: string;
  label: string;
  amountCents?: number;
}

export function CooldownMemoryRow({
  item,
  onReactivate,
}: {
  item: CooldownMemoryItem;
  onReactivate: (themeKey: string, name: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-lg bg-surface-raised/80 hover:bg-surface-hover transition-colors">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
            {item.name}
          </span>
          <Badge variant="muted" size="xs" className="max-w-full truncate">
            Cooldown
          </Badge>
          {item.detail ? (
            <span className="text-[11px] text-muted-foreground">({item.detail})</span>
          ) : null}
        </div>
        <span className="text-[11px] text-muted-foreground">
          Descartado temporariamente até {item.formattedDate}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        sensoryIntent="success"
        onClick={() => onReactivate(item.themeKey, item.name)}
        className="max-sm:min-h-11 text-xs font-medium self-start sm:self-auto shrink-0"
        aria-label={`Reativar monitoramento de ${item.name}`}
        title={`Reativar monitoramento de ${item.name}`}
      >
        <RotateCcw className="size-3.5 mr-1.5" aria-hidden="true" />
        Reativar monitoramento
      </Button>
    </div>
  );
}

export function FeedbackMemoryRow({
  item,
  onReactivate,
}: {
  item: FeedbackMemoryItem;
  onReactivate: (key: string, name: string, decision: string) => void;
}) {
  const badgeVariant =
    item.decision === "already_cancelled" || item.decision === "essential"
      ? "positive"
      : item.decision === "one_off"
        ? "warning"
        : "muted";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-lg bg-surface-raised/80 hover:bg-surface-hover transition-colors">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-xs font-semibold text-foreground line-clamp-2 break-words">
            {item.name}
          </span>
          <Badge variant={badgeVariant} size="xs" className="max-w-full truncate">
            {item.label}
          </Badge>
        </div>
        {item.amountCents !== undefined ? (
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <span>Média estimada:</span>
            <MoneyText
              cents={item.amountCents}
              tone="default"
              className="font-medium text-foreground text-[11px]"
            />
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        sensoryIntent="success"
        onClick={() => onReactivate(item.key, item.name, item.decision)}
        className="max-sm:min-h-11 text-xs font-medium self-start sm:self-auto shrink-0"
        aria-label={`Reativar monitoramento de ${item.name}`}
        title={`Reativar monitoramento de ${item.name}`}
      >
        <RotateCcw className="size-3.5 mr-1.5" aria-hidden="true" />
        Reativar monitoramento
      </Button>
    </div>
  );
}
