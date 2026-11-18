import { Check, ChevronDown, Users } from "lucide-react";
import { Badge, Button } from "@/components/ui";

export interface ActiveSplitsCollapsedBarProps {
  totalCount: number;
  onExpand: () => void;
}

/** Barra compacta exibida quando todos os rachas do mês estão quitados. */
export function ActiveSplitsCollapsedBar({ totalCount, onExpand }: ActiveSplitsCollapsedBarProps) {
  return (
    <div
      data-tour="active-splits-card"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-3.5 shadow-xs min-w-0"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Users className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            Rachas de Despesa
          </span>
          <Badge variant="positive" size="xs" className="gap-1 font-semibold">
            <Check className="size-3" aria-hidden="true" />
            <span>Todos quitados</span>
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {totalCount} {totalCount === 1 ? "arquivado" : "arquivados"} neste mês
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        sensoryIntent="selection"
        onClick={onExpand}
        className="gap-1.5 shrink-0 text-muted-foreground hover:text-foreground"
      >
        <span>Ver arquivados</span>
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
