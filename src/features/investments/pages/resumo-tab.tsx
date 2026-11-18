import { Plus, Sparkles, TrendingUp } from "lucide-react";
import { CashKpiCard } from "@/components/modules";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { setStepIndex, startDemo } from "@/state";
import type { PortfolioAsset } from "@/types";
import { PortfolioSnapshotsCarousel } from "../components";
import { CustodySectionCard } from "../components/resumo/custody-section-card";
import { PortfolioAllocationCard } from "../components/resumo/portfolio-allocation-card";
import { PortfolioConcentrationAlert } from "../components/resumo/portfolio-concentration-alert";
import { PortfolioKpiStrip } from "../components/resumo/portfolio-kpi-strip";
import { ResumoModalsHost } from "../components/resumo/resumo-modals-host";
import type { OpenWizardOptions } from "../components/resumo/use-investments-page-controller";
import { useResumoTabController } from "../components/resumo/use-resumo-tab-controller";
import type { WizardMode } from "../wizard/wizard-state";

export interface ResumoTabProps {
  onOpenWizard?: (
    asset?: PortfolioAsset | null,
    mode?: WizardMode,
    options?: OpenWizardOptions,
  ) => void;
  onOpenCash?: () => void;
  onSelectTab?: (tab: string, params?: Record<string, string | number>) => void;
}

/**
 * Resumo da carteira (§F36 e §F41 unificada) — Posição Consolidada, KPIs executivos,
 * distribuição patrimonial e snapshots históricos.
 */
export function ResumoTab({ onOpenWizard, onOpenCash, onSelectTab }: ResumoTabProps = {}) {
  const ctrl = useResumoTabController({ onOpenWizard, onOpenCash, onSelectTab });
  const { position, concentration } = ctrl;

  return (
    <div className="flex flex-col gap-6">
      {position.error ? (
        <ErrorState message={getErrorMessage(position.error)} onRetry={position.refetch} />
      ) : null}

      <PortfolioKpiStrip
        isLoading={position.isLoading}
        totalBRL={position.totalBRL}
        totalDividendsBRL={position.totalDividendsBRL}
        performance={ctrl.performance}
        onOpenExplainModal={() => ctrl.setExplainModalOpen(true)}
      />

      <CashKpiCard
        variant="banner"
        cashBRL={position.cashBRL}
        cashPct={ctrl.performance.cashPct}
        hasCashAsset={Boolean(ctrl.cashAsset)}
        isLoading={position.isLoading}
        onEdit={ctrl.handleOpenCash}
        onAporte={() => {
          if (onSelectTab) {
            onSelectTab("aporte", { usarCaixa: "1" });
          } else {
            ctrl.navigate("/investments?tab=rebalancear&view=simulador&usarCaixa=1");
          }
        }}
      />

      {concentration.isConcentrated ? (
        <PortfolioConcentrationAlert
          ticker={concentration.concentratedAssets[0]?.ticker}
          pct={concentration.concentratedAssets[0]?.pct ?? 0}
        />
      ) : null}

      {!position.isLoading && !ctrl.hasInvestments ? (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title="Nenhum ativo cadastrado"
          headingLevel="h2"
          description="Adicione seus investimentos ou registre seu saldo em caixa para iniciar o acompanhamento patrimonial."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button type="button" size="sm" onClick={() => ctrl.handleOpenWizard(null, "select")}>
                <Plus aria-hidden="true" className="size-4" />
                Nova Operação
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={ctrl.handleOpenCash}>
                Cadastrar Saldo em Caixa
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  startDemo("investments");
                  setStepIndex(0);
                }}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="size-3.5 text-muted-foreground" aria-hidden="true" />
                Ver carteira na Simulação
              </Button>
            </div>
          }
        />
      ) : null}

      {!position.isLoading && ctrl.hasInvestments ? (
        <>
          <PortfolioAllocationCard
            allocationMode={ctrl.allocationMode}
            onChangeMode={ctrl.setAllocationMode}
            slices={ctrl.activeSlices}
            totalBRL={position.totalBRL}
          />

          <CustodySectionCard
            rows={ctrl.investmentRows}
            highlightId={ctrl.highlightId}
            isSyncingQuotes={ctrl.syncQuotes.isPending}
            onOpenExecutiveReport={() => ctrl.setExecutiveReportOpen(true)}
            onSyncQuotes={() => ctrl.syncQuotes.mutate(ctrl.assetsQuery.data ?? [])}
            onOpenDetail={ctrl.openDetail}
            onOpenEdit={ctrl.openEdit}
            onCalibrateAsset={(assetId, _ticker, currentValueCents) => {
              const asset = ctrl.assetById(assetId);
              if (asset) ctrl.setCalibrateFor({ asset, valueCents: currentValueCents });
            }}
            onSetManualPrice={(
              assetId,
              ticker,
              currency,
              priceBRL,
              source,
              priceQuote,
              pricingMode,
              usdRate,
            ) => {
              ctrl.setPriceFor({
                id: assetId,
                ticker,
                currency,
                priceQuote,
                priceBRL,
                usdRate,
                source,
                pricingMode,
              });
            }}
            onEvaluateScore={(assetId) => {
              const asset = ctrl.assetById(assetId);
              if (asset) ctrl.setScoreEvaluatingAsset(asset);
            }}
          />

          <PortfolioSnapshotsCarousel
            series={ctrl.carouselSeries}
            totalMonthsCount={ctrl.allSeries.length}
            currentMonthStr={ctrl.month}
            onOpenAnalyticsDialog={() => ctrl.setSnapshotsDialogOpen(true)}
            onGenerateReport={(targetMonth) => {
              ctrl.setReportSelectedMonth(targetMonth);
              ctrl.setExecutiveReportOpen(true);
            }}
          />
        </>
      ) : null}

      <ResumoModalsHost ctrl={ctrl} />
    </div>
  );
}
