import { parseDecimalNumber } from "@/domain/money";
import {
  calculateWizardOrderPreview,
  computeDividendTotalFromMode,
  getFixedIncomeRedemptionInfo,
  resolveEffectiveSplitFactor,
  type DividendCalculationMode,
  type InvestmentPreviewResult,
  type OrderWizardMode,
} from "@/domain/portfolio";
import type { DividendEntryMode } from "@/domain/portfolio/dividends";
import { FALLBACK_USD_RATE } from "@/domain/portfolio/valuation";
import { todayISO } from "@/domain/debts";
import { currentMonth } from "@/lib/date";
import type {
  AssetAllocationStatus,
  AssetCurrency,
  FixedIncomeRateType,
  PortfolioAsset,
} from "@/types";
import { canProceed, getWizardSteps } from "./wizard-step-rules";

export type ScoreCriteriaBreakdown = Record<string, number>;
export type WizardMode = OrderWizardMode;
export type { InvestmentPreviewResult };

export {
  canProceed,
  computeDividendTotalFromMode,
  getFixedIncomeRedemptionInfo,
  getWizardSteps,
  resolveEffectiveSplitFactor,
};

export interface InvestmentWizardState {
  mode: WizardMode;
  step: number;
  searchQuery: string;
  selectedAsset: PortfolioAsset | null;

  ticker: string;
  name: string;
  assetClass: string;
  sector: string;
  currency: AssetCurrency;
  isCash: boolean;

  fixedIncomeRateType: FixedIncomeRateType;
  fixedIncomeRateValue: number | string;
  fixedIncomeBaseDate: string;
  fixedIncomeInitialInvestmentDate: string;
  fixedIncomeMaturityDate: string;
  fixedIncomeIsTaxExempt: boolean;
  fixedIncomeManualTaxRatePct?: number | null;

  quantityStr: string;
  priceCents: number;
  totalCents: number;
  date: string;
  month: string;
  dividendEntryMode: DividendEntryMode;
  dividendCalcMode?: DividendCalculationMode;
  perShareCents?: number;
  splitFactor: number;
  reverseSplitFactor: number;
  splitFromStr?: string;
  splitToStr?: string;

  accumulatedDividendsCents: number;
  estimatedDividendPerShareCents: number;
  appliedCostCents: number;
  customTaxRatePct?: number | null;
  customTaxAmountCents?: number | null;

  score: number | null;
  allocationStatus: AssetAllocationStatus;
  scoreCriteria: ScoreCriteriaBreakdown;
  thesisSummary: string;
  reviewFrequencyMonths: number | null;
  isEmergencyFund: boolean;
  syncCash: boolean;
  recordContribution: boolean;
  isFamily: boolean;
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
  sector: "",
  currency: "BRL",
  isCash: false,

  fixedIncomeRateType: "cdi",
  fixedIncomeRateValue: "",
  fixedIncomeBaseDate: todayISO(),
  fixedIncomeInitialInvestmentDate: "",
  fixedIncomeMaturityDate: "",
  fixedIncomeIsTaxExempt: false,

  quantityStr: "",
  priceCents: 0,
  totalCents: 0,
  appliedCostCents: 0,
  customTaxRatePct: null,
  customTaxAmountCents: null,
  date: todayISO(),
  month: currentMonth(),
  dividendEntryMode: "daily",
  dividendCalcMode: "total",
  perShareCents: 0,
  splitFactor: 2,
  reverseSplitFactor: 2,
  splitFromStr: "",
  splitToStr: "",

  accumulatedDividendsCents: 0,
  estimatedDividendPerShareCents: 0,

  score: null,
  allocationStatus: "active",
  scoreCriteria: {},
  thesisSummary: "",
  reviewFrequencyMonths: 6,
  isEmergencyFund: false,
  syncCash: false,
  recordContribution: true,
  isFamily: false,
  notes: "",
};

export const parseNumber = parseDecimalNumber;

export function calculateInvestmentPreview(
  state: InvestmentWizardState,
  cashAvailableBRL = 0,
  usdRate = FALLBACK_USD_RATE,
): InvestmentPreviewResult {
  return calculateWizardOrderPreview(state, cashAvailableBRL, usdRate);
}
