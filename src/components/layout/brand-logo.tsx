import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  className?: string;
  /** Exibe o wordmark "AXIS" ao lado do símbolo (padrão: false). */
  showWordmark?: boolean;
  /** Exibe subtítulo "Guia Financeiro" abaixo do wordmark (padrão: false). */
  showSubtitle?: boolean;
  /** Tamanho do símbolo (padrão: size-8). */
  markClassName?: string;
  wordmarkClassName?: string;
}

/**
 * Logo oficial da marca AXIS (F10) — Carteira Orbital & Gestão Financeira.
 * Renderiza o símbolo com fundo transparente em alta resolução (srcSet multi-tamanho)
 * e tipografia de marca harmonizada com o design system Obsidian Glass (Dark e Light).
 */
export function BrandLogo({
  className,
  showWordmark = false,
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
        alt={showWordmark ? "" : "AXIS"}
        aria-hidden={showWordmark ? "true" : undefined}
        className={cn("size-8 shrink-0 object-contain transition-transform duration-200 ease-out", markClassName)}
        loading="eager"
      />
      {showWordmark ? (
        <span className="flex flex-col justify-center min-w-0 overflow-hidden whitespace-nowrap animate-fade-slide-in">
          <span
            className={cn(
              "font-display text-lg font-black leading-tight tracking-wider text-foreground whitespace-nowrap",
              wordmarkClassName,
            )}
          >
            AXIS
          </span>
          {showSubtitle ? (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Guia Financeiro
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
