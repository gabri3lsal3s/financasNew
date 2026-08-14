/* eslint-disable react-refresh/only-export-components */
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface DonutSlice {
  label: string;
  valueCents: number;
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
export const CAT_DONUT_PALETTE = [
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
  const arcs = slices.reduce<{ key: string; dash: number; offset: number; className: string }[]>(
    (acc, slice, index) => {
      const dash = (slice.valueCents / total) * CIRCUMFERENCE;
      const previous = acc[acc.length - 1];
      const offset = previous ? previous.offset + previous.dash : 0;
      acc.push({
        key: slice.label,
        dash,
        offset,
        className: slice.colorClassName ?? (CAT_DONUT_PALETTE[index % CAT_DONUT_PALETTE.length] ?? "stroke-cat-1"),
      });
      return acc;
    },
    [],
  );

  return (
    <div className={cn("flex flex-col items-center gap-6 sm:flex-row sm:items-center", className)}>
      {/* Anel SVG de alto contraste */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-34 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            className="stroke-border/70 dark:stroke-border/80"
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
              className={cn("transition-all duration-300", arc.className)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Total</span>
          <p className="privacy-mask num text-xs sm:text-sm font-bold text-foreground tracking-tight">
            {centerValue ?? formatCentsAsBRL(total)}
          </p>
        </div>
      </div>

      {/* Lista de fatias com alto contraste */}
      <ul className="w-full min-w-0 space-y-2">
        {slices.map((slice, index) => {
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          const bgClass =
            slice.colorClassName?.replace("stroke-", "bg-") ??
            (CAT_DONUT_PALETTE[index % CAT_DONUT_PALETTE.length] ?? "stroke-cat-1").replace("stroke-", "bg-");

          return (
            <li
              key={slice.label}
              className="group flex flex-col gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-surface-hover/50"
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 shrink-0 rounded-full ring-2 ring-surface", bgClass)}
                />
                <span className="truncate font-semibold text-foreground">{slice.label}</span>
                <span className="num ml-auto font-bold text-muted-foreground text-xs">
                  {percent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                </span>
                <span className="privacy-mask num w-22 text-right font-semibold text-foreground text-xs">
                  {formatCentsAsBRL(slice.valueCents)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40 dark:bg-border/60" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", bgClass)}
                  style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
