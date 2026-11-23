/**
 * Motor de Deduplicação Inteligente de Proventos Corporativos vs. Lançamentos Manuais.
 *
 * Compara proventos corporativos capturados (B3 e EUA) com lançamentos manuais do
 * investidor para evitar aprovações redundantes e inflação de Caixa.
 *
 * Critério Canônico:
 *  - Mesmo ticker canônico (normalizando sufixos `.SA` e fracionário `F` da B3);
 *  - Data de pagamento definida e diferença <= 3 dias úteis (ANBIMA/B3);
 *  - Diferença monetária no montante financeiro total <= 0,05 na moeda nativa (arredondamento/IOF).
 *
 * Módulo puro — sem chamadas externas.
 */

import type { CorporateDividend, PortfolioDividend } from "@/types";
import { classifyTickerMarket, countMarketBusinessDays } from "./market-calendar";

export interface DeduplicationOptions {
  maxBusinessDaysDiff?: number;
  maxAmountDiff?: number;
}

const FRACTIONAL_B3_SUFFIX_RE = /^([A-Z][A-Z0-9]{3}\d{1,2})F$/;
const VALID_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza a chave do ticker para conciliação de proventos (PETR4F / B3SA3F / PETR4.SA -> PETR4 / B3SA3).
 */
export function normalizeDividendTickerKey(rawTicker: string): string {
  const clean = rawTicker.trim().toUpperCase().replace(/\.SA$/, "");
  const fracMatch = clean.match(FRACTIONAL_B3_SUFFIX_RE);
  return fracMatch && fracMatch[1] ? fracMatch[1] : clean;
}

/**
 * Calcula a diferença em dias úteis entre duas datas ISO YYYY-MM-DD (com validação contra data inválida).
 */
export function getBusinessDaysDifference(
  date1: string,
  date2: string,
  market: "BR" | "US" = "BR",
): number {
  const d1 = date1.slice(0, 10);
  const d2 = date2.slice(0, 10);
  if (!VALID_ISO_DATE_RE.test(d1) || !VALID_ISO_DATE_RE.test(d2)) {
    return Number.POSITIVE_INFINITY;
  }
  if (d1 === d2) return 0;
  return d1 < d2
    ? countMarketBusinessDays(d1, d2, market)
    : countMarketBusinessDays(d2, d1, market);
}

/**
 * Localiza um lançamento manual em `portfolio_dividends` compatível com o evento
 * corporativo (para deduplicação fuzzy e reconciliação de `settled_dividend_id`).
 */
export function findFuzzyMatchingManualDividend(
  corporateEvent: Pick<CorporateDividend, "ticker" | "payment_date"> & { currency?: string },
  calculatedTotal: number,
  manualDividends: ReadonlyArray<
    Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { id?: string; asset_id?: string | null }
  >,
  assetTickerMap?: ReadonlyMap<string, string>,
  options: DeduplicationOptions = {},
): (Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { id?: string; asset_id?: string | null }) | null {
  if (!corporateEvent.payment_date || !Number.isFinite(calculatedTotal)) return null;

  const maxDays = options.maxBusinessDaysDiff ?? 3;
  const maxDiffCents = Math.round((options.maxAmountDiff ?? 0.05) * 100);

  const corpTicker = normalizeDividendTickerKey(corporateEvent.ticker);
  const corpDate = corporateEvent.payment_date.slice(0, 10);
  if (!VALID_ISO_DATE_RE.test(corpDate)) return null;

  const rawMarket = classifyTickerMarket(corporateEvent.ticker);
  const market: "BR" | "US" =
    rawMarket === "US" || corporateEvent.currency === "USD" ? "US" : "BR";
  const calculatedCents = Math.round(calculatedTotal * 100);

  for (const manual of manualDividends) {
    const rawManualTicker =
      manual.ticker ?? (manual.asset_id ? assetTickerMap?.get(manual.asset_id) : undefined) ?? "";
    const manualTicker = normalizeDividendTickerKey(rawManualTicker);

    if (!manualTicker || manualTicker !== corpTicker) continue;

    const manualDate = manual.date.slice(0, 10);
    if (!VALID_ISO_DATE_RE.test(manualDate)) continue;

    const dayDiff = getBusinessDaysDifference(corpDate, manualDate, market);
    if (dayDiff > maxDays) continue;

    const manualNum = Number(manual.amount);
    if (!Number.isFinite(manualNum)) continue;
    const manualCents = Math.round(manualNum * 100);
    if (Math.abs(calculatedCents - manualCents) <= maxDiffCents) {
      return manual;
    }
  }

  return null;
}

/**
 * Verifica se um provento corporativo (com valor apurado pelo investidor)
 * já foi lançado manualmente na tabela `portfolio_dividends`.
 */
export function isCorporateDividendDeduplicated(
  corporateEvent: Pick<CorporateDividend, "ticker" | "payment_date">,
  calculatedTotal: number,
  manualDividends: ReadonlyArray<
    Pick<PortfolioDividend, "ticker" | "date" | "amount"> & { asset_id?: string | null }
  >,
  assetTickerMap?: ReadonlyMap<string, string>,
  options: DeduplicationOptions = {},
): boolean {
  return (
    findFuzzyMatchingManualDividend(
      corporateEvent,
      calculatedTotal,
      manualDividends,
      assetTickerMap,
      options,
    ) !== null
  );
}
