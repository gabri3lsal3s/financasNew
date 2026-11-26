import { lazy, Suspense, useMemo } from "react";
import { ContentLoading } from "@/components/ui/content-loading";
import { ReportInsufficientDataModal } from "@/components/modules/reports";
import { evaluateCarteiraMensalReadiness } from "@/domain/reports";
import { formatMonthYear } from "@/lib/date";
import { useUserAccess } from "@/state";
import type { PortfolioTransactionType } from "@/types";
import {
  AllocationBreakdownDialog,
  AssetDetailSheet,
  AssetEditDialog,
  AssetScoreEvaluationDialog,
  CalibrateFixedIncomeDialog,
  InitialPocketCostDialog,
  ManualPriceDialog,
  PortfolioExecutiveReport,
  PortfolioSnapshotsDialog,
  QuickTransactionSheet,
} from "..";
import type { useResumoTabController } from "./use-resumo-tab-controller";

const InvestmentWizard = lazy(() =>
  import("../../wizard/investment-wizard").then((m) => ({ default: m.InvestmentWizard })),
);
const CashFormDialog = lazy(() =>
  import("../cash-form-dialog").then((m) => ({ default: m.CashFormDialog })),
);

export interface ResumoModalsHostProps {
  ctrl: ReturnType<typeof useResumoTabController>;
}

