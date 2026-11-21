import { useMemo, useState } from "react";
import { History } from "lucide-react";
import {
  ReportDocumentLayout,
  ReportFooter,
  ReportHeader,
  ReportRunningHeader,
} from "@/components/modules/reports";
import { Button, ConfirmDialog } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { PortfolioMonthlySeriesPoint } from "@/domain/portfolio";
import { formatDateBR, formatMonthYear, todayLocalIso } from "@/lib/date";
import { OFFICIAL_CVM_DISCLAIMER } from "@/lib/institutional";
import { formatCentsAsBRL } from "@/services/masks";
import { useDeletePortfolioSnapshot, useResetManualSnapshotCalibration } from "@/state";
import { CalibrateSnapshotDialog } from "./calibrate-snapshot-dialog";
import { SnapshotsEvolutionChart } from "./snapshots/snapshots-evolution-chart";
import { SnapshotsLedgerTable } from "./snapshots/snapshots-ledger-table";

export interface PortfolioSnapshotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: PortfolioMonthlySeriesPoint[];
  currentMonthStr?: string;
  onDeleteSnapshot?: (month: string) => Promise<void> | void;
  onGenerateReport?: (month: string) => void;
  onOpenPocketCostDialog?: () => void;
}

/**
 * Diálogo modal analítico de evolução patrimonial histórica com suporte
 * a impressão A4 / PDF oficial via `<ReportDocumentLayout />`.
 */
