import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollPosition } from "@/hooks/use-scroll-position";

export interface ScrollToTopButtonProps {
  /** Limiar de rolagem (px) para exibir (default 300). */
  threshold?: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll-to-Top inteligente (F9 — Decisão D): visível após `scrollY > 300px`,
 * posicionado acima da BottomNav no mobile e no canto inferior direito no
 * desktop. Rolagem suave (instantânea com prefers-reduced-motion).
 */
export function ScrollToTopButton({ threshold = 300, className }: ScrollToTopButtonProps) {
  const visible = useScrollPosition(threshold);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-lg transition-colors hover:bg-surface-hover lg:bottom-6 lg:right-6",
        className,
      )}
    >
      <ArrowUp className="size-4" aria-hidden="true" />
    </button>
  );
}
