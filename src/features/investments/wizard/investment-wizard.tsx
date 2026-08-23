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
  type WizardMode,
} from "./wizard-state";

export interface InvestmentWizardProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  /** Ativo pré-selecionado para iniciar diretamente no fluxo Fast-Track. */
  initialAsset?: PortfolioAsset | null;
  /** Modo inicial ("select" | "new_asset" | "buy" | "sell" | "dividend" | "split" | "existing_aporte"). */
  initialMode?: WizardMode;
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
      const mode: WizardMode = initialMode !== "select" ? initialMode : "buy";
      return {
        ...defaultWizardState,
        mode,
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
    (state.mode === "new_asset" && state.step === 4) ||
    (state.mode !== "new_asset" && state.mode !== "select" && state.step === 3);

  const handleNext = () => {
    if (!canProceed(state)) return;
    setError(null);
    triggerSensory("selection");

    // No modo select, ao avançar vai para o step 2 do modo correspondente
    if (state.mode === "select") {
      if (state.selectedAsset) {
        setState((prev) => ({ ...prev, mode: "buy", step: 2 }));
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

    if (state.mode !== "new_asset" && state.mode !== "select" && state.step === 2 && !initialAsset) {
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
      if (state.mode === "buy" || state.mode === "existing_aporte") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");
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
      } else if (state.mode === "sell") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");
        const parsedQty = parseNumber(state.quantityStr);
        const price = state.priceCents / 100;
        const total = parsedQty * price;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "sell",
          date: state.date,
          quantity: parsedQty,
          price,
          total,
          syncCash: state.syncCash,
          cashAsset,
          notes: state.notes,
        });
      } else if (state.mode === "dividend") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");
        const total = state.totalCents / 100;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "dividend",
          date: state.date,
          quantity: 0,
          price: 0,
          total,
          syncCash: state.syncCash,
          cashAsset,
          notes: state.notes,
        });
      } else if (state.mode === "split") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "split",
          date: state.date,
          quantity: state.splitFactor,
          price: 0,
          total: 0,
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

        // Se foi definida meta de alocação % para o novo ativo, salva no repositório
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

  const getModalTitle = () => {
    if (state.mode === "sell") return `Vender · ${state.ticker || "Investimento"}`;
    if (state.mode === "dividend") return `Provento · ${state.ticker || "Investimento"}`;
    if (state.mode === "split") return `Split · ${state.ticker || "Investimento"}`;
    if (state.mode === "buy" || state.mode === "existing_aporte") {
      return `Novo Aporte · ${state.ticker || "Investimento"}`;
    }
    if (state.mode === "new_asset") {
      return `Novo Ativo · ${state.ticker || "Investimento"}`;
    }
    return "Operação em Investimentos";
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(next) => (!next ? requestClose() : onOpenChange?.(true))}
        title={getModalTitle()}
        description="Lance compras, vendas, proventos, splits ou cadastre novos ativos com atualização em tempo real."
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
                const isCash = isCashAssetClass(res.assetClass);
                if (res.isExisting && res.existingAssetId) {
                  const asset = existingAssets.find((a) => a.id === res.existingAssetId);
                  setState((prev) => ({
                    ...prev,
                    mode: "buy",
                    step: 2,
                    selectedAsset: asset ?? null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    currency: res.currency,
                    isCash,
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    mode: "new_asset",
                    step: 1,
                    selectedAsset: null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    currency: res.currency,
                    isCash,
                  }));
                }
              }}
              onSelectSuggestion={(item) => {
                const asset = existingAssets.find((a) => a.id === item.assetId);
                setState((prev) => ({
                  ...prev,
                  mode: "buy",
                  step: 2,
                  selectedAsset: asset ?? null,
                  ticker: item.ticker,
                  assetClass: item.assetClass,
                  currency: asset?.currency ?? "BRL",
                  isCash: false,
                  totalCents: Math.round(item.gapBRL * 100),
                }));
              }}
            />
          )}

          {/* Passo 1 do Novo Ativo: Identificação Cadastral */}
          {state.mode === "new_asset" && state.step === 1 && (
            <StepSelect
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              existingAssets={existingAssets}
              assetRows={position.rows}
              targets={targets}
              totalPortfolioBRL={position.totalBRL}
              onSelectResult={(res) => {
                const isCash = isCashAssetClass(res.assetClass);
                setState((prev) => ({
                  ...prev,
                  ticker: res.ticker,
                  name: res.name,
                  assetClass: res.assetClass,
                  currency: res.currency,
                  isCash,
                }));
              }}
              onSelectSuggestion={(item) => {
                const asset = existingAssets.find((a) => a.id === item.assetId);
                setState((prev) => ({
                  ...prev,
                  mode: "buy",
                  step: 2,
                  selectedAsset: asset ?? null,
                  ticker: item.ticker,
                  assetClass: item.assetClass,
                  currency: asset?.currency ?? "BRL",
                  isCash: false,
                  totalCents: Math.round(item.gapBRL * 100),
                }));
              }}
            />
          )}

          {/* Passo 2 do Novo Ativo: Posição Inicial */}
          {state.mode === "new_asset" && state.step === 2 && (
            <StepNewPosition
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
            />
          )}

          {/* Passo 3 do Novo Ativo: Meta de Alocação */}
          {state.mode === "new_asset" && state.step === 3 && (
            <StepTarget
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              targets={targets}
            />
          )}

          {/* Passo 2 de Operações em Ativo Existente: Quantidade e Preço */}
          {state.mode !== "new_asset" && state.mode !== "select" && state.step === 2 && (
            <StepOrder
              state={state}
              onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
              cashAsset={cashAsset}
            />
          )}

          {/* Passo Final: Revisão & Confirmação */}
          {isLastStep && (
            <StepReview
              state={state}
              cashAvailableBRL={cashAsset?.quantity ?? 0}
            />
          )}

          {/* Rodapé de Navegação do Wizard */}
          <div className="flex items-center justify-between border-t border-border/80 pt-4">
            <div>
              {state.mode !== "select" && (state.step > 1 || !initialAsset) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  disabled={isPending}
                >
                  Voltar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={requestClose}
                disabled={isPending}
              >
                Cancelar
              </Button>

              {isLastStep ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canProceed(state) || isPending}
                >
                  {isPending ? "Gravando..." : "Confirmar Operação"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  disabled={!canProceed(state) || isPending}
                >
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirmação de Descarte se formulário foi preenchido */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Descartar alterações?"
        description="Você já preencheu dados da operação. Se fechar agora, as informações serão perdidas."
        confirmLabel="Descartar"
        variant="destructive"
        onConfirm={handleClose}
      />
    </>
  );
}
