import { calculateWeightedAveragePrice } from "@/domain/portfolio/summary";
import { cleanTicker } from "@/domain/portfolio/tickers-catalog";
import { todayISO } from "@/domain/debts";
import type { AssetCurrency, PortfolioAsset } from "@/types";

export type WizardMode = "select" | "new_asset" | "existing_aporte";

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

  // Valores da Ordem / Posição
  quantityStr: string;
  priceCents: number;
  totalCents: number;
  date: string;

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
  if (mode === "existing_aporte") {
    return [
      { title: "Ativo", subtitle: "Seleção" },
      { title: "Aporte", subtitle: "Quantidade & Preço" },
      { title: "Revisão", subtitle: "Confirmação" },
    ];
  }

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

  if (state.mode === "select") {
    return cleanTicker(state.ticker).length > 0;
  }

  if (state.mode === "existing_aporte") {
    // Passo 1 (Seleção): precisa ter ativo selecionado
    if (state.step === 1) {
      return state.selectedAsset !== null || cleanTicker(state.ticker).length > 0;
    }
    // Passo 2 (Ordem de Aporte): quantidade e preço (ou total para caixa) > 0
    if (state.step === 2) {
      if (state.isCash) {
        return total > 0 || parsedQty > 0;
      }
      return parsedQty > 0 && (price > 0 || total > 0);
    }
    // Passo 3 (Revisão): pode concluir
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
      if (state.isCash) {
        return total > 0 || parsedQty > 0;
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
  contributionBRL: number;
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
    contributionBRL: Math.round(contributionBRL * 100) / 100,
  };
}
