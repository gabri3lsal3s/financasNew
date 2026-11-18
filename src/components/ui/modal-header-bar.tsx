import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { ReactNode } from "react";
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
}

/**
 * Barra superior minimalista do `<Modal />` (mobile micro-título reativo + ações top-right).
 */
export function ModalHeaderBar({
  title,
  description,
  hideTitle,
  isScrolled,
  hasScrolled,
  displayCalculator,
  headerActions,
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
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </DialogPrimitive.Close>
    </>
  );

  if (hideTitle) {
    return (
      <div
        className={cn(
          "h-11 md:h-12 px-4 md:px-6 flex items-center justify-between shrink-0 border-b bg-transparent z-20 transition-all duration-200",
          hasScrolled ? "border-border/80 backdrop-blur-xs shadow-xs" : "border-transparent",
        )}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">{actionButtons}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-9 md:h-0 md:overflow-visible flex items-center justify-between px-4 md:px-0 shrink-0 relative z-20 md:pointer-events-none bg-transparent md:border-b-0 md:shadow-none transition-all duration-200 border-b",
        isScrolled
          ? "backdrop-blur-xs border-border/80 shadow-xs"
          : "border-transparent",
      )}
    >
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
  );
}
