import { parseDecimalNumber } from "@/domain/money";
import {
  classifyAssetValuation,
  computeDividendTotalFromMode,
  getFixedIncomeRedemptionInfo,
  resolveEffectiveSplitFactor,
  type OrderWizardMode,
} from "@/domain/portfolio";
import { cleanTicker } from "@/domain/portfolio/tickers-catalog";
import type { InvestmentWizardState } from "./wizard-state";

export function getWizardModeBadge(mode: OrderWizardMode) {
  switch (mode) {
    case "buy":
    case "existing_aporte":
      return { label: "Compra / Aporte", variant: "default" as const };
    case "sell":
      return { label: "Venda / Resgate", variant: "negative" as const };
    case "dividend":
      return { label: "Provento", variant: "positive" as const };
    case "split":
      return { label: "Split / Desdobro", variant: "warning" as const };
    case "reverse_split":
      return { label: "Grupamento", variant: "warning" as const };
    case "new_asset":
      return { label: "Novo Ativo", variant: "default" as const };
    default:
      return { label: "Operação", variant: "muted" as const };
  }
}

export function getWizardSteps(mode: OrderWizardMode): readonly { title: string; subtitle: string }[] {
  if (mode === "sell") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Venda", subtitle: "Quantidade & Preço" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }
  if (mode === "dividend") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Provento", subtitle: "Valor & Data" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }
  if (mode === "split") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Desdobro", subtitle: "Proporção & Data" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }
  if (mode === "reverse_split") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Grupamento", subtitle: "Proporção & Data" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }
  if (mode === "buy" || mode === "existing_aporte") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Aporte", subtitle: "Quantidade & Preço" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }
  return [
    { title: "Identificação", subtitle: "Código & Classe" },
    { title: "Posição", subtitle: "Cotas & Custo" },
    { title: "Governança", subtitle: "Nota & Status" },
    { title: "Revisão", subtitle: "Confirmação" },
  ];
}

export function canProceed(state: InvestmentWizardState): boolean {
  const parsedQty = parseDecimalNumber(state.quantityStr);
  const price = state.priceCents / 100;
  const total = state.totalCents / 100;
  const { isCash, isTotalValue } = classifyAssetValuation(state);

  if (state.mode === "select") {
    return cleanTicker(state.ticker).length > 0 || state.selectedAsset !== null;
  }

  if (state.mode === "buy" || state.mode === "existing_aporte") {
    if (state.step === 1) return state.selectedAsset !== null || cleanTicker(state.ticker).length > 0;
    if (state.step === 2) {
      return isCash || isTotalValue ? total > 0 || price > 0 || parsedQty > 0 : parsedQty > 0 && (price > 0 || total > 0);
    }
    return true;
  }

  if (state.mode === "sell") {
    if (state.step === 1) return state.selectedAsset !== null;
    if (state.step === 2) {
      if (isTotalValue) {
        const { grossValue, appliedCost } = getFixedIncomeRedemptionInfo(state.selectedAsset, state.date);
        const sellAmount = total > 0 ? total : price;
        const maxLimit = Math.max(grossValue, appliedCost);
        return sellAmount > 0 && (maxLimit === 0 || sellAmount <= maxLimit * 1.005);
      }
      return parsedQty > 0 && parsedQty <= (state.selectedAsset?.quantity ?? 0) && price > 0;
    }
    return true;
  }

  if (state.mode === "dividend") {
    if (state.step === 1) return state.selectedAsset !== null;
    if (state.step === 2) {
      const effectiveDiv = computeDividendTotalFromMode({
        calcMode: state.dividendCalcMode ?? "total",
        totalCents: state.totalCents,
        perShareCents: state.perShareCents ?? 0,
        custodyQty: state.selectedAsset?.quantity ?? 0,
        isTotalValue,
      });
      return effectiveDiv > 0;
    }
    return true;
  }

  if (state.mode === "split" || state.mode === "reverse_split") {
    if (state.step === 1) return state.selectedAsset !== null;
    if (state.step === 2) {
      const factor = resolveEffectiveSplitFactor({
        mode: state.mode,
        splitFactor: state.splitFactor,
        reverseSplitFactor: state.reverseSplitFactor,
        splitFromStr: state.splitFromStr,
        splitToStr: state.splitToStr,
      });
      return Number.isFinite(factor) && factor > 1;
    }
    return true;
  }

  if (state.mode === "new_asset") {
    if (state.step === 1) return cleanTicker(state.ticker).length >= 1 && state.assetClass.trim().length > 0;
    if (state.step === 2) {
      if (isCash) return total > 0 || parsedQty > 0;
      if (isTotalValue) return state.priceCents > 0 || state.totalCents > 0;
      return parsedQty > 0 && price > 0;
    }
    if (state.step === 3) {
      return state.isCash || state.score === null || (state.score >= 0 && state.score <= 10);
    }
    return true;
  }
  return false;
}
