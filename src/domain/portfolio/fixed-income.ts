/**
 * Motor Paramétrico de Rentabilidade de Renda Fixa & Inteligência Fiscal (Fase 63).
 *
 * Funções puras para:
 *   1. Capitalização determinística a partir do Marco Zero (D₀) por dias úteis da B3;
 *   2. Trava automática no vencimento (min(hoje, data_vencimento));
 *   3. Tabela regressiva de IR (Lei 11.033/2004: 22,5% -> 15%);
 *   4. Tabela de IOF para aplicações de curto prazo (< 30 dias);
 *   5. Otimizador de Resgate (Alerta de virada de alíquota e economia estimada).
 *
 * Módulo puro — sem import de UI ou Supabase.
 */

import type { FixedIncomeRateType } from "@/types";
import { countBusinessDays, countCalendarDays } from "./business-days";

/**
 * Tabela oficial de alíquotas regressivas de IOF (Decreto 6.306/2007).
 * Índice 1 a 29 representa o dia corrido do resgate. Dia 30 em diante é 0%.
 */
export const IOF_TABLE_PERCENT = [
  0,  // Dia 0
  96, // Dia 1
  93, // Dia 2
  90, // Dia 3
  86, // Dia 4
  83, // Dia 5
  80, // Dia 6
  76, // Dia 7
  73, // Dia 8
  70, // Dia 9
  66, // Dia 10
  63, // Dia 11
  60, // Dia 12
  56, // Dia 13
  53, // Dia 14
  50, // Dia 15
  46, // Dia 16
  43, // Dia 17
  40, // Dia 18
  36, // Dia 19
  33, // Dia 20
  30, // Dia 21
  26, // Dia 22
  23, // Dia 23
  20, // Dia 24
  16, // Dia 25
  13, // Dia 26
  10, // Dia 27
  6,  // Dia 28
  3,  // Dia 29
] as const;

/**
 * Retorna a alíquota de IOF para um determinado prazo em dias corridos.
 */
export function getIofRatePct(calendarDays: number): number {
  if (calendarDays <= 0) return 0;
  if (calendarDays >= 30) return 0;
  return IOF_TABLE_PERCENT[calendarDays] ?? 0;
}

/**
 * Retorna a alíquota regressiva de Imposto de Renda (Lei 11.033/2004) para renda fixa.
 *
 *   • Até 180 dias corridos: 22,5%
 *   • De 181 a 360 dias corridos: 20,0%
 *   • De 361 a 720 dias corridos: 17,5%
 *   • Acima de 720 dias corridos: 15,0%
 */
export function getFixedIncomeTaxRatePct(calendarDays: number, isTaxExempt = false): number {
  if (isTaxExempt) return 0;
  if (calendarDays <= 180) return 22.5;
  if (calendarDays <= 360) return 20.0;
  if (calendarDays <= 720) return 17.5;
  return 15.0;
}

export interface TaxReductionCountdown {
  currentRatePct: number;
  nextRatePct: number;
  daysRemaining: number;
  nextBracketDate: string;
  estimatedTaxSavingsBRL: number;
}

/**
 * Calcula a contagem regressiva para a próxima redução de alíquota de IR e a economia estimada.
 */
export function calculateTaxReductionCountdown(params: {
  initialInvestmentDate: string;
  todayDate: string;
  accumulatedProfitBRL: number;
  isTaxExempt?: boolean;
}): TaxReductionCountdown | null {
  const { initialInvestmentDate, todayDate, accumulatedProfitBRL, isTaxExempt } = params;
  if (isTaxExempt || accumulatedProfitBRL <= 0) return null;

  const daysPassed = countCalendarDays(initialInvestmentDate, todayDate);
  const currentRate = getFixedIncomeTaxRatePct(daysPassed, false);

  if (currentRate <= 15.0) {
    return null; // Já está na alíquota mínima definitiva
  }

  let targetThresholdDays = 181;
  let nextRate = 20.0;

  if (daysPassed <= 180) {
    targetThresholdDays = 181;
    nextRate = 20.0;
  } else if (daysPassed <= 360) {
    targetThresholdDays = 361;
    nextRate = 17.5;
  } else if (daysPassed <= 720) {
    targetThresholdDays = 721;
    nextRate = 15.0;
  }

  const daysRemaining = Math.max(1, targetThresholdDays - daysPassed);

  // Calcula a data da virada somando os dias restantes
  const parts = todayDate.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(parts[0] ?? 2026, (parts[1] ?? 1) - 1, (parts[2] ?? 1) + daysRemaining));
  const nextBracketDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const rateDifference = (currentRate - nextRate) / 100;
  const estimatedTaxSavingsBRL = Math.round(accumulatedProfitBRL * rateDifference * 100) / 100;

  return {
    currentRatePct: currentRate,
    nextRatePct: nextRate,
    daysRemaining,
    nextBracketDate,
    estimatedTaxSavingsBRL,
  };
}

/** Converte taxa anual (% a.a.) para taxa diária em base 252 dias úteis. */
export function annualRateToDaily(annualRatePct: number): number {
  if (annualRatePct <= 0) return 0;
  return Math.pow(1 + annualRatePct / 100, 1 / 252) - 1;
}

export interface FixedIncomeBalanceInput {
  baseValue: number;
  baseDate: string;
  initialInvestmentDate?: string | null;
  maturityDate?: string | null;
  rateType: FixedIncomeRateType;
  rateValue: number;
  isTaxExempt?: boolean;
  totalCost?: number;
  dailyCdiRate?: number;
  annualCdiRate?: number;
  today?: string;
}

