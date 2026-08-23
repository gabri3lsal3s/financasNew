import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { sellAssetPosition } from "@/domain/portfolio/operations";
import {
  getAssetPricingMode,
  isFixedIncomeClass,
  isTesouroAsset,
} from "@/domain/portfolio/valuation";
import { cleanTicker } from "@/domain/portfolio/tickers-catalog";
import { todayISO } from "@/domain/debts";
import { currentMonth } from "@/lib/date";
import type { DividendEntryMode } from "@/domain/portfolio/dividends";
import type { AssetCurrency, PortfolioAsset } from "@/types";


export type WizardMode =
  | "select"
  | "new_asset"
  | "buy"
  | "sell"
  | "dividend"
  | "split"
  | "existing_aporte"; // alias para buy

export interface InvestmentWizardState {
  mode: WizardMode;
  step: number; // 1 | 2 | 3 | 4
  searchQuery: string;
  selectedAsset: PortfolioAsset | null;

  // Metadados do Ativo (Novo ou Existente)
  ticker: string;
  name: string;
  assetClass: string;
  currency: AssetCurrency;
  isCash: boolean;
  pricingMode?: "total_value" | "unit_price";

  // Valores da Ordem / Posição
  quantityStr: string;
  priceCents: number;
  totalCents: number;
  date: string;
  month: string;
  dividendEntryMode: DividendEntryMode;
  splitFactor: number;

  // Proventos Históricos (anteriores ao extrato periódico)
  /** Total de proventos acumulados em centavos. Alimenta YoC sem distorcer calendário/extrato. */
  accumulatedDividendsCents: number;
  /** Dividendo mensal estimado por cota em centavos. Alimenta Bola de Neve (Cenário B). */
  estimatedDividendPerShareCents: number;

  // Metas e Opções
  targetPercentage: number | null;
  syncCash: boolean;
  recordContribution: boolean;
  notes: string;
}

export const defaultWizardState: InvestmentWizardState = {
  mode: "select",
  step: 1,
  searchQuery: "",
  selectedAsset: null,

  ticker: "",
  name: "",
  assetClass: "Ações",
  currency: "BRL",
  isCash: false,

  quantityStr: "",
  priceCents: 0,
  totalCents: 0,
  date: todayISO(),
  month: currentMonth(),
  dividendEntryMode: "daily",
  splitFactor: 2,

  accumulatedDividendsCents: 0,
  estimatedDividendPerShareCents: 0,

  targetPercentage: null,
  syncCash: false,
  recordContribution: true,
  notes: "",
};



export const parseNumber = (raw: string): number => {
  if (!raw || typeof raw !== "string") return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // Trata formato brasileiro com separador de milhar: 1.234,56 -> 1234.56
  if (trimmed.includes(",") && trimmed.includes(".")) {
    const clean = trimmed.replace(/\./g, "").replace(",", ".");
    const val = Number(clean);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  }

  // Trata vírgula como decimal: 10,5 -> 10.5
  const clean = trimmed.replace(",", ".");
  const val = Number(clean);
  return Number.isFinite(val) && val >= 0 ? val : 0;
};

/**
 * Retorna os passos dinâmicos do Wizard conforme o modo de operação.
 */
export function getWizardSteps(mode: WizardMode): readonly { title: string; subtitle: string }[] {
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
      { title: "Desdobro", subtitle: "Fator & Data" },
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

  // Modo new_asset (4 passos)
  return [
    { title: "Identificação", subtitle: "Código & Classe" },
    { title: "Posição", subtitle: "Cotas & Custo" },
    { title: "Meta", subtitle: "Alocação %" },
    { title: "Revisão", subtitle: "Confirmação" },
  ];
}

/**
 * Validação pura de elegibilidade para avançar de passo.
 */
