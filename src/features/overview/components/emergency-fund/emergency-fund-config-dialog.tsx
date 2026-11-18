import { Button, Modal, ModalFooter } from "@/components/ui";
import type { PortfolioPositionRowLike } from "@/domain/projection";
import type { EmergencyFundConfig } from "@/types";
import { EmergencyAssetsSelectorList } from "./emergency-assets-selector-list";
import {
  EmergencyCheckingAccountCard,
  EmergencyPrecisionSection,
  EmergencySummaryBanner,
} from "./emergency-summary-panel";
import { useEmergencyFundForm } from "./use-emergency-fund-form";

export interface EmergencyFundConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: EmergencyFundConfig;
  onSave: (config: EmergencyFundConfig) => Promise<void>;
  realCashCents: number;
  portfolioRows: PortfolioPositionRowLike[];
  monthlyExpensesCents: number;
}

export function EmergencyFundConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  realCashCents,
  portfolioRows = [],
  monthlyExpensesCents,
}: EmergencyFundConfigDialogProps) {
  const form = useEmergencyFundForm({
    open,
    config,
    realCashCents,
    portfolioRows,
    monthlyExpensesCents,
    onSave,
    onOpenChange,
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Composição da Reserva de Emergência"
      description="Personalize quais contas e ativos de investimentos garantem a sua autonomia financeira."
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={form.isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={form.handleSave}
            disabled={form.isSaving}
            loading={form.isSaving}
          >
            Salvar Composição
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-5 text-sm min-w-0">
        <EmergencySummaryBanner
          previewComposition={form.previewComposition}
          coverageMonths={form.coverageMonths}
          targetMonths={form.targetMonths}
        />

        <EmergencyCheckingAccountCard
          includeCheckingAccounts={form.includeCheckingAccounts}
          onIncludeCheckingAccountsChange={form.setIncludeCheckingAccounts}
          realCashCents={realCashCents}
        />

        <EmergencyAssetsSelectorList
          selectionMode={form.selectionMode}
          onSelectMode={form.setSelectionMode}
          portfolioRows={portfolioRows}
          selectedAssetIds={form.selectedAssetIds}
          onToggleAsset={form.handleToggleAsset}
          availableClasses={form.availableClasses}
          selectedClasses={form.selectedClasses}
          onToggleClass={form.handleToggleClass}
          useNetValue={form.useNetValue}
          onSuggestReserveAssets={form.handleSuggestReserveAssets}
          onSelectAllAssets={form.handleSelectAllAssets}
          onClearAssets={form.handleClearAssets}
        />

        <EmergencyPrecisionSection
          useNetValue={form.useNetValue}
          onUseNetValueChange={form.setUseNetValue}
          targetMonths={form.targetMonths}
          onTargetMonthsChange={form.setTargetMonths}
          warnings={form.previewComposition.warnings}
        />
      </div>
    </Modal>
  );
}
