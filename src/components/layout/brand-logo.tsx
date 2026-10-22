import { cn } from "@/lib/utils";
import { LogoIcon } from "./logo-icon";
import type { LogoIconProps } from "./logo-icon";
import { LogoFull } from "./logo-full";

export type { LogoIconProps } from "./logo-icon";
export { LogoIcon } from "./logo-icon";
export type { LogoFullProps } from "./logo-full";
export { LogoFull } from "./logo-full";

export interface BrandLogoProps {
  className?: string;
  /** Exibe o wordmark "Áxis" ao lado do símbolo (padrão: false). */
  showWordmark?: boolean;
  /** Exibe subtítulo "Finance" abaixo do wordmark (padrão: false). */
  showSubtitle?: boolean;
  /** Texto do subtítulo (padrão: "Finance"). */
  subtitleText?: string;
  /** Tamanho e classes do símbolo (padrão: size-8). */
  markClassName?: string;
  /** Classes adicionais para o texto "Áxis". */
  wordmarkClassName?: string;
  /** Classes adicionais para o subtítulo. */
  subtitleClassName?: string;
  /** Força exibição da versão Pro (Âmbar/Dourada). Se omitido, detecta via assinatura ativa. */
  isPro?: boolean;
  /** Modo de tema visual ("light" | "dark" | "auto"). Padrão: "auto". */
  themeMode?: LogoIconProps["themeMode"];
  /** Mantido para retrocompatibilidade. */
  accentReactive?: boolean;
  /** Variante gráfica do símbolo ("default" | "monochrome" | "white" | "dark"). */
  variant?: LogoIconProps["variant"];
  /** Ação de clique opcional. */
  onClick?: () => void;
}

/**
 * BrandLogo — Ponto único de entrada para a identidade oficial da marca Áxis Finance.
 * Utiliza o motor gráfico de alta resolução (LogoIcon e LogoFull), garantindo
 * zero serrilhados em qualquer densidade de pixels, máxima nitidez e reatividade
 * automática ao modo Pro (Âmbar/Dourado) e tema Claro/Escuro.
 */
export function BrandLogo({
  className,
  showWordmark = false,
  showSubtitle = false,
  subtitleText = "Finance",
  markClassName,
  wordmarkClassName,
  subtitleClassName,
  isPro,
  themeMode,
  accentReactive = true,
  variant = "default",
  onClick,
}: BrandLogoProps) {
  if (showWordmark) {
    return (
      <LogoFull
        className={className}
        markClassName={markClassName}
        wordmarkClassName={wordmarkClassName}
        subtitleClassName={subtitleClassName}
        showSubtitle={showSubtitle}
        subtitleText={subtitleText}
        isPro={isPro}
        themeMode={themeMode}
        accentReactive={accentReactive}
        variant={variant}
        onClick={onClick}
      />
    );
  }

  return (
    <span
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "inline-flex items-center justify-center select-none overflow-hidden min-w-0",
        onClick && "cursor-pointer hover:opacity-90 active:scale-[0.98]",
        className,
      )}
    >
      <LogoIcon
        className={cn(
          "size-8 shrink-0 transition-transform duration-200 ease-out",
          markClassName,
        )}
        isPro={isPro}
        themeMode={themeMode}
        accentReactive={accentReactive}
        variant={variant}
        title="Áxis"
        aria-hidden={false}
      />
    </span>
  );
}
