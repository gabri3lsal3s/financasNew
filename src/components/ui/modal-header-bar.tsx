import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";

interface ModalHeaderBarProps {
  title: string;
  description?: string;
  hideTitle: boolean;
  isScrolled: boolean;
  hasScrolled: boolean;
  displayCalculator: boolean;
  headerActions?: ReactNode;
  dragHandlers?: {
    onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  };
}

/**
 * Barra superior unificada do `<Modal />` (alça integrada + micro-título reativo no mobile e ações contextuais).
 * Mantém 100% da mesma cor de superfície entre a alça e o cabeçalho comprimido, eliminando recortes ou linhas divisórias espúrias.
 */
export function ModalHeaderBar({
  title,
  description,
  hideTitle,
  isScrolled,
  hasScrolled,
  displayCalculator,
  headerActions,
  dragHandlers,
}: ModalHeaderBarProps) {
  const actionButtons = (
    <>
      {headerActions}
      {displayCalculator ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Abrir calculadora"
          title="Calculadora"
          className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          onClick={() => {
            setCalculatorOpen(true);
          }}
        >
          <Calculator className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
      <DialogPrimitive.Close asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Fechar"
          className="size-8 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onMouseUp={(e) => {
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </DialogPrimitive.Close>
    </>
  );

  const sheetHandle = (isCompressed: boolean) => (
    <div
      data-testid="modal-sheet-handle"
      data-sheet-handle="true"
      aria-label="Arrastar para fechar"
      {...dragHandlers}
      className="pt-2.5 pb-2 px-6 flex items-center justify-center shrink-0 md:hidden pointer-events-auto touch-none select-none cursor-grab active:cursor-grabbing"
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-1 w-10 shrink-0 rounded-full bg-primary/30 transition-opacity duration-200 md:hidden",
          isCompressed ? "opacity-30" : "opacity-100",
        )}
      />
    </div>
  );

  if (hideTitle) {
    return (
      <div
        className={cn(
          "shrink-0 z-20 transition-all duration-200 bg-surface",
          // Desktop: barra horizontal clássica de ações alinhadas à direita com altura confortável (h-14 / 56px)
          "md:h-14 md:px-6 md:flex md:items-center md:justify-end md:border-b",
          hasScrolled ? "md:border-border/80 md:shadow-xs" : "md:border-border/60",
          // Mobile: cabeçalho unificado contendo alça + ações com respiro vertical
          "flex flex-col border-b",
          hasScrolled ? "border-border/80 shadow-xs" : "border-border/60",
        )}
      >
        {sheetHandle(hasScrolled)}
        <div className="h-11 px-4 flex items-center justify-end w-full md:h-full md:px-0">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
          ) : null}
          <div className="flex shrink-0 items-center gap-1.5">{actionButtons}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shrink-0 z-20 transition-all duration-200 bg-transparent",
        // Desktop: altura zero, deixa espaço para ações contextuais no topo direito
        "md:h-0 md:overflow-visible md:pointer-events-none md:border-b-0 md:shadow-none",
        // Mobile: cabeçalho unificado integrando alça e barra de controle na mesma superfície contínua
        "flex flex-col border-b",
        isScrolled ? "border-border/80 shadow-xs" : "border-transparent",
      )}
    >
      {sheetHandle(isScrolled)}

      <div className="h-9 md:h-0 md:overflow-visible flex items-center justify-between px-4 md:px-0 relative md:pointer-events-none">
        {/* Micro-título reativo no mobile (aparece quando o título principal rola para fora no scroll > 32px) */}
        <div className="flex-1 min-w-0 pr-2 md:hidden">
          {isScrolled ? (
            <span
              aria-hidden="true"
              className="block text-xs font-semibold text-foreground truncate transition-opacity duration-150 animate-in fade-in-0"
            >
              {title}
            </span>
          ) : null}
        </div>

        {/* Ações contextuais e fechar: à direita na barra mobile; top-right absoluto no desktop */}
        <div className="flex shrink-0 items-center gap-1 z-20 md:pointer-events-auto md:absolute md:top-4 md:right-6 md:gap-1.5">
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
