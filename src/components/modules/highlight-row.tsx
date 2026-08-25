import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HighlightRowProps {
  /** Id do registro destacado (null = sem destaque). */
  highlightId: string | null;
  /** Id desta linha. */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * Destaque de linha vinda de deep-link (busca global §3.9): quando
 * `highlightId === id`, aplica anel visual e rola a linha para o centro
 * (scroll + highlight — DoD F5). Usado nas telas-alvo da busca.
 */
export function HighlightRow({ highlightId, id, children, className }: HighlightRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = highlightId === id;

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active]);

  return (
    <div
      ref={ref}
      className={cn(
        "scroll-mt-24 rounded-xl transition-[box-shadow,background-color] duration-300",
        active && "bg-primary/10 ring-2 ring-primary shadow-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}
