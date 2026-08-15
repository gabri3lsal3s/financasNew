import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PullUpState } from "@/hooks/use-pull-up-to-top";

export interface PullUpToTopIndicatorProps {
  /** Estado atual da FSM do gesto (vindo do hook). */
  state: PullUpState;
  /** Progresso do pull (0–1) — preenche o anel de progresso. */
  progress: number;
  /** Distância puxada (px, pós-resistência) — para a escala do indicador. */
  pullDistance: number;
  className?: string;
}

/** Raio do anel de progresso (SVG). */
const RING_RADIUS = 20;
/** Circunferência do anel — referência para o stroke-dashoffset. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Indicador visual do gesto Pull-up / Overscroll to Top (F26).
 *
 * Aparece sobre o rodapé da página enquanto o usuário puxa para baixo no fim
 * do scroll: uma seta dentro de um anel de progresso que se preenche com a cor
 * primária do tema. No estado armado (`threshold_reached`) o anel fica cheio e
 * a seta ganha destaque — sinal de que soltar dispara o retorno ao topo.
 *
 * Puramente decorativo (`pointer-events-none`, `aria-hidden`) — a lógica de
 * disparo vive no hook `usePullUpToTop`; este componente só espelha o estado.
 */
export function PullUpToTopIndicator({
  state,
  progress,
  pullDistance,
  className,
}: PullUpToTopIndicatorProps) {
  const visible = state !== "idle" && state !== "at_bottom" && pullDistance > 0;
  const armed = state === "threshold_reached" || state === "triggered";

  if (!visible) return null;

  // O anel se enche conforme o progresso; quando armado, fica completo.
  const fill = Math.max(0, Math.min(1, armed ? 1 : progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - fill);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed bottom-24 right-4 z-sticky flex size-14 items-center justify-center lg:bottom-8 lg:right-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full border border-border bg-surface/95 shadow-lg backdrop-blur-sm transition-colors",
          armed && "border-primary/40",
        )}
      >
        <svg
          viewBox="0 0 48 48"
          className="absolute inset-0 size-full -rotate-90"
          role="presentation"
        >
          {/* Trilha do anel. */}
          <circle
            cx="24"
            cy="24"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            className="stroke-border/60"
          />
          {/* Progresso com a cor primária ativa do tema. */}
          <circle
            cx="24"
            cy="24"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-75 ease-linear"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <ArrowUp
          className={cn("size-4 text-foreground/80 transition-colors", armed && "text-primary")}
        />
      </div>
    </div>
  );
}