export function ResumoModalsHost({ ctrl }: ResumoModalsHostProps) {
  const { position, breakdownGroup, classTargetsQuery, sectorTargetsQuery } = ctrl;
  const userAccess = useUserAccess();
  const accountHolder = userAccess?.profile?.name ?? undefined;

  const breakdownTargetPercent =
    breakdownGroup?.type === "class"
      ? (classTargetsQuery.data?.find((t) => t.name === breakdownGroup.name)?.target_percentage ?? null)
      : breakdownGroup?.name
        ? (sectorTargetsQuery.data?.find(
            (t) =>
              t.name === breakdownGroup.name &&
              (!t.class_name ||
                !breakdownGroup.parentClass ||
                t.class_name === breakdownGroup.parentClass),
          )?.target_percentage ?? null)
        : null;

  const carteiraReadiness = useMemo(
    () =>
      evaluateCarteiraMensalReadiness({
        activeAssetCount: position.rows.length,
        totalBRL: position.totalBRL,
        cashBRL: position.cashBRL,
        hasScoresPQS: position.rows.some((r) => r.scoreCriteria != null),
      }),
    [position.rows, position.totalBRL, position.cashBRL],
  );

  return (
    <>
      {!ctrl.onOpenWizard && ctrl.isWizardOpen ? (
        <Suspense fallback={<ContentLoading />}>
          <InvestmentWizard
            open={ctrl.isWizardOpen}
            onOpenChange={ctrl.handleWizardOpenChange}
            initialAsset={ctrl.wizardInitialAsset}
            initialMode={ctrl.wizardInitialMode}
            initialQuantity={ctrl.wizardInitialQuantity}
            initialTotalCents={ctrl.wizardInitialTotalCents}
          />
        </Suspense>
      ) : null}

      <AssetDetailSheet
        open={ctrl.activeDetailAsset !== null}
        onOpenChange={(open) => {
          if (!open) {
            ctrl.setDetailAsset(null);
            ctrl.setDismissedHighlight(true);
          }
        }}
        asset={ctrl.activeDetailAsset}
        onAction={(action, asset) => {
          ctrl.setDetailAsset(null);
          ctrl.setDismissedHighlight(true);
          const txType: PortfolioTransactionType =
            action === "sell" || action === "dividend" || action === "split" ? action : "buy";
          ctrl.setQuickTxAsset(asset);
          ctrl.setQuickTxType(txType);
        }}
        onOpenWizard={(asset, qty, totalCents) => {
          ctrl.setDetailAsset(null);
          ctrl.setDismissedHighlight(true);
          ctrl.handleOpenWizard(asset, "buy", {
            initialQuantity: qty ?? null,
            initialTotalCents: totalCents ?? null,
          });
        }}
      />

      <QuickTransactionSheet
        open={ctrl.quickTxAsset !== null}
        onOpenChange={(open) => {
          if (!open) ctrl.setQuickTxAsset(null);
        }}
        asset={ctrl.quickTxAsset}
        initialType={ctrl.quickTxType}
      />

      {ctrl.assetEditing ? (
        <AssetEditDialog
          open={ctrl.assetEditing !== null}
          onOpenChange={(open) => !open && ctrl.setAssetEditing(null)}
          asset={ctrl.assetEditing}
        />
      ) : null}

      <AssetScoreEvaluationDialog
        open={ctrl.scoreEvaluatingAsset !== null}
        onOpenChange={(next) => !next && ctrl.setScoreEvaluatingAsset(null)}
        asset={ctrl.scoreEvaluatingAsset}
      />

      {!ctrl.onOpenCash && ctrl.activeCashDialogOpen ? (
        <Suspense fallback={<ContentLoading />}>
          <CashFormDialog
            open={ctrl.activeCashDialogOpen}
            onOpenChange={(open) => {
              ctrl.setCashDialogOpen(open);
              if (!open) ctrl.setDismissedHighlight(true);
            }}
            asset={ctrl.cashAsset}
          />
        </Suspense>
      ) : null}

      {ctrl.calibrateFor ? (
        <CalibrateFixedIncomeDialog
          key={ctrl.calibrateFor.asset.id}
          open={ctrl.calibrateFor !== null}
          onOpenChange={(next) => !next && ctrl.setCalibrateFor(null)}
          asset={ctrl.calibrateFor.asset}
          currentEstimatedValueCents={ctrl.calibrateFor.valueCents}
        />
      ) : null}

      {ctrl.priceFor ? (
        <ManualPriceDialog
          key={ctrl.priceFor.id}
          open={ctrl.priceFor !== null}
          onOpenChange={(next) => !next && ctrl.setPriceFor(null)}
          asset={ctrl.priceFor}
        />
      ) : null}

      <AllocationBreakdownDialog
        open={breakdownGroup !== null}
        onOpenChange={(open) => {
          if (!open) ctrl.setBreakdownGroup(null);
        }}
        type={breakdownGroup?.type ?? "class"}
        groupName={breakdownGroup?.name ?? null}
        parentClassName={breakdownGroup?.parentClass}
        rows={ctrl.rows}
        totalPortfolioBRL={position.totalBRL}
        targetPercent={breakdownTargetPercent}
        onSelectAsset={(assetId) => ctrl.openDetail(assetId)}
        onNavigateToTargets={
          ctrl.onSelectTab
            ? () => ctrl.onSelectTab?.("metas")
            : () => ctrl.navigate("/investments?tab=metas")
        }
      />

      <InitialPocketCostDialog
        open={ctrl.initialCostDialogOpen}
        onOpenChange={ctrl.setInitialCostDialogOpen}
        defaultCostBRL={position.totalCostBRL}
        onOpenSnapshotsDialog={() => ctrl.setSnapshotsDialogOpen(true)}
      />

      {ctrl.executiveReportOpen && carteiraReadiness.status === "blocked" && (
        <ReportInsufficientDataModal
          open={ctrl.executiveReportOpen}
          onOpenChange={(next) => {
            ctrl.setExecutiveReportOpen(next);
            if (!next) ctrl.setReportSelectedMonth(undefined);
          }}
          reportTitle="Relatório Executivo da Carteira"
          periodLabel={formatMonthYear(ctrl.reportSelectedMonth ?? ctrl.month)}
          blockingReasons={carteiraReadiness.blockingReasons}
        />
      )}

      {ctrl.executiveReportOpen && carteiraReadiness.canGenerate && (
        <PortfolioExecutiveReport
          open={ctrl.executiveReportOpen}
          onOpenChange={(next) => {
            ctrl.setExecutiveReportOpen(next);
            if (!next) ctrl.setReportSelectedMonth(undefined);
          }}
          accountHolder={accountHolder}
          rows={position.rows}
          totalBRL={position.totalBRL}
          cashBRL={position.cashBRL}
          yearDividendsBRL={position.totalDividendsBRL}
          portfolioIrr={position.portfolioIrr}
          portfolioTwr={position.portfolioTwr}
          totalReturnPct={position.totalReturnPct}
          totalReturnPnlBRL={position.totalReturnPnlBRL}
          allTimeEconomicPnlBRL={position.allTimeEconomicPnlBRL}
          usdRate={position.usdRate}
          fxMetadata={position.fxMetadata}
          transactions={ctrl.transactions}
          initialMonth={ctrl.reportSelectedMonth}
        />
      )}

      <PortfolioSnapshotsDialog
        open={ctrl.snapshotsDialogOpen}
        onOpenChange={ctrl.setSnapshotsDialogOpen}
        series={ctrl.allSeries}
        currentMonthStr={ctrl.month}
        onOpenPocketCostDialog={() => ctrl.setInitialCostDialogOpen(true)}
        onGenerateReport={(targetMonth) => {
          ctrl.setSnapshotsDialogOpen(false);
          ctrl.setReportSelectedMonth(targetMonth);
          ctrl.setExecutiveReportOpen(true);
        }}
      />
    </>
  );
}
