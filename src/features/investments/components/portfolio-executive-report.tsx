import { useMemo, useState } from "react";
import { ConfirmDialog, ErrorState, Skeleton } from "@/components/ui";
import type { PositionRow } from "@/components/modules/position-table";
import { ReportDocumentLayout } from "@/components/modules/reports";
import {
  buildMarketReferenceSummary,
  buildReportPrintWarning,
  calculateCustodyReconciliation,
  evaluateStaleQuoteGuard,
  getActiveCustodyPositions,
  type CanonicalFxMetadata,
  type ProvisionedDividendsSummary,
  type TwrConsolidatedResult,
  type XIRRResult,
} from "@/domain/portfolio";
import {
  buildExecutiveReportClassGroups,
  buildReportMonthOptions,
  resolveReportPositionRows,
  resolveReportTotals,
} from "@/domain/portfolio/executive-report-builder";
import { getOptionalHook } from "@/hooks/use-notification-center";
import { currentMonth, formatMonthYear } from "@/lib/date";
import * as state from "@/state";
import {
  useDeletePortfolioSnapshot,
  usePortfolioAssets,
  usePortfolioMonthlyPosition,
  usePortfolioSnapshots,
} from "@/state";
import type { PortfolioTransaction } from "@/types";
import { useExecutiveReportRefresh } from "../hooks/use-executive-report-refresh";
import { ExecutiveReportDocument } from "./executive-report/executive-report-document";
import { ExecutiveReportPeriodBar } from "./executive-report/executive-report-period-bar";
import {
  ExecutiveReportErrorState,
  ExecutiveReportInsufficientState,
  ExecutiveReportLoadingSkeleton,
} from "./executive-report/executive-report-states";
import { MonthlyClosingEditor } from "./monthly-closing-editor";

export interface PortfolioExecutiveReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: PositionRow[];
  totalBRL: number;
  cashBRL: number;
  yearDividendsBRL: number;
  portfolioIrr?: XIRRResult;
  portfolioTwr?: TwrConsolidatedResult;
  totalReturnPct?: number | null;
  totalReturnPnlBRL?: number;
  allTimeEconomicPnlBRL?: number;
  periodLabel?: string;
  appName?: string;
  accountHolder?: string;
  initialMonth?: string;
  usdRate?: number;
  fxMetadata?: CanonicalFxMetadata | null;
  transactions?: readonly PortfolioTransaction[];
}

/**
 * Relatório Executivo de Acompanhamento da Carteira em padrão A4/PDF (§F40/F51).
 */
