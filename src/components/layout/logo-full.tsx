import { cn } from "@/lib/utils";
import { useIsPro } from "@/hooks/use-is-pro";
import { LogoIcon } from "./logo-icon";
import type { LogoIconProps } from "./logo-icon";

export interface LogoFullProps {
  className?: string;
  /** Classes adicionais para o símbolo / ícone */
  markClassName?: string;
  /** Classes adicionais para a tipografia "ÁXIS" */
  wordmarkClassName?: string;
  /** Classes adicionais para o subtítulo */
  subtitleClassName?: string;
  /** Se deve exibir o subtítulo abaixo do wordmark (padrão: false) */
  showSubtitle?: boolean;
  /** Texto do subtítulo customizado (padrão: "Finance") */
  subtitleText?: string;
  /** Orientação do lockup: "horizontal" (padrão) ou "vertical" (empilhado) */
  orientation?: "horizontal" | "vertical";
  /** Se deve renderizar a versão Pro (Âmbar/Dourado) */
  isPro?: boolean;
  /** Modo de tema visual ("light" | "dark" | "auto") */
  themeMode?: LogoIconProps["themeMode"];
  /** Mantido para retrocompatibilidade */
  accentReactive?: boolean;
  /** Variante gráfica do símbolo ("default" | "monochrome" | "white" | "dark") */
  variant?: LogoIconProps["variant"];
  /** Tamanho predefinido do conjunto */
  size?: "sm" | "md" | "lg" | "xl";
  /** Handler de clique opcional */
  onClick?: () => void;
  /** Label acessível customizado */
  "aria-label"?: string;
}

const SIZE_PRESETS = {
  sm: {
    mark: "size-6",
    wordmark: "text-base font-bold",
    subtitle: "text-[9px] tracking-wider",
    gap: "gap-2",
  },
  md: {
    mark: "size-8",
    wordmark: "text-lg font-black tracking-wider",
    subtitle: "text-[10px] tracking-widest",
    gap: "gap-2.5",
  },
  lg: {
    mark: "size-10 sm:size-12",
    wordmark: "text-xl sm:text-2xl font-black tracking-wider",
    subtitle: "text-xs tracking-widest",
    gap: "gap-3",
  },
  xl: {
    mark: "size-14 sm:size-16",
    wordmark: "text-3xl sm:text-4xl font-black tracking-widest",
    subtitle: "text-xs sm:text-sm tracking-widest",
    gap: "gap-3.5",
  },
} as const;

/**
 * LogoFull — Componente oficial de lockup completo da marca ÁXIS Finance.
 * Combina o símbolo orbital oficial com o wordmark corporativo e subtítulo,
 * permitindo orientação horizontal e vertical e alternância Pro/Free e Dark/Light.
 */
export function LogoFull({
  className,
  markClassName,
  wordmarkClassName,
  subtitleClassName,
  showSubtitle = false,
  subtitleText = "Finance",
  orientation = "horizontal",
  isPro,
  themeMode = "auto",
  accentReactive,
  variant = "default",
  size = "md",
  onClick,
  "aria-label": ariaLabel,
}: LogoFullProps) {
  const isProActive = useIsPro(isPro);
  const preset = SIZE_PRESETS[size];
  const isVertical = orientation === "vertical";

  return (
    <span
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel ?? (isProActive ? "ÁXIS PRO • Finance" : "ÁXIS • Finance")}
      className={cn(
        "inline-flex select-none min-w-0 transition-opacity",
        isVertical
          ? "flex-col items-center justify-center text-center gap-2"
          : cn("items-center", preset.gap),
        onClick && "cursor-pointer hover:opacity-90 active:scale-[0.99]",
        className,
      )}
    >
      <LogoIcon
        className={cn(preset.mark, markClassName)}
        isPro={isProActive}
        themeMode={themeMode}
        accentReactive={accentReactive}
        variant={variant}
        aria-hidden="true"
      />
      <span
        className={cn(
          "flex flex-col min-w-0 overflow-hidden whitespace-nowrap",
          isVertical ? "items-center" : "justify-center",
        )}
      >
        <div className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "font-display leading-tight text-foreground whitespace-nowrap tracking-wide",
              preset.wordmark,
              wordmarkClassName,
            )}
          >
            ÁXIS
          </span>
          {isProActive ? (
            <span
              className="inline-flex items-center rounded bg-amber-500/15 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/30 leading-none select-none"
              title="Plano Pro ativo"
            >
              PRO
            </span>
          ) : null}
        </div>
        {showSubtitle ? (
          <span
            className={cn(
              "font-medium uppercase text-muted-foreground whitespace-nowrap",
              preset.subtitle,
              subtitleClassName,
            )}
          >
            {subtitleText}
          </span>
        ) : null}
      </span>
    </span>
  );
}
