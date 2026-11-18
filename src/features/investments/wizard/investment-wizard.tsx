import { Alert, ConfirmDialog, Modal, Stepper } from "@/components/ui";
import type { PortfolioAsset } from "@/types";
import { StepGovernance } from "./step-governance";
import { StepNewPosition } from "./step-new-position";
import { StepOrder } from "./step-order";
import { StepReview } from "./step-review";
import { StepSelect } from "./step-select";
import { useInvestmentWizard } from "./use-investment-wizard";
import { WizardNavigationFooter } from "./wizard-navigation-footer";
import { canProceed, type WizardMode } from "./wizard-state";

export interface InvestmentWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  /** Ativo pré-selecionado para iniciar diretamente no fluxo Fast-Track. */
  initialAsset?: PortfolioAsset | null;
  /** Modo inicial ("select" | "new_asset" | "buy" | "sell" | "dividend" | "split" | "reverse_split" | "existing_aporte"). */
  initialMode?: WizardMode;
  /** Quantidade pré-carregada (para sugestões do AporteTab ou Wizard). */
  initialQuantity?: number | string | null;
  /** Valor total pré-carregado em centavos (para renda fixa ou alocações pré-definidas). */
  initialTotalCents?: number | null;
}

export interface InvestmentWizardContentProps extends InvestmentWizardProps {
  open: boolean;
}

function getWizardModalTitle(mode: WizardMode, ticker: string): string {
  const target = ticker || "Investimento";
  if (mode === "sell") return `Vender · ${target}`;
  if (mode === "dividend") return `Provento · ${target}`;
  if (mode === "split") return `Desdobro (Split) · ${target}`;
  if (mode === "reverse_split") return `Grupamento (Inplit) · ${target}`;
  if (mode === "buy" || mode === "existing_aporte") return `Novo Aporte · ${target}`;
  if (mode === "new_asset") return `Novo Ativo · ${target}`;
  return "Operação em Investimentos";
}

function InvestmentWizardContent({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset,
  initialMode,
  initialQuantity,
  initialTotalCents,
}: InvestmentWizardContentProps) {
  const wizard = useInvestmentWizard({
    onOpenChange,
    onClose,
    onSuccess,
    initialAsset,
    initialMode,
    initialQuantity,
    initialTotalCents,
  });

  const { state, setState } = wizard;
  const canGoBack = state.mode !== "select" && (state.step > 1 || !initialAsset);
  const showCalculator =
    (state.mode === "new_asset" && state.step === 2) ||
    (state.mode !== "new_asset" && state.mode !== "select" && state.step === 2);
  const continueLabel =
    (state.mode === "select" || state.step === 1) && state.ticker
      ? `Continuar com ${state.ticker}`
      : "Continuar";

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => (!next ? wizard.requestClose() : onOpenChange?.(true))}
        title={getWizardModalTitle(state.mode, state.ticker)}
        description="Lance compras, vendas, proventos, desdobramentos ou cadastre novos ativos com atualização em tempo real."
        size="xl"
        showCalculator={showCalculator}
        footer={
          <WizardNavigationFooter
            canGoBack={canGoBack}
            isLastStep={wizard.isLastStep}
            canAdvance={canProceed(state)}
            isPending={wizard.isPending}
            isSubmitting={wizard.isSubmitting}
            continueLabel={continueLabel}
            onBack={wizard.handleBack}
            onCancel={wizard.requestClose}
            onNext={wizard.handleNext}
            onSubmit={wizard.handleSubmit}
          />
        }
      >
        <div className="flex flex-col gap-6 pt-2">
          {state.mode !== "select" && (
            <Stepper steps={wizard.steps.map((s) => s.title)} current={state.step} />
          )}

          {wizard.error && <Alert variant="error">{wizard.error}</Alert>}

          {state.mode === "select" && (
            <StepSelect
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={wizard.existingAssets}
              assetRows={wizard.position.rows}
              classTargets={wizard.classTargets}
              sectorTargets={wizard.sectorTargets}
              totalPortfolioBRL={wizard.position.totalBRL}
              cashAvailableBRL={wizard.cashAsset?.quantity ?? 0}
              onSelectResult={(res) => wizard.handleSelectResult(res, false)}
              onSelectSuggestion={wizard.handleSelectSuggestion}
            />
          )}

          {state.mode === "new_asset" && state.step === 1 && (
            <StepSelect
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={wizard.existingAssets}
              assetRows={wizard.position.rows}
              classTargets={wizard.classTargets}
              sectorTargets={wizard.sectorTargets}
              totalPortfolioBRL={wizard.position.totalBRL}
              cashAvailableBRL={wizard.cashAsset?.quantity ?? 0}
              onSelectResult={(res) => wizard.handleSelectResult(res, true)}
              onSelectSuggestion={wizard.handleSelectSuggestion}
            />
          )}

          {state.mode === "new_asset" && state.step === 2 && (
            <StepNewPosition state={state} onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))} />
          )}

          {state.mode === "new_asset" && state.step === 3 && (
            <StepGovernance
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={wizard.existingAssets}
              classTargets={wizard.classTargets}
              sectorTargets={wizard.rawSectorTargets}
            />
          )}

          {state.mode !== "new_asset" && state.mode !== "select" && state.step === 2 && (
            <StepOrder
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              cashAsset={wizard.cashAsset}
              usdRate={wizard.usdRate}
            />
          )}

          {wizard.isLastStep && (
            <StepReview
              state={state}
              cashAvailableBRL={wizard.cashAsset?.quantity ?? 0}
              usdRate={wizard.usdRate}
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={wizard.confirmClose}
        onOpenChange={wizard.setConfirmClose}
        title="Descartar alterações?"
        description="Você já preencheu dados da operação. Se fechar agora, as informações serão perdidas."
        confirmLabel="Descartar"
        variant="destructive"
        onConfirm={wizard.handleClose}
      />

      {wizard.upgradeModal}
    </>
  );
}

export function InvestmentWizard({
  open = true,
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset = null,
  initialMode = "select",
  initialQuantity,
  initialTotalCents,
}: InvestmentWizardProps) {
  if (!open) return null;

  return (
    <InvestmentWizardContent
      key={`${initialAsset?.id ?? "none"}-${initialMode}-${initialQuantity ?? "default"}`}
      open={open}
      onOpenChange={onOpenChange}
      onClose={onClose}
      onSuccess={onSuccess}
      initialAsset={initialAsset}
      initialMode={initialMode}
      initialQuantity={initialQuantity}
      initialTotalCents={initialTotalCents}
    />
  );
}
