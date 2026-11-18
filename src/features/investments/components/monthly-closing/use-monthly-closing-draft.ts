import { useMemo, useState } from "react";
import { FALLBACK_USD_RATE, type PointInTimeResult } from "@/domain/portfolio";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { useSaveMonthlyClosing } from "@/state/mutations/use-portfolio-monthly-mutations";
import type { MonthlyPriceInput, MonthlyPriceSource } from "@/types";

export interface EditableClosingItemState {
  ticker: string;
  assetClass: string;
  currency: "BRL" | "USD";
  quantity: number;
  rawQuantity: string;
  priceCents: number;
  source: MonthlyPriceSource;
  isCandidate: boolean;
  currentPrice: number;
  fxRate: number;
}

export interface ComputedClosingItem extends EditableClosingItemState {
  editedPrice: number;
  editedValueBRL: number;
  diffPct: number | null;
}

export interface ClosingRecalculatedSummary {
  items: ComputedClosingItem[];
  totalInvestedBRL: number;
  cashBRL: number;
  totalValueBRL: number;
  totalCostBRL: number;
  gainBRL: number;
  gainPct: number;
  snapshotTargetValue: number | null;
  discrepancyBRL: number | null;
}

function buildInitialItemsState(
  historicalPosition: PointInTimeResult,
): Record<string, EditableClosingItemState> {
  const initial: Record<string, EditableClosingItemState> = {};

  for (const pos of historicalPosition.positions) {
    const isUsd = pos.currency === "USD";
    const fxRate = isUsd && pos.priceQuote > 0 ? pos.priceBRL / pos.priceQuote : 1;

    initial[pos.ticker] = {
      ticker: pos.ticker,
      assetClass: pos.assetClass ?? "Outros",
      currency: (pos.currency as "BRL" | "USD") ?? "BRL",
      quantity: pos.quantity,
      rawQuantity: String(pos.quantity),
      priceCents: Math.round((pos.priceQuote ?? pos.priceBRL) * 100),
      source: (pos.quoteSource as MonthlyPriceSource) ?? (pos.isEstimate ? "fallback" : "api"),
      isCandidate: false,
      currentPrice: pos.priceQuote ?? pos.priceBRL,
      fxRate,
    };
  }

  const isBalanceOnly =
    historicalPosition.fidelity?.status === "balance_only" ||
    historicalPosition.positions.length === 0;

  if (isBalanceOnly && historicalPosition.candidateAssets) {
    for (const cand of historicalPosition.candidateAssets) {
      if (!initial[cand.ticker]) {
        initial[cand.ticker] = {
          ticker: cand.ticker,
          assetClass: cand.assetClass,
          currency: cand.currency,
          quantity: cand.suggestedQuantity,
          rawQuantity: String(cand.suggestedQuantity),
          priceCents: Math.round(cand.referencePrice * 100),
          source: "fallback",
          isCandidate: true,
          currentPrice: cand.referencePrice,
          fxRate: cand.currency === "USD" ? FALLBACK_USD_RATE : 1,
        };
      }
    }
  }

  return initial;
}

