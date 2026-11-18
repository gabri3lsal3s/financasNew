import { Checkbox, ConfirmDialog, ErrorState, SkeletonTable, Tabs, type TabItem } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import { getErrorMessage } from "@/services/errors";
import { formatCentsAsBRL } from "@/services/masks";
import type { PortfolioAsset } from "@/types";
import { PendingDividendsDialog, QuickTransactionSheet } from "../components";
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
export function ProventosTab({ defaultMonth, onOpenWizard }: ProventosTabProps) {
  const ctrl = useProventosTabController(defaultMonth, onOpenWizard);

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
          onOpenPendingDividends={() => ctrl.setPendingDividendsDialogOpen(true)}
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

  const deleteTargetTicker = ctrl.dividendToDelete
    ? (ctrl.assetById.get(ctrl.dividendToDelete.asset_id ?? "")?.ticker ??
      ctrl.dividendToDelete.ticker ??
      "Ativo")
    : "";

  return (
    <div className="flex flex-col gap-5 min-w-0" data-tour="investments-dividends">
      {ctrl.error ? <ErrorState message={getErrorMessage(ctrl.error)} onRetry={ctrl.refetch} /> : null}

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
        description={`O registro deste provento de ${deleteTargetTicker} no valor de ${formatCentsAsBRL(numberToCents(ctrl.dividendToDelete?.amount ?? 0))} será removido da carteira.`}
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

      <PendingDividendsDialog
        open={ctrl.pendingDividendsDialogOpen}
        onOpenChange={ctrl.setPendingDividendsDialogOpen}
        availableDividends={ctrl.corporateDividends.available}
        projectedDividends={ctrl.corporateDividends.projected}
      />

      {ctrl.upgradeModal}
    </div>
  );
}
