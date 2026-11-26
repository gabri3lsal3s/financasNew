import { CalendarClock } from "lucide-react";
import { Button, Checkbox, ConfirmDialog, ErrorState, SkeletonTable, Tabs, type TabItem } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL, formatCentsAsCurrency } from "@/services/masks";
import type { PortfolioAsset } from "@/types";
import { QuickTransactionSheet } from "../components";
import { DividendsByAssetPanel } from "../components/proventos/dividends-by-asset-panel";
import { DividendsCalendarPanel } from "../components/proventos/dividends-calendar-panel";
import { DividendsHistoryPanel } from "../components/proventos/dividends-history-panel";
import { DividendsSnowballPanel } from "../components/proventos/dividends-snowball-panel";
import {
  useProventosTabController,
  type ProventosSubTab,
} from "../components/proventos/use-proventos-tab-controller";
import type { WizardMode } from "../wizard/wizard-state";

export type { ProventosSubTab };

export interface ProventosTabProps {
  defaultMonth?: string;
  onOpenWizard?: (asset?: PortfolioAsset | null, mode?: WizardMode) => void;
}

/**
 * Proventos da carteira (§F36 e §F39) — extrato mensal dos rendimentos RECEBIDOS,
 * calendário anual, histórico vitalício por ativo e acompanhamento Bola de Neve.
 */