export function PortfolioSnapshotsDialog({
  open,
  onOpenChange,
  series,
  currentMonthStr,
  onDeleteSnapshot,
  onGenerateReport,
  onOpenPocketCostDialog,
}: PortfolioSnapshotsDialogProps) {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [snapshotToDelete, setSnapshotToDelete] = useState<string | null>(null);
  const [snapshotToCalibrate, setSnapshotToCalibrate] = useState<PortfolioMonthlySeriesPoint | null>(null);
  const [snapshotToRestore, setSnapshotToRestore] = useState<PortfolioMonthlySeriesPoint | null>(null);
  const deleteSnapshotMutation = useDeletePortfolioSnapshot();
  const resetCalibrationMutation = useResetManualSnapshotCalibration();

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    for (const point of series) {
      const yr = point.month.slice(0, 4);
      if (yr) yearsSet.add(yr);
    }
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [series]);

  const filteredSeries = useMemo(
    () => (selectedYear === "all" ? series : series.filter((pt) => pt.month.startsWith(selectedYear))),
    [series, selectedYear],
  );

  const sortedTablePoints = useMemo(
    () => [...filteredSeries].sort((a, b) => b.month.localeCompare(a.month)),
    [filteredSeries],
  );

  const summary = useMemo(() => {
    if (filteredSeries.length === 0) {
      return { totalMonths: 0, latestValueBRL: 0, latestCostBRL: 0, periodDividendsBRL: 0, openingDividendsBalanceBRL: 0, totalHistoricalDividendsBRL: 0, latestTwrPct: null };
    }
    const chronological = [...filteredSeries].sort((a, b) => a.month.localeCompare(b.month));
    const latest = chronological[chronological.length - 1];
    const earliest = chronological[0];
    const sumMonthDivs = chronological.reduce((acc, pt) => acc + (pt.monthDividendsBRL ?? 0), 0);
    const openingDivs = latest?.openingDividendsBalanceBRL ?? 0;

    return {
      totalMonths: chronological.length,
      latestValueBRL: latest?.valueBRL ?? 0,
      latestCostBRL: latest?.costBRL ?? 0,
      periodDividendsBRL:
        sumMonthDivs > 0
          ? sumMonthDivs
          : (latest?.accumulatedDividendsBRL ?? 0) - (earliest?.accumulatedDividendsBRL ?? 0),
      openingDividendsBalanceBRL: openingDivs,
      totalHistoricalDividendsBRL: sumMonthDivs + openingDivs,
      latestTwrPct: latest?.twrAccumulatedPct ?? null,
    };
  }, [filteredSeries]);

  return (
    <>
      <ReportDocumentLayout
        open={open}
        onOpenChange={onOpenChange}
        title="Extrato Analítico de Evolução Patrimonial"
        documentTitle={
          selectedYear === "all"
            ? "AXIR_Extrato_Snapshots_Consolidado.pdf"
            : `AXIR_Extrato_Snapshots_${selectedYear}.pdf`
        }
        size="3xl"
      >
        <ReportHeader
          title="Extrato Analítico de Evolução Patrimonial"
          subtitle="Auditoria cronológica da evolução de patrimônio, custos, proventos e rentabilidade ponderada (TWR) mês a mês."
          periodLabel={selectedYear === "all" ? "Histórico Completo" : `Ano ${selectedYear}`}
          generatedAt={formatDateBR(todayLocalIso())}
        />

        <ReportRunningHeader
          title="Extrato Analítico de Evolução Patrimonial"
          periodLabel={selectedYear === "all" ? "Histórico Completo" : `Ano ${selectedYear}`}
        />

        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1 print:hidden">
          {availableYears.length > 1 ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0">Ano:</span>
              <Button
                type="button"
                size="sm"
                variant={selectedYear === "all" ? "default" : "outline"}
                sensoryIntent="selection"
                onClick={() => setSelectedYear("all")}
                className="shrink-0"
              >
                Todos ({series.length}m)
              </Button>
              {availableYears.map((yr) => (
                <Button
                  key={yr}
                  type="button"
                  size="sm"
                  variant={selectedYear === yr ? "default" : "outline"}
                  sensoryIntent="selection"
                  onClick={() => setSelectedYear(yr)}
                  className="shrink-0"
                >
                  {yr}
                </Button>
              ))}
            </div>
          ) : (
            <div />
          )}

          {onOpenPocketCostDialog ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenPocketCostDialog();
              }}
              className="shrink-0 gap-1.5 text-xs ml-auto"
            >
              <History className="size-3.5 text-portfolio" aria-hidden="true" />
              <span>Marcos do Bolso</span>
            </Button>
          ) : null}
        </div>

        <SnapshotsEvolutionChart series={filteredSeries} summary={summary} />

        <SnapshotsLedgerTable
          points={sortedTablePoints}
          currentMonthStr={currentMonthStr}
          onCloseModal={() => onOpenChange(false)}
          onGenerateReport={onGenerateReport}
          onCalibrate={setSnapshotToCalibrate}
          onRestore={setSnapshotToRestore}
          onDelete={setSnapshotToDelete}
        />

        <ReportFooter
          disclaimer={OFFICIAL_CVM_DISCLAIMER}
          reportType="ledger"
          showQrCode
          className="mt-2"
        />
      </ReportDocumentLayout>

      <ConfirmDialog
        open={snapshotToDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSnapshotToDelete(null);
        }}
        elevated
        title="Excluir Snapshot Mensal"
        description={
          snapshotToDelete
            ? `Tem certeza que deseja excluir o snapshot patrimonial de ${formatMonthYear(snapshotToDelete)}? Esta ação removerá o registro consolidado do banco de dados.`
            : ""
        }
        confirmLabel="Excluir Snapshot"
        variant="destructive"
        confirmPending={deleteSnapshotMutation.isPending}
        onConfirm={async () => {
          if (!snapshotToDelete) return;
          if (onDeleteSnapshot) {
            await onDeleteSnapshot(snapshotToDelete);
          } else {
            await deleteSnapshotMutation.mutateAsync(snapshotToDelete);
          }
          setSnapshotToDelete(null);
        }}
      />

      <ConfirmDialog
        open={snapshotToRestore !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSnapshotToRestore(null);
        }}
        elevated
        title="Restaurar Fechamento Oficial"
        description={
          snapshotToRestore && snapshotToRestore.autoTotalValue != null
            ? `Deseja desfazer a calibração manual de ${formatMonthYear(snapshotToRestore.month)} e restaurar o valor gravado originalmente no fechamento oficial de mercado (${formatCentsAsBRL(numberToCents(snapshotToRestore.autoTotalValue))})?`
            : "Deseja restaurar o snapshot para o valor original do fechamento?"
        }
        confirmLabel="Restaurar Fechamento"
        variant="default"
        confirmPending={resetCalibrationMutation.isPending}
        onConfirm={async () => {
          if (!snapshotToRestore) return;
          await resetCalibrationMutation.mutateAsync(snapshotToRestore.month);
          setSnapshotToRestore(null);
        }}
      />

      <CalibrateSnapshotDialog
        open={snapshotToCalibrate !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSnapshotToCalibrate(null);
        }}
        snapshot={snapshotToCalibrate}
      />
    </>
  );
}
