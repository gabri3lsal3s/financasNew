import { type KeyboardEvent, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface TargetDonutItem {
  key: string;
  label: string;
  targetPercent: number;
  countAssets?: number;
  color?: string;
}

export interface InteractiveTargetDonutProps {
  items: readonly TargetDonutItem[];
  selectedKey?: string | null;
  onSelectKey?: (key: string | null) => void;
  onChangeTarget?: (key: string, nextTarget: number) => void;
  totalCeiling?: number;
  unitLabel?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

/** Paleta com os 10 tokens de cor (--cat-1..10) adaptáveis a light e dark mode */
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

function getItemColor(item: TargetDonutItem, index: number): string {
  if (item.color) return item.color;
  const varName = CAT_HSL_VARS[index % CAT_HSL_VARS.length];
  return `hsl(${varName})`;
}

const SIZE = 160;
const STROKE_WIDTH = 15;
const RADIUS = (SIZE - STROKE_WIDTH) / 2; // 72.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~455.53
const CENTER = SIZE / 2;
const GAP_SPACING = 5;
const TOTAL_GAP = STROKE_WIDTH + GAP_SPACING;

/**
 * InteractiveTargetDonut — Gráfico Donut Vetorial Nativo (Pure SVG)
 * para visualização geométrica da carteira ideal e ajuste rápido de metas.
 *
 * Características:
 * - Renderização em alta resolução (Pure SVG sem libs canvas pesadas);
 * - Sincronização bidirecional (seleção de fatia $\leftrightarrow$ lista externa);
 * - Extremidades arredondadas elegantes com micro-gaps proporcionais;
 * - Ajuste rápido no painel do Donut com passos de $\pm 1\%$ e $\pm 5\%$;
 * - Indicação visual de margem livre ou excesso percentual.
 */
export function InteractiveTargetDonut({
  items,
  selectedKey = null,
  onSelectKey,
  onChangeTarget,
  totalCeiling = 100,
  unitLabel = "%",
  title = "Alocação Ideal",
  className,
  disabled = false,
}: InteractiveTargetDonutProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const totalSum = items.reduce((acc, item) => acc + (Number.isFinite(item.targetPercent) ? item.targetPercent : 0), 0);
  const roundedSum = Math.round(totalSum * 10) / 10;
  const freePercent = Math.max(0, Math.round((totalCeiling - totalSum) * 10) / 10);
  const isOverflow = roundedSum > totalCeiling;
  const overflowPercent = Math.max(0, Math.round((totalSum - totalCeiling) * 10) / 10);

  // Consideramos a base de cálculo para a geometria visual
  const denominator = isOverflow ? totalSum : totalCeiling;
  const effectiveDenominator = denominator > 0 ? denominator : 100;

  const validItems = items.filter((item) => item.targetPercent > 0);
  const hasMultipleItems = validItems.length > 1;

  const selectedItem = items.find((item) => item.key === selectedKey) ?? null;
  const selectedIndex = selectedItem ? items.findIndex((i) => i.key === selectedItem.key) : -1;
  const selectedColor = selectedItem && selectedIndex >= 0 ? getItemColor(selectedItem, selectedIndex) : undefined;

  const handleSliceClick = (key: string) => {
    if (disabled) return;
    const nextKey = selectedKey === key ? null : key;
    triggerSensory("selection");
    onSelectKey?.(nextKey);
  };

  const handleAdjustTarget = (delta: number) => {
    if (disabled || !selectedItem || !onChangeTarget) return;
    const current = selectedItem.targetPercent;
    const next = Math.max(0, Math.min(100, Math.round((current + delta) * 10) / 10));
    triggerSensory("selection");
    onChangeTarget(selectedItem.key, next);
  };

function computeVisualTargetShares(items: readonly TargetDonutItem[], denominator: number, minShare = 0.045): number[] {
  const n = items.length;
  if (n <= 1) return items.map(() => 1);

  const effectiveMin = Math.min(minShare, 0.85 / n);
  const rawShares = items.map((item) => (denominator > 0 ? item.targetPercent / denominator : 1 / n));

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

  // Cálculo das posições dos arcos com bordas arredondadas e gaps seguros sem sobreposição
  const visualShares = computeVisualTargetShares(validItems, effectiveDenominator, 0.045);
  const totalGapBudget = hasMultipleItems ? validItems.length * TOTAL_GAP : 0;
  const availableDashBudget = Math.max(10, CIRCUMFERENCE - totalGapBudget);

  const arcs = validItems.map((item, index) => {
    const itemIndex = items.findIndex((i) => i.key === item.key);
    const color = getItemColor(item, itemIndex >= 0 ? itemIndex : 0);

    let dash: number;
    let offset: number;

    if (hasMultipleItems) {
      const visualShare = visualShares[index] ?? 0;
      dash = Math.max(0.1, visualShare * availableDashBudget);

      const priorVisualShare = visualShares.slice(0, index).reduce((sum, v) => sum + v, 0);
      const priorOffset = priorVisualShare * availableDashBudget + index * TOTAL_GAP;
      offset = priorOffset + TOTAL_GAP / 2;
    } else {
      dash = CIRCUMFERENCE;
      offset = 0;
    }

    return {
      key: item.key,
      label: item.label,
      targetPercent: item.targetPercent,
      color,
      dash,
      offset,
      isSelected: selectedKey === item.key,
      isHovered: hoveredKey === item.key,
      strokeLinecap: (hasMultipleItems ? "round" : "butt") as "round" | "butt",
    };
  });


  return (
    <div
      className={cn(
        "flex flex-col md:flex-row items-center justify-between gap-5 rounded-2xl border border-border/80 bg-surface/70 p-4 sm:p-5 shadow-xs transition-all",
        className,
      )}
      data-swipe-nav-ignore
    >
      {/* Visualização do Donut SVG */}
      <div className="flex flex-col sm:flex-row items-center gap-5 w-full md:w-auto">
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="size-40 sm:size-48 md:size-52 lg:size-56 -rotate-90 transition-transform duration-300"
            aria-label={`Gráfico de metas: ${title}`}
            role="img"
          >
            {/* Trilha de fundo neutra */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE_WIDTH}
              className="stroke-border/30 dark:stroke-border/50"
            />

            {/* Arcos preenchidos com extremidades arredondadas sem sobreposição */}
            {arcs.map((arc) => {
              const strokeWidth = arc.isSelected ? STROKE_WIDTH + 2.5 : arc.isHovered ? STROKE_WIDTH + 1.5 : STROKE_WIDTH;
              const opacity = (selectedKey && !arc.isSelected) || (hoveredKey && !arc.isHovered && !arc.isSelected) ? 0.4 : 1;

              return (
                <circle
                  key={arc.key}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                  strokeDashoffset={-arc.offset}
                  strokeLinecap={arc.strokeLinecap}
                  role="button"
                  tabIndex={0}
                  aria-label={`${arc.label}: ${arc.targetPercent.toFixed(1)}${unitLabel}`}
                  className="transition-all duration-200 cursor-pointer focus:outline-none"
                  style={{ opacity }}
                  onMouseEnter={() => setHoveredKey(arc.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => handleSliceClick(arc.key)}
                  onKeyDown={(e: KeyboardEvent<SVGCircleElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSliceClick(arc.key);
                    }
                  }}
                />
              );
            })}
          </svg>


          {/* Conteúdo central do Donut */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3 sm:px-4"
            aria-live="polite"
          >
            {selectedItem ? (
              <>
                <span
                  className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider truncate max-w-[110px] sm:max-w-[140px]"
                  style={{ color: selectedColor }}
                >
                  {selectedItem.label}
                </span>
                <span className="num font-mono text-sm sm:text-base md:text-lg font-bold text-foreground leading-tight mt-0.5">
                  {selectedItem.targetPercent.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal ml-0.5">{unitLabel}</span>
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">selecionado</span>
              </>
            ) : (
              <>
                <span className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  Alocado
                </span>
                <span
                  className={cn(
                    "num font-mono text-sm sm:text-base md:text-lg font-bold leading-tight mt-0.5",
                    isOverflow ? "text-critical-strong" : "text-foreground",
                  )}
                >
                  {roundedSum.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal ml-0.5">{unitLabel}</span>
                </span>
                {freePercent > 0 ? (
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">
                    {freePercent.toFixed(1)}{unitLabel} livre
                  </span>
                ) : isOverflow ? (
                  <span className="text-[10px] sm:text-xs text-critical-strong font-semibold mt-0.5">
                    +{overflowPercent.toFixed(1)}{unitLabel}
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-xs text-positive-strong font-medium mt-0.5">100% calibrado</span>
                )}
              </>
            )}
          </div>
        </div>


        {/* Legendas e Tags Rápidas das Fatias */}
        <div className="flex flex-col gap-1.5 min-w-0 w-full sm:w-auto">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground tracking-tight">{title}</span>
            {selectedItem ? (
              <button
                type="button"
                onClick={() => handleSliceClick(selectedItem.key)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer"
              >
                <X className="size-3" aria-hidden="true" />
                Limpar seleção
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {items.map((item, idx) => {
              const color = getItemColor(item, idx);
              const isSelected = selectedKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSliceClick(item.key)}
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium border transition-all cursor-pointer",
                    isSelected
                      ? "bg-surface border-foreground/30 shadow-xs ring-1 ring-border"
                      : "bg-surface/50 border-border/60 hover:bg-surface-hover/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="truncate max-w-[110px] font-medium text-foreground">{item.label}</span>
                  <span className="num font-mono text-[11px] font-bold text-foreground">
                    {item.targetPercent.toFixed(1)}{unitLabel}
                  </span>
                </button>
              );
            })}

            {freePercent > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground bg-muted/30 border border-dashed border-border/80">
                <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" aria-hidden="true" />
                <span>Livre: {freePercent.toFixed(1)}{unitLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Painel Contextual de Ajuste Rápido */}
      {selectedItem && onChangeTarget ? (
        <div className="flex flex-col gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-border/60 md:pl-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-foreground truncate">
              Ajuste rápido: <span style={{ color: selectedColor }}>{selectedItem.label}</span>
            </span>
            <span className="num font-mono font-bold text-xs text-foreground">
              {selectedItem.targetPercent.toFixed(1)}{unitLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedItem.targetPercent <= 0}
              onClick={() => handleAdjustTarget(-5)}
              className="h-7 px-2 text-xs gap-0.5"
              aria-label={`Diminuir 5% de ${selectedItem.label}`}
            >
              <ChevronLeft className="size-3" aria-hidden="true" />
              -5{unitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedItem.targetPercent <= 0}
              onClick={() => handleAdjustTarget(-1)}
              className="h-7 px-2 text-xs gap-0.5"
              aria-label={`Diminuir 1% de ${selectedItem.label}`}
            >
              <Minus className="size-3" aria-hidden="true" />
              -1{unitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedItem.targetPercent >= 100}
              onClick={() => handleAdjustTarget(1)}
              className="h-7 px-2 text-xs gap-0.5"
              aria-label={`Aumentar 1% de ${selectedItem.label}`}
            >
              <Plus className="size-3" aria-hidden="true" />
              +1{unitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || selectedItem.targetPercent >= 100}
              onClick={() => handleAdjustTarget(5)}
              className="h-7 px-2 text-xs gap-0.5"
              aria-label={`Aumentar 5% de ${selectedItem.label}`}
            >
              +5{unitLabel}
              <ChevronRight className="size-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
