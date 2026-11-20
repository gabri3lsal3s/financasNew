import { cloneElement, isValidElement, useRef, useState } from "react";
import type { ReactElement, ReactNode, UIEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { ModalFooter, type ModalFooterProps } from "./modal-footer";
import { ModalHeaderBar } from "./modal-header-bar";
import { useBottomSheetDrag } from "./use-bottom-sheet-drag";

export { ModalFooter, type ModalFooterProps } from "./modal-footer";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";

/** Largura máxima no desktop e tablet (base + variantes — UMA classe por modal, sem conflito de cascata). */
const SIZE_MAX_W: Record<ModalSize, string> = {
  sm: "md:max-w-md",
  md: "md:max-w-lg",
  lg: "md:max-w-2xl",
  xl: "md:max-w-4xl",
  "2xl": "md:max-w-5xl lg:max-w-6xl",
  "3xl": "md:max-w-7xl",
  full: "md:max-w-[94vw] lg:max-w-7xl",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Rodapé canônico fixado na base do modal, fora do corpo de rolagem (sem sobreposição). */
  footer?: ReactNode;
  /** Ação destrutiva secundária encaminhada para o rodapé canônico quando aplicável. */
  destructiveAction?: ReactNode;
  className?: string;
  /** Classes extras aplicadas ao corpo rolável do modal. */
  contentClassName?: string;
  /** Largura máxima no desktop (default "md" = 32rem / 512px). */
  size?: ModalSize;
  /** Sobe o z-index acima de outros modais (ex.: calculadora sobre formulários). */
  elevated?: boolean;
  /** Exibe o botão de calculadora no cabeçalho do modal (default false). */
  showCalculator?: boolean;
  /** Ações contextuais adicionais renderizadas no cabeçalho antes do botão fechar. */
  headerActions?: ReactNode;
  /** Reserva espaço horizontal adequado no desktop para ações largas no cabeçalho. */
  wideHeaderActions?: boolean;
  /** Oculta o cabeçalho de título visual do modal (preserva para acessibilidade via sr-only). */
  hideTitle?: boolean;
  /** Se false, o modal opera em modo não-bloqueante (sem focus-trap ou lock externo). */
  modal?: boolean;
  /** Identificador para foco em tours guiados e automação. */
  dataTour?: string;
  "data-tour"?: string;
  /** Se true, o modal possui dados não salvos modificados pelo usuário. */
  isDirty?: boolean;
  /** Se true e isDirty for true, intercepta qualquer tentativa de fechamento exigindo confirmação de descarte. */
  confirmDiscard?: boolean;
  /** Título customizado do diálogo de confirmação de descarte. */
  discardTitle?: string;
  /** Descrição customizada do diálogo de confirmação de descarte. */
  discardDescription?: string;
  /** Rótulo do botão destrutivo de confirmação de descarte (default "Descartar"). */
  discardConfirmLabel?: string;
  /** Rótulo do botão de cancelamento para continuar no modal (default "Continuar editando"). */
  discardCancelLabel?: string;
  /** Callback acionado quando o usuário confirma o descarte. */
  onDiscard?: () => void;
}

interface DiscardConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

function DiscardConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: DiscardConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-overlay/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 z-floating-tools" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-primary/25 bg-surface p-4 sm:p-5 shadow-2xl z-floating-tools animate-in fade-in-0 zoom-in-95 duration-200 focus:outline-none"
        >
          <DialogPrimitive.Title className="font-display text-base font-bold text-foreground tracking-tight">
            {title ?? "Descartar alterações?"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {description ??
              "Você possui alterações não salvas. Se sair agora, todas as informações modificadas serão descartadas."}
          </DialogPrimitive.Description>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel ?? "Continuar editando"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              sensoryIntent="destructive"
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel ?? "Descartar"}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const OUTSIDE_PORTAL_SELECTOR =
  "[data-tour-spotlight-card], [data-tour-spotlight-root], [data-radix-popper-content-wrapper], [data-radix-select-content], [data-radix-popover-content], [data-radix-dropdown-menu-content]";

function preventPortalOutsideDismiss(event: { target: EventTarget | null; preventDefault: () => void }) {
  const target = event.target as HTMLElement | null;
  if (target?.closest?.(OUTSIDE_PORTAL_SELECTOR)) {
    event.preventDefault();
  }
}

/**
 * Modal próprio do app (Radix Dialog) — Bottom Sheet no mobile (< md) e diálogo centralizado em md+.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  destructiveAction,
  className,
  contentClassName,
  size = "md",
  elevated = false,
  showCalculator = false,
  headerActions,
  wideHeaderActions = false,
  hideTitle = false,
  modal = true,
  dataTour,
  "data-tour": dataTourAttr,
  isDirty = false,
  confirmDiscard = false,
  discardTitle,
  discardDescription,
  discardConfirmLabel,
  discardCancelLabel,
  onDiscard,
}: ModalProps) {
  const resolvedDataTour = dataTour ?? dataTourAttr;
  const z = elevated ? "z-floating-tools" : "z-modal";
  const displayCalculator = showCalculator && !elevated;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { resetDrag, dragHandlers, dragStyle } = useBottomSheetDrag({
    scrollRef,
    onClose: () => handleOpenChange(false),
  });

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setShowDiscardConfirm(false);
      resetDrag();
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (confirmDiscard && isDirty) {
        setShowDiscardConfirm(true);
        return;
      }
      setIsScrolled(false);
      setHasScrolled(false);
    } else {
      resetDrag();
      setIsScrolled(false);
      setHasScrolled(false);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
    onOpenChange(next);
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    resetDrag();
    setIsScrolled(false);
    setHasScrolled(false);
    onDiscard?.();
    onOpenChange(false);
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const top = event.currentTarget.scrollTop;
    const scrolled = top > 32;
    const startedScrolling = top > 4;
    if (scrolled !== isScrolled) setIsScrolled(scrolled);
    if (startedScrolling !== hasScrolled) setHasScrolled(startedScrolling);
  };

  const resolvedFooter = (() => {
    if (!footer && !destructiveAction) return null;
    if (isValidElement(footer) && footer.type === ModalFooter) {
      if (destructiveAction && !(footer.props as ModalFooterProps).destructiveAction) {
        return cloneElement(footer as ReactElement<ModalFooterProps>, { destructiveAction });
      }
      return footer;
    }
    if (destructiveAction) {
      return (
        <ModalFooter borderless destructiveAction={destructiveAction}>
          {footer}
        </ModalFooter>
      );
    }
    return footer;
  })();

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} modal={modal}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
              z,
            )}
          />
          <DialogPrimitive.Content
            data-tour={resolvedDataTour}
            onPointerDownOutside={preventPortalOutsideDismiss}
            onInteractOutside={preventPortalOutsideDismiss}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            style={dragStyle}
            className={cn(
              "fixed inset-x-0 bottom-0 w-full max-h-[calc(92dvh-max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] flex flex-col overflow-hidden rounded-t-2xl border border-primary/25 bg-surface shadow-2xl focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out duration-200",
              "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100vw-2rem)] md:max-h-[calc(100dvh-3rem)] md:rounded-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:animate-none md:data-[state=open]:animate-in md:data-[state=closed]:animate-out md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:duration-200",
              SIZE_MAX_W[size],
              z,
              className,
            )}
          >
            <ModalHeaderBar
              title={title}
              description={description}
              hideTitle={hideTitle}
              isScrolled={isScrolled}
              hasScrolled={hasScrolled}
              displayCalculator={displayCalculator}
              headerActions={headerActions}
              dragHandlers={dragHandlers}
            />

            {/* Corpo rolável isolado */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className={cn(
                "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 sm:px-6",
                resolvedFooter
                  ? "pb-3 sm:pb-4"
                  : "pb-[calc(1.25rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:pb-6",
                contentClassName,
              )}
            >
              {!hideTitle ? (
                <div
                  className={cn(
                    "pt-2 pb-3 md:pt-4 md:pb-3 md:-mx-6 md:pl-6 shrink-0 md:sticky md:top-0 md:z-10 md:border-b transition-colors duration-200",
                    isScrolled
                      ? "md:bg-surface/95 md:backdrop-blur-xs md:border-border/80 md:shadow-xs"
                      : "bg-transparent md:border-transparent",
                    wideHeaderActions
                      ? "md:pr-[360px]"
                      : headerActions
                        ? "md:pr-40"
                        : displayCalculator
                          ? "md:pr-24"
                          : "md:pr-16",
                  )}
                >
                  <DialogPrimitive.Title className="font-display text-lg font-bold text-foreground tracking-tight">
                    {title}
                  </DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {description}
                    </DialogPrimitive.Description>
                  ) : null}
                </div>
              ) : null}

              {children}
            </div>

            {/* Rodapé Pinned Canônico — suprime margem/borda superior duplicada de ModalFooter filho */}
            {resolvedFooter ? (
              <div className="shrink-0 border-t border-border/80 bg-surface/95 backdrop-blur-xs px-4 py-3 sm:px-6 sm:py-3.5 pb-[max(0.5rem,calc(max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px))+0.25rem))] sm:pb-3.5 shadow-xs [&>*]:mt-0 [&>*]:pt-0 [&>*]:border-t-0">
                {resolvedFooter}
              </div>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {confirmDiscard ? (
        <DiscardConfirmDialog
          open={showDiscardConfirm}
          onOpenChange={setShowDiscardConfirm}
          title={discardTitle}
          description={discardDescription}
          confirmLabel={discardConfirmLabel}
          cancelLabel={discardCancelLabel}
          onConfirm={handleConfirmDiscard}
        />
      ) : null}
    </>
  );
}