export interface FixedIncomeBalanceResult {
  grossValue: number;
  netValue: number;
  totalAccruedInterest: number;
  totalProfit: number;
  taxAmount: number;
  taxRatePct: number;
  iofAmount: number;
  iofRatePct: number;
  businessDaysAccrued: number;
  calendarDaysTotal: number;
  isMatured: boolean;
  effectiveCutoffDate: string;
  taxCountdown: TaxReductionCountdown | null;
}

/** Taxa CDI padrão de fallback caso a API macroeconômica esteja indisponível (10.50% a.a.). */
export const DEFAULT_ANNUAL_CDI_RATE = 10.5;

/**
 * Calcula o saldo projetado, juros acumulados, tributação e trava de vencimento
 * para qualquer ativo de Renda Fixa parametrizado no Marco Zero (D₀).
 */
export function calculateFixedIncomeBalance(input: FixedIncomeBalanceInput): FixedIncomeBalanceResult {
  const {
    baseValue,
    baseDate,
    initialInvestmentDate,
    maturityDate,
    rateType,
    rateValue,
    isTaxExempt = false,
    totalCost,
    dailyCdiRate,
    annualCdiRate,
    today = new Date().toISOString().slice(0, 10),
  } = input;

  if (baseValue <= 0) {
    return {
      grossValue: 0,
      netValue: 0,
      totalAccruedInterest: 0,
      totalProfit: 0,
      taxAmount: 0,
      taxRatePct: isTaxExempt ? 0 : 22.5,
      iofAmount: 0,
      iofRatePct: 0,
      businessDaysAccrued: 0,
      calendarDaysTotal: 0,
      isMatured: false,
      effectiveCutoffDate: today,
      taxCountdown: null,
    };
  }

  // 1. Determinação da data de corte e trava de vencimento
  const cleanToday = today.slice(0, 10);
  const cleanBaseDate = baseDate.slice(0, 10);
  const cleanMaturity = maturityDate ? maturityDate.slice(0, 10) : null;

  const isMatured = Boolean(cleanMaturity && cleanToday >= cleanMaturity);
  const effectiveCutoffDate = cleanMaturity && cleanToday > cleanMaturity ? cleanMaturity : cleanToday;

  // 2. Contagem de dias úteis entre Marco Zero (baseDate) e a data efetiva de corte
  const businessDays = countBusinessDays(cleanBaseDate, effectiveCutoffDate);

  // 3. Fator diário de capitalização conforme indexador
  let grossValue = baseValue;

  if (businessDays > 0 && rateValue > 0) {
    let effectiveDailyRate = 0;

    switch (rateType) {
      case "cdi":
      case "selic": {
        const cdiDaily = dailyCdiRate ?? annualRateToDaily(annualCdiRate ?? DEFAULT_ANNUAL_CDI_RATE);
        effectiveDailyRate = cdiDaily * (rateValue / 100);
        break;
      }
      case "pre": {
        effectiveDailyRate = annualRateToDaily(rateValue);
        break;
      }
      case "ipca": {
        // Para IPCA+, rateValue é o spread pré (ex.: 6.5% a.a.)
        effectiveDailyRate = annualRateToDaily(rateValue);
        break;
      }
    }

    if (effectiveDailyRate > 0) {
      grossValue = baseValue * Math.pow(1 + effectiveDailyRate, businessDays);
    }
  }

  grossValue = Math.round(grossValue * 100) / 100;
  const totalAccruedInterest = Math.max(0, Math.round((grossValue - baseValue) * 100) / 100);

  // 4. Apuração contábil de lucro total para fins tributários
  const acquisitionCost = totalCost !== undefined && totalCost > 0 ? totalCost : baseValue;
  const totalProfit = Math.max(0, Math.round((grossValue - acquisitionCost) * 100) / 100);

  // 5. Contagem de dias corridos desde a aplicação original para tabela regressiva
  const origDate = initialInvestmentDate ? initialInvestmentDate.slice(0, 10) : cleanBaseDate;
  const calendarDays = countCalendarDays(origDate, effectiveCutoffDate);

  // 6. IOF (sobre o lucro, se prazo < 30 dias)
  const iofRatePct = getIofRatePct(calendarDays);
  const iofAmount = iofRatePct > 0 ? Math.round(totalProfit * (iofRatePct / 100) * 100) / 100 : 0;

  // 7. Imposto de Renda (incide sobre lucro líquido de IOF)
  const profitAfterIof = Math.max(0, totalProfit - iofAmount);
  const taxRatePct = getFixedIncomeTaxRatePct(calendarDays, isTaxExempt);
  const taxAmount = taxRatePct > 0 ? Math.round(profitAfterIof * (taxRatePct / 100) * 100) / 100 : 0;

  const netValue = Math.max(0, Math.round((grossValue - iofAmount - taxAmount) * 100) / 100);

  // 8. Otimizador de Resgate
  const taxCountdown = calculateTaxReductionCountdown({
    initialInvestmentDate: origDate,
    todayDate: effectiveCutoffDate,
    accumulatedProfitBRL: profitAfterIof,
    isTaxExempt,
  });

  return {
    grossValue,
    netValue,
    totalAccruedInterest,
    totalProfit,
    taxAmount,
    taxRatePct,
    iofAmount,
    iofRatePct,
    businessDaysAccrued: businessDays,
    calendarDaysTotal: calendarDays,
    isMatured,
    effectiveCutoffDate,
    taxCountdown,
  };
}
