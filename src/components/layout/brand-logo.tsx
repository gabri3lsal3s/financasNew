import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  className?: string;
  /** Exibe o wordmark "Guia Financeiro" ao lado do símbolo (padrão: true). */
  showWordmark?: boolean;
  /** Exibe subtítulo "Organização & Economia" abaixo do wordmark (padrão: false). */
  showSubtitle?: boolean;
  /** Tamanho do símbolo (padrão: size-8). */
  markClassName?: string;
  wordmarkClassName?: string;
}

/**
 * Logo oficial da marca "Guia Financeiro" (F10) — Carteira Orbital & Economia.
 * Renderiza o asset oficial em PNG com antialiasing de alta resolução (srcSet multi-tamanho)
 * e tipografia de marca harmonizada com o design system Obsidian Glass.
 */
export function BrandLogo({
  className,
  showWordmark = true,
  showSubtitle = false,
  markClassName,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none overflow-hidden min-w-0", className)}>
      <img
        src="/brand/logo-128.png"
        srcSet="/brand/logo-64.png 64w, /brand/logo-128.png 128w, /brand/logo.png 512w"
        sizes="(max-width: 640px) 32px, 48px"
        alt={showWordmark ? "" : "Guia Financeiro"}
        aria-hidden={showWordmark ? "true" : undefined}
        className={cn("size-8 shrink-0 object-contain transition-transform duration-200 ease-out", markClassName)}
        loading="eager"
      />
      {showWordmark ? (
        <span className="flex flex-col justify-center min-w-0 overflow-hidden whitespace-nowrap animate-fade-slide-in">
          <span
            className={cn(
              "font-display text-lg font-bold leading-tight tracking-tight text-foreground whitespace-nowrap",
              wordmarkClassName,
            )}
          >
            Guia Financeiro
          </span>
          {showSubtitle ? (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Organização & Economia
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
