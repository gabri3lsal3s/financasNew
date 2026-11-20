import { Check, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AporteRowActionsProps {
  ticker: string;
  isDone: boolean;
  quantity: number;
  allocatedBRL: number;
  onToggleDone: (ticker: string) => void;
  onOpenWizard?: (ticker: string, quantity: number, allocatedBRL?: number) => void;
  onInspect?: () => void;
  compact?: boolean;
}

/**
 * Ações padronizadas por ativo sugerido (§Fase 3):
 * Atalho para Wizard de Compra, inspeção de tese e marcação sutil de execução (sem pílula pendente agressiva).
 */
export function AporteRowActions({
  ticker,
  isDone,
  quantity,
  allocatedBRL,
  onToggleDone,
  onOpenWizard,
  onInspect,
  compact = false,
}: AporteRowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1.5 shrink-0">
      {onInspect ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onInspect}
          className={cn(
            "size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-surface-raised cursor-pointer",
            compact && "size-7",
          )}
          title={`Inspecionar tese e nota de ${ticker}`}
          aria-label={`Inspecionar tese e nota de ${ticker}`}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Inspecionar tese</span>
        </Button>
      ) : null}

      {onOpenWizard ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenWizard(ticker, quantity, allocatedBRL)}
          className={cn(
            "px-2.5 text-xs gap-1 font-medium text-foreground cursor-pointer h-7",
            compact && "px-2 text-[11px] h-6",
          )}
          title={`Comprar ${ticker} no Wizard`}
          aria-label={`Comprar ${ticker} no Wizard`}
        >
          <ShoppingCart className="size-3.5 text-portfolio" aria-hidden="true" />
          <span>Comprar</span>
        </Button>
      ) : null}

      <button
        type="button"
        onClick={() => onToggleDone(ticker)}
        aria-label={isDone ? `Marcar ${ticker} como pendente` : `Marcar ${ticker} como executado`}
        className={cn(
          "relative inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer shrink-0 max-sm:after:absolute max-sm:after:-inset-2",
          isDone
            ? "border border-positive/30 bg-positive/10 text-positive-strong font-semibold"
            : "border border-transparent hover:border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-raised",
          compact && "h-6 px-1.5 text-[11px]",
        )}
      >
        <Check className={cn("size-3.5", isDone ? "text-positive-strong" : "opacity-40 hover:opacity-100")} aria-hidden="true" />
        <span>{isDone ? "Feito" : "Marcar"}</span>
      </button>
    </div>
  );
}
