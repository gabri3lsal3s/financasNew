import { History } from "lucide-react";
import { EmptyState, SkeletonTable } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import {
  resolveActivityItemAsset,
  type ActivityFilterType,
  type ActivityItem,
} from "@/domain/portfolio/unified-activity-feed";
import type { PortfolioAsset, PortfolioContribution, PortfolioDividend } from "@/types";
import { ActivityDeleteDialog } from "./activity-panel/activity-delete-dialog";
import { ActivityFilterBar } from "./activity-panel/activity-filter-bar";
import { ActivityRowItem } from "./activity-panel/activity-row-item";
import { ActivitySummaryCards } from "./activity-panel/activity-summary-cards";
import { useActivityFiltersExport } from "./activity-panel/use-activity-filters-export";
import { ContributionFormDialog } from "./contribution-form-dialog";
import { QuickTransactionSheet } from "./quick-transaction-sheet";

export type { ActivityFilterType, ActivityItem };

export interface PortfolioActivityPanelProps {
  defaultMonth?: string;
}

/**
 * Extrato Completo de Movimentações da Carteira.
 */
export function PortfolioActivityPanel({ defaultMonth }: PortfolioActivityPanelProps) {
  const vm = useActivityFiltersExport(defaultMonth);

  const handleEditItem = (item: ActivityItem, asset: PortfolioAsset | null) => {
    if (item.type === "dividend") {
      vm.guardAction(() => {
        const divToEdit: PortfolioDividend = item.rawDividend ?? {
          id: item.id.replace(/^div-/, "").replace(/^tx-/, ""),
          user_id: item.rawTransaction?.user_id ?? "",
          asset_id: item.rawTransaction?.asset_id ?? null,
          ticker: item.ticker,
          date: item.date,
          amount: item.total,
          sync_cash: false,
        };
        vm.setEditingDividend(divToEdit);
      }, "Editar Provento");
      return;
    }

    if (item.type === "contribution") {
      vm.guardAction(() => {
        const contribToEdit: PortfolioContribution = item.rawContribution ?? {
          id: item.id.replace(/^contrib-/, ""),
          user_id: "",
          asset_id: item.rawTransaction?.asset_id ?? null,
          date: item.date,
          amount: item.total,
          notes: item.notes ?? null,
        };
        vm.setEditingContribution(contribToEdit);
      }, "Editar Aporte");
      return;
    }

    if (item.source === "transaction" && item.rawTransaction && asset) {
      vm.guardAction(() => {
        vm.setEditingTx({
          transaction: item.rawTransaction!,
          asset,
          linkedContribution: item.linkedContribution,
        });
      }, "Editar Operação");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <MonthPicker value={vm.month} onValueChange={vm.setMonth} />

        <ActivitySummaryCards stats={vm.monthStats} />

        <ActivityFilterBar
          search={vm.search}
          onSearchChange={vm.setSearch}
          filterType={vm.filterType}
          onFilterTypeChange={vm.setFilterType}
          totalCount={vm.monthActivitiesCount}
          typeCounts={vm.typeCounts}
          filteredCount={vm.filteredActivities.length}
          onExportCsv={vm.handleExportCsv}
          availableClasses={vm.availableClasses}
          selectedClass={vm.selectedClass}
          onSelectedClassChange={vm.setSelectedClass}
          availableSectors={vm.availableSectors}
          selectedSector={vm.selectedSector}
          onSelectedSectorChange={vm.setSelectedSector}
          onClearAuxFilters={() => {
            vm.setSelectedClass("all");
            vm.setSelectedSector("all");
          }}
        />

        {vm.isLoading ? (
          <SkeletonTable rows={4} />
        ) : vm.filteredActivities.length === 0 ? (
          <EmptyState
            icon={<History className="size-6" aria-hidden="true" />}
            title="Nenhuma movimentação registrada no período"
            description="Todas as suas compras, vendas, resgates de renda fixa e proventos aparecem aqui para conferência e auditoria completa."
            tone="default"
            headingLevel="h3"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border/50 rounded-xl border border-border/80 overflow-hidden bg-surface shadow-xs">
            {vm.filteredActivities.map((item) => (
              <ActivityRowItem
                key={item.id}
                item={item}
                itemAsset={resolveActivityItemAsset(item, vm.assetMap)}
                onEdit={handleEditItem}
                onRequestDelete={(target) =>
                  vm.guardAction(() => vm.setItemToDelete(target), "Excluir Movimentação")
                }
              />
            ))}
          </div>
        )}
      </div>

      <ActivityDeleteDialog
        item={vm.itemToDelete}
        rollbackCash={vm.rollbackCash}
        onRollbackCashChange={vm.setRollbackCash}
        cashAsset={vm.cashAsset}
        cashBalance={vm.cashBalance}
        usdRate={vm.usdRate}
        assetMap={vm.assetMap}
        confirmPending={vm.isDeleting}
        onClose={() => {
          vm.setItemToDelete(null);
          vm.setRollbackCash(true);
        }}
        onConfirm={vm.handleDeleteItem}
      />

      {vm.editingTx ? (
        <QuickTransactionSheet
          open={vm.editingTx !== null}
          onOpenChange={(open) => !open && vm.setEditingTx(null)}
          asset={vm.editingTx.asset}
          editTransaction={vm.editingTx.transaction}
          linkedContribution={vm.editingTx.linkedContribution}
        />
      ) : null}

      {vm.editingDividend ? (
        <QuickTransactionSheet
          open={vm.editingDividend !== null}
          onOpenChange={(open) => !open && vm.setEditingDividend(null)}
          asset={vm.assetMap.get(vm.editingDividend.asset_id ?? "") ?? null}
          editDividend={vm.editingDividend}
        />
      ) : null}

      {vm.editingContribution ? (
        <ContributionFormDialog
          open={vm.editingContribution !== null}
          onOpenChange={(open) => !open && vm.setEditingContribution(null)}
          contribution={vm.editingContribution}
        />
      ) : null}

      {vm.upgradeModal}
    </>
  );
}
