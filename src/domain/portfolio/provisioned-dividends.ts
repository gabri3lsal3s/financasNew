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

import type { UserDividendEvent } from "@/types";
import type { SuggestedDividendItem } from "./dividend-suggester";
import { FALLBACK_USD_RATE } from "./valuation";

export interface ProvisionedDividendSummaryInputItem {
  status: "PROVISIONED" | "PENDING_CONFIRMATION" | "SETTLED" | "DISMISSED" | "available" | "projected";
  netAmount: number;
  currency: "BRL" | "USD";
  isTypeUncertain?: boolean;
}

export interface ProvisionedDividendsSummary {
  /** Total em centavos (BRL equivalente) exclusivamente de eventos futuros/sem data (`PROVISIONED`). */
  totalProvisionedBRLCents: number;
  /** Total em centavos (BRL equivalente) exclusivamente de eventos vencidos aguardando confirmação (`PENDING_CONFIRMATION`). */
  totalPendingBRLCents: number;
  /** Soma total a receber (PROVISIONED + PENDING_CONFIRMATION) convertida em centavos de BRL. */
  totalReceivableBRLCents: number;
  /** Parcela nativa em centavos de USD dentre os proventos ainda não liquidados. */
  totalReceivableUSDCents: number;
  /** Parcela nativa em centavos de BRL dentre os proventos ainda não liquidados. */
  totalReceivableNativeBRLCents: number;
  provisionedCount: number;
  pendingCount: number;
  totalCount: number;
  hasUncertainTax: boolean;
  fxRateUsed: number;
}

export function userDividendEventToSummaryItem(
  ev: Pick<UserDividendEvent, "status" | "net_amount" | "currency" | "is_type_uncertain">,
): ProvisionedDividendSummaryInputItem {
  return {
    status: ev.status,
    netAmount: ev.net_amount,
    currency: ev.currency,
    isTypeUncertain: ev.is_type_uncertain,
  };
}

export function suggestedDividendToSummaryItem(
  item: Pick<SuggestedDividendItem, "status" | "totalAmount" | "currency" | "isTypeUncertain">,
): ProvisionedDividendSummaryInputItem {
  return {
    status: item.status === "available" ? "PENDING_CONFIRMATION" : "PROVISIONED",
    netAmount: item.totalAmount,
    currency: item.currency,
    isTypeUncertain: item.isTypeUncertain,
  };
}

/**
 * Consolida os valores líquidos a receber em centavos inteiros sem contaminar
 * o Patrimônio no Fechamento ou o Caixa.
 */
export function summarizeProvisionedDividends(
  items: readonly ProvisionedDividendSummaryInputItem[],
  usdRate: number = FALLBACK_USD_RATE,
): ProvisionedDividendsSummary {
  const effectiveFx = usdRate > 0 && Number.isFinite(usdRate) ? usdRate : FALLBACK_USD_RATE;

  let provisionedNativeBRLCents = 0;
  let provisionedUSDCents = 0;
  let pendingNativeBRLCents = 0;
  let pendingUSDCents = 0;
  let provisionedCount = 0;
  let pendingCount = 0;
  let hasUncertainTax = false;

  for (const item of items) {
    if (item.status === "SETTLED" || item.status === "DISMISSED") continue;
    const cents = Math.round((Number(item.netAmount) || 0) * 100);
    if (cents <= 0) continue;

    const isPendingConfirm =
      item.status === "PENDING_CONFIRMATION" || item.status === "available";
    if (item.isTypeUncertain) {
      hasUncertainTax = true;
    }

    if (isPendingConfirm) {
      pendingCount += 1;
      if (item.currency === "USD") {
        pendingUSDCents += cents;
      } else {
        pendingNativeBRLCents += cents;
      }
    } else {
      provisionedCount += 1;
      if (item.currency === "USD") {
        provisionedUSDCents += cents;
      } else {
        provisionedNativeBRLCents += cents;
      }
    }
  }

  const totalProvisionedBRLCents =
    provisionedNativeBRLCents + Math.round(provisionedUSDCents * effectiveFx);
  const totalPendingBRLCents =
    pendingNativeBRLCents + Math.round(pendingUSDCents * effectiveFx);
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
    pendingCount,
    totalCount: provisionedCount + pendingCount,
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
