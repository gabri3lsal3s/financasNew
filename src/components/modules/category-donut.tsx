import { useMemo, useState } from "react";
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
  /** Número máximo de fatias desenhadas no anel SVG antes de agrupar em "Outros" (default: 7). */
  maxVisualSlices?: number;
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

interface InternalVisualSlice {
  key: string;
  label: string;
  valueCents: number;
  colorStyle: string;
  isOthersGroup?: boolean;
  memberKeys: string[];
}

/**
 * Normaliza proporções visuais para garantir que fatias visíveis no anel
 * tenham um tamanho mínimo de arco visível e renderizem como pílulas arredondadas consistentes.
 */
function computeVisualShares(slices: InternalVisualSlice[], total: number, minShare = 0.05): number[] {
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
 * confortável para mobile, agrupamento elegante de cauda longa (Top N + Outros)
 * e alternância dinâmica no centro entre o Total e a Categoria ativa.
 */
function getDynamicValueSize(valueCents: number): string {
  if (valueCents >= 100000000) return "text-[11px] sm:text-xs md:text-sm font-extrabold"; // >= R$ 1.000.000,00
  if (valueCents >= 10000000) return "text-xs sm:text-sm md:text-base font-extrabold"; // >= R$ 100.000,00
  return "text-xs sm:text-base md:text-lg font-extrabold";
}

export function CategoryDonut({
  slices,
  totalCents,
  centerValue,
  selectedKey: controlledSelectedKey,
  onSelectKey,
  className,
  listClassName,
  emptyText = "Sem despesas",
  maxVisualSlices = 7,
  onSliceClick,
}: CategoryDonutProps) {
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null);
  const [hoveredSliceKey, setHoveredSliceKey] = useState<string | null>(null);

  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);

  const activeSelectedKey = controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey;
  const validSlices = useMemo(() => slices.filter((s) => s.valueCents > 0), [slices]);

  // Agrupamento visual: quando há mais fatias do que maxVisualSlices, consolida a cauda longa em "Outros" no anel SVG
  const visualRingSlices = useMemo<InternalVisualSlice[]>(() => {
    if (validSlices.length <= maxVisualSlices) {
      return validSlices.map((s, idx) => {
        const key = s.key ?? `${s.label}-${idx}`;
        return {
          key,
          label: s.label,
          valueCents: s.valueCents,
          colorStyle: getSliceColor(s, idx),
          memberKeys: [key],
        };
      });
    }

    const topCount = Math.max(1, maxVisualSlices - 1);
    const topSlices = validSlices.slice(0, topCount);
    const others = validSlices.slice(topCount);
    const othersValueCents = others.reduce((acc, s) => acc + s.valueCents, 0);

    const mappedTop: InternalVisualSlice[] = topSlices.map((s, idx) => {
      const key = s.key ?? `${s.label}-${idx}`;
      return {
        key,
        label: s.label,
        valueCents: s.valueCents,
        colorStyle: getSliceColor(s, idx),
        memberKeys: [key],
      };
    });

    const othersKeys = others.map((s, idx) => s.key ?? `${s.label}-${topCount + idx}`);
    mappedTop.push({
      key: "__donut_others__",
      label: `Outros (${others.length})`,
      valueCents: othersValueCents,
      colorStyle: "hsl(var(--muted-foreground) / 0.55)",
      isOthersGroup: true,
      memberKeys: othersKeys,
    });

    return mappedTop;
  }, [validSlices, maxVisualSlices]);

  // Localiza o item ativo para o centro (hover tem precedência temporária sobre selecionado)
  const activeKey = hoveredSliceKey ?? activeSelectedKey;

  const activeDisplayItem = useMemo(() => {
    if (!activeKey) return null;
    if (activeKey === "__donut_others__") {
      const othersSlice = visualRingSlices.find((v) => v.key === "__donut_others__");
      return othersSlice ? { ...othersSlice, icon: null } : null;
    }
    const foundSlice = slices.find((s, idx) => (s.key ? s.key === activeKey : `${s.label}-${idx}` === activeKey));
    if (foundSlice) {
      const idx = slices.findIndex((s) => s === foundSlice);
      return {
        label: foundSlice.label,
        valueCents: foundSlice.valueCents,
        icon: foundSlice.icon,
        colorStyle: getSliceColor(foundSlice, idx >= 0 ? idx : 0),
      };
    }
    return visualRingSlices.find((v) => v.key === activeKey) ?? null;
  }, [activeKey, slices, visualRingSlices]);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="flex size-32 sm:size-36 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-surface/60">
          <p className="text-xs font-medium text-muted-foreground">{emptyText}</p>
        </div>
      </div>
    );
  }

  const hasMultipleRingSlices = visualRingSlices.length > 1;

  const activeDisplayPercent =
    activeDisplayItem && total > 0 ? (activeDisplayItem.valueCents / total) * 100 : 0;

  const handleItemClick = (key: string, slice?: DonutSlice) => {
    const nextKey = activeSelectedKey === key ? null : key;
    triggerSensory("selection");

    if (controlledSelectedKey === undefined) {
      setInternalSelectedKey(nextKey);
    }
    onSelectKey?.(nextKey);
    slice?.onClick?.();
    if (slice) {
      const idx = slices.findIndex((s) => s === slice);
      onSliceClick?.(slice, idx >= 0 ? idx : 0);
    }
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

  // Cálculo das proporções visuais para os arcos do anel SVG
  const visualShares = computeVisualShares(visualRingSlices, total, 0.05);
  const totalGapBudget = hasMultipleRingSlices ? visualRingSlices.length * TOTAL_GAP : 0;
  const availableDashBudget = Math.max(10, CIRCUMFERENCE - totalGapBudget);

  // Mapeamento dos arcos do anel SVG
  const arcs = visualRingSlices.map((vSlice, index) => {
    let dash: number;
    let offset: number;

    if (hasMultipleRingSlices) {
      const visualShare = visualShares[index] ?? 0;
      dash = Math.max(0.1, visualShare * availableDashBudget);

      const priorVisualShare = visualShares.slice(0, index).reduce((sum, v) => sum + v, 0);
      const priorOffset = priorVisualShare * availableDashBudget + index * TOTAL_GAP;
      offset = priorOffset + TOTAL_GAP / 2;
    } else {
      dash = CIRCUMFERENCE;
      offset = 0;
    }

    const isRingSelected = activeSelectedKey !== null && vSlice.memberKeys.includes(activeSelectedKey);
    const isRingHovered = hoveredSliceKey !== null && vSlice.memberKeys.includes(hoveredSliceKey);

    return {
      key: vSlice.key,
      label: vSlice.label,
      valueCents: vSlice.valueCents,
      dash,
      offset,
      colorStyle: vSlice.colorStyle,
      isSelected: isRingSelected,
      isHovered: isRingHovered,
      isOthersGroup: vSlice.isOthersGroup,
      strokeLinecap: (hasMultipleRingSlices ? "round" : "butt") as "round" | "butt",
    };
  });

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-6 md:flex-row md:items-center lg:gap-8 w-full min-w-0",
        className,
      )}
      data-swipe-nav-ignore
    >
      {/* Anel SVG responsivo de alto contraste, bordas arredondadas e furo interno expandido */}
      <div className="relative shrink-0 flex items-center justify-center py-2 self-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-44 sm:size-48 md:size-52 lg:size-56 xl:size-60 -rotate-90 transition-transform duration-300"
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
            .filter((arc) => arc.dash > 0)
            .map((arc) => {
              const isHighlighted = arc.isHovered || arc.isSelected;
              const hasAnyActive = hoveredSliceKey !== null || activeSelectedKey !== null;
              const opacity = hasAnyActive ? (isHighlighted ? 1 : 0.35) : 1;
              const strokeWidth = isHighlighted ? STROKE_WIDTH + 2.5 : STROKE_WIDTH;

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
                    cursor: "pointer",
                  }}
                  className="transition-all duration-200"
                  onMouseEnter={() => setHoveredSliceKey(arc.key)}
                  onMouseLeave={() => setHoveredSliceKey(null)}
                  onClick={() => handleItemClick(arc.key)}
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
            "absolute inset-[10%] flex flex-col items-center justify-center text-center p-2 rounded-full transition-all select-none overflow-hidden",
            activeSelectedKey ? "cursor-pointer group hover:bg-surface-hover/40 ring-1 ring-border/50" : "pointer-events-none",
          )}
          aria-label={activeDisplayItem ? `${activeDisplayItem.label}: ${activeDisplayPercent.toFixed(1)}%` : "Total geral"}
        >
          {activeDisplayItem ? (
            <div className="flex flex-col items-center justify-center w-full max-w-[85%] min-w-0">
              <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
                {"icon" in activeDisplayItem && activeDisplayItem.icon && activeDisplayItem.colorStyle ? (
                  <CategoryIcon icon={activeDisplayItem.icon} color={activeDisplayItem.colorStyle} className="size-3.5 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: activeDisplayItem.colorStyle }}
                    className="size-2 rounded-full shrink-0"
                  />
                )}
                <span
                  className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate"
                  style={{ color: activeDisplayItem.colorStyle }}
                  title={activeDisplayItem.label}
                >
                  {activeDisplayItem.label}
                </span>
              </div>
              <p
                className={cn(
                  "privacy-mask text-foreground tracking-tight tabular-nums mt-0.5 leading-snug whitespace-nowrap",
                  getDynamicValueSize(activeDisplayItem.valueCents),
                )}
              >
                <MoneyText cents={activeDisplayItem.valueCents} tone="default" />
              </p>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold tabular-nums mt-0.5 whitespace-nowrap">
                {Math.round(activeDisplayPercent)}% <span className="font-normal text-[9px] text-muted-foreground/80">do total</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full max-w-[85%] min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-muted-foreground truncate max-w-full">
                Total
              </span>
              <p
                className={cn(
                  "privacy-mask text-foreground tracking-tight tabular-nums mt-0.5 leading-snug whitespace-nowrap",
                  getDynamicValueSize(total),
                )}
              >
                {centerValue ? (
                  centerValue
                ) : (
                  <MoneyText cents={total} tone="default" />
                )}
              </p>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground/80 font-medium mt-0.5 whitespace-nowrap">
                {slices.length} {slices.length === 1 ? "item" : "itens"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lista de fatias com legendas detalhadas em 2 colunas no desktop quando houver múltiplos itens */}
      <ul
        className={cn(
          "w-full min-w-0",
          slices.length > 4
            ? "grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2"
            : "flex flex-col space-y-1.5 sm:space-y-2",
          listClassName,
        )}
      >
        {slices.map((slice, index) => {
          const sliceKey = slice.key ?? `${slice.label}-${index}`;
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          const colorStyle = getSliceColor(slice, index);
          const isSelected = activeSelectedKey === sliceKey;
          const isHovered = hoveredSliceKey === sliceKey;
          const isHighlighted = isSelected || isHovered;

          return (
            <li key={sliceKey} className="w-full min-w-0">
              <button
                type="button"
                aria-label={`Selecionar ${slice.label}`}
                aria-pressed={isSelected}
                onClick={() => handleItemClick(sliceKey, slice)}
                onMouseEnter={() => setHoveredSliceKey(sliceKey)}
                onMouseLeave={() => setHoveredSliceKey(null)}
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