export function useMonthlyClosingDraft(params: {
  month: string;
  historicalPosition: PointInTimeResult;
  onSaved?: () => void;
}) {
  const { month, historicalPosition, onSaved } = params;
  const saveClosingMutation = useSaveMonthlyClosing();

  const [itemsState, setItemsState] = useState<Record<string, EditableClosingItemState>>(() =>
    buildInitialItemsState(historicalPosition),
  );
  const [cashBalanceCents, setCashBalanceCents] = useState<number>(() =>
    Math.round(historicalPosition.cashQuantity * 100),
  );

  const handleReset = () => {
    setItemsState(buildInitialItemsState(historicalPosition));
    setCashBalanceCents(Math.round(historicalPosition.cashQuantity * 100));
  };

  const handlePriceChange = (ticker: string, cents: number) => {
    setItemsState((prev) => {
      const item = prev[ticker];
      if (!item) return prev;
      return {
        ...prev,
        [ticker]: { ...item, priceCents: Math.max(0, cents), source: "manual" },
      };
    });
  };

  const handleQuantityChange = (ticker: string, rawVal: string) => {
    const parsed = Number.parseFloat(rawVal.replace(",", "."));
    const qty = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setItemsState((prev) => {
      const item = prev[ticker];
      if (!item) return prev;
      return {
        ...prev,
        [ticker]: { ...item, rawQuantity: rawVal, quantity: qty },
      };
    });
  };

  const recalculatedSummary = useMemo<ClosingRecalculatedSummary>(() => {
    const itemsList: ComputedClosingItem[] = Object.values(itemsState).map((item) => {
      const unitPrice = item.priceCents / 100;
      const valueBRL = Math.round(item.quantity * unitPrice * item.fxRate * 100) / 100;
      const diffPct =
        unitPrice > 0 && item.currentPrice > 0
          ? ((item.currentPrice - unitPrice) / unitPrice) * 100
          : null;

      return { ...item, editedPrice: unitPrice, editedValueBRL: valueBRL, diffPct };
    });

    const totalInvestedBRL = itemsList.reduce((acc, it) => acc + it.editedValueBRL, 0);
    const cashBRL = cashBalanceCents / 100;
    const totalValueBRL = Math.round((totalInvestedBRL + cashBRL) * 100) / 100;
    const assetsCostBRL =
      historicalPosition.totalCostBRL > 0 ? historicalPosition.totalCostBRL : totalInvestedBRL;
    const totalCostBRL = Math.round((assetsCostBRL + cashBRL) * 100) / 100;
    const gainBRL = Math.round((totalValueBRL - totalCostBRL) * 100) / 100;
    const gainPct = totalCostBRL > 0 ? (gainBRL / totalCostBRL) * 100 : 0;

    const snapshotTargetValue = historicalPosition.fidelity?.snapshotTotalValue ?? null;
    const discrepancyBRL =
      snapshotTargetValue !== null
        ? Math.round((totalValueBRL - snapshotTargetValue) * 100) / 100
        : null;

    return {
      items: itemsList,
      totalInvestedBRL,
      cashBRL,
      totalValueBRL,
      totalCostBRL,
      gainBRL,
      gainPct,
      snapshotTargetValue,
      discrepancyBRL,
    };
  }, [itemsState, cashBalanceCents, historicalPosition]);

  const handleSave = async () => {
    const invalidItems = recalculatedSummary.items.filter(
      (item) => item.quantity > 0 && (item.editedPrice <= 0 || !Number.isFinite(item.editedPrice)),
    );
    if (invalidItems.length > 0) {
      const tickers = invalidItems.map((it) => it.ticker).join(", ");
      pushToast({
        title: "Cotação obrigatória ausente",
        description: `Os seguintes ativos sob custódia não possuem cotação válida informada: ${tickers}. Informe um valor maior que zero antes de fechar a competência.`,
        variant: "destructive",
      });
      triggerSensory("destructive");
      return;
    }

    const pricesPayload: MonthlyPriceInput[] = recalculatedSummary.items
      .filter((item) => item.editedPrice > 0)
      .map((item) => ({
        ticker: item.ticker,
        month,
        price: item.editedPrice,
        currency: item.currency ?? "BRL",
        source: item.source,
      }));

    await saveClosingMutation.mutateAsync({
      month,
      prices: pricesPayload,
      totalValueBRL: recalculatedSummary.totalValueBRL,
      totalCostBRL: recalculatedSummary.totalCostBRL,
      closingDate: historicalPosition.cutoffDate,
    });

    triggerSensory("success");
    onSaved?.();
  };

  return {
    cashBalanceCents,
    setCashBalanceCents,
    recalculatedSummary,
    isSaving: saveClosingMutation.isPending,
    handleReset,
    handlePriceChange,
    handleQuantityChange,
    handleSave,
  };
}