export function PortfolioExecutiveReport({
  open,
  onOpenChange,
  rows,
  totalBRL,
  cashBRL,
  appName = "Axir",
  accountHolder,
  initialMonth,
  usdRate,
  fxMetadata,
  transactions = [],
}: PortfolioExecutiveReportProps) {
  const activeMonth = currentMonth();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => initialMonth ?? activeMonth);
  const [activeTab, setActiveTab] = useState<"report" | "closing">("report");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [prevInitialMonth, setPrevInitialMonth] = useState(initialMonth);
  if (initialMonth !== prevInitialMonth) {
    setPrevInitialMonth(initialMonth);
    setSelectedMonth(initialMonth ?? activeMonth);
    setActiveTab("report");
  }

  const deleteSnapshotMutation = useDeletePortfolioSnapshot();
  const assetsQuery = usePortfolioAssets();
  const snapshotsQuery = usePortfolioSnapshots();
  const monthlyPositionQuery = usePortfolioMonthlyPosition(selectedMonth);
  const useCorporateDividendsSafe = getOptionalHook(state, "useCorporateDividends", () => ({
    provisionedSummary: null as ProvisionedDividendsSummary | null,
  }));
  const corporateDividendsState = useCorporateDividendsSafe();

  const isCurrentSelected = selectedMonth === activeMonth;
  const reportRefresh = useExecutiveReportRefresh({
    open,
    enabled: isCurrentSelected,
    assets: assetsQuery.data ?? [],
    tickers: rows.map((r) => r.ticker),
  });

  const monthOptions = useMemo(
    () =>
      buildReportMonthOptions({
        activeMonth,
        initialMonth,
        snapshots: snapshotsQuery.data ?? [],
      }),
    [activeMonth, initialMonth, snapshotsQuery.data],
  );

  const effectiveRows = useMemo(
    () =>
      resolveReportPositionRows({
        isCurrentSelected,
        currentRows: rows,
        monthlyPosition: monthlyPositionQuery.data,
      }),
    [isCurrentSelected, rows, monthlyPositionQuery.data],
  );

  const { effectiveTotalBRL, effectiveCashBRL, effectiveCostBRL, effectivePeriodLabel } = useMemo(
    () =>
      resolveReportTotals({
        isCurrentSelected,
        selectedMonth,
        currentRows: rows,
        totalBRL,
        cashBRL,
        monthlyPosition: monthlyPositionQuery.data,
      }),
    [isCurrentSelected, selectedMonth, rows, totalBRL, cashBRL, monthlyPositionQuery.data],
  );

  const investmentRows = useMemo(
    () => getActiveCustodyPositions(effectiveRows),
    [effectiveRows],
  );

  const effectiveUsdRate = isCurrentSelected
    ? usdRate
    : monthlyPositionQuery.data?.usdRate ?? usdRate;
  const effectiveFxMetadata = useMemo(
    () =>
      isCurrentSelected
        ? fxMetadata
        : effectiveUsdRate && effectiveUsdRate > 0
          ? {
              rate: effectiveUsdRate,
              source: "closing_saved" as const,
              provider: "closing_saved",
              fxRateAt: null,
              fetchedAt: null,
              isFallback: false,
            }
          : fxMetadata,
    [isCurrentSelected, fxMetadata, effectiveUsdRate],
  );

  const staleGuard = useMemo(() => {
    if (!isCurrentSelected) return null;
    return evaluateStaleQuoteGuard({
      rows: effectiveRows,
      transactions,
      assets: assetsQuery.data ?? [],
      fxMetadata: effectiveFxMetadata,
    });
  }, [isCurrentSelected, effectiveRows, transactions, assetsQuery.data, effectiveFxMetadata]);

  const marketSummary = useMemo(
    () =>
      buildMarketReferenceSummary({
        rows: effectiveRows,
        fxMetadata: effectiveFxMetadata,
        usdRate: effectiveUsdRate,
      }),
    [effectiveRows, effectiveFxMetadata, effectiveUsdRate],
  );

  const custodyReconciliation = useMemo(
    () =>
      calculateCustodyReconciliation({
        rows: effectiveRows,
        totalBRL: effectiveTotalBRL,
        cashBRL: effectiveCashBRL,
        fxMetadata: effectiveFxMetadata,
        usdRate: effectiveUsdRate,
      }),
    [effectiveRows, effectiveTotalBRL, effectiveCashBRL, effectiveFxMetadata, effectiveUsdRate],
  );

  const printWarning = useMemo(() => buildReportPrintWarning(staleGuard), [staleGuard]);

  const { classGroups, pqs } = useMemo(
    () =>
      buildExecutiveReportClassGroups({
        investmentRows,
        effectiveTotalBRL,
        rawAssets: assetsQuery.data ?? [],
        cashBRL: effectiveCashBRL,
        fxMetadata: effectiveFxMetadata,
        usdRate: effectiveUsdRate,
        staleGuard,
      }),
    [
      investmentRows,
      effectiveTotalBRL,
      assetsQuery.data,
      effectiveCashBRL,
      effectiveFxMetadata,
      effectiveUsdRate,
      staleGuard,
    ],
  );

  const canDeleteSnapshot =
    !isCurrentSelected && Boolean(snapshotsQuery.data?.some((s) => s.month === selectedMonth));

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo da Carteira"
      documentTitle={`AXIR_Relatorio_Executivo_Carteira_${selectedMonth}.pdf`}
      printWarning={printWarning}
      size="3xl"
    >
      <div className="flex flex-col gap-4 w-full">
        <ExecutiveReportPeriodBar
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          monthOptions={monthOptions}
          isCurrentSelected={isCurrentSelected}
          fidelity={monthlyPositionQuery.data?.fidelity}
          canDeleteSnapshot={canDeleteSnapshot}
          onRequestDeleteSnapshot={() => setDeleteModalOpen(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {activeTab === "closing" ? (
          monthlyPositionQuery.isLoading ? (
            <div className="flex flex-col gap-4 w-full p-4 sm:p-6 rounded-2xl border border-border/80 bg-surface shadow-xs my-2 print:hidden">
              <Skeleton className="h-10 w-48 rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : monthlyPositionQuery.isError ? (
            <div className="my-2 print:hidden">
              <ErrorState
                message="Falha ao carregar dados de fechamento desta competência."
                onRetry={() => void monthlyPositionQuery.refetch()}
              />
            </div>
          ) : monthlyPositionQuery.data ? (
            <div className="pt-1 print:hidden">
              <MonthlyClosingEditor
                month={selectedMonth}
                historicalPosition={monthlyPositionQuery.data}
                onSaved={() => {
                  setActiveTab("report");
                  void monthlyPositionQuery.refetch();
                }}
              />
            </div>
          ) : null
        ) : !isCurrentSelected && monthlyPositionQuery.isLoading ? (
          <ExecutiveReportLoadingSkeleton />
        ) : !isCurrentSelected && monthlyPositionQuery.isError ? (
          <ExecutiveReportErrorState onRetry={() => void monthlyPositionQuery.refetch()} />
        ) : !isCurrentSelected &&
          monthlyPositionQuery.data?.fidelity &&
          !monthlyPositionQuery.data.fidelity.canGenerateExecutiveReport ? (
          <ExecutiveReportInsufficientState
            reason={monthlyPositionQuery.data.fidelity.reasons[0]}
            snapshotTotalValue={monthlyPositionQuery.data.fidelity.snapshotTotalValue}
            onOpenClosing={() => setActiveTab("closing")}
          />
        ) : (
          <ExecutiveReportDocument
            periodLabel={effectivePeriodLabel}
            appName={appName}
            accountHolder={accountHolder}
            fidelity={monthlyPositionQuery.data?.fidelity}
            monthlyData={monthlyPositionQuery.data}
            effectiveTotalBRL={effectiveTotalBRL}
            effectiveCostBRL={effectiveCostBRL}
            effectiveCashBRL={effectiveCashBRL}
            investmentCount={investmentRows.length}
            classGroups={classGroups}
            pqs={pqs}
            marketMetadata={marketSummary}
            custodyReconciliation={custodyReconciliation}
            provisionedSummary={
              isCurrentSelected ? (corporateDividendsState?.provisionedSummary ?? null) : null
            }
            staleGuard={staleGuard}
            isRefreshingQuotes={reportRefresh.isRefreshing}
            onRetryQuotes={() => void reportRefresh.retry()}
            onOpenClosing={() => setActiveTab("closing")}
          />
        )}

        <ConfirmDialog
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          title="Excluir Fechamento Histórico"
          description={`Tem certeza que deseja excluir o fechamento e as cotações gravadas para ${formatMonthYear(selectedMonth)}? A carteira passará a utilizar as cotações de referência/estimadas até que um novo fechamento seja realizado.`}
          confirmLabel={deleteSnapshotMutation.isPending ? "Excluindo..." : "Excluir Fechamento"}
          confirmPending={deleteSnapshotMutation.isPending}
          variant="destructive"
          onConfirm={async () => {
            await deleteSnapshotMutation.mutateAsync(selectedMonth);
            setDeleteModalOpen(false);
            setSelectedMonth(activeMonth);
            setActiveTab("report");
          }}
        />
      </div>
    </ReportDocumentLayout>
  );
}
