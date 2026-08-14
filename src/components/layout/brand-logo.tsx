import { useId } from "react";
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
 * Logo oficial da marca "Guia Financeiro" (F10) — "carteira orbital" refinada
 * com o design de referência (`identidadeVisual/`): esfera teal com gradiente
 * vertical, faixas orbitais em Ouro Âmbar, núcleo Azul Petróleo e satélite
 * dourado no topo. 100% via tokens (fill-primary/portfolio/accent) — a
 * identidade propaga por `tokens.css`. Vetorial e `aria-hidden`.
 */
export function BrandLogo({
  className,
  showWordmark = true,
  markClassName,
  wordmarkClassName,
}: BrandLogoProps) {
  const gradientId = useId();
  const clipId = useId();

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", markClassName)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary-strong))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
          <clipPath id={clipId}>
            <circle cx="16" cy="16" r="14" />
          </clipPath>
        </defs>

        {/* Esfera (carteira orbital): teal com profundidade vertical */}
        <circle cx="16" cy="16" r="14" fill={`url(#${gradientId})`} />
        <g clipPath={`url(#${clipId})`}>
          {/* Núcleo Azul Petróleo (referência) */}
          <circle cx="16" cy="16" r="3.6" className="fill-portfolio" />
          {/* Faixas orbitais douradas: superior (~38%) e inferior (~79%) */}
          <rect x="1" y="11.7" width="30" height="1.9" rx="0.95" className="fill-accent" />
          <rect x="1" y="23.2" width="30" height="1.9" rx="0.95" className="fill-accent" />
        </g>
        {/* Satélite dourado no topo */}
        <circle cx="16" cy="3.6" r="1.6" className="fill-accent" />
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
