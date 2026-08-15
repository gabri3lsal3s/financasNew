import { useRef } from "react";
import { MonthPicker } from "./month-picker";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import { APP_START_DATE } from "@/types";

export interface MonthSwiperProps {
  /** YYYY-MM */
  value: string;
  onValueChange: (month: string) => void;
  disabled?: boolean;
  className?: string;
  /** Pode avançar além do mês atual? (default true — paridade com os botões). */
  canGoNext?: boolean;
}

/** Soma `delta` meses a uma chave YYYY-MM (aritmética pura de string). */
function addMonths(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const total = (year ?? 0) * 12 + ((monthNum ?? 1) - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (((total % 12) + 12) % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Navegador de mês com swipe horizontal (F20 — MonthSwiper).
 *
 * Envolve o `MonthPicker` (botões continuam como alternativa acessível —
 * gestos são adicionais): arrastar para a direita volta um mês, para a
 * esquerda avança. Borda inferior em `APP_START_DATE` (2026-01 — spec §4.1):
 * antes disso o conteúdo cede elasticamente (rubber-banding) e NÃO navega.
 *
 * O swipe acontece na área do seletor inteira (`touch-action: pan-y` — scroll
 * vertical livre); áreas interativas (inputs, modais, `.swipeable-item`,
 * `[data-swipe-nav-ignore]`) são isoladas pela engine.
 */
export function MonthSwiper({ value, onValueChange, disabled, className, canGoNext = true }: MonthSwiperProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const canGoPrevious = value > APP_START_DATE;

  const swipe = useSwipeNavigation({
    onNavigate: (direction) => {
      onValueChange(addMonths(value, direction === "previous" ? -1 : 1));
    },
    canGoPrevious,
    canGoNext,
    onDragProgress: (offsetPx) => {
      const node = contentRef.current;
      if (node) {
        node.style.transform = `translateX(${offsetPx}px)`;
      }
    },
  });

  return (
    <div
      {...swipe.pointerHandlers}
      className={className}
      style={{ touchAction: "pan-y" }}
      data-testid="month-swiper"
    >
      <div
        ref={contentRef}
        className="will-change-transform"
        style={{
          transition: swipe.dragging ? "none" : "transform 0.25s ease-out",
        }}
      >
        <MonthPicker value={value} onValueChange={onValueChange} disabled={disabled} />
      </div>
    </div>
  );
}
