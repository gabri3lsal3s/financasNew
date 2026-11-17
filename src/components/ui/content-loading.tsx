import type { HTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContentLoadingProps extends HTMLAttributes<HTMLDivElement> {
  /** Texto opcional e discreto descrevendo a etapa de carregamento. */
  statusText?: string;
  /** Variante de layout e padding do container. */
  variant?: "inline" | "card" | "fill";
  /** Tamanho do ícone indicador. */
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
} as const;

/**
 * Componente canônico de carregamento simplificado e neutro para uso dentro de páginas,
 * abas, modais e cards. Elimina logomarcas, brilhos orbitais e elementos pesados de boot,
 * priorizando discrição, sobriedade e conformidade com o design system.
 */
export function ContentLoading({
  statusText,
  variant = "fill",
  size = "md",
  className,
  ...props
}: ContentLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center text-center select-none motion-reduce:animate-none",
        variant === "inline" && "py-4 gap-2 w-full",
        variant === "card" && "min-h-[140px] p-6 rounded-2xl border border-border/80 bg-surface shadow-xs gap-3 w-full",
        variant === "fill" && "min-h-[200px] w-full flex-1 p-6 gap-3",
        className,
      )}
      {...props}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground shrink-0", SIZE_MAP[size])}
        aria-hidden="true"
      />
      {statusText ? (
        <p className="text-xs font-medium text-muted-foreground tracking-tight animate-fade-in">
          {statusText}
        </p>
      ) : (
        <span className="sr-only">Carregando…</span>
      )}
    </div>
  );
}
