import { useState } from "react";
import { Alert, Button, ConfirmDialog, Modal, Stepper } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { getAssetPricingMode, isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { numberToCents } from "@/domain/money";
import { inferSectorFromTicker, type AporteSuggestionItem } from "@/domain/portfolio/tickers-catalog";
import { resolveDividendDate, resolveDividendNote } from "@/domain/portfolio/dividends";
import { buildInitialPositionOperations } from "@/domain/portfolio/operations";
import {
  useAllocationTargets,
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
  useCreatePortfolioTransaction,
  useGroupTargets,
  usePortfolioAssets,
  usePortfolioPosition,
  useRecordOrder,
  useSaveAllocationTargets,
  useSetManualPrice,
} from "@/state";
import type { AllocationTargetInput, FixedIncomeMetadata, PortfolioAsset } from "@/types";


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

export interface InvestmentWizardContentProps extends InvestmentWizardProps {
  open: boolean;
}

function InvestmentWizardContent({
  open,
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset,
  initialMode,
}: InvestmentWizardContentProps) {
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const targetsQuery = useAllocationTargets();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const createAsset = useCreatePortfolioAsset();
  const createTransaction = useCreatePortfolioTransaction();
  const createContribution = useCreatePortfolioContribution();
  const recordOrder = useRecordOrder();
  const saveTargets = useSaveAllocationTargets();
  const setManualPrice = useSetManualPrice();

  const existingAssets = assetsQuery.data ?? [];
  const targets = targetsQuery.data ?? [];
  const classTargets = classTargetsQuery.data ?? [];
  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];

  const sectorTargets = (sectorTargetsQuery.data ?? []).flatMap((st) => {
    const matchedClasses = classes.filter((cls) => {
      const inAssets = position.rows.some((r) => r.assetClass === cls && (r.sector === st.name || inferSectorFromTicker(r.ticker, cls) === st.name));
      return inAssets;
    });
    if (matchedClasses.length === 0) {
      return [{ className: "Ações", sectorName: st.name, target_percentage: st.target_percentage }];
    }
    return matchedClasses.map((className) => ({
      className,
      sectorName: st.name,
      target_percentage: st.target_percentage,
    }));
  });
  const cashAsset =
    existingAssets.find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") ?? null;

  const [state, setState] = useState<InvestmentWizardState>(() => {
    if (initialAsset) {
      const mode: WizardMode = initialMode && initialMode !== "select" ? initialMode : "buy";
      const initialCost = initialAsset.fixed_income_metadata?.initial_investment_value
        ?? initialAsset.fixed_income_metadata?.base_value
        ?? initialAsset.average_price
        ?? 0;
      return {
        ...defaultWizardState,
        mode,
        step: 2,
        selectedAsset: initialAsset,
        ticker: initialAsset.ticker,
        assetClass: initialAsset.asset_class ?? "Ações",
        currency: initialAsset.currency,
        isCash: isCashAssetClass(initialAsset.asset_class),
        appliedCostCents: numberToCents(initialCost),
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
    setConfirmClose(false);
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
        const total = state.totalCents / 100;

        const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
        const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
        const pricingMode = getAssetPricingMode(
          state.selectedAsset ?? { ticker: state.ticker, asset_class: state.assetClass, notes: state.notes },
        );
        const isTotalValue = !state.isCash && (pricingMode === "total_value" || isFixedIncome);

        const finalTotal = isTotalValue
          ? total > 0
            ? total
            : price
          : state.isCash
            ? total > 0
              ? total
              : parsedQty
            : parsedQty * price;

        const usdRate = position.rows.find((r) => r.usdRate)?.usdRate ?? 5.25;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "buy",
          date: state.date,
          quantity: isTotalValue ? 1 : state.isCash ? (total > 0 ? total : parsedQty) : parsedQty,
          price: isTotalValue ? finalTotal : state.isCash ? 1 : price,
          total: finalTotal,
          syncCash: state.syncCash,
          cashAsset,
          recordContribution: state.recordContribution,
          notes: state.notes,
          usdRate,
        });
      } else if (state.mode === "sell") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");
        const parsedQty = parseNumber(state.quantityStr);
        const price = state.priceCents / 100;
        const total = state.totalCents / 100;

        const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
        const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
        const pricingMode = getAssetPricingMode(
          state.selectedAsset ?? { ticker: state.ticker, asset_class: state.assetClass, notes: state.notes },
        );
        const isTotalValue = !state.isCash && (pricingMode === "total_value" || isFixedIncome);

        const finalTotal = isTotalValue
          ? total > 0
            ? total
            : price
          : parsedQty * price;

        const usdRate = position.rows.find((r) => r.usdRate)?.usdRate ?? 5.25;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "sell",
          date: state.date,
          quantity: isTotalValue ? 1 : parsedQty,
          price: isTotalValue ? finalTotal : price,
          total: finalTotal,
          syncCash: state.syncCash,
          cashAsset,
          notes: state.notes,
          usdRate,
          appliedCostBasis: isTotalValue && state.appliedCostCents > 0 ? state.appliedCostCents / 100 : undefined,
        });
      } else if (state.mode === "dividend") {
        if (!state.selectedAsset) throw new Error("Selecione um ativo");
        const total = state.totalCents / 100;

        const resolvedDate = resolveDividendDate(
          state.dividendEntryMode,
          state.dividendEntryMode === "monthly" ? state.month : state.date,
        );
        const resolvedNotes = resolveDividendNote(
          state.dividendEntryMode,
          state.notes,
          "dividend",
        );

        const usdRate = position.rows.find((r) => r.usdRate)?.usdRate ?? 5.25;

        await recordOrder.mutateAsync({
          asset: state.selectedAsset,
          type: "dividend",
          date: resolvedDate,
          quantity: 0,
          price: 0,
          total,
          syncCash: state.syncCash,
          cashAsset,
          notes: resolvedNotes,
          usdRate,
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

        const isCash = state.isCash || isCashAssetClass(state.assetClass) || state.ticker.toUpperCase() === "CAIXA";
        const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
        const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
        const isTotalValue = !isCash && isFixedIncome;

        let finalQuantity = parsedQty;
        let finalAveragePrice = price;
        const finalNotes = state.notes ? state.notes.trim() : null;

        if (isCash) {
          finalQuantity = total > 0 ? total : parsedQty;
          finalAveragePrice = 1;
        } else if (isTotalValue) {
          finalQuantity = 1;
          finalAveragePrice = price > 0 ? price : total;
        }

        let fixedIncomeMetadata: FixedIncomeMetadata | null = null;
        if (isFixedIncome && !isCash) {
          const rateVal = parseNumber(state.fixedIncomeRateValue);
          fixedIncomeMetadata = {
            rate_type: state.fixedIncomeRateType,
            rate_value: rateVal,
            base_date: state.fixedIncomeBaseDate || state.date,
            base_value: isTotalValue && total > 0 ? total : null,
            initial_investment_date: state.fixedIncomeInitialInvestmentDate ? state.fixedIncomeInitialInvestmentDate.slice(0, 10) : null,
            maturity_date: state.fixedIncomeMaturityDate ? state.fixedIncomeMaturityDate.slice(0, 10) : null,
            is_tax_exempt: state.fixedIncomeIsTaxExempt,
            manual_tax_rate_pct: state.fixedIncomeIsTaxExempt ? null : state.fixedIncomeManualTaxRatePct,
          };
        }

        const newAsset = await createAsset.mutateAsync({
          ticker: state.ticker,
          asset_class: state.assetClass,
          sector: state.sector.trim() || null,
          currency: state.currency,
          quantity: finalQuantity,
          average_price: finalAveragePrice,
          accumulated_dividends: state.accumulatedDividendsCents / 100,
          estimated_monthly_dividend_per_share: state.estimatedDividendPerShareCents / 100,
          fixed_income_metadata: fixedIncomeMetadata,
          notes: finalNotes,
        });

        // Registra a transação inicial de compra no ledger e o aporte correspondente
        const ops = buildInitialPositionOperations({
          assetId: newAsset.id,
          ticker: state.ticker,
          assetClass: state.assetClass,
          currency: state.currency,
          quantity: finalQuantity,
          averagePrice: finalAveragePrice,
          initialDate:
            fixedIncomeMetadata?.initial_investment_date ||
            fixedIncomeMetadata?.base_date ||
            state.date,
          usdRate: position.rows.find((r) => r.currency === "USD")?.usdRate ?? 5.25,
          isTotalValue,
          isCash,
          notes: finalNotes,
        });

        if (ops.transaction) {
          await createTransaction.mutateAsync(ops.transaction);
        }
        if (ops.contribution) {
          await createContribution.mutateAsync(ops.contribution);
        }

        // Se for modo total_value e tiver preço atual / saldo definido, salva override manual
        if (isTotalValue && total > 0) {
          await setManualPrice.mutateAsync({
            ticker: state.ticker,
            price: total,
          });
        }

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

  const handleSelectSuggestion = (item: AporteSuggestionItem) => {
    triggerSensory("selection");
    const asset = existingAssets.find((a) => a.id === item.assetId);
    const row = position.rows.find((r) => r.assetId === item.assetId);
    const priceBRL = row?.priceBRL ?? Number(asset?.average_price ?? 0);
    const isTesouro = isTesouroAsset(item.ticker, item.assetClass);
    const isFixedIncome = isFixedIncomeClass(item.assetClass) || isTesouro;
    const pricingMode = getAssetPricingMode(
      asset ?? { ticker: item.ticker, asset_class: item.assetClass, notes: null },
    );
    const isTotalValue = pricingMode === "total_value" || isFixedIncome;
    const cashAvailableBRL = cashAsset?.quantity ?? 0;

    if (isTotalValue) {
      const suggestedAmount = cashAvailableBRL > 0 ? Math.min(cashAvailableBRL, item.gapBRL) : 0;
      const totalCents = Math.round(suggestedAmount * 100);
      setState((prev) => ({
        ...prev,
        mode: "buy",
        step: 2,
        searchQuery: item.ticker,
        selectedAsset: asset ?? null,
        ticker: item.ticker,
        assetClass: item.assetClass,
        sector: item.sector ?? asset?.sector ?? "",
        currency: asset?.currency ?? "BRL",
        isCash: false,
        priceCents: totalCents,
        quantityStr: "",
        totalCents,
        syncCash: suggestedAmount > 0,
      }));
      return;
    }

    let suggestedQty = 0;
    if (cashAvailableBRL > 0 && priceBRL > 0) {
      const maxUsefulQty = Math.floor(item.gapBRL / priceBRL);
      const cashQty = Math.floor(cashAvailableBRL / priceBRL);
      suggestedQty = Math.min(maxUsefulQty, cashQty);
    }

    const priceCents = Math.round(priceBRL * 100);
    const totalCents = suggestedQty > 0 ? Math.round(suggestedQty * priceBRL * 100) : 0;

    setState((prev) => ({
      ...prev,
      mode: "buy",
      step: 2,
      searchQuery: item.ticker,
      selectedAsset: asset ?? null,
      ticker: item.ticker,
      assetClass: item.assetClass,
      sector: item.sector ?? asset?.sector ?? "",
      currency: asset?.currency ?? "BRL",
      isCash: false,
      priceCents,
      quantityStr: suggestedQty > 0 ? String(suggestedQty) : "",
      totalCents,
      syncCash: suggestedQty > 0,
    }));
  };

  const isPending =
    createAsset.isPending ||
    createTransaction.isPending ||
    createContribution.isPending ||
    recordOrder.isPending ||
    saveTargets.isPending;

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
        showCalculator
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
              classTargets={classTargets}
              sectorTargets={sectorTargets}
              totalPortfolioBRL={position.totalBRL}
              cashAvailableBRL={cashAsset?.quantity ?? 0}
              onSelectResult={(res) => {
                triggerSensory("selection");
                const isCash = isCashAssetClass(res.assetClass);
                if (res.isExisting && res.existingAssetId) {
                  const asset = existingAssets.find((a) => a.id === res.existingAssetId);
                  setState((prev) => ({
                    ...prev,
                    mode: "buy",
                    step: 2,
                    searchQuery: res.ticker,
                    selectedAsset: asset ?? null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    sector: res.sector ?? asset?.sector ?? "",
                    currency: res.currency,
                    isCash,
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    mode: "new_asset",
                    step: 2,
                    searchQuery: res.ticker,
                    selectedAsset: null,
                    ticker: res.ticker,
                    name: res.name,
                    assetClass: res.assetClass,
                    sector: res.sector ?? "",
                    currency: res.currency,
                    isCash,
                  }));
                }
              }}
              onSelectSuggestion={handleSelectSuggestion}
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
              classTargets={classTargets}
              totalPortfolioBRL={position.totalBRL}
              cashAvailableBRL={cashAsset?.quantity ?? 0}
              onSelectResult={(res) => {
                triggerSensory("selection");
                const isCash = isCashAssetClass(res.assetClass);
                setState((prev) => ({
                  ...prev,
                  step: 2,
                  searchQuery: res.ticker,
                  ticker: res.ticker,
                  name: res.name,
                  assetClass: res.assetClass,
                  sector: res.sector ?? "",
                  currency: res.currency,
                  isCash,
                }));
              }}
              onSelectSuggestion={handleSelectSuggestion}
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
              usdRate={position.rows.find((r) => r.usdRate)?.usdRate ?? 5.25}
            />
          )}

          {/* Passo Final: Revisão & Confirmação */}
          {isLastStep && (
            <StepReview
              state={state}
              cashAvailableBRL={cashAsset?.quantity ?? 0}
              usdRate={position.rows.find((r) => r.usdRate)?.usdRate ?? 5.25}
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
                  {(state.mode === "select" || state.step === 1) && state.ticker
                    ? `Continuar com ${state.ticker}`
                    : "Continuar"}
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

export function InvestmentWizard({
  open = true,
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset = null,
  initialMode = "select",
}: InvestmentWizardProps) {
  if (!open) return null;

  return (
    <InvestmentWizardContent
      key={`${initialAsset?.id ?? "none"}-${initialMode}`}
      open={open}
      onOpenChange={onOpenChange}
      onClose={onClose}
      onSuccess={onSuccess}
      initialAsset={initialAsset}
      initialMode={initialMode}
    />
  );
}
