/**
 * Motor de Apuração Determinística de Proventos na Data COM.
 *
 * Calcula a custódia exata no fechamento da Data COM (`America/Sao_Paulo`),
 * suportando ativos criados com saldo inicial (baseline) + compras/vendas/splits
 * posteriores, proventos sem `payment_date` definida, alíquotas B3/EUA (IRRF/WHT),
 * guarda Anti-Flood e separação estrita de moedas (BRL vs. USD).
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
import {
  isCorporateDividendDeduplicated,
  normalizeDividendTickerKey,
} from "./dividend-deduplication";
import { getMarketZonedParts } from "./market-calendar";
import { FALLBACK_USD_RATE } from "./valuation";

export interface SuggestedDividendItem {
  corporateDividendId: string;
  eventId?: string | null;
  assetId: string;
  ticker: string;
  type: string;
  comDate: string;
  paymentDate: string | null;
  quantityOnComDate: number;
  rate: number;
  netRate: number;
  taxRatePct: number;
  grossAmount: number;
  totalAmount: number;
  currency: "BRL" | "USD";
  status: "available" | "projected";
  provider?: string | null;
  isTypeUncertain?: boolean;
  isManual?: boolean;
}

export interface SuggestedDividendsResult {
  available: SuggestedDividendItem[];
  projected: SuggestedDividendItem[];
  totalAvailableAmount: number;
  totalProjectedAmount: number;
  totalAvailableBRL: number;
  totalAvailableUSD: number;
  totalProjectedBRL: number;
  totalProjectedUSD: number;
  usdRateUsed: number;
}

export interface CalculateSuggestedDividendsInput {
  corporateEvents: CorporateDividend[];
  dismissals: PortfolioDividendDismissal[];
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
  manualDividends: PortfolioDividend[];
  referenceDate?: string; // YYYY-MM-DD em America/Sao_Paulo
  usdRate?: number;
}

/** Retorna a data civil corrente em America/Sao_Paulo (YYYY-MM-DD). */
export function todaySaoPauloISO(now: Date = new Date()): string {
  return getMarketZonedParts(now, "America/Sao_Paulo").isoDate;
}

function addDaysIsoLocal(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Resolve a janela segura Anti-Flood na ativação da automação:
 * `max(activatedAt, todayBR - safeWindowDays)`. Eventos anteriores a esse corte
 * jamais devem ser liquidados automaticamente.
 */
export function resolveDividendAntiFloodCutoff(
  activatedAtIso: string | null | undefined,
  referenceDateBR: string = todaySaoPauloISO(),
  safeWindowDays = 7,
): string {
  const safeFloor = addDaysIsoLocal(referenceDateBR.slice(0, 10), -Math.max(1, safeWindowDays));
  const cleanActivated =
    typeof activatedAtIso === "string" && /^\d{4}-\d{2}-\d{2}/.test(activatedAtIso.trim())
      ? activatedAtIso.trim().slice(0, 10)
      : null;
  if (!cleanActivated) return safeFloor;
  return cleanActivated > safeFloor ? cleanActivated : safeFloor;
}

function roundQty8(val: number): number {
  return Math.round(val * 100_000_000) / 100_000_000;
}

function isCustodyTransaction(type: PortfolioTransaction["type"]): boolean {
  return (
    type === "buy" ||
    type === "subscription" ||
    type === "sell" ||
    type === "split" ||
    type === "reverse_split"
  );
}

/**
 * Calcula a posição de custódia de um ativo até o fechamento da Data COM (`America/Sao_Paulo`).
 *
 * Reconcilia tanto históricos 100% no ledger quanto ativos criados com saldo inicial
 * (baseline) que receberam compras, vendas ou splits/inplits posteriormente.
 */
export function getCustodyAtComDate(
  asset: PortfolioAsset,
  transactions: PortfolioTransaction[],
  comDate: string,
): number {
  const comClean = comDate.slice(0, 10);
  const currentQty = Math.max(0, Number(asset.quantity) || 0);
  const assetCreatedAt =
    "created_at" in asset && typeof (asset as Record<string, unknown>).created_at === "string"
      ? ((asset as Record<string, unknown>).created_at as string).slice(0, 10)
      : "";

  const custodyTxs = transactions
    .filter((tx) => tx.asset_id === asset.id && isCustodyTransaction(tx.type))
    .slice()
    .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));

  if (custodyTxs.length === 0) {
    if (!assetCreatedAt || assetCreatedAt <= comClean) {
      return currentQty;
    }
    return 0;
  }

  let zeroReplayPos: AssetPosition = {
    quantity: 0,
    averageCost: 0,
    totalCost: 0,
    dividends: 0,
  };
  for (const tx of custodyTxs) {
    zeroReplayPos = applyOperation(zeroReplayPos, tx);
  }

  // Detecta custódia inicial pré-ledger por reconciliação reversa a partir de `asset.quantity`.
  let baselineQty = 0;
  if (currentQty > zeroReplayPos.quantity + 1e-6) {
    let q = currentQty;
    for (let i = custodyTxs.length - 1; i >= 0; i--) {
      const tx = custodyTxs[i]!;
      const txQty = Number(tx.quantity) || 0;
      if (tx.type === "buy" || tx.type === "subscription") {
        q -= txQty;
      } else if (tx.type === "sell") {
        q += txQty;
      } else if (tx.type === "split") {
        const factor = txQty > 0 ? txQty : 1;
        q /= factor;
      } else if (tx.type === "reverse_split") {
        const factor = txQty > 0 ? txQty : 1;
        q *= factor;
      }
    }
    baselineQty = q > 1e-6 ? roundQty8(q) : 0;
  }

  const txsUpToCom = custodyTxs.filter((tx) => tx.date.slice(0, 10) <= comClean);
  if (baselineQty > 0 && assetCreatedAt && assetCreatedAt > comClean && txsUpToCom.length === 0) {
    return 0;
  }

  let pos: AssetPosition = {
    quantity: baselineQty,
    averageCost: asset.average_price,
    totalCost: baselineQty * asset.average_price,
    dividends: 0,
  };

  for (const tx of txsUpToCom) {
    pos = applyOperation(pos, tx);
  }

  return pos.quantity > 0 ? roundQty8(pos.quantity) : 0;
}

