import { numberToCents } from "@/domain/money";
import { calculatePositionRowYoC } from "@/domain/portfolio/position-grouping";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import type { PositionRow } from "@/components/modules/portfolio/position-types";

export interface PositionRentabilityCellProps {
  row: PositionRow;
  includeYoC?: boolean;
}

export function PositionRentabilityCell({ row, includeYoC = false }: PositionRentabilityCellProps) {
  const effectivePct = row.totalReturnPct !== undefined ? row.totalReturnPct : row.unrealizedPct;
  if (effectivePct === null) {
    return <span className="num text-sm text-muted-foreground">—</span>;
  }
  const toneClass = effectivePct >= 0 ? "text-positive-strong" : "text-negative-strong";
  const yoc = includeYoC ? calculatePositionRowYoC(row) : 0;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn("num text-sm font-semibold whitespace-nowrap", toneClass)}
        title={
          includeYoC && row.totalReturnPct !== undefined && row.unrealizedPct !== null
            ? `Retorno Total: ${formatSignedPct(effectivePct)} (Cotação: ${formatSignedPct(row.unrealizedPct)}${yoc > 0 ? ` + Proventos/YoC: ${formatPercent(yoc)}%` : ""})`
            : undefined
        }
      >
        {formatSignedPct(effectivePct)}
      </span>
      {yoc > 0 ? (
        <div className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          {row.unrealizedPct !== null ? (
            <span
              className={cn(
                "font-medium tabular-nums",
                row.unrealizedPct >= 0 ? "text-positive-strong" : "text-negative-strong",
              )}
              title={`Variação da cotação: ${formatSignedPct(row.unrealizedPct)}`}
            >
              Cota {formatSignedPct(row.unrealizedPct)}
            </span>
          ) : null}
          <span
            className="text-portfolio font-medium tabular-nums"
            title={`Yield on Cost acumulado: ${formatCentsAsBRL(numberToCents(row.dividends ?? 0))}`}
          >
            YoC {formatPercent(yoc)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
