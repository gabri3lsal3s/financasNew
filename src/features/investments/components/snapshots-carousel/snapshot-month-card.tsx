import { FileText } from "lucide-react";
import { Badge, Button, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatMonthYear } from "@/lib/date";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/services/masks";

export interface SnapshotMonthCardProps {
  point: PortfolioMonthlySeriesPoint;
  isCurrent: boolean;
  onGenerateReport?: (month: string) => void;
}

/**
 * Cartão mensal do carrossel de evolução patrimonial.
 */
export function SnapshotMonthCard({
  point,
  isCurrent,
  onGenerateReport,
}: SnapshotMonthCardProps) {
  const effectiveGain =
    point.totalReturnPnl !== undefined
      ? point.totalReturnPnl
      : point.valueBRL - point.costBRL;
  const effectivePct =
    point.totalReturnPct !== undefined
      ? point.totalReturnPct
      : point.costBRL > 0
        ? ((point.valueBRL - point.costBRL) / point.costBRL) * 100
        : 0;
  const twrMonth = point.twrMonthPct;
  const twrAcc = point.twrAccumulatedPct;

  return (
    <div
      className={cn(
        "min-w-[250px] max-w-[275px] sm:min-w-[260px] shrink-0 snap-start flex flex-col justify-between rounded-2xl border p-4 shadow-xs",
        isCurrent
          ? "border-portfolio/40 bg-portfolio/5 ring-1 ring-portfolio/20"
          : "border-border/80 bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {formatMonthYear(point.month)}
          </span>
          {isCurrent ? (
            <Badge variant="portfolio" size="xs" className="shrink-0">
              atual
            </Badge>
          ) : point.status === "provisional" ? (
            <Badge variant="warning" size="xs" className="shrink-0">
              provisório
            </Badge>
          ) : null}
        </div>

        {twrMonth !== null && twrMonth !== undefined ? (
          <span
            className={cn(
              "num font-mono text-[11px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded-pill",
              twrMonth >= 0
                ? "text-positive-strong bg-positive/10"
                : "text-negative-strong bg-negative/10",
            )}
            title={`Variação da cota no mês: ${formatSignedPct(twrMonth)}`}
          >
            {formatSignedPct(twrMonth)} m/m
          </span>
        ) : null}
      </div>

      <div className="min-w-0 my-2">
        <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
          Patrimônio
        </span>
        <MoneyText
          cents={numberToCents(point.valueBRL)}
          tone="default"
          className="text-lg sm:text-xl font-bold text-foreground tabular-nums whitespace-nowrap block"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-border/50 pt-2.5 text-xs">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground truncate font-medium">
            Custo
          </span>
          <MoneyText
            cents={numberToCents(point.costBRL)}
            tone="default"
            className="text-xs text-muted-foreground tabular-nums font-medium whitespace-nowrap"
          />
        </div>

        <div className="flex flex-col min-w-0 text-right">
          <span className="text-[10px] text-muted-foreground truncate font-medium">
            Proventos acum.
          </span>
          <MoneyText
            cents={numberToCents(point.accumulatedDividendsBRL ?? 0)}
            tone="positive"
            className="text-xs tabular-nums font-medium whitespace-nowrap"
          />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground truncate font-medium">
            Retorno Total
          </span>
          <span
            className={cn(
              "num font-semibold tabular-nums text-xs whitespace-nowrap",
              effectiveGain >= 0 ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            {formatSignedPct(effectivePct)}
          </span>
        </div>

        <div className="flex flex-col min-w-0 text-right">
          <span className="text-[10px] text-muted-foreground truncate font-medium">
            TWR Acum.
          </span>
          <span
            className={cn(
              "num font-mono font-semibold tabular-nums text-xs whitespace-nowrap",
              (twrAcc ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong",
            )}
          >
            {formatSignedPct(twrAcc ?? null)}
          </span>
        </div>
      </div>

      {onGenerateReport ? (
        <div className="pt-2 mt-1.5 border-t border-border/50 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onGenerateReport(point.month)}
            className="px-2.5 text-[11px] font-medium text-muted-foreground hover:text-portfolio gap-1"
            title={`Gerar Relatório Executivo de ${formatMonthYear(point.month)}`}
          >
            <FileText className="size-3.5" aria-hidden="true" />
            <span>Relatório do Mês</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