/**
 * Sugere proventos corporativos elegíveis agrupando em 'disponíveis para confirmação'
 * e 'previstos/provisionados', com totais segregados em BRL/USD e consolidado em BRL.
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
    referenceDate = todaySaoPauloISO(),
    usdRate = FALLBACK_USD_RATE,
  } = input;

  const effectiveFx = usdRate > 0 ? usdRate : FALLBACK_USD_RATE;
  const dismissedIds = new Set(dismissals.map((d) => d.corporate_dividend_id));

  const assetsByTicker = new Map<string, PortfolioAsset[]>();
  const assetTickerMap = new Map<string, string>();
  for (const a of assets) {
    const rawNorm = a.ticker.trim().toUpperCase();
    const canonNorm = normalizeDividendTickerKey(a.ticker);
    assetTickerMap.set(a.id, canonNorm);

    const listCanon = assetsByTicker.get(canonNorm) ?? [];
    listCanon.push(a);
    assetsByTicker.set(canonNorm, listCanon);

    if (rawNorm !== canonNorm) {
      const listRaw = assetsByTicker.get(rawNorm) ?? [];
      listRaw.push(a);
      assetsByTicker.set(rawNorm, listRaw);
    }
  }

  const available: SuggestedDividendItem[] = [];
  const projected: SuggestedDividendItem[] = [];

  let availBRLCents = 0;
  let availUSDCents = 0;
  let projBRLCents = 0;
  let projUSDCents = 0;

  for (const event of corporateEvents) {
    if (dismissedIds.has(event.id)) continue;

    const normTicker = normalizeDividendTickerKey(event.ticker);
    const matchingAssets = assetsByTicker.get(normTicker) ?? [];
    if (matchingAssets.length === 0) continue;

    const comDateClean = event.com_date.slice(0, 10);
    if (comDateClean > referenceDate) continue;

    for (const asset of matchingAssets) {
      const quantity = getCustodyAtComDate(asset, transactions, comDateClean);
      if (quantity <= 0) continue;

      const grossCents = Math.round(quantity * event.rate * 100);
      const netCents = Math.round(quantity * event.net_rate * 100);
      if (netCents <= 0) continue;

      const grossAmount = grossCents / 100;
      const totalAmount = netCents / 100;

      // Deduplicação fuzzy contra lançamentos manuais já existentes
      const alreadyLogged = isCorporateDividendDeduplicated(
        event,
        totalAmount,
        manualDividends,
        assetTickerMap,
      );
      if (alreadyLogged) continue;

      const paymentDateClean = event.payment_date ? event.payment_date.slice(0, 10) : null;
      const isAvailable = paymentDateClean !== null && paymentDateClean <= referenceDate;
      const inferredTaxPct =
        event.tax_rate_pct ??
        (event.rate > 0
          ? Math.max(0, Math.round((1 - event.net_rate / event.rate) * 10000) / 100)
          : 0);

      const item: SuggestedDividendItem = {
        corporateDividendId: event.id,
        eventId: null,
        assetId: asset.id,
        ticker: asset.ticker.trim().toUpperCase(),
        type: event.type,
        comDate: comDateClean,
        paymentDate: paymentDateClean,
        quantityOnComDate: quantity,
        rate: event.rate,
        netRate: event.net_rate,
        taxRatePct: inferredTaxPct,
        grossAmount,
        totalAmount,
        currency: event.currency,
        status: isAvailable ? "available" : "projected",
        provider: event.provider ?? null,
        isTypeUncertain: Boolean(event.is_type_uncertain),
        isManual: false,
      };

      if (isAvailable) {
        available.push(item);
        if (event.currency === "USD") {
          availUSDCents += netCents;
        } else {
          availBRLCents += netCents;
        }
      } else {
        projected.push(item);
        if (event.currency === "USD") {
          projUSDCents += netCents;
        } else {
          projBRLCents += netCents;
        }
      }
    }
  }

  const availTotalBRLCents = availBRLCents + Math.round(availUSDCents * effectiveFx);
  const projTotalBRLCents = projBRLCents + Math.round(projUSDCents * effectiveFx);

  return {
    available,
    projected,
    totalAvailableAmount: availTotalBRLCents / 100,
    totalProjectedAmount: projTotalBRLCents / 100,
    totalAvailableBRL: availBRLCents / 100,
    totalAvailableUSD: availUSDCents / 100,
    totalProjectedBRL: projBRLCents / 100,
    totalProjectedUSD: projUSDCents / 100,
    usdRateUsed: effectiveFx,
  };
}
