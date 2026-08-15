import { cloneElement, useId } from "react";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  /** Texto exibido no tooltip. */
  content: string;
  /** Trigger — deve aceitar `aria-describedby` (Botões do app aceitam). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  /** Posição do tooltip (default: acima do trigger). */
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Tooltip próprio do app (F25) — primitivo acessível baseado em CSS puro
 * (group-hover / group-focus-within), sem libs externas. Exibido ao passar o
 * mouse ou focar via teclado, com `role="tooltip"` + `aria-describedby`
 * injetado no trigger (cliente: `useId`). Respeita `prefers-reduced-motion`
 * (transição desligada) e `data-motion="reduced"` via regras globais.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const id = useId();
  const trigger = cloneElement(children, { "aria-describedby": id });

  return (
    <span className={cn("group relative inline-flex", className)}>
      {trigger}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-tooltip -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
