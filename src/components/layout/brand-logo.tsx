import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  className?: string;
  /** Exibe o wordmark "Guia Financeiro" ao lado do símbolo (padrão: true). */
  showWordmark?: boolean;
  /** Tamanho do símbolo (padrão: size-8). */
  markClassName?: string;
  wordmarkClassName?: string;
}

/**
 * Logo oficial da marca "Guia Financeiro" (F10) — ícone da carteira orbital:
 * moeda central em Teal Petróleo com órbita em Ouro Âmbar, tudo via tokens
 * (fill-primary / stroke-accent). Vetorial, `aria-hidden` e sem textos
 * decorativos — a identidade propaga por `tokens.css`.
 */
export function BrandLogo({
  className,
  showWordmark = true,
  markClassName,
  wordmarkClassName,
}: BrandLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", markClassName)}>
        {/* Órbita dourada inclinada + satélite */}
        <g transform="rotate(-24 16 16)">
          <ellipse cx="16" cy="16" rx="13" ry="6.5" fill="none" strokeWidth="2.5" className="stroke-accent" />
          <circle cx="16" cy="9.5" r="2" className="fill-accent" />
        </g>
        {/* Moeda/carteira: disco teal com vazado central */}
        <circle cx="16" cy="16" r="8" className="fill-primary" />
        <circle cx="16" cy="16" r="3.2" className="fill-surface" />
      </svg>
      {showWordmark ? (
        <span
          className={cn(
            "font-display text-lg font-bold leading-none tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          Guia Financeiro
        </span>
      ) : null}
    </span>
  );
}
