import { useState } from "react";
import { AlertTriangle, Layers, PieChart, Sparkles, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface AporteReasonBadgeProps {
  ticker: string;
  reasonKind?: "class_deficit" | "sector_deficit" | "asset_conviction";
  reasonLabel?: string;
  reasonDescription?: string;
  hasQualityConflict?: boolean;
  qualityConflictDetail?: string;
  rawScore?: number | null;
  onInspect?: () => void;
  className?: string;
}

export function AporteReasonBadge({
  ticker,
  reasonKind = "class_deficit",
  reasonLabel,
  reasonDescription,
  hasQualityConflict = false,
  qualityConflictDetail,
  rawScore,
  onInspect,
  className,
}: AporteReasonBadgeProps) {
  const [open, setOpen] = useState(false);

  const displayLabel = reasonLabel || (
    hasQualityConflict
      ? "Puxado por Setor"
      : reasonKind === "asset_conviction"
        ? "Destaque por Nota"
        : reasonKind === "sector_deficit"
          ? "Defasagem de Setor"
          : "Defasagem de Classe"
  );

  const badgeVariant: "warning" | "positive" | "default" | "muted" = hasQualityConflict
    ? "warning"
    : reasonKind === "asset_conviction"
      ? "positive"
      : reasonKind === "sector_deficit"
        ? "default"
        : "muted";

  const IconComponent = hasQualityConflict
    ? AlertTriangle
    : reasonKind === "asset_conviction"
      ? Sparkles
      : reasonKind === "sector_deficit"
        ? Layers
        : PieChart;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ver motivo da sugestão de ${ticker}: ${displayLabel}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left",
            className,
          )}
        >
          <Badge
            variant={badgeVariant}
            size="xs"
            className={cn(
              "gap-1 font-medium max-w-full truncate cursor-pointer",
              hasQualityConflict && "border-warning/40 bg-warning/15 text-warning-strong",
            )}
          >
            <IconComponent className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{displayLabel}</span>
          </Badge>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-3.5 flex flex-col gap-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md border mt-0.5",
              hasQualityConflict
                ? "bg-warning/15 border-warning/30 text-warning-strong"
                : reasonKind === "asset_conviction"
                  ? "bg-positive/10 border-positive/30 text-positive-strong"
                  : "bg-surface-raised border-border/80 text-muted-foreground",
            )}
          >
            <IconComponent className="size-3.5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground leading-tight">
              {hasQualityConflict ? "Alerta: Qualidade vs. Alocação" : displayLabel}
            </span>
            <span className="text-[11px] text-muted-foreground leading-snug">
              {hasQualityConflict
                ? qualityConflictDetail ||
                  `O ativo possui nota de convicção baixa (${rawScore ?? "Sem nota"}/10) e foi sugerido prioritariamente pela defasagem da classe ou setor por haver poucas alternativas elegíveis.`
                : reasonDescription ||
                  (reasonKind === "asset_conviction"
                    ? `A alta nota de convicção (${rawScore ?? "alta"}/10) priorizou este ativo sobre os pares no setor.`
                    : reasonKind === "sector_deficit"
                      ? "O setor apresenta maior defasagem frente à meta configurada dentro da respectiva classe."
                      : "A classe macro possui déficit na carteira e foi priorizada para estabilização.")}
            </span>
          </div>
        </div>

        {hasQualityConflict && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning-strong leading-tight">
            O algoritmo prioriza a diversificação macro, não a qualidade do papel. Avalie se deseja aportar mesmo assim ou reavaliar o ativo.
          </div>
        )}

        {onInspect && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => {
              setOpen(false);
              onInspect();
            }}
            className="w-full gap-1.5 mt-0.5 text-xs font-medium"
          >
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            <span>Reavaliar tese e nota de {ticker}</span>
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