export function canProceed(state: InvestmentWizardState): boolean {
  const parsedQty = parseNumber(state.quantityStr);
  const price = state.priceCents / 100;
  const total = state.totalCents / 100;

  const isCash = state.isCash;
  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const pricingMode = getAssetPricingMode(
    state.selectedAsset ?? { ticker: state.ticker, asset_class: state.assetClass, notes: state.notes },
  );
  const isTotalValue =
    !isCash &&
    (pricingMode === "total_value" || (isFixedIncome && (!isTesouro || state.pricingMode === "total_value")));

  if (state.mode === "select") {
    return cleanTicker(state.ticker).length > 0 || state.selectedAsset !== null;
  }

  if (state.mode === "buy" || state.mode === "existing_aporte") {
    // Passo 1 (Seleção): precisa ter ativo selecionado
    if (state.step === 1) {
      return state.selectedAsset !== null || cleanTicker(state.ticker).length > 0;
    }
    // Passo 2 (Ordem de Aporte): quantidade e preço (ou total para caixa / valor completo) > 0
    if (state.step === 2) {
      if (isCash || isTotalValue) {
        return total > 0 || price > 0 || parsedQty > 0;
      }
      return parsedQty > 0 && (price > 0 || total > 0);
    }
    // Passo 3 (Revisão): pode concluir
    return true;
  }

  if (state.mode === "sell") {
    if (state.step === 1) {
      return state.selectedAsset !== null;
    }
    if (state.step === 2) {
      if (isTotalValue) {
        const balance = state.selectedAsset?.average_price ?? 0;
        const sellAmount = total > 0 ? total : price;
        return sellAmount > 0 && (balance === 0 || sellAmount <= balance);
      }
      const maxQty = state.selectedAsset?.quantity ?? 0;
      return parsedQty > 0 && parsedQty <= maxQty && price > 0;
    }
    return true;
  }

  if (state.mode === "dividend") {
    if (state.step === 1) {
      return state.selectedAsset !== null;
    }
    if (state.step === 2) {
      return total > 0;
    }
    return true;
  }

  if (state.mode === "split") {
    if (state.step === 1) {
      return state.selectedAsset !== null;
    }
    if (state.step === 2) {
      return state.splitFactor >= 2;
    }
    return true;
  }

  // Modo: new_asset
  if (state.mode === "new_asset") {
    // Passo 1: Identificação
    if (state.step === 1) {
      return cleanTicker(state.ticker).length >= 1 && state.assetClass.trim().length > 0;
    }
    // Passo 2: Posição Inicial
    if (state.step === 2) {
      if (isCash) {
        return total > 0 || parsedQty > 0;
      }
      if (isTotalValue) {
        return state.priceCents > 0 || state.totalCents > 0;
      }
      const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
      const isTotalValueCheck = !state.isCash && isFixedIncome && (!isTesouro || state.pricingMode === "total_value" || !state.pricingMode);

      if (isTotalValueCheck) {
        return state.priceCents > 0 || state.totalCents > 0;
      }
      return parsedQty > 0 && price > 0;
    }
    // Passo 3: Meta de Alocação (opcional, mas se informada deve ser 0-100)
    if (state.step === 3) {
      if (state.targetPercentage === null) return true;
      return state.targetPercentage >= 0 && state.targetPercentage <= 100;
    }
    // Passo 4: Revisão
    return true;
  }

  return false;
}

export interface InvestmentPreviewResult {
  currentQuantity: number;
  currentAveragePrice: number;
  newQuantity: number;
  newAveragePrice: number;
  totalOrderValueBRL: number;
  cashDebitBRL: number;
  cashCreditBRL?: number;
  contributionBRL: number;
  realizedPnl?: number;
  realizedPnlPct?: number;
}

/**
 * Calcula a prévia instantânea do impacto patrimonial e do novo preço médio ponderado.
 */
