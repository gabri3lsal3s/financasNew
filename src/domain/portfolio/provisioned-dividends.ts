/**
 * Motor Puro de Agregação e Isolamento Contábil de Proventos Provisionados.
 *
 * REGRAS INVIOLÁVEIS:
 *  - Agrega apenas eventos em estado não efetivado (`PROVISIONED` e `PENDING_CONFIRMATION`);
 *  - Trabalha em centavos inteiros;
 *  - Converte USD -> BRL utilizando estritamente a taxa oficial de câmbio (`fxMetadata.rate`);
 *  - NUNCA soma proventos provisionados ou a confirmar ao Patrimônio no Fechamento
 *    nem ao saldo de Caixa (`CAIXA`), atuando somente em linhas auxiliares informativas.
 */

import { numberToCents } from "@/domain/money/parse";
import type { UserDividendEvent } from "@/types";
import { todaySaoPauloISO, type SuggestedDividendItem } from "./dividend-suggester";
import { FALLBACK_USD_RATE } from "./valuation";

export interface ProvisionedDividendSummaryInputItem {
  status: "PROVISIONED" | "PENDING_CONFIRMATION" | "SETTLED" | "DISMISSED" | "available" | "projected";
  netAmount: number;
  currency: "BRL" | "USD";
  isTypeUncertain?: boolean;
  paymentDate?: string | null;
  isOver120DaysWithoutPayment?: boolean;
}

export interface ProvisionedDividendsSummary {
  /** Total em centavos (BRL equivalente) exclusivamente de eventos futuros/sem data dentro do prazo (`PROVISIONED`). */
  totalProvisionedBRLCents: number;
  /** Total em centavos (BRL equivalente) exclusivamente de eventos vencidos aguardando confirmação (`PENDING_CONFIRMATION`, excluindo >120d sem data). */
  totalPendingBRLCents: number;
  /** Soma total a receber (PROVISIONED + PENDING_CONFIRMATION, excluindo >120d sem data) convertida em centavos de BRL. */
  totalReceivableBRLCents: number;
  /** Parcela nativa em centavos de USD dentre os proventos elegíveis a receber. */
  totalReceivableUSDCents: number;
  /** Parcela nativa em centavos de BRL dentre os proventos elegíveis a receber. */
  totalReceivableNativeBRLCents: number;
  provisionedCount: number;
  datelessProvisionedCount?: number;
  pendingCount: number;
  over120DaysWithoutPaymentCount?: number;
  totalCount: number;
  monthlyForecastCount?: number;
  monthlyForecastBRLCents?: number;
  monthlyForecastNativeBRLCents?: number;
  monthlyForecastUSDCents?: number;
  hasUncertainTax: boolean;
  fxRateUsed: number;
}

export function userDividendEventToSummaryItem(
  ev: Pick<UserDividendEvent, "status" | "net_amount" | "currency" | "is_type_uncertain"> & {
    payment_date?: string | null;
  },
): ProvisionedDividendSummaryInputItem {
  return {
    status: ev.status,
    netAmount: ev.net_amount,
    currency: ev.currency,
    isTypeUncertain: ev.is_type_uncertain,
    paymentDate: ev.payment_date ?? null,
  };
}

export function suggestedDividendToSummaryItem(
  item: Pick<SuggestedDividendItem, "status" | "totalAmount" | "currency" | "isTypeUncertain"> & {
    paymentDate?: string | null;
    isOver120DaysWithoutPayment?: boolean;
  },
): ProvisionedDividendSummaryInputItem {
  return {
    status: item.status === "available" ? "PENDING_CONFIRMATION" : "PROVISIONED",
    netAmount: item.totalAmount,
    currency: item.currency,
    isTypeUncertain: item.isTypeUncertain,
    paymentDate: item.paymentDate ?? null,
    isOver120DaysWithoutPayment: Boolean(item.isOver120DaysWithoutPayment),
  };
}

/**
 * Filtra eventos abertos com data de pagamento conhecida na competência M,
 * considerando estritamente de hoje em diante (`paymentDate >= today`).
 * Pagamentos vencidos (< today) vão para a fila de conferência, nunca para previsão futura (§5).
 */
export function filterMonthlyForecastDividends<
  T extends { status?: string; paymentDate?: string | null },
>(items: readonly T[], month: string, today: string = todaySaoPauloISO()): T[] {
  const cleanMonth = month.slice(0, 7);
  const cleanToday = today.slice(0, 10);
  if (!/^\d{4}-\d{2}$/.test(cleanMonth)) return [];
  return items.filter((item) => {
    if (item.status === "SETTLED" || item.status === "DISMISSED") return false;
    if (typeof item.paymentDate !== "string") return false;
    const cleanPay = item.paymentDate.slice(0, 10);
    return cleanPay.startsWith(cleanMonth) && cleanPay >= cleanToday;
  });
}

export function computeMonthlyForecastSummary(
  items: readonly ProvisionedDividendSummaryInputItem[],
  month: string,
  today: string = todaySaoPauloISO(),
  usdRate: number = FALLBACK_USD_RATE,
): {
  month: string;
  count: number;
  totalBRLCents: number;
  nativeBRLCents: number;
  usdCents: number;
} {
  const effectiveFx = usdRate > 0 && Number.isFinite(usdRate) ? usdRate : FALLBACK_USD_RATE;
  const matching = filterMonthlyForecastDividends(items, month, today);
  let nativeBRLCents = 0;
  let usdCents = 0;
  let convertedBRLCents = 0;
  let count = 0;

  for (const item of matching) {
    const cents = numberToCents(item.netAmount);
    if (cents <= 0) continue;
    count += 1;
    if (item.currency === "USD") {
      usdCents += cents;
      convertedBRLCents += Math.round(cents * effectiveFx);
    } else {
      nativeBRLCents += cents;
    }
  }

  return {
    month: month.slice(0, 7),
    count,
    totalBRLCents: nativeBRLCents + convertedBRLCents,
    nativeBRLCents,
    usdCents,
  };
}

