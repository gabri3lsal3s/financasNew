/**
 * Motor de Deduplicação Inteligente de Proventos B3 vs. Lançamentos Manuais.
 *
 * Compara proventos corporativos capturados com lançamentos manuais do investidor
 * para evitar aprovações redundantes e inflação de Caixa.
 *
 * Critério Canônico:
 *  - Mesmo ticker (normalizado em caixa alta);
 *  - Diferença entre datas de pagamento <= 3 dias úteis (ANBIMA/B3);
 *  - Diferença monetária no montante financeiro total <= R$ 0,05 (arredondamento/IOF).
 *
 * Módulo puro — sem chamadas externas.
 */

import type { CorporateDividend, PortfolioDividend } from "@/types";
import { countBusinessDays } from "./business-days";

export interface DeduplicationOptions {
  maxBusinessDaysDiff?: number;
  maxAmountDiff?: number;
}

/**
 * Calcula a diferença em dias úteis entre duas datas ISO YYYY-MM-DD.
 */
export function getBusinessDaysDifference(date1: string, date2: string): number {
  const d1 = date1.slice(0, 10);
  const d2 = date2.slice(0, 10);
  if (d1 === d2) return 0;
  return d1 < d2 ? countBusinessDays(d1, d2) : countBusinessDays(d2, d1);
}

/**
 * Verifica se um provento corporativo (com valor apurado pelo investidor)
 * já foi lançado manualmente na tabela `portfolio_dividends`.
 */
export function isCorporateDividendDeduplicated(
  corporateEvent: Pick<CorporateDividend, "ticker" | "payment_date">,
  calculatedTotal: number,
  manualDividends: Array<Pick<PortfolioDividend, "ticker" | "date" | "amount">>,
  assetTickerMap?: Map<string, string>,
  options: DeduplicationOptions = {},
): boolean {
  const maxDays = options.maxBusinessDaysDiff ?? 3;
  const maxDiff = options.maxAmountDiff ?? 0.05;

  const corpTicker = corporateEvent.ticker.trim().toUpperCase();
  const corpDate = corporateEvent.payment_date.slice(0, 10);

  for (const manual of manualDividends) {
    const manualTicker = (manual.ticker ?? assetTickerMap?.get((manual as { asset_id?: string }).asset_id ?? "") ?? "")
      .trim()
      .toUpperCase();

    if (manualTicker !== corpTicker) continue;

    const manualDate = manual.date.slice(0, 10);
    const dayDiff = getBusinessDaysDifference(corpDate, manualDate);
    if (dayDiff > maxDays) continue;

    const amountDiff = Math.abs(calculatedTotal - manual.amount);
    if (amountDiff <= maxDiff) {
      return true;
    }
  }

  return false;
}
