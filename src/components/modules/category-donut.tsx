import { useState } from "react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";
import { triggerSensory } from "@/services/sensory";

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
  /** Centro do donut: valor total customizado (opcional). */
  centerValue?: string;
  /** Chave do item selecionado (modo controlado). */
  selectedKey?: string | null;
  /** Callback acionado ao alterar a seleção da fatia. */
  onSelectKey?: (key: string | null) => void;
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

const SIZE = 160;
const STROKE_WIDTH = 15;
const RADIUS = (SIZE - STROKE_WIDTH) / 2; // 72.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~455.53
const CENTER = SIZE / 2;
const GAP_SPACING = 5; // espaçamento visual limpo entre pílulas em px
const TOTAL_GAP = STROKE_WIDTH + GAP_SPACING; // compensação do raio do round cap

/**
 * Normaliza proporções visuais para garantir que fatias minúsculas (ex.: 0.02% / R$ 4,60)
 * tenham um tamanho mínimo de arco visível, renderizando como pílulas arredondadas consistentes.
 */
function computeVisualShares(slices: DonutSlice[], total: number, minShare = 0.045): number[] {
  const n = slices.length;
  if (n <= 1) return slices.map(() => 1);

  const effectiveMin = Math.min(minShare, 0.85 / n);
  const rawShares = slices.map((s) => (total > 0 ? s.valueCents / total : 1 / n));

  let underAllocatedSum = 0;
  let overAllocatedRawSum = 0;
  const isSmall = rawShares.map((share) => share < effectiveMin);

  for (let i = 0; i < n; i++) {
    if (isSmall[i]) {
      underAllocatedSum += effectiveMin;
    } else {
      overAllocatedRawSum += rawShares[i] ?? 0;
    }
  }

  const remainingBudget = Math.max(0, 1 - underAllocatedSum);
  return rawShares.map((share, i) => {
    if (isSmall[i]) return effectiveMin;
    return overAllocatedRawSum > 0 ? (share / overAllocatedRawSum) * remainingBudget : remainingBudget / (n - underAllocatedSum / effectiveMin);
  });
}

/**
 * CategoryDonut — distribuição visual interativa de categorias ou ativos.
 * Anel SVG de alto contraste com bordas arredondadas (pill arcs), dimensionamento
 * confortável para mobile e alternância dinâmica no centro entre o Total e a Categoria ativa.
 */