/**
 * Consolida os valores líquidos a receber em centavos inteiros sem contaminar
 * o Patrimônio no Fechamento ou o Caixa.
 */
export function summarizeProvisionedDividends(
  items: readonly ProvisionedDividendSummaryInputItem[],
  usdRate: number = FALLBACK_USD_RATE,
  options?: { referenceDate?: string; forecastMonth?: string },
): ProvisionedDividendsSummary {
  const effectiveFx = usdRate > 0 && Number.isFinite(usdRate) ? usdRate : FALLBACK_USD_RATE;
  const referenceDate = (options?.referenceDate ?? todaySaoPauloISO()).slice(0, 10);
  const forecastMonth = (options?.forecastMonth ?? referenceDate.slice(0, 7)).slice(0, 7);

  let provisionedNativeBRLCents = 0;
  let provisionedUSDCents = 0;
  let provisionedConvertedBRLCents = 0;
  let pendingNativeBRLCents = 0;
  let pendingUSDCents = 0;
  let pendingConvertedBRLCents = 0;
  let provisionedCount = 0;
  let datelessProvisionedCount = 0;
  let pendingCount = 0;
  let over120DaysWithoutPaymentCount = 0;
  let hasUncertainTax = false;

  for (const item of items) {
    if (item.status === "SETTLED" || item.status === "DISMISSED") continue;
    const cents = numberToCents(item.netAmount);
    if (cents <= 0) continue;

    const isPendingConfirm =
      item.status === "PENDING_CONFIRMATION" || item.status === "available";
    const isOver120 = Boolean(item.isOver120DaysWithoutPayment && !item.paymentDate);
    if (item.isTypeUncertain) {
      hasUncertainTax = true;
    }

    if (isPendingConfirm) {
      // Contagem operacional inclui antigas (>120d sem data), mas projeção monetária as exclui (§5)
      pendingCount += 1;
      if (isOver120) {
        over120DaysWithoutPaymentCount += 1;
        continue;
      }
      if (item.currency === "USD") {
        pendingUSDCents += cents;
        pendingConvertedBRLCents += Math.round(cents * effectiveFx);
      } else {
        pendingNativeBRLCents += cents;
      }
    } else {
      provisionedCount += 1;
      if (!item.paymentDate) {
        datelessProvisionedCount += 1;
      }
      if (isOver120) {
        over120DaysWithoutPaymentCount += 1;
        continue;
      }
      if (item.currency === "USD") {
        provisionedUSDCents += cents;
        provisionedConvertedBRLCents += Math.round(cents * effectiveFx);
      } else {
        provisionedNativeBRLCents += cents;
      }
    }
  }

  const monthlyForecast = computeMonthlyForecastSummary(
    items,
    forecastMonth,
    referenceDate,
    effectiveFx,
  );

  const totalProvisionedBRLCents = provisionedNativeBRLCents + provisionedConvertedBRLCents;
  const totalPendingBRLCents = pendingNativeBRLCents + pendingConvertedBRLCents;
  const totalReceivableNativeBRLCents = provisionedNativeBRLCents + pendingNativeBRLCents;
  const totalReceivableUSDCents = provisionedUSDCents + pendingUSDCents;
  const totalReceivableBRLCents = totalProvisionedBRLCents + totalPendingBRLCents;

  return {
    totalProvisionedBRLCents,
    totalPendingBRLCents,
    totalReceivableBRLCents,
    totalReceivableUSDCents,
    totalReceivableNativeBRLCents,
    provisionedCount,
    datelessProvisionedCount,
    pendingCount,
    over120DaysWithoutPaymentCount,
    totalCount: provisionedCount + pendingCount,
    monthlyForecastCount: monthlyForecast.count,
    monthlyForecastBRLCents: monthlyForecast.totalBRLCents,
    monthlyForecastNativeBRLCents: monthlyForecast.nativeBRLCents,
    monthlyForecastUSDCents: monthlyForecast.usdCents,
    hasUncertainTax,
    fxRateUsed: effectiveFx,
  };
}

/**
 * Calcula o valor auxiliar "Total Projetado c/ Provisionados" mantendo o
 * Patrimônio no Fechamento estritamente inalterado (isolamento contábil).
 */
export function computeProjectedPatrimonyWithProvisioned(
  closingPatrimonyCents: number,
  summary: Pick<ProvisionedDividendsSummary, "totalReceivableBRLCents"> | null | undefined,
): {
  closingPatrimonyCents: number;
  receivableBRLCents: number;
  projectedPatrimonyCents: number;
} {
  const safeClosing = Math.round(Number(closingPatrimonyCents) || 0);
  const receivableBRLCents = Math.max(0, Math.round(summary?.totalReceivableBRLCents ?? 0));
  return {
    closingPatrimonyCents: safeClosing,
    receivableBRLCents,
    projectedPatrimonyCents: safeClosing + receivableBRLCents,
  };
}
