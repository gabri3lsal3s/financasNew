/**
 * Motor de Apuração Determinística de Proventos na Data COM.
 *
 * Determina o montante de proventos a que o investidor tem direito calculando
 * a custódia exata no fechamento da Data COM e filtrando eventos dispensados
 * ou já lançados manualmente.
 *
 * Módulo puro — sem chamadas externas.
 */

import type {
  CorporateDividend,
  PortfolioAsset,
  PortfolioDividend,
  PortfolioDividendDismissal,
  PortfolioTransaction,
} from "@/types";
import { applyOperation, type AssetPosition } from "./index";
import { isCorporateDividendDeduplicated } from "./dividend-deduplication";

export interface SuggestedDividendItem {
  corporateDividendId: string;
  assetId: string;
  ticker: string;
  type: string;
  comDate: string;
  paymentDate: string;
  quantityOnComDate: number;
  rate: number;
  netRate: number;
  totalAmount: number;
  currency: "BRL" | "USD";
  status: "available" | "projected";
}

export interface SuggestedDividendsResult {
  available: SuggestedDividendItem[];
  projected: SuggestedDividendItem[];
  totalAvailableAmount: number;
  totalProjectedAmount: number;
}

export interface CalculateSuggestedDividendsInput {
  corporateEvents: CorporateDividend[];
  dismissals: PortfolioDividendDismissal[];
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
  manualDividends: PortfolioDividend[];
  referenceDate?: string; // YYYY-MM-DD (default: today UTC)
}

/**
 * Calcula a posição de custódia de um ativo até uma data limite (Data COM).
 */
export function getCustodyAtComDate(
  asset: PortfolioAsset,
  transactions: PortfolioTransaction[],
  comDate: string,
): number {
  const assetTxs = transactions
    .filter((tx) => tx.asset_id === asset.id && tx.date.slice(0, 10) <= comDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (assetTxs.length === 0) {
    const assetCreatedAt =
      "created_at" in asset && typeof (asset as Record<string, unknown>).created_at === "string"
        ? ((asset as Record<string, unknown>).created_at as string).slice(0, 10)
        : "";
    if (!assetCreatedAt || assetCreatedAt <= comDate) {
      return asset.quantity > 0 ? asset.quantity : 0;
    }
    return 0;
  }

  let pos: AssetPosition = {
    quantity: 0,
    averageCost: 0,
    totalCost: 0,
    dividends: 0,
  };

  for (const tx of assetTxs) {
    pos = applyOperation(pos, tx);
  }

  return pos.quantity > 0 ? pos.quantity : 0;
}

/**
 * Sugere proventos elegíveis agrupando em 'disponíveis para crédito' e 'previstos'.
 */
export function calculateSuggestedDividends(
  input: CalculateSuggestedDividendsInput,
): SuggestedDividendsResult {
  const {
    corporateEvents,
    dismissals,
    assets,
    transactions,
    manualDividends,
    referenceDate = new Date().toISOString().slice(0, 10),
  } = input;

  const dismissedIds = new Set(dismissals.map((d) => d.corporate_dividend_id));

  const assetByTicker = new Map<string, PortfolioAsset>();
  const assetTickerMap = new Map<string, string>();
  for (const a of assets) {
    const norm = a.ticker.trim().toUpperCase();
    assetByTicker.set(norm, a);
    assetTickerMap.set(a.id, norm);
  }

  const available: SuggestedDividendItem[] = [];
  const projected: SuggestedDividendItem[] = [];

  let totalAvailableCents = 0;
  let totalProjectedCents = 0;

  for (const event of corporateEvents) {
    if (dismissedIds.has(event.id)) continue;

    const normTicker = event.ticker.trim().toUpperCase();
    const asset = assetByTicker.get(normTicker);
    if (!asset) continue;

    const comDateClean = event.com_date.slice(0, 10);
    const quantity = getCustodyAtComDate(asset, transactions, comDateClean);
    if (quantity <= 0) continue;

    const totalAmount = Math.round(quantity * event.net_rate * 100) / 100;
    if (totalAmount <= 0) continue;

    // Deduplicação fuzzy contra lançamentos manuais já existentes
    const alreadyLogged = isCorporateDividendDeduplicated(
      event,
      totalAmount,
      manualDividends,
      assetTickerMap,
    );
    if (alreadyLogged) continue;

    const paymentDateClean = event.payment_date.slice(0, 10);
    const isAvailable = paymentDateClean <= referenceDate;

    const item: SuggestedDividendItem = {
      corporateDividendId: event.id,
      assetId: asset.id,
      ticker: normTicker,
      type: event.type,
      comDate: comDateClean,
      paymentDate: paymentDateClean,
      quantityOnComDate: quantity,
      rate: event.rate,
      netRate: event.net_rate,
      totalAmount,
      currency: event.currency,
      status: isAvailable ? "available" : "projected",
    };

    if (isAvailable) {
      available.push(item);
      totalAvailableCents += Math.round(totalAmount * 100);
    } else {
      projected.push(item);
      totalProjectedCents += Math.round(totalAmount * 100);
    }
  }

  return {
    available,
    projected,
    totalAvailableAmount: totalAvailableCents / 100,
    totalProjectedAmount: totalProjectedCents / 100,
  };
}