export function CategoryDonut({
  slices,
  totalCents,
  centerValue,
  selectedKey: controlledSelectedKey,
  onSelectKey,
  className,
  listClassName,
  emptyText = "Sem despesas",
  onSliceClick,
}: CategoryDonutProps) {
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="flex size-32 sm:size-36 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-surface/60">
          <p className="text-xs font-medium text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  const activeSelectedKey = controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey;

  const validSlices = slices.filter((s) => s.valueCents > 0);
  const hasMultipleSlices = validSlices.length > 1;

  // Localiza o item ativo (hover tem prioridade temporária de visualização; se não houver hover, usa o selecionado)
  const activeHoveredSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;
  const activeSelectedSlice = activeSelectedKey
    ? slices.find((s, idx) => (s.key ? s.key === activeSelectedKey : `${s.label}-${idx}` === activeSelectedKey)) ?? null
    : null;
  const activeDisplaySlice = activeHoveredSlice ?? activeSelectedSlice;
  const activeDisplayIndex = activeDisplaySlice ? slices.findIndex((s) => s === activeDisplaySlice) : null;
  const activeDisplayPercent =
    activeDisplaySlice && total > 0 ? (activeDisplaySlice.valueCents / total) * 100 : 0;
  const activeDisplayColor =
    activeDisplaySlice && activeDisplayIndex !== null ? getSliceColor(activeDisplaySlice, activeDisplayIndex) : undefined;

  const handleItemClick = (slice: DonutSlice, index: number) => {
    const key = slice.key ?? `${slice.label}-${index}`;
    const nextKey = activeSelectedKey === key ? null : key;
    triggerSensory("selection");

    if (controlledSelectedKey === undefined) {
      setInternalSelectedKey(nextKey);
    }
    onSelectKey?.(nextKey);
    slice.onClick?.();
    onSliceClick?.(slice, index);
  };

  const handleResetSelection = () => {
    if (activeSelectedKey) {
      triggerSensory("selection");
      if (controlledSelectedKey === undefined) {
        setInternalSelectedKey(null);
      }
      onSelectKey?.(null);
    }
  };

  // Cálculo das proporções visuais para os arcos válidos com tamanho mínimo de fatia garantido
  const visualShares = computeVisualShares(validSlices, total, 0.045);
  const totalGapBudget = hasMultipleSlices ? validSlices.length * TOTAL_GAP : 0;
  const availableDashBudget = Math.max(10, CIRCUMFERENCE - totalGapBudget);

  // Mapeamento dos arcos sem sobreposição e com extremidades arredondadas uniformes
  const arcs = slices.map((slice, index) => {
    const sliceKey = slice.key ?? `${slice.label}-${index}`;
    const validIdx = validSlices.findIndex((s) => s === slice);
    const isVisible = slice.valueCents > 0 && validIdx >= 0;

    let dash = 0;
    let offset = 0;

    if (isVisible) {
      if (hasMultipleSlices) {
        const visualShare = visualShares[validIdx] ?? 0;
        dash = Math.max(0.1, visualShare * availableDashBudget);

        const priorVisualShare = visualShares.slice(0, validIdx).reduce((sum, v) => sum + v, 0);
        const priorOffset = priorVisualShare * availableDashBudget + validIdx * TOTAL_GAP;
        offset = priorOffset + TOTAL_GAP / 2;
      } else {
        dash = CIRCUMFERENCE;
        offset = 0;
      }
    }

    return {
      key: sliceKey,
      dash,
      offset,
      colorStyle: getSliceColor(slice, index),
      slice,
      index,
      isSelected: activeSelectedKey === sliceKey,
      isHovered: hoveredIndex === index,
      strokeLinecap: (hasMultipleSlices ? "round" : "butt") as "round" | "butt",
      isVisible,
    };
  });


  return (
    <div
      className={cn(
        "flex flex-col items-center gap-5 sm:gap-6 md:flex-row md:items-center w-full min-w-0",
        className,
      )}
      data-swipe-nav-ignore
    >
      {/* Anel SVG de alto contraste, bordas arredondadas e furo interno expandido */}
      <div className="relative shrink-0 flex items-center justify-center py-1">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-36 sm:size-40 md:size-44 -rotate-90 transition-transform duration-300"
          aria-hidden="true"
        >
          {/* Trilha de fundo suave */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            className="stroke-border/30 dark:stroke-border/50"
          />

          {/* Arcos preenchidos com extremidades arredondadas sem sobreposição */}
          {arcs
            .filter((arc) => arc.isVisible && arc.dash > 0)
            .map((arc) => {
              const isHighlighted = arc.isHovered || arc.isSelected;
              const hasAnyActive = hoveredIndex !== null || activeSelectedKey !== null;
              const opacity = hasAnyActive ? (isHighlighted ? 1 : 0.35) : 1;
              const strokeWidth = isHighlighted ? STROKE_WIDTH + 2.5 : STROKE_WIDTH;
              const isClickable = true;

              return (
                <circle
                  key={arc.key}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  strokeLinecap={arc.strokeLinecap}
                  style={{
                    stroke: arc.colorStyle,
                    opacity,
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


        {/* Centro Dinâmico e Confortável: Total <-> Categoria Selecionada */}
        <div
          role={activeSelectedKey ? "button" : undefined}
          tabIndex={activeSelectedKey ? 0 : undefined}
          onClick={handleResetSelection}
          onKeyDown={
            activeSelectedKey
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleResetSelection();
                  }
                }
              : undefined
          }
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center text-center px-3 rounded-full transition-all select-none",
            activeSelectedKey ? "cursor-pointer group hover:bg-surface-hover/30" : "pointer-events-none",
          )}
          aria-label={activeDisplaySlice ? `${activeDisplaySlice.label}: ${activeDisplayPercent.toFixed(1)}%` : "Total geral"}
        >
          {activeDisplaySlice ? (
            <>
              <div className="flex items-center gap-1 max-w-[105px] sm:max-w-[125px] min-w-0">
                {activeDisplaySlice.icon && activeDisplayColor ? (
                  <CategoryIcon icon={activeDisplaySlice.icon} color={activeDisplayColor} className="size-3 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: activeDisplayColor }}
                    className="size-2 rounded-full shrink-0"
                  />
                )}
                <span
                  className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate"
                  style={{ color: activeDisplayColor }}
                >
                  {activeDisplaySlice.label}
                </span>
              </div>
              <p className="privacy-mask text-xs sm:text-sm md:text-base font-bold text-foreground tracking-tight tabular-nums mt-0.5 leading-snug">
                <MoneyText cents={activeDisplaySlice.valueCents} tone="default" />
              </p>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold tabular-nums mt-0.5">
                {Math.round(activeDisplayPercent)}% <span className="font-normal text-[9px] text-muted-foreground/80">do total</span>
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Total
              </span>
              <p className="privacy-mask text-xs sm:text-sm md:text-base font-bold text-foreground tracking-tight tabular-nums mt-0.5 leading-snug">
                {centerValue ? (
                  centerValue
                ) : (
                  <MoneyText cents={total} tone="default" />
                )}
              </p>
              <span className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">
                {slices.length} {slices.length === 1 ? "item" : "itens"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Lista de fatias com legendas detalhadas e sincronização de clique/hover */}
      <ul className={cn("w-full min-w-0 space-y-1.5 sm:space-y-2", listClassName)}>
        {slices.map((slice, index) => {
          const sliceKey = slice.key ?? `${slice.label}-${index}`;
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          const colorStyle = getSliceColor(slice, index);
          const isSelected = activeSelectedKey === sliceKey;
          const isHovered = hoveredIndex === index;
          const isHighlighted = isSelected || isHovered;

          return (
            <li key={sliceKey} className="w-full min-w-0">
              <button
                type="button"
                aria-label={`Selecionar ${slice.label}`}
                aria-pressed={isSelected}
                onClick={() => handleItemClick(slice, index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  "group flex flex-col gap-1 sm:gap-1.5 rounded-xl px-2.5 py-1.5 transition-all min-w-0 w-full border text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "bg-surface-hover border-border shadow-xs ring-1 ring-border/80"
                    : isHovered
                      ? "bg-surface-hover/80 border-border/70 shadow-xs"
                      : "border-transparent hover:bg-surface-hover/60 hover:border-border/40",
                )}
              >
                <div className="flex items-center gap-2 text-xs min-w-0 w-full">
                  {slice.icon ? (
                    <CategoryIcon icon={slice.icon} color={colorStyle} className="size-4 shrink-0" />
                  ) : (
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: colorStyle }}
                      className={cn(
                        "size-3 shrink-0 rounded-full ring-2 ring-surface shadow-xs transition-transform",
                        isHighlighted && "scale-110",
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span
                      className={cn(
                        "truncate font-semibold transition-colors",
                        isHighlighted ? "text-foreground font-bold" : "text-foreground/90",
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
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 dark:bg-border/60" aria-hidden="true">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, percent))}%`,
                      backgroundColor: colorStyle,
                      opacity: isHighlighted ? 1 : 0.85,
                    }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

    </div>
  );
}

