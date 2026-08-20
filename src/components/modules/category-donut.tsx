import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules/category-icon";

export interface DonutSlice {
  label: string;
  valueCents: number;
  /** Ícone cadastrado da categoria (opcional). */
  icon?: string | null;
  /** Cor cadastrada da categoria (hex ou HSL, opcional). */
  color?: string | null;
  /** Classe de cor do arco (ex.: "stroke-cat-1") — default pela posição na paleta. */
  colorClassName?: string;
}

export interface CategoryDonutProps {
  /** Fatias ordenadas por valor (desc) para a leitura do anel. */
  slices: DonutSlice[];
  /** Total usado na proporção (default: soma das fatias). */
  totalCents?: number;
  /** Centro do donut: valor total formatado (default). */
  centerValue?: string;
  className?: string;
}

/** Paleta das 10 categorias (tokens --cat-1..10) — ordem de queda de valor. */
const CAT_DONUT_PALETTE = [
  "stroke-cat-1",
  "stroke-cat-2",
  "stroke-cat-3",
  "stroke-cat-4",
  "stroke-cat-5",
  "stroke-cat-6",
  "stroke-cat-7",
  "stroke-cat-8",
  "stroke-cat-9",
  "stroke-cat-10",
];

const SIZE = 136;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

/**
 * CategoryDonut — distribuição visual das principais categorias de despesa (F8).
 * Anel SVG de alto contraste com centro estruturado e lista com mini-barras de progresso relativas.
 */
export function CategoryDonut({ slices, totalCents, centerValue, className }: CategoryDonutProps) {
  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
        <div className="flex size-28 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-surface/60">
          <p className="text-xs font-medium text-muted-foreground">Sem despesas</p>
        </div>
      </div>
    );
  }

  // Acumula o dashoffset de cada arco sem mutação no escopo do render
  const arcs = slices.reduce<{ key: string; dash: number; offset: number; className: string; color?: string | null }[]>(
    (acc, slice, index) => {
      const dash = (slice.valueCents / total) * CIRCUMFERENCE;
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.dash : 0;
      acc.push({
        key: slice.label,
        dash,
        offset,
        color: slice.color,
        className: slice.colorClassName ?? (CAT_DONUT_PALETTE[index % CAT_DONUT_PALETTE.length] ?? "stroke-cat-1"),
      });
      return acc;
    },
    [],
  );

  return (
    // F20 — isolamento: gestos no donut (lista com hover) nunca viram swipe.
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center w-full min-w-0", className)} data-swipe-nav-ignore>
      {/* Anel SVG de alto contraste */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-32 sm:size-34 -rotate-90"
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
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
              strokeDashoffset={-arc.offset}
              style={arc.color ? { stroke: arc.color } : undefined}
              className={cn("transition-all duration-300", !arc.color && arc.className)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Total</span>
          <p className="privacy-mask text-xs sm:text-sm font-bold text-foreground tracking-tight">
            {centerValue ?? <MoneyText cents={total} tone="default" className="text-xs sm:text-sm font-bold tracking-tight" />}
          </p>
        </div>
      </div>

      {/* Lista de fatias com alto contraste */}
      <ul className="w-full min-w-0 space-y-2.5">
        {slices.map((slice, index) => {
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          const bgClass =
            slice.colorClassName?.replace("stroke-", "bg-") ??
            (CAT_DONUT_PALETTE[index % CAT_DONUT_PALETTE.length] ?? "stroke-cat-1").replace("stroke-", "bg-");

          return (
            <li
              key={slice.label}
              className="group flex flex-col gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-hover/60 min-w-0 w-full"
            >
              <div className="flex items-center gap-2 text-xs min-w-0 w-full">
                {slice.icon ? (
                  <CategoryIcon icon={slice.icon} color={slice.color} className="size-4 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    style={slice.color ? { backgroundColor: slice.color } : undefined}
                    className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-surface shadow-xs", !slice.color && bgClass)}
                  />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground" title={slice.label}>
                  {slice.label}
                </span>
                <span className="num font-bold text-foreground text-xs shrink-0 tabular-nums">
                  {percent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                </span>
                <MoneyText cents={slice.valueCents} tone="default" className="privacy-mask min-w-[4.5rem] text-right text-xs font-semibold shrink-0 tabular-nums" />
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50 dark:bg-border/60" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", !slice.color && bgClass)}
                  style={{
                    width: `${Math.min(100, Math.max(2, percent))}%`,
                    backgroundColor: slice.color ?? undefined,
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
