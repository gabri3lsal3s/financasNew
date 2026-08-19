import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calculator, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setCalculatorOpen } from "@/services/calculator-open";
import { triggerSensory } from "@/services/sensory";

export type ModalSize = "sm" | "md" | "lg" | "xl";

/** Largura máxima no desktop (base + variantes — UMA classe por modal, sem conflito de cascata). */
const SIZE_MAX_W: Record<ModalSize, string> = {
  sm: "lg:max-w-sm",
  md: "lg:max-w-md",
  lg: "lg:max-w-lg",
  xl: "lg:max-w-3xl",
};

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Largura máxima no desktop (default "md" = 28rem). Evite `max-w-*` no className: a variante `lg:` da base vence a classe solta na cascata. */
  size?: ModalSize;
  /** Sobe o z-index acima de outros modais (ex.: calculadora sobre formulários). */
  elevated?: boolean;
  /** Exibe o botão de calculadora no cabeçalho do modal (default false). Use apenas em modais com campos de valor monetário. */
  showCalculator?: boolean;
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
 * F25 — Bottom Sheet no mobile: em telas < lg o modal vira uma folha inferior
 * (inset-x-0 bottom-0, cantos superiores arredondados, slide-up) com alça
 * visível e **fechamento por arrasto** (drag-to-close com resistência elástica,
 * velocity fling e spring-back). Em lg+ mantém o diálogo centralizado clássico.
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
  className,
  size = "md",
  elevated = false,
  showCalculator = false,
}: ModalProps) {
  const z = elevated ? "z-floating-tools" : "z-modal";
  const displayCalculator = showCalculator && !elevated;

  const contentRef = useRef<HTMLDivElement>(null);
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
    }
    onOpenChange(next);
  };

  const prefersReducedMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    const el = contentRef.current;
    if (!el || el.scrollTop > 0) return;
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
        <DialogPrimitive.Overlay className={cn("fixed inset-0 bg-overlay backdrop-blur-sm", z)} />
        <DialogPrimitive.Content
          ref={contentRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
          className={cn(
            // Mobile (base): bottom sheet com slide-up e alça; lg+: diálogo centralizado.
            "fixed inset-x-0 bottom-0 w-full max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] shadow-lg focus:outline-none animate-sheet-in",
            "lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[calc(100vw-2rem)] lg:rounded-2xl lg:pb-6 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-none",
            SIZE_MAX_W[size],
            z,
            className,
          )}
        >
          {/* Alça do bottom sheet (F25) — visível apenas no mobile. */}
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border lg:hidden"
          />
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
              {displayCalculator ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir calculadora"
                  title="Calculadora"
                  onClick={() => {
                    triggerSensory("action");
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
