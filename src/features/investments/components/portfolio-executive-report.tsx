import { useMemo, useState } from "react";
import { ConfirmDialog, ErrorState, Skeleton } from "@/components/ui";
import type { PositionRow } from "@/components/modules/position-table";
import { ReportDocumentLayout } from "@/components/modules/reports";
import type { TwrConsolidatedResult, XIRRResult } from "@/domain/portfolio";
import {
  buildExecutiveReportClassGroups,
  buildReportMonthOptions,
  resolveReportPositionRows,
  resolveReportTotals,
} from "@/domain/portfolio/executive-report-builder";
import { currentMonth, formatMonthYear } from "@/lib/date";
import {
  useDeletePortfolioSnapshot,
  usePortfolioAssets,
  usePortfolioMonthlyPosition,
  usePortfolioSnapshots,
} from "@/state";
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

  const isCurrentSelected = selectedMonth === activeMonth;

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
    () => effectiveRows.filter((r) => !r.isCash),
    [effectiveRows],
  );

  const { classGroups, pqs } = useMemo(
    () =>
      buildExecutiveReportClassGroups({
        investmentRows,
        effectiveTotalBRL,
        rawAssets: assetsQuery.data ?? [],
        cashBRL: effectiveCashBRL,
      }),
    [investmentRows, effectiveTotalBRL, assetsQuery.data, effectiveCashBRL],
  );

  const canDeleteSnapshot =
    !isCurrentSelected && Boolean(snapshotsQuery.data?.some((s) => s.month === selectedMonth));

  return (
    <ReportDocumentLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Relatório Executivo da Carteira"
      size="2xl"
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
