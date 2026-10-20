import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";
import { triggerSensory } from "@/services/sensory";

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
  className?: string;
  /** Classes extras aplicadas ao corpo rolável do modal. */
  contentClassName?: string;
  /** Largura máxima no desktop (default "md" = 32rem / 512px). Evite `max-w-*` no className: a variante `md:` da base vence a classe solta na cascata. */
  size?: ModalSize;
  /** Sobe o z-index acima de outros modais (ex.: calculadora sobre formulários). */
  elevated?: boolean;
  /** Exibe o botão de calculadora no cabeçalho do modal (default false). Use apenas em modais com campos de valor monetário. */
  showCalculator?: boolean;
  /** Ações contextuais adicionais renderizadas no cabeçalho antes do botão fechar. */
  headerActions?: ReactNode;
}

/** Distância (px) de arrasto que dispara o fechamento do bottom sheet. */
const CLOSE_DRAG_THRESHOLD = 96;
/** Velocidade (px/ms) que caracteriza um "arremesso" para fechar. */
const CLOSE_FLING_VELOCITY = 0.5;
/** Ponto onde a resistência elástica começa (px arrastados). */
const RESIST_START = 100;
const RESIST_FACTOR = 0.35;

/** Elementos interativos nunca iniciam o drag-to-close (botões, campos etc.). */
const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [role='slider'], [data-drag-ignore]";

/**
 * Modal próprio do app (Radix Dialog) — substitui `<dialog>`, alert/confirm/prompt (DESIGN_SYSTEM §13).
 *
 * F25 — Bottom Sheet no mobile: em telas < md o modal vira uma folha inferior
 * (inset-x-0 bottom-0, cantos superiores arredondados, slide-up) com alça
 * visível e **fechamento por arrasto** (drag-to-close com resistência elástica,
 * velocity fling e spring-back). Em md+ mantém o diálogo centralizado clássico.
 * O gesto respeita `prefers-reduced-motion` (sem rubber-band) e só engaja em
 * toque/pena a partir do topo do conteúdo (scrollTop 0), nunca sobre elementos
 * interativos.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  size = "md",
  elevated = false,
  showCalculator = false,
  headerActions,
}: ModalProps) {
  const z = elevated ? "z-floating-tools" : "z-modal";
  const displayCalculator = showCalculator && !elevated;

  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    dy: number;
  } | null>(null);
  const [dragY, setDragY] = useState(0);

  // Garante que o transform nunca "vaza" para a próxima abertura: o reset
  // acontece no handler (evento), não em effect (React Compiler).
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDragY(0);
      dragRef.current = null;
    } else {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }
    onOpenChange(next);
  };

  const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const el = scrollRef.current;
    if (el && el.scrollTop > 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    dragRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      dy: 0,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = Math.max(0, event.clientY - drag.startY);
    // Velocidade (px/ms) para o fling — amostra por movimento.
    const now = performance.now();
    drag.lastTime = now;
    drag.lastY = event.clientY;
    drag.dy = dy;
    // Resistência elástica após RESIST_START px (evita arrastar o sheet inteiro).
    const applied = dy < RESIST_START ? dy : RESIST_START + (dy - RESIST_START) * RESIST_FACTOR;
    if (prefersReducedMotion()) {
      // Sem rubber-band: só registra a distância (fecha no threshold).
      return;
    }
    setDragY(applied);
    event.preventDefault();
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    const velocity = Math.abs(event.clientY - drag.lastY) / dt;
    const shouldClose = drag.dy >= CLOSE_DRAG_THRESHOLD || velocity > CLOSE_FLING_VELOCITY;
    setDragY(0);
    if (shouldClose) {
      triggerSensory("action");
      onOpenChange(false);
    }
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragY(0);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
            z,
          )}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onOpenAutoFocus={(e) => {
            // Evita foco automático imediato que dispara rolagem indesejada do sheet ou teclado virtual
            e.preventDefault();
          }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
          className={cn(
            // Mobile (base): bottom sheet ancorado na base da tela (bottom-0) com cantos superiores arredondados e shell flexível; md+: diálogo centralizado com margens adequadas e animação.
            "fixed inset-x-0 bottom-0 w-full max-h-[calc(90dvh-max(env(safe-area-inset-top,0px),var(--safe-area-top,0px)))] flex flex-col overflow-hidden rounded-t-2xl border border-primary/25 bg-surface shadow-xl focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 animate-sheet-in",
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[calc(100vw-2rem)] md:max-h-[calc(100dvh-3rem)] md:rounded-2xl md:-translate-x-1/2 md:-translate-y-1/2 md:animate-none md:data-[state=open]:animate-in md:data-[state=closed]:animate-out md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:duration-200",
            SIZE_MAX_W[size],
            z,
            className,
          )}
        >
          {/* Cabeçalho fixo (não rola) com alça e ações contextuais */}
          <div className="shrink-0 p-4 sm:p-6 pb-2 sm:pb-3">
            {/* Alça do bottom sheet (F25) — visível apenas no mobile com micro-interação. */}
            <div
              aria-hidden="true"
              className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-primary/30 hover:bg-primary/50 transition-colors md:hidden"
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="font-display text-lg font-bold text-foreground tracking-tight">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {headerActions}
                {displayCalculator ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Abrir calculadora"
                    title="Calculadora"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => {
                      setCalculatorOpen(true);
                    }}
                  >
                    <Calculator aria-hidden="true" />
                  </Button>
                ) : null}
                <DialogPrimitive.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Fechar"
                    className="text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>
          </div>

          {/* Corpo rolável isolado (o conteúdo rola aqui dentro e NUNCA é sobreposto pelo rodapé) */}
          <div
            ref={scrollRef}
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-2",
              footer
                ? "pb-3 sm:pb-4"
                : "pb-[calc(1.25rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))] sm:pb-6",
              contentClassName,
            )}
          >
            {children}
          </div>

          {/* Rodapé Pinned Canônico (quando passado via prop footer) */}
          {footer ? (
            <div className="shrink-0 border-t border-border/80 bg-surface px-4 py-3 sm:px-6 sm:py-4 pb-[max(0.75rem,calc(max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px))+0.5rem))] sm:pb-4">
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 mt-6 border-t border-border/80 w-full",
        "[&_button]:w-full [&_button]:sm:w-auto [&_button]:sm:min-w-[110px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