export function ProventosTab({ defaultMonth }: ProventosTabProps) {
  const ctrl = useProventosTabController(defaultMonth);

  const tabItems: TabItem[] = [
    {
      value: "mensal",
      label: "Extrato Mensal",
      content: (
        <DividendsHistoryPanel
          month={ctrl.month}
          onMonthChange={ctrl.setMonth}
          hasAny={ctrl.hasAny}
          extract={ctrl.monthlySummary.extract}
          monthTotal={ctrl.monthlySummary.monthTotal}
          uniqueTickersCount={ctrl.monthlySummary.uniqueTickersCount}
          topPayer={ctrl.monthlySummary.topPayer}
          projectedCount={ctrl.projectedInSelectedMonth.length}
          projectedTotal={ctrl.projectedTotalInSelectedMonth}
          assetById={ctrl.assetById}
          rowByAssetId={ctrl.rowByAssetId}
          onOpenNewDividend={() => ctrl.guardAction(() => ctrl.setDividendFormOpen(true), "Registrar Provento")}
          onEditDividend={(entry) => ctrl.guardAction(() => ctrl.setEditingDividend(entry), "Editar Provento")}
          onDeleteDividend={(entry) => ctrl.guardAction(() => ctrl.setDividendToDelete(entry), "Excluir Provento")}
          onOpenPendingDividends={ctrl.openPendingDividendsModal}
        />
      ),
    },
    {
      value: "calendario",
      label: "Calendário",
      content: (
        <DividendsCalendarPanel
          year={ctrl.year}
          selectedMonth={ctrl.month}
          yearly={ctrl.yearlySummary.yearly}
          yearTotal={ctrl.yearlySummary.yearTotal}
          yearMonthlyAverage={ctrl.yearlySummary.yearMonthlyAverage}
          bestMonth={ctrl.yearlySummary.bestMonth}
          maxMonthTotal={ctrl.yearlySummary.maxMonthTotal}
          pendingItems={ctrl.corporateDividends.available}
          provisionedItems={ctrl.corporateDividends.projected}
          onOpenReview={ctrl.openPendingDividendsModal}
          onSelectMonth={(nextMonth) => {
            ctrl.setMonth(nextMonth);
            ctrl.handleSubTabChange("mensal");
          }}
        />
      ),
    },
    {
      value: "ativos",
      label: "Por Ativo",
      content: (
        <DividendsByAssetPanel
          lifetimeTotal={ctrl.assetsBreakdown.lifetimeTotal}
          historicalTotal={ctrl.assetsBreakdown.historicalTotal}
          portfolioAverageYoC={ctrl.assetsBreakdown.portfolioAverageYoC}
          items={ctrl.assetsBreakdown.items}
        />
      ),
    },
    {
      value: "snowball",
      label: "Bola de Neve",
      content: (
        <DividendsSnowballPanel
          totalMonthlyEstimatedIncome={ctrl.snowballSummary.totalMonthlyEstimatedIncome}
          activeCount={ctrl.snowballSummary.activeCount}
          items={ctrl.snowballSummary.items}
        />
      ),
    },
  ];

  const deleteTargetAsset = ctrl.dividendToDelete?.asset_id
    ? ctrl.assetById.get(ctrl.dividendToDelete.asset_id)
    : undefined;
  const deleteTargetTicker = ctrl.dividendToDelete
    ? (deleteTargetAsset?.ticker ??
      ctrl.dividendToDelete.ticker ??
      "Ativo")
    : "";
  const deleteTargetCurrency = deleteTargetAsset?.currency === "USD" ? "USD" : "BRL";

  return (
    <div className="flex flex-col gap-5 min-w-0" data-tour="investments-dividends">
      {ctrl.error ? <ErrorState message={getErrorMessage(ctrl.error)} onRetry={ctrl.refetch} /> : null}

      {!ctrl.loading && ctrl.calibrationCount > 0 ? (
        <div
          role="region"
          aria-label="Calibração de proventos pendente"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3.5"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <CalendarClock
              className="size-4 text-warning-strong shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-semibold text-foreground">
                {ctrl.calibrationCount}{" "}
                {ctrl.calibrationCount === 1
                  ? "ativo aguarda calibração de proventos"
                  : "ativos aguardam calibração de proventos"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                Defina o primeiro dia (Data COM) ainda não incluído nos proventos acumulados para ativar o acompanhamento automático.
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 self-stretch sm:self-center"
            onClick={ctrl.openPendingDividendsModal}
          >
            Calibrar {ctrl.calibrationCount === 1 ? "1 ativo" : `${ctrl.calibrationCount} ativos`}
          </Button>
        </div>
      ) : null}

      {ctrl.loading ? (
        <>
          <Tabs
            value={ctrl.subTab}
            onValueChange={(val) => ctrl.handleSubTabChange(val as ProventosSubTab)}
            variant="pills"
            items={tabItems.map((item) => ({ value: item.value, label: item.label }))}
            ariaLabel="Sub-abas de proventos"
          />
          <div aria-hidden="true">
            <SkeletonTable rows={4} />
          </div>
        </>
      ) : (
        <Tabs
          value={ctrl.subTab}
          onValueChange={(val) => ctrl.handleSubTabChange(val as ProventosSubTab)}
          variant="pills"
          items={tabItems}
          ariaLabel="Sub-abas de proventos"
        />
      )}

      <QuickTransactionSheet
        open={ctrl.dividendFormOpen || ctrl.editingDividend !== null}
        onOpenChange={(open) => {
          if (!open) {
            ctrl.setDividendFormOpen(false);
            ctrl.setEditingDividend(null);
          }
        }}
        initialType="dividend"
        editDividend={ctrl.editingDividend}
      />

      <ConfirmDialog
        open={ctrl.dividendToDelete !== null}
        onOpenChange={(next) => {
          if (!next) {
            ctrl.setDividendToDelete(null);
            ctrl.setRollbackCash(true);
          }
        }}
        title="Excluir provento?"
        description={`O registro deste provento de ${deleteTargetTicker} no valor de ${formatCentsAsCurrency(numberToCents(ctrl.dividendToDelete?.amount ?? 0), deleteTargetCurrency)} será removido da carteira.`}
        confirmLabel="Excluir"
        variant="destructive"
        confirmPending={ctrl.isDeleting}
        onConfirm={() => void ctrl.handleDelete()}
      >
        {ctrl.dividendToDelete && Boolean(ctrl.dividendToDelete.sync_cash) ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-raised p-3 text-xs text-left">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Estornar valor do Caixa</span>
              <Checkbox
                checked={ctrl.rollbackCash}
                onCheckedChange={(checked) => ctrl.setRollbackCash(Boolean(checked))}
                aria-label="Estornar valor do Caixa"
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {ctrl.cashBalance < (ctrl.dividendToDelete.cash_amount ?? ctrl.dividendToDelete.amount)
                ? `Saldo atual em Caixa (${formatCentsAsBRL(numberToCents(ctrl.cashBalance))}) é menor que o provento. Ao estornar, o saldo do Caixa será ajustado para R$ 0,00.`
                : `Abaterá ${formatCentsAsBRL(numberToCents(ctrl.dividendToDelete.cash_amount ?? ctrl.dividendToDelete.amount))} do saldo atual de Caixa (${formatCentsAsBRL(numberToCents(ctrl.cashBalance))}).`}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      {ctrl.upgradeModal}
    </div>
  );
}
