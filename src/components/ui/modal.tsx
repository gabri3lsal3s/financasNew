import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";
import { triggerHaptic } from "@/services/haptics";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Sobe o z-index acima de outros modais (ex.: calculadora sobre formulários). */
  elevated?: boolean;
  /** Oculta o botão de calculadora no cabeçalho do modal. */
  hideCalculator?: boolean;
}

/** Modal próprio do app (Radix Dialog) — substitui `<dialog>`, alert/confirm/prompt (DESIGN_SYSTEM §13). */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  elevated = false,
  hideCalculator = false,
}: ModalProps) {
  const z = elevated ? "z-floating-tools" : "z-modal";
  const showCalculator = !hideCalculator && !elevated;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn("fixed inset-0 bg-overlay backdrop-blur-sm", z)} />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md max-h-[90dvh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-lg focus:outline-none",
            z,
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-lg font-bold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {showCalculator ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir calculadora"
                  title="Calculadora"
                  onClick={() => {
                    triggerHaptic("light");
                    setCalculatorOpen(true);
                  }}
                >
                  <Calculator aria-hidden="true" />
                </Button>
              ) : null}
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Fechar">
                  <X aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
