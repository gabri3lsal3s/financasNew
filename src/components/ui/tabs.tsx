import { useEffect, useRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";

export interface TabItem {
  value: string;
  label: string;
  shortLabel?: string;
  icon?: ReactNode;
  content?: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  variant?: "underline" | "pills";
  fullWidth?: boolean;
  className?: string;
  /**
   * F20 — navegação por gesto: swipe horizontal na área de conteúdo alterna
   * as abas (esquerda = próxima, direita = anterior). Gestos adicionais ao
   * teclado Radix (a11y). Desabilitado em telas com formulários densos.
   */
  swipeable?: boolean;
}

/** Tabs próprias do app (Radix) — acessível, com teclado e micro-interação (F11). */
export function Tabs({
  value,
  onValueChange,
  items,
  variant = "underline",
  fullWidth,
  className,
  swipeable = false,
}: TabsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const isFullWidth = fullWidth ?? (variant === "pills");

  const swipe = useSwipeNavigation({
    onNavigate: (direction) => {
      const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const next = items[nextIndex];
      if (next) {
        triggerSensory("selection");
        onValueChange(next.value);
      }
    },
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex < items.length - 1,
    onDragProgress: (offsetPx) => {
      const node = contentRef.current;
      if (node) {
        node.style.transform = offsetPx !== 0 ? `translateX(${offsetPx}px)` : "";
      }
    },
  });

  // Limpa o deslocamento inline ao trocar de aba ou quando o arrasto termina
  useEffect(() => {
    if (!swipe.dragging && contentRef.current) {
      contentRef.current.style.transform = "";
    }
  }, [value, swipe.dragging]);

  const handleTabChange = (val: string) => {
    triggerSensory("selection");
    onValueChange(val);
  };

  // Se o toque iniciou em uma sub-aba aninhada, este container pai não disputa o gesto
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!swipeable) return;
    const target = event.target;
    if (target instanceof Element) {
      const closestTabsContent = target.closest("[data-swipe-tabs-content]");
      if (closestTabsContent && closestTabsContent !== contentRef.current) {
        return;
      }
    }
    swipe.pointerHandlers.onPointerDown(event);
  };

  return (
    <TabsPrimitive.Root value={value} onValueChange={handleTabChange} className={className}>
      <TabsPrimitive.List
        className={cn(
          "flex gap-1 overflow-x-auto no-scrollbar",
          isFullWidth ? "w-full" : "w-auto",
          variant === "underline"
            ? "border-b border-border"
            : "p-1 rounded-xl bg-muted/60 border border-border/50 backdrop-blur-sm",
        )}
        aria-label="Abas de navegação"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none active:scale-[0.98] min-w-0",
              isFullWidth && "flex-1",
              variant === "underline"
                ? "border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary-strong data-[state=active]:font-semibold"
                : "rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/50 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:shadow-black/5 text-center",
            )}
          >
            {item.icon}
            <span className={cn("truncate", item.shortLabel && "hidden sm:inline")}>{item.label}</span>
            {item.shortLabel && <span className="truncate sm:hidden">{item.shortLabel}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {/* F20 — a área de conteúdo é o alvo do swipe (o List tem overflow-x-auto).
          `touch-action: pan-y` preserva o scroll vertical. */}
      <div
        onPointerDown={swipeable ? handlePointerDown : undefined}
        onPointerMove={swipeable ? swipe.pointerHandlers.onPointerMove : undefined}
        onPointerUp={swipeable ? swipe.pointerHandlers.onPointerUp : undefined}
        onPointerCancel={swipeable ? swipe.pointerHandlers.onPointerCancel : undefined}
        ref={contentRef}
        className="mt-4 will-change-transform"
        style={{
          touchAction: swipeable ? "pan-y" : undefined,
          transition: swipe.dragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        data-swipe-tabs-content
      >
        {items.map((item) => (
          <TabsPrimitive.Content
            key={item.value}
            value={item.value}
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring animate-route-in"
          >
            {item.content}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
}
