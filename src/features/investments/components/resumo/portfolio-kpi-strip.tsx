import { useMemo } from "react";
import { KpiCard } from "@/components/modules";
import { CalculationMemoryModal } from "@/components/modules/calculation-memory";
import { Badge, MoneyText, SkeletonKpi } from "@/components/ui";
import {
  buildAllTimePnlBreakdown,
  buildIrrBreakdown,
  buildPortfolioTotalBreakdown,
  buildTwrBreakdown,
  buildUnrealizedPnlBreakdown,
} from "@/domain/calculation-memory";
import { numberToCents } from "@/domain/money";
import type { TwrConsolidatedResult, XIRRResult } from "@/domain/portfolio";
import type { PortfolioPerformanceSummary } from "@/domain/portfolio/resumo-metrics";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface PortfolioKpiStripProps {
  isLoading: boolean;
  totalBRL: number;
  totalDividendsBRL?: number;
  performance: PortfolioPerformanceSummary;
  onOpenExplainModal: () => void;
  brlAssetsTotal?: number;
  usdAssetsTotalBRL?: number;
  cashBRL?: number;
  portfolioTwr?: TwrConsolidatedResult;
  portfolioIrr?: XIRRResult;
  totalCostBRL?: number;
}

export function PortfolioKpiStrip({
  isLoading,
  totalBRL,
  totalDividendsBRL = 0,
  performance,
  onOpenExplainModal,
  brlAssetsTotal,
  usdAssetsTotalBRL,
  cashBRL = 0,
  portfolioTwr,
  portfolioIrr,
  totalCostBRL,
}: PortfolioKpiStripProps) {
  const patrimonioBreakdown = useMemo(() => {
    return buildPortfolioTotalBreakdown({
      totalBRL,
      brlAssetsTotal: brlAssetsTotal ?? (totalBRL - cashBRL - (usdAssetsTotalBRL ?? 0)),
      usdAssetsTotalBRL: usdAssetsTotalBRL ?? 0,
      cashBRL,
    });
  }, [brlAssetsTotal, cashBRL, totalBRL, usdAssetsTotalBRL]);

  const rentabilidadeBreakdown = useMemo(() => {
    if (performance.rentabilidadeMode === "twr") {
      return buildTwrBreakdown({
        accumulatedRatePct: portfolioTwr?.accumulatedRatePct ?? null,
        annualizedRatePct: portfolioTwr?.annualizedRatePct,
        monthsElapsed: portfolioTwr?.monthsElapsed,
        currentSharePrice: portfolioTwr?.currentSharePrice,
        status: portfolioTwr?.status,
      });
    }
    return buildUnrealizedPnlBreakdown({
      currentValueBRL: Math.max(0, totalBRL - cashBRL),
      totalCostBRL: totalCostBRL ?? Math.max(0, totalBRL - cashBRL - performance.unrealizedPnlBRL),
      unrealizedPnlBRL: performance.unrealizedPnlBRL,
      unrealizedPnlPct: performance.capitalGainPct,
      totalDividendsBRL,
      totalReturnPnlBRL: performance.totalReturnPnlBRL,
      totalReturnPct: performance.totalReturnPct,
    });
  }, [
    cashBRL,
    performance.capitalGainPct,
    performance.rentabilidadeMode,
    performance.totalReturnPct,
    performance.totalReturnPnlBRL,
    performance.unrealizedPnlBRL,
    portfolioTwr,
    totalBRL,
    totalCostBRL,
    totalDividendsBRL,
  ]);

  const resultadoHistoricoBreakdown = useMemo(() => {
    return buildAllTimePnlBreakdown({
      allTimePnlBRL: performance.allTimePnlBRL,
      realizedPnlBRL: performance.realizedPnlBRL,
      unrealizedPnlBRL: performance.unrealizedPnlBRL,
      totalDividendsBRL,
      appliedCostBRL: totalCostBRL,
      currentValueBRL: totalBRL,
    });
  }, [
    performance.allTimePnlBRL,
    performance.realizedPnlBRL,
    performance.unrealizedPnlBRL,
    totalBRL,
    totalCostBRL,
    totalDividendsBRL,
  ]);

  const tirBreakdown = useMemo(() => {
    return buildIrrBreakdown({
      annualizedRatePct: portfolioIrr?.annualizedRatePct ?? null,
      periodRatePct: portfolioIrr?.periodRatePct ?? null,
      daysElapsed: portfolioIrr?.daysElapsed ?? 0,
      isEligible: portfolioIrr?.isEligible ?? false,
      status: portfolioIrr?.status ?? "ok",
      capitalCoveragePct: portfolioIrr?.capitalCoveragePct,
      currentValueBRL: totalBRL,
    });
  }, [portfolioIrr, totalBRL]);

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
        action={<CalculationMemoryModal breakdown={patrimonioBreakdown} />}
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
        action={<CalculationMemoryModal breakdown={rentabilidadeBreakdown} priority="p0" />}
        onClick={onOpenExplainModal}
      />

      <KpiCard
        label="Resultado Histórico"
        ariaLabel="Resultado Histórico"
        cents={performance.allTimePnlCents}
        tone={performance.allTimePnlBRL >= 0 ? "positive" : "negative"}
        action={<CalculationMemoryModal breakdown={resultadoHistoricoBreakdown} />}
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
        label="TIR (Fluxo do Bolso)"
        ariaLabel="TIR (Fluxo do Bolso)"
        value={performance.irrLabel}
        tone={performance.irrTone}
        hint={performance.irrHint}
        action={<CalculationMemoryModal breakdown={tirBreakdown} priority="p0" />}
        onClick={onOpenExplainModal}
      />
    </div>
  );
}
