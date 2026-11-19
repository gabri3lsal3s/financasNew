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
 * Ações padronizadas por ativo sugerido: atalho para Wizard de Compra, inspeção de tese e marcação de execução.
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
            "size-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-surface-raised",
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
            "px-2.5 text-xs gap-1 font-medium text-foreground",
            compact && "px-2 text-[11px]",
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
          "relative inline-flex min-h-8 items-center justify-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0 max-sm:after:absolute max-sm:after:-inset-2",
          isDone
            ? "border border-positive/30 bg-positive/10 text-positive-strong"
            : "border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground active:scale-[0.98]",
        )}
      >
        {isDone ? (
          <>
            <Check className="size-3.5" aria-hidden="true" />
            <span>Feito</span>
          </>
        ) : (
          <span>Pendente</span>
        )}
      </button>
    </div>
  );
}
