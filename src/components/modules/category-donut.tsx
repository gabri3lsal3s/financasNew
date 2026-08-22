import { useState } from "react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";

export interface DonutSlice {
  key?: string;
  label: string;
  valueCents: number;
  /** Subtítulo descritivo (ex.: classe do ativo "Ações" ou código da categoria). */
  subtitle?: string | null;
  /** Ícone cadastrado da categoria (opcional). */
  icon?: string | null;
  /** Cor cadastrada da categoria (hex ou HSL, opcional). */
  color?: string | null;
  /** Classe de cor do arco (ex.: "stroke-cat-1") — default pela posição na paleta. */
  colorClassName?: string;
  /** Ação ao clicar no arco ou na legenda deste item. */
  onClick?: () => void;
}

export interface CategoryDonutProps {
  /** Fatias ordenadas por valor (desc) para a leitura do anel. */
  slices: DonutSlice[];
  /** Total usado na proporção (default: soma das fatias). */
  totalCents?: number;
  /** Centro do donut: valor total formatado (default). */
  centerValue?: string;
  className?: string;
  /** Classe adicional para o container de lista/legendas (ex.: grid/scroll/max-height). */
  listClassName?: string;
  /** Texto para estado vazio quando não há fatias. */
  emptyText?: string;
  /** Callback global acionado ao clicar em uma fatia ou legenda. */
  onSliceClick?: (slice: DonutSlice, index: number) => void;
}

/** Paleta com os 10 tokens de cor (--cat-1..10) que se adaptam automaticamente a light e dark mode. */
const CAT_HSL_VARS = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
  "var(--cat-8)",
  "var(--cat-9)",
  "var(--cat-10)",
];

function getSliceColor(slice: DonutSlice, index: number): string {
  if (slice.color) return slice.color;
  const varName = CAT_HSL_VARS[index % CAT_HSL_VARS.length];
  return `hsl(${varName})`;
}

const SIZE = 144;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

/**
 * CategoryDonut — distribuição visual interativa de categorias ou ativos.
 * Anel SVG de alto contraste com cores dinâmicas HSL, sincronização de hover
 * e suporte a cliques nas fatias e legendas para abrir detalhes.
 */
export function CategoryDonut({
  slices,
  totalCents,
  centerValue,
  className,
  listClassName,
  emptyText = "Sem despesas",
  onSliceClick,
}: CategoryDonutProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-surface/60">
          <p className="text-xs font-medium text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  const handleItemClick = (slice: DonutSlice, index: number) => {
    slice.onClick?.();
    onSliceClick?.(slice, index);
  };

  // Acumula o dashoffset de cada arco sem mutação no escopo do render
  const arcs = slices.reduce<
    {
      key: string;
      dash: number;
      offset: number;
      colorStyle: string;
      slice: DonutSlice;
      index: number;
    }[]
  >((acc, slice, index) => {
    const dash = (slice.valueCents / total) * CIRCUMFERENCE;
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.dash : 0;
    acc.push({
      key: slice.key ?? `${slice.label}-${index}`,
      dash,
      offset,
      colorStyle: getSliceColor(slice, index),
      slice,
      index,
    });
    return acc;
  }, []);

  return (
    <div
      className={cn("flex flex-col items-center gap-6 md:flex-row md:items-start w-full min-w-0", className)}
      data-swipe-nav-ignore
    >
      {/* Anel SVG de alto contraste e interativo */}
      <div className="relative shrink-0 flex items-center justify-center py-1">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-36 sm:size-40 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            className="stroke-border/40 dark:stroke-border/60"
          />
          {arcs.map((arc) => {
            const isHovered = hoveredIndex === arc.index;
            const isClickable = Boolean(arc.slice.onClick || onSliceClick);
            return (
              <circle
                key={arc.key}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                strokeWidth={isHovered ? STROKE_WIDTH + 3 : STROKE_WIDTH}
                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                strokeDashoffset={-arc.offset}
                style={{
                  stroke: arc.colorStyle,
                  opacity: hoveredIndex !== null && !isHovered ? 0.5 : 1,
                  cursor: isClickable ? "pointer" : "default",
                }}
                className="transition-all duration-200"
                onMouseEnter={() => setHoveredIndex(arc.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => handleItemClick(arc.slice, arc.index)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Total</span>
          <p className="privacy-mask text-xs sm:text-sm font-bold text-foreground tracking-tight">
            {centerValue ?? <MoneyText cents={total} tone="default" className="text-xs sm:text-sm font-bold tracking-tight" />}
          </p>
        </div>
      </div>

      {/* Lista de fatias com legendas detalhadas em grid responsivo */}
      <ul className={cn("w-full min-w-0 space-y-2.5", listClassName)}>
        {slices.map((slice, index) => {
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          const colorStyle = getSliceColor(slice, index);
          const isClickable = Boolean(slice.onClick || onSliceClick);
          const isHovered = hoveredIndex === index;

          return (
            <li
              key={slice.key ?? `${slice.label}-${index}`}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={isClickable ? `Ver detalhes de ${slice.label}` : undefined}
              onClick={isClickable ? () => handleItemClick(slice, index) : undefined}
              onKeyDown={
                isClickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(slice, index);
                      }
                    }
                  : undefined
              }
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                "group flex flex-col gap-1.5 rounded-xl px-2.5 py-1.5 transition-all min-w-0 w-full border border-transparent",
                isClickable && "cursor-pointer hover:bg-surface-hover/80 hover:border-border/60 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isHovered && "bg-surface-hover/80 border-border/80 shadow-xs",
              )}
            >
              <div className="flex items-center gap-2 text-xs min-w-0 w-full">
                {slice.icon ? (
                  <CategoryIcon icon={slice.icon} color={colorStyle} className="size-4 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: colorStyle }}
                    className="size-3 shrink-0 rounded-full ring-2 ring-surface shadow-xs transition-transform group-hover:scale-110"
                  />
                )}
                <div className="min-w-0 flex-1 flex flex-col">
                  <span
                    className={cn(
                      "truncate font-semibold text-foreground transition-colors",
                      isClickable && "group-hover:text-primary",
                    )}
                    title={slice.label}
                  >
                    {slice.label}
                  </span>
                  {slice.subtitle ? (
                    <span className="text-[10px] text-muted-foreground truncate">{slice.subtitle}</span>
                  ) : null}
                </div>
                <span className="num font-bold text-foreground text-xs shrink-0 tabular-nums">
                  {Math.round(percent)}%
                </span>
                <MoneyText
                  cents={slice.valueCents}
                  tone="default"
                  className="privacy-mask min-w-[4.5rem] text-right text-xs font-semibold shrink-0 tabular-nums"
                />
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50 dark:bg-border/60" aria-hidden="true">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(2, percent))}%`,
                    backgroundColor: colorStyle,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
