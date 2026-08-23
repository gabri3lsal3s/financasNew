import { useState } from "react";
import { Alert, Button, ConfirmDialog, Modal, Stepper } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import {
  useAllocationTargets,
  useCreatePortfolioAsset,
  usePortfolioAssets,
  usePortfolioPosition,
  useRecordOrder,
  useSaveAllocationTargets,
} from "@/state";
import type { PortfolioAsset } from "@/types";
import type { AllocationTargetInput } from "@/data/repositories/allocation-targets";
import { StepNewPosition } from "./step-new-position";
import { StepOrder } from "./step-order";
import { StepReview } from "./step-review";
import { StepSelect } from "./step-select";
import { StepTarget } from "./step-target";
import {
  canProceed,
  defaultWizardState,
  getWizardSteps,
  parseNumber,
  type InvestmentWizardState,
} from "./wizard-state";

export interface InvestmentWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  /** Ativo pré-selecionado para iniciar diretamente no fluxo Fast-Track de Aporte. */
  initialAsset?: PortfolioAsset | null;
  /** Modo inicial ("select" | "new_asset" | "existing_aporte"). */
  initialMode?: "select" | "new_asset" | "existing_aporte";
}

export function InvestmentWizard({
  open = true,
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset = null,
  initialMode = "select",
}: InvestmentWizardProps) {
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const createAsset = useCreatePortfolioAsset();
  const recordOrder = useRecordOrder();
  const saveTargets = useSaveAllocationTargets();

  const existingAssets = assetsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const cashAsset = existingAssets.find((a) => isCashAssetClass(a.asset_class)) ?? null;

  const [state, setState] = useState<InvestmentWizardState>(() => {
    if (initialAsset) {
      return {
        ...defaultWizardState,
        mode: "existing_aporte",
        step: 2,
        selectedAsset: initialAsset,
        ticker: initialAsset.ticker,
        assetClass: initialAsset.asset_class ?? "Ações",
        currency: initialAsset.currency,
        isCash: isCashAssetClass(initialAsset.asset_class),
      };
    }
    if (initialMode === "new_asset") {
      return {
        ...defaultWizardState,
        mode: "new_asset",
        step: 1,
      };
    }
    return defaultWizardState;
  });

  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const isDirty =
    state.ticker !== "" ||
    state.quantityStr !== "" ||
    state.priceCents > 0 ||
    state.totalCents > 0;

  const handleClose = () => {
    setState(defaultWizardState);
    setError(null);
    onClose?.();
    onOpenChange?.(false);
  };

  const requestClose = () => {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      handleClose();
    }
  };

  const steps = getWizardSteps(state.mode);
  const isLastStep =
    (state.mode === "existing_aporte" && state.step === 3) ||
    (state.mode === "new_asset" && state.step === 4);

  const handleNext = () => {
    if (!canProceed(state)) return;
    setError(null);
    triggerSensory("selection");

    // No modo select, ao avançar vai para o step 2 do modo correspondente
    if (state.mode === "select") {
      if (state.selectedAsset) {
        setState((prev) => ({ ...prev, mode: "existing_aporte", step: 2 }));
      } else {
        setState((prev) => ({ ...prev, mode: "new_asset", step: 2 }));
      }
      return;
    }

    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const handleBack = () => {
    setError(null);
    triggerSensory("selection");

    if (state.mode === "existing_aporte" && state.step === 2 && !initialAsset) {
      setState((prev) => ({ ...prev, mode: "select", step: 1 }));
      return;
    }

    if (state.mode === "new_asset" && state.step === 1 && !initialAsset) {
      setState((prev) => ({ ...prev, mode: "select", step: 1 }));
      return;
    }

    setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) }));
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (state.mode === "existing_aporte" && state.selectedAsset) {
        const parsedQty = parseNumber(state.quantityStr);
        const price = state.priceCents / 100;
        const total = state.totalCents / 100 || parsedQty * price;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "buy",
          date: state.date,
          quantity: state.isCash ? (total > 0 ? total : parsedQty) : parsedQty,
          price: state.isCash ? 1 : price,
          total: total > 0 ? total : parsedQty * price,
          syncCash: state.syncCash,
          cashAsset,
          recordContribution: state.recordContribution,
          notes: state.notes,
        });
      } else if (state.mode === "new_asset") {
        const parsedQty = parseNumber(state.quantityStr);
        const price = state.priceCents / 100;
        const total = state.totalCents / 100;

        const newAsset = await createAsset.mutateAsync({
          ticker: state.ticker,
          asset_class: state.assetClass,
          currency: state.currency,
          quantity: state.isCash ? (total > 0 ? total : parsedQty) : parsedQty,
          average_price: state.isCash ? 1 : price,
          notes: state.notes ? state.notes : null,
        });

        // 3. Se foi definida meta de alocação % para o novo ativo, salva no repositório
        if (state.targetPercentage !== null && state.targetPercentage > 0) {
          const currentTargets: AllocationTargetInput[] = targets.map((t) => ({
            assetId: t.asset_id,
            target: t.target_percentage,
          }));
          await saveTargets.mutateAsync([
            ...currentTargets.filter((t) => t.assetId !== newAsset.id),
            { assetId: newAsset.id, target: state.targetPercentage },
          ]);
        }
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const isPending = createAsset.isPending || recordOrder.isPending || saveTargets.isPending;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => (!next ? requestClose() : onOpenChange?.(true))}
        title={
          state.mode === "existing_aporte"
            ? `Novo Aporte · ${state.ticker || "Investimento"}`
            : "Adicionar Ativo à Carteira"
        }
        description={
          state.mode === "existing_aporte"
            ? "Registre a compra de cotas ou novo aporte na sua posição."
            : "Cadastre um novo ativo, defina a posição inicial e sua meta de alocação."
        }
        size="lg"
      >
        <div className="flex flex-col gap-6 pt-2">
          {/* Stepper com passos contextuais */}
          {state.mode !== "select" && (
            <Stepper
              steps={steps.map((s) => s.title)}
              current={state.step}
            />
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {/* Renderização do Passo Ativo */}
          {state.mode === "select" && (
            <StepSelect
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={existingAssets}
              assetRows={position.rows}
              targets={targets}
              totalPortfolioBRL={position.totalBRL}
              onSelectResult={(res) => {
                if (res.isExisting && res.existingAssetId) {
                  const asset = existingAssets.find((a) => a.id === res.existingAssetId);
                  setState((prev) => ({
                    ...prev,
                    mode: "existing_aporte",
                    step: 2,
                    selectedAsset: asset ?? null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    currency: res.currency,
                    isCash: isCashAssetClass(res.assetClass),
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    mode: "new_asset",
                    step: 2,
                    selectedAsset: null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    currency: res.currency,
                    isCash: isCashAssetClass(res.assetClass),
                  }));
                }
              }}
              onSelectSuggestion={(sug) => {
                const asset = existingAssets.find((a) => a.id === sug.assetId);
                setState((prev) => ({
                  ...prev,
                  mode: "existing_aporte",
                  step: 2,
                  selectedAsset: asset ?? null,
                  ticker: sug.ticker,
                  assetClass: sug.assetClass,
                  totalCents: Math.round(sug.gapBRL * 100),
                  isCash: isCashAssetClass(sug.assetClass),
                }));
              }}
            />
          )}

          {state.mode === "existing_aporte" && state.step === 2 && (
            <StepOrder
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              cashAsset={cashAsset}
            />
          )}

          {state.mode === "new_asset" && state.step === 1 && (
            <StepSelect
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={existingAssets}
              assetRows={position.rows}
              targets={targets}
              totalPortfolioBRL={position.totalBRL}
              onSelectResult={(res) => {
                setState((prev) => ({
                  ...prev,
                  ticker: res.ticker,
                  name: res.name,
                  assetClass: res.assetClass,
                  currency: res.currency,
                  isCash: isCashAssetClass(res.assetClass),
                }));
              }}
              onSelectSuggestion={() => undefined}
            />
          )}

          {state.mode === "new_asset" && state.step === 2 && (
            <StepNewPosition
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
            />
          )}

          {state.mode === "new_asset" && state.step === 3 && (
            <StepTarget
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              targets={targets}
            />
          )}

          {isLastStep && (
            <StepReview
              state={state}
              cashAvailableBRL={cashAsset?.quantity ?? 0}
            />
          )}

          {/* Rodapé de Ações com Navegação do Stepper */}
          <div className="flex items-center justify-between border-t border-border/80 pt-4">
            {state.step > 1 || (state.mode !== "select" && !initialAsset) ? (
              <Button type="button" variant="outline" size="sm" onClick={handleBack} disabled={isPending}>
                Voltar
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={isPending}>
                Cancelar
              </Button>
            )}

            <div className="flex items-center gap-2">
              {isLastStep ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isPending || !canProceed(state)}
                >
                  {isPending ? "Salvando…" : state.mode === "existing_aporte" ? "Concluir Aporte" : "Cadastrar Ativo"}
                </Button>
              ) : (
                state.mode !== "select" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    disabled={!canProceed(state)}
                  >
                    Avançar
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmação Anti-Perda Acidental */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Descartar alterações?"
        description="Você preencheu dados da operação. Se fechar agora, essas informações não serão salvas."
        confirmLabel="Descartar e Fechar"
        variant="destructive"
        onConfirm={handleClose}
      />
    </>
  );
}
