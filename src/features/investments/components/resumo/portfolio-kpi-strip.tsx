import { Info } from "lucide-react";
import { KpiCard } from "@/components/modules";
import { Badge, MoneyText, SkeletonKpi } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { PortfolioPerformanceSummary } from "@/domain/portfolio/resumo-metrics";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface PortfolioKpiStripProps {
  isLoading: boolean;
  totalBRL: number;
  totalDividendsBRL?: number;
  performance: PortfolioPerformanceSummary;
  onOpenExplainModal: () => void;
}

export function PortfolioKpiStrip({
  isLoading,
  totalBRL,
  totalDividendsBRL = 0,
  performance,
  onOpenExplainModal,
}: PortfolioKpiStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3" data-tour="investments-summary">
        <SkeletonKpi className="col-span-1" />
        <SkeletonKpi className="col-span-1" />
        <SkeletonKpi className="col-span-1" />
        <SkeletonKpi className="col-span-1" />
      </div>
    );
  }

  const rentabilidadeLabel = (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate">Rentabilidade</span>
      {performance.isTwrActive ? (
        <Badge variant="portfolio" size="xs" className="shrink-0 font-normal">
          TWR · Cotas
        </Badge>
      ) : performance.isCustodyActive ? (
        <Badge variant="muted" size="xs" className="shrink-0 font-normal">
          Custódia Aberta
        </Badge>
      ) : null}
      <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
    </div>
  );

  const rentabilidadeHint =
    performance.rentabilidadeMode === "twr" ? (
      performance.twrHintText
    ) : performance.rentabilidadeMode === "custody" ? (
      <span className="inline-flex items-center gap-1 tabular-nums">
        <MoneyText
          cents={performance.totalReturnCents}
          tone={performance.totalReturnPnlBRL >= 0 ? "positive" : "negative"}
          sign="explicit"
          variant="caption"
          className="text-[11px]"
        />
        <span>s/ custo</span>
      </span>
    ) : (
      "Cadastre seus ativos"
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3" data-tour="investments-summary">
      <KpiCard
        label="Patrimônio Total"
        cents={numberToCents(totalBRL)}
        hint={
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-[11px] font-medium whitespace-nowrap tabular-nums max-w-full",
              performance.totalReturnPnlBRL > 0
                ? "text-positive-strong"
                : performance.totalReturnPnlBRL < 0
                  ? "text-negative-strong"
                  : "text-foreground",
            )}
            title={`Retorno Contábil da Custódia Aberta: ${(performance.totalReturnPnlBRL ?? 0) >= 0 ? "+" : ""}${formatCentsAsBRL(performance.totalReturnCents)}${performance.totalReturnPct != null ? ` (${performance.totalReturnPct >= 0 ? "+" : ""}${performance.totalReturnPct.toFixed(1).replace(".", ",")}%)` : ""} | Cotação: ${performance.unrealizedPnlBRL >= 0 ? "+" : ""}${formatCentsAsBRL(numberToCents(performance.unrealizedPnlBRL))}${performance.capitalGainPct != null ? ` (${performance.capitalGainPct >= 0 ? "+" : ""}${performance.capitalGainPct.toFixed(1).replace(".", ",")}%)` : ""} | Proventos Ativos: +${formatCentsAsBRL(numberToCents(totalDividendsBRL))}`}
          >
            <span className="text-muted-foreground font-normal">Retorno contábil:</span>
            <span className="tabular-nums font-semibold">
              {performance.totalReturnPct != null
                ? `${performance.totalReturnPct >= 0 ? "+" : ""}${performance.totalReturnPct.toFixed(1).replace(".", ",")}%`
                : "0,0%"}
            </span>
          </span>
        }
        onClick={onOpenExplainModal}
      />

      <KpiCard
        label={rentabilidadeLabel}
        ariaLabel="Rentabilidade"
        value={performance.rentabilidadeValue}
        tone={performance.rentabilidadeTone}
        hint={rentabilidadeHint}
        onClick={onOpenExplainModal}
      />

      <KpiCard
        label={
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">Resultado Histórico</span>
            <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
        }
        ariaLabel="Resultado Histórico"
        cents={performance.allTimePnlCents}
        tone={performance.allTimePnlBRL >= 0 ? "positive" : "negative"}
        hint={
          <span
            className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground whitespace-nowrap tabular-nums"
            title={`P&L Histórico Total: ${formatCentsAsBRL(performance.allTimePnlCents)} | Passado Realizado: ${formatCentsAsBRL(performance.realizedPnlCents)} | Aberto: ${formatCentsAsBRL(performance.totalReturnCents)} | Proventos Totais: ${formatCentsAsBRL(numberToCents(totalDividendsBRL))}`}
          >
            <span>P&L Total (</span>
            <MoneyText
              cents={performance.realizedPnlCents}
              sign="explicit"
              tone="default"
              variant="caption"
              className="text-[11px] text-muted-foreground"
            />
            <span>pass.)</span>
          </span>
        }
        onClick={onOpenExplainModal}
      />

      <KpiCard
        label={
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">TIR (Fluxo do Bolso)</span>
            <Info className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
          </div>
        }
        ariaLabel="TIR (Fluxo do Bolso)"
        value={performance.irrLabel}
        tone={performance.irrTone}
        hint={performance.irrHint}
        onClick={onOpenExplainModal}
      />
    </div>
  );
}
