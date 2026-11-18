import { useMemo, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, History, Printer, TrendingUp } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { useGroupTargets, usePortfolioAssets, usePortfolioPosition } from "@/state";
import { numberToCents } from "@/domain/money";
import { formatPercent } from "@/services/masks";
import type { AllocationAnalysisResult, ConcentrationRiskResult, AllocationDonutSegment } from "@/domain/reports";
import type { PositionRow } from "@/components/modules/position-table";
import { AllocationGapTreeTable } from "./allocation-gap-tree-table";
import { InvestmentsDeepBreakdowns } from "./investments-deep-breakdowns";

export interface InvestmentsTabProps {
  totalPatrimonyBRL: number;
  allocationAnalysis: AllocationAnalysisResult;
  concentrationRisk: ConcentrationRiskResult;
  classSegments?: readonly AllocationDonutSegment[];
  sectorSegments?: readonly AllocationDonutSegment[];
  totalUniqueSectors?: number;
  expandedTreeClasses: Set<string>;
  setExpandedTreeClasses: Dispatch<SetStateAction<Set<string>>>;
  expandedTreeSectors: Set<string>;
  setExpandedTreeSectors: Dispatch<SetStateAction<Set<string>>>;
  onOpenTearSheet: () => void;
  hasDataForPeriod?: boolean;
  /** Linhas de posição vigentes consolidadas. */
  rows?: readonly PositionRow[];
}

/**
 * Aba "Investimentos & Carteira" — cards de patrimônio/aderência/concentração
 * e tabela em árvore hierárquica (Classe -> Setor -> Ativos) da carteira viva atual.
 */
export function InvestmentsTab({
  totalPatrimonyBRL,
  allocationAnalysis,
  concentrationRisk,
  classSegments,
  sectorSegments,
  totalUniqueSectors,
  expandedTreeClasses,
  setExpandedTreeClasses,
  expandedTreeSectors,
  setExpandedTreeSectors,
  onOpenTearSheet,
  hasDataForPeriod = true,
  rows,
}: InvestmentsTabProps) {
  const position = usePortfolioPosition();
  const assetsQuery = usePortfolioAssets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const navigate = useNavigate();

  const breakdownRows = useMemo(() => {
    if (!rows) return position.rows;
    return rows.map((r) => ({
      assetId: r.assetId ?? r.ticker,
      ticker: r.ticker,
      assetClass: r.assetClass ?? null,
      sector: r.sector ?? null,
      currency: (r.currency as "BRL" | "USD") ?? "BRL",
      quantity: r.quantity,
      averageCost: r.averageCost,
      totalCost: r.totalCost ?? r.quantity * r.averageCost,
      totalCostBRL: r.totalCostBRL ?? r.quantity * r.averageCost,
      averageCostBRL: r.averageCost,
      dividends: r.dividends ?? 0,
      dividendsNative: r.dividends ?? 0,
      priceQuote: r.priceQuote ?? r.priceBRL,
      priceBRL: r.priceBRL,
      usdRate: r.usdRate ?? 1,
      valueBRL: r.valueBRL,
      valueNative: r.valueBRL,
      pct: r.pct,
      unrealizedPnl: r.unrealizedPnl,
      unrealizedPct: r.unrealizedPct ?? 0,
      totalReturnPnl: r.totalReturnPnl ?? 0,
      totalReturnPct: r.totalReturnPct ?? 0,
      source: r.source ?? "manual",
      pricingMode: r.pricingMode ?? "unit_price",
      isCash: r.isCash ?? false,
      fixedIncomeMetadata: r.fixedIncomeMetadata ?? null,
    }));
  }, [rows, position.rows]);

  if (!hasDataForPeriod) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={<TrendingUp className="size-8" aria-hidden="true" />}
          title="Nenhum ativo ou custódia cadastrada"
          description="Você ainda não possui ativos ou saldo de caixa cadastrados na sua carteira. Cadastre seus ativos para desbloquear a análise patrimonial e diagnósticos de alocação."
          action={
            <Button type="button" onClick={() => navigate("/investments")}>
              Ir para Investimentos
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface p-4 shadow-xs">
        <div className="flex items-start gap-3 min-w-0">
          <History className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-semibold text-foreground">Análise e Auditoria de Meses Anteriores</span>
            <p className="text-muted-foreground leading-relaxed m-0 text-[11px]">
              Deseja auditar ou emitir relatórios de fechamento de meses anteriores? Acesse os Fechamentos & Snapshots na página de Investimentos.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate("/investments")}
          className="gap-1.5 shrink-0 w-full sm:w-auto justify-center text-xs"
        >
          <span>Ir para Fechamentos</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Dossiê Executivo da Posição Vigente Consolidada (A4/PDF)
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Documento de consultoria patrimonial com diagnóstico de defasagem de metas (Target vs. Actual), risco de concentração e custódia.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          onClick={onOpenTearSheet}
          className="gap-2 shrink-0 w-full sm:w-auto justify-center"
        >
          <Printer className="size-4" aria-hidden="true" />
          Visualizar & Imprimir Dossiê A4
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Patrimônio Consolidado</span>
          <MoneyText cents={numberToCents(totalPatrimonyBRL)} tone="portfolio" variant="hero" animated className="text-lg sm:text-xl font-bold font-display whitespace-nowrap" />
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Aderência às Metas</span>
          <span className="num font-mono tabular-nums text-lg sm:text-xl font-bold font-display text-primary-strong">
            {allocationAnalysis.alignmentScore}%
          </span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top 5 Concentração</span>
          <span className="num font-mono tabular-nums text-lg sm:text-xl font-bold font-display text-foreground">
            {formatPercent(concentrationRisk.top5Pct)}%
          </span>
        </div>
        <div className="rounded-2xl border border-border/80 bg-surface p-4 shadow-xs flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top Setor Dominante</span>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-sm sm:text-base font-bold font-display text-foreground line-clamp-2 break-words">
              {concentrationRisk.topSectorDominance?.sector ?? "Nenhum"}
            </span>
            <span className="num font-mono tabular-nums text-xs font-bold text-portfolio-strong shrink-0 whitespace-nowrap">
              {concentrationRisk.topSectorDominance ? `${formatPercent(concentrationRisk.topSectorDominance.pct)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      <AllocationGapTreeTable
        allocationAnalysis={allocationAnalysis}
        expandedTreeClasses={expandedTreeClasses}
        setExpandedTreeClasses={setExpandedTreeClasses}
        expandedTreeSectors={expandedTreeSectors}
        setExpandedTreeSectors={setExpandedTreeSectors}
      />

      <InvestmentsDeepBreakdowns
        classSegments={classSegments}
        sectorSegments={sectorSegments}
        totalPatrimonyBRL={totalPatrimonyBRL}
        fallbackTotalBRL={position.totalBRL}
        totalUniqueSectors={totalUniqueSectors}
        breakdownRows={breakdownRows}
        assetsMetadata={assetsQuery.data ?? []}
        classTargets={classTargetsQuery.data ?? []}
        sectorTargets={sectorTargetsQuery.data ?? []}
      />
    </div>
  );
}
