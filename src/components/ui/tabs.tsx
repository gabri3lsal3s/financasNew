import { useRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { playSound } from "@/services/audio-fx";
import { getVisualCustomization } from "@/hooks/use-visual-customization";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  variant?: "underline" | "pills";
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
  className,
  swipeable = false,
}: TabsProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.max(0, items.findIndex((item) => item.value === value));

  const swipe = useSwipeNavigation({
    onNavigate: (direction) => {
      const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const next = items[nextIndex];
      if (next) {
        triggerHaptic("light");
        const visual = getVisualCustomization();
        playSound("click", visual.soundEnabled);
        onValueChange(next.value);
      }
    },
    canGoPrevious: currentIndex > 0,
    canGoNext: currentIndex < items.length - 1,
    onDragProgress: (offsetPx) => {
      const node = contentRef.current;
      if (node) {
        node.style.transform = `translateX(${offsetPx}px)`;
      }
    },
  });

  const handleTabChange = (val: string) => {
    triggerHaptic("light");
    const visual = getVisualCustomization();
    playSound("click", visual.soundEnabled);
    onValueChange(val);
  };

  return (
    <TabsPrimitive.Root value={value} onValueChange={handleTabChange} className={className}>
      <TabsPrimitive.List
        className={cn(
          "flex gap-1 overflow-x-auto no-scrollbar",
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
              "inline-flex items-center justify-center gap-2 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none active:scale-[0.98]",
              variant === "underline"
                ? "border-b-2 border-transparent text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary-strong data-[state=active]:font-semibold"
                : "rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/50 data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:shadow-black/5",
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {/* F20 — a área de conteúdo é o alvo do swipe (o List tem overflow-x-auto).
          `touch-action: pan-y` preserva o scroll vertical. */}
      <div
        {...(swipeable ? swipe.pointerHandlers : {})}
        ref={contentRef}
        className="mt-4 will-change-transform"
        style={{
          touchAction: swipeable ? "pan-y" : undefined,
          transition: swipe.dragging ? "none" : "transform 0.25s ease-out",
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