export function calculateInvestmentPreview(
  state: InvestmentWizardState,
  cashAvailableBRL = 0,
): InvestmentPreviewResult {
  const parsedQty = parseNumber(state.quantityStr);
  const inputPrice = state.priceCents / 100;
  const inputTotal = state.totalCents / 100;

  const currentQty = state.selectedAsset?.quantity ?? 0;
  const currentAvgPrice = state.selectedAsset?.average_price ?? 0;

  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const pricingMode = getAssetPricingMode(
    state.selectedAsset ?? { ticker: state.ticker, asset_class: state.assetClass, notes: state.notes },
  );
  const isTotalValue =
    !state.isCash &&
    (pricingMode === "total_value" || (isFixedIncome && (!isTesouro || state.pricingMode === "total_value")));

  // 1. Caixa
  if (state.isCash) {
    const amount = inputTotal > 0 ? inputTotal : parsedQty;
    return {
      currentQuantity: currentQty,
      currentAveragePrice: 1,
      newQuantity: currentQty + amount,
      newAveragePrice: 1,
      totalOrderValueBRL: amount,
      cashDebitBRL: 0,
      contributionBRL: amount,
    };
  }

  // 2. Renda Fixa / Modo Valor Completo (Aporte ou Venda/Resgate)
  if (isTotalValue) {
    const amount = inputTotal > 0 ? inputTotal : inputPrice;
    if (state.mode === "sell") {
      return {
        currentQuantity: 1,
        currentAveragePrice: currentAvgPrice,
        newQuantity: amount >= currentAvgPrice ? 0 : 1,
        newAveragePrice: Math.max(0, currentAvgPrice - amount),
        totalOrderValueBRL: amount,
        cashDebitBRL: 0,
        cashCreditBRL: state.syncCash ? amount : 0,
        contributionBRL: 0,
      };
    }

    let cashDebitBRL = 0;
    let contributionBRL = amount;
    if (state.syncCash && cashAvailableBRL > 0) {
      cashDebitBRL = Math.min(cashAvailableBRL, amount);
      contributionBRL = Math.max(0, amount - cashDebitBRL);
    }

    return {
      currentQuantity: 1,
      currentAveragePrice: currentAvgPrice,
      newQuantity: 1,
      newAveragePrice: currentAvgPrice + amount,
      totalOrderValueBRL: amount,
      cashDebitBRL,
      contributionBRL,
    };
  }

  // 3. Venda
  if (state.mode === "sell") {
    const sellRes = sellAssetPosition({
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      sellQuantity: parsedQty,
      sellPrice: inputPrice,
      assetClass: state.assetClass,
    });
    const orderTotal = parsedQty * inputPrice;

    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: sellRes.remainingQuantity,
      newAveragePrice: sellRes.remainingAveragePrice,
      totalOrderValueBRL: Math.round(orderTotal * 100) / 100,
      cashDebitBRL: 0,
      cashCreditBRL: state.syncCash ? Math.round(orderTotal * 100) / 100 : 0,
      contributionBRL: 0,
      realizedPnl: sellRes.realizedPnl,
      realizedPnlPct: sellRes.realizedPnlPct,
    };
  }

  // 4. Provento
  if (state.mode === "dividend") {
    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: currentQty,
      newAveragePrice: currentAvgPrice,
      totalOrderValueBRL: Math.round(inputTotal * 100) / 100,
      cashDebitBRL: 0,
      cashCreditBRL: state.syncCash ? Math.round(inputTotal * 100) / 100 : 0,
      contributionBRL: 0,
    };
  }

  // 5. Split
  if (state.mode === "split") {
    const newQty = currentQty * state.splitFactor;
    const newAvg = currentAvgPrice / state.splitFactor;
    return {
      currentQuantity: currentQty,
      currentAveragePrice: currentAvgPrice,
      newQuantity: newQty,
      newAveragePrice: newAvg,
      totalOrderValueBRL: 0,
      cashDebitBRL: 0,
      contributionBRL: 0,
    };
  }

  // 6. Compra / Novo Ativo
  const orderPrice = inputPrice > 0 ? inputPrice : parsedQty > 0 ? inputTotal / parsedQty : 0;
  const orderTotal = inputTotal > 0 ? inputTotal : parsedQty * orderPrice;

  const lot = calculateWeightedAveragePrice(
    currentQty,
    currentAvgPrice,
    parsedQty,
    orderPrice,
  );

  let cashDebitBRL = 0;
  let contributionBRL = orderTotal;

  if (state.syncCash && cashAvailableBRL > 0) {
    cashDebitBRL = Math.min(cashAvailableBRL, orderTotal);
    contributionBRL = Math.max(0, orderTotal - cashDebitBRL);
  }

  return {
    currentQuantity: currentQty,
    currentAveragePrice: currentAvgPrice,
    newQuantity: lot.newQuantity,
    newAveragePrice: lot.newAveragePrice,
    totalOrderValueBRL: Math.round(orderTotal * 100) / 100,
    cashDebitBRL: Math.round(cashDebitBRL * 100) / 100,
    cashCreditBRL: 0,
    contributionBRL: state.recordContribution ? Math.round(contributionBRL * 100) / 100 : 0,
  };
}
