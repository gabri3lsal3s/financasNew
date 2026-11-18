import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { resolvePortfolioUsdRate } from "@/domain/portfolio";
import type { AporteSuggestionItem, TickerSearchResult } from "@/domain/portfolio/tickers-catalog";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import {
  invalidatePortfolioSuite,
  useCreatePortfolioAsset,
  useCreatePortfolioContribution,
  useCreatePortfolioTransaction,
  useEmergencyFundComposition,
  useFamilyMode,
  useGroupTargets,
  useMyFamily,
  usePortfolioAssets,
  usePortfolioPosition,
  useRecordOrder,
  useSetManualPrice,
} from "@/state";
import type { PortfolioAsset } from "@/types";
import {
  buildInitialWizardState,
  buildStateFromSearchResult,
  buildStateFromSuggestion,
  expandWizardSectorTargets,
} from "./wizard-selection-helpers";
import { canProceed, defaultWizardState, getWizardSteps, type InvestmentWizardState, type WizardMode } from "./wizard-state";
import { executeWizardSubmit } from "./wizard-submit-actions";

export interface UseInvestmentWizardParams {
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  initialAsset?: PortfolioAsset | null;
  initialMode?: WizardMode;
  initialQuantity?: number | string | null;
  initialTotalCents?: number | null;
}

export function useInvestmentWizard({
  onOpenChange,
  onClose,
  onSuccess,
  initialAsset,
  initialMode,
  initialQuantity,
  initialTotalCents,
}: UseInvestmentWizardParams) {
  const queryClient = useQueryClient();
  const assetsQuery = usePortfolioAssets();
  const position = usePortfolioPosition();
  const classTargetsQuery = useGroupTargets("class");
  const sectorTargetsQuery = useGroupTargets("sector");
  const createAsset = useCreatePortfolioAsset();
  const createTransaction = useCreatePortfolioTransaction();
  const createContribution = useCreatePortfolioContribution();
  const recordOrder = useRecordOrder();
  const setManualPrice = useSetManualPrice();
  const emergencyFund = useEmergencyFundComposition();
  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();

  const existingAssets = assetsQuery.data ?? [];
  const classTargets = classTargetsQuery.data ?? [];
  const rawSectorTargets = sectorTargetsQuery.data ?? [];
  const classes = [...new Set(position.rows.map((r) => r.assetClass).filter((c): c is string => c !== null))];
  const usdRate = resolvePortfolioUsdRate(position.rows);
  const sectorTargets = expandWizardSectorTargets(rawSectorTargets, classes, position.rows);
  const cashAsset = existingAssets.find((a) => isCashAssetClass(a.asset_class) || a.ticker.toUpperCase() === "CAIXA") ?? null;

  const [state, setState] = useState<InvestmentWizardState>(() =>
    buildInitialWizardState({ initialAsset, initialMode, initialQuantity, initialTotalCents }),
  );

  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({
    moduleKey: "investments",
    defaultContext: "Cadastrar Operação de Investimento",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = state.ticker !== "" || state.quantityStr !== "" || state.priceCents > 0 || state.totalCents > 0;
  const steps = getWizardSteps(state.mode);
  const isLastStep = (state.mode === "new_asset" && state.step === 4) || (state.mode !== "new_asset" && state.mode !== "select" && state.step === 3);
  const isPending = createAsset.isPending || createTransaction.isPending || createContribution.isPending || recordOrder.isPending || emergencyFund.isUpdating;

  const handleClose = () => {
    setState(defaultWizardState);
    setError(null);
    setConfirmClose(false);
    onClose?.();
    onOpenChange?.(false);
  };

  const requestClose = () => (isDirty ? setConfirmClose(true) : handleClose());

  const handleNext = () => {
    if (!canProceed(state)) return;
    setError(null);
    if (state.mode === "select") {
      setState((prev) => ({ ...prev, mode: prev.selectedAsset ? "buy" : "new_asset", step: 2 }));
      return;
    }
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const handleBack = () => {
    setError(null);
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
    if (isReadOnlyMode) {
      guardAction(() => {}, "Confirmar Operação de Investimento");
      return;
    }
    if (isPending || isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await executeWizardSubmit(state, {
        cashAsset,
        usdRate,
        isFamilyModeEnabled,
        familyId: myFamilyData?.family?.id ?? null,
        recordOrder: recordOrder.mutateAsync,
        createAsset: createAsset.mutateAsync,
        createTransaction: createTransaction.mutateAsync,
        createContribution: createContribution.mutateAsync,
        setManualPrice: setManualPrice.mutateAsync,
        emergencyFund: {
          config: emergencyFund.config,
          portfolioRows: emergencyFund.portfolioRows,
          breakdownAssetIds: emergencyFund.composition.breakdown.filter((b) => b.type === "asset").map((b) => b.id),
          updateConfig: emergencyFund.updateConfig,
        },
      });
      if (queryClient) await invalidatePortfolioSuite(queryClient, { invalidateAccounts: true });
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSelectResult = (res: TickerSearchResult, forceNewAssetStep1 = false) => {
    triggerSensory("selection");
    setState((prev) => buildStateFromSearchResult(prev, res, existingAssets, forceNewAssetStep1));
  };

  const handleSelectSuggestion = (item: AporteSuggestionItem) => {
    triggerSensory("selection");
    setState((prev) => buildStateFromSuggestion(prev, item, existingAssets, position.rows, cashAsset));
  };

  return {
    state, setState, existingAssets, position, classTargets, rawSectorTargets, sectorTargets,
    cashAsset, usdRate, error, confirmClose, setConfirmClose, isPending, isSubmitting, steps,
    isLastStep, upgradeModal, handleClose, requestClose, handleNext, handleBack, handleSubmit,
    handleSelectResult, handleSelectSuggestion,
  };
}
