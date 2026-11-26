/**
 * Conciliação Contábil por Custódia Geográfica: Brasil (BRL) vs. Exterior (USD) (Bloco B).
 *
 * Regras:
 *   • A jurisdição de custódia segue estritamente a moeda de liquidação/custódia (`currency`):
 *     - Ativos `currency === "USD"` → Custódia Exterior (subtotal em centavos US\$ + equivalente em R\$);
 *     - Todos os demais ativos (`BRL`, incluindo BDRs e ETFs internacionais listados na B3 como
 *       `IVVB11`, `WRLD11`, `NASD11`, além de Renda Fixa, FIIs e Reserva de Caixa) → Custódia Brasil (BRL).
 *   • Operações aritméticas em centavos inteiros garantindo estritamente:
 *     `custodyBrazilCents + custodyForeignBRLCents === closingPatrimonyCents`.
 */

import { numberToCents } from "@/domain/money/parse";
import type { CanonicalFxMetadata } from "./canonical-types";
import { formatFxSourceLabel } from "./stale-quote-guard";
import { FALLBACK_USD_RATE } from "./valuation";

export interface CustodyReconciliationRowLike {
  ticker: string;
  currency?: string | null;
  quantity: number;
  valueBRL: number;
  priceQuote?: number | null;
  currentPrice?: number | null;
  usdRate?: number | null;
  isCash?: boolean;
}

export interface CustodyReconciliationSummary {
  custodyBrazilCents: number;
  custodyBrazilAssetsCount: number;
  custodyBrazilPct: number;
  custodyForeignUSDCents: number;
  custodyForeignBRLCents: number;
  custodyForeignAssetsCount: number;
  custodyForeignPct: number;
  fxRateUsed: number;
  fxSourceLabel: string;
  closingPatrimonyCents: number;
  roundingAdjustmentCents: number;
  hasForeignCustody: boolean;
}

/**
 * Calcula o detalhamento de Custódia Brasil (BRL) vs. Exterior (USD) com paridade exata
 * em centavos inteiros em relação ao Patrimônio Total de Fechamento.
 */
export function calculateCustodyReconciliation(params: {
  rows: readonly CustodyReconciliationRowLike[];
  totalBRL?: number;
  cashBRL?: number;
  fxMetadata?: CanonicalFxMetadata | null;
  usdRate?: number;
}): CustodyReconciliationSummary {
  const fxRateUsed =
    params.fxMetadata?.rate && params.fxMetadata.rate > 0
      ? params.fxMetadata.rate
      : params.usdRate && params.usdRate > 0
        ? params.usdRate
        : params.rows.find((r) => (r.currency ?? "BRL").toUpperCase() === "USD" && r.usdRate && r.usdRate > 0)?.usdRate ??
          FALLBACK_USD_RATE;

  const fxSourceLabel = formatFxSourceLabel(
    params.fxMetadata ??
      (params.usdRate && params.usdRate > 0 && params.usdRate !== FALLBACK_USD_RATE
        ? {
            rate: params.usdRate,
            source: "api",
            provider: null,
            fxRateAt: null,
            fetchedAt: null,
            isFallback: false,
          }
        : null),
  );

  let rawBrazilBRLCents = 0;
  let custodyBrazilAssetsCount = 0;
  let rawForeignBRLCents = 0;
  let custodyForeignUSDCents = 0;
  let custodyForeignAssetsCount = 0;
  let hasExplicitBrlCashRow = false;

  for (const row of params.rows) {
    const qty = Number(row.quantity) || 0;
    const valCents = numberToCents(row.valueBRL);
    const currency = (row.currency ?? "BRL").toUpperCase().trim();
    const tickerUpper = row.ticker.toUpperCase().trim();
    if ((row.isCash || tickerUpper === "CAIXA") && currency !== "USD" && (qty > 0 || valCents > 0)) {
      hasExplicitBrlCashRow = true;
    }
    if (qty <= 0 && valCents <= 0) continue;

    if (currency === "USD") {
      custodyForeignAssetsCount += 1;
      rawForeignBRLCents += valCents;

      const unitUsd =
        row.priceQuote && row.priceQuote > 0
          ? row.priceQuote
          : row.currentPrice && row.currentPrice > 0
            ? row.currentPrice
            : fxRateUsed > 0 && qty > 0
              ? row.valueBRL / (fxRateUsed * qty)
              : 0;
      const nativeUsdCents =
        unitUsd > 0 && qty > 0
          ? numberToCents(qty * unitUsd)
          : fxRateUsed > 0
            ? numberToCents(row.valueBRL / fxRateUsed)
            : 0;
      custodyForeignUSDCents += nativeUsdCents;
    } else {
      custodyBrazilAssetsCount += 1;
      rawBrazilBRLCents += valCents;
    }
  }

  const extraCashCents =
    !hasExplicitBrlCashRow && params.cashBRL && params.cashBRL > 0 ? numberToCents(params.cashBRL) : 0;
  if (extraCashCents > 0) {
    custodyBrazilAssetsCount += 1;
  }
  rawBrazilBRLCents += extraCashCents;

  const rawSumCents = rawBrazilBRLCents + rawForeignBRLCents;
  const closingPatrimonyCents =
    params.totalBRL !== undefined && Number.isFinite(params.totalBRL)
      ? numberToCents(params.totalBRL)
      : rawSumCents;

  const roundingAdjustmentCents = closingPatrimonyCents - rawSumCents;
  const isPureForeignCustody =
    custodyForeignAssetsCount > 0 && custodyBrazilAssetsCount === 0 && rawBrazilBRLCents === 0;

  let custodyForeignBRLCents: number;
  let custodyBrazilCents: number;
  if (isPureForeignCustody) {
    custodyForeignBRLCents = closingPatrimonyCents;
    custodyBrazilCents = 0;
  } else {
    custodyForeignBRLCents =
      closingPatrimonyCents >= 0
        ? Math.min(Math.max(0, rawForeignBRLCents), closingPatrimonyCents)
        : rawForeignBRLCents;
    custodyBrazilCents = closingPatrimonyCents - custodyForeignBRLCents;
  }

  const hasForeignCustody = custodyForeignAssetsCount > 0 || custodyForeignBRLCents > 0;
  const custodyForeignPct =
    closingPatrimonyCents > 0
      ? Math.round((custodyForeignBRLCents / closingPatrimonyCents) * 1000) / 10
      : 0;
  const custodyBrazilPct =
    closingPatrimonyCents > 0 ? Math.round((100 - custodyForeignPct) * 10) / 10 : 0;

  return {
    custodyBrazilCents,
    custodyBrazilAssetsCount,
    custodyBrazilPct,
    custodyForeignUSDCents,
    custodyForeignBRLCents,
    custodyForeignAssetsCount,
    custodyForeignPct,
    fxRateUsed,
    fxSourceLabel,
    closingPatrimonyCents,
    roundingAdjustmentCents,
    hasForeignCustody,
  };
}
