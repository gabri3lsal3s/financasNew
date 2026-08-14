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

const SIZE = 128;
const STROKE_WIDTH = 20;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

/**
 * CategoryDonut — distribuição visual das principais categorias de despesa
 * (F8). Anel SVG com paleta de 10 cores + legenda com participação e valor.
 * `aria-hidden` no anel (decorativo); a legenda é o conteúdo acessível.
 */
export function CategoryDonut({ slices, totalCents, centerValue, className }: CategoryDonutProps) {
  const total = totalCents ?? slices.reduce((acc, slice) => acc + slice.valueCents, 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <div className="flex size-32 items-center justify-center rounded-full border-4 border-muted">
          <p className="text-xs text-muted-foreground">Sem despesas</p>
        </div>
      </div>
    );
  }

  // Acumula o dashoffset de cada arco sem mutação no escopo do render
  // (compatível com o React Compiler — sem reassign de variável externa).
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
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6", className)}>
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-32 -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            className="stroke-muted"
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
              className={arc.className}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="num text-center text-xs font-semibold text-foreground">
            {centerValue ?? formatCentsAsBRL(total)}
          </p>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice, index) => {
          const percent = total > 0 ? (slice.valueCents / total) * 100 : 0;
          return (
            <li key={slice.label} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  slice.colorClassName?.replace("stroke-", "bg-") ??
                    (CAT_DONUT_PALETTE[index % CAT_DONUT_PALETTE.length] ?? "stroke-cat-1").replace("stroke-", "bg-"),
                )}
              />
              <span className="truncate font-medium text-foreground">{slice.label}</span>
              <span className="num ml-auto pl-2 text-muted-foreground">
                {percent.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
              </span>
              <span className="num w-20 text-right text-muted-foreground">
                {formatCentsAsBRL(slice.valueCents)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
