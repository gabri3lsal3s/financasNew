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
import {
  evaluateLotCutoffAtComDate,
  matchesOperationalCatalogWindow,
  normalizeCanonicalDividendTicker,
  resolveOpenDividendEventStatus,
  selectPrimaryLotForGroup,
  type DividendTrustTier,
} from "./dividend-engine";
import {
  findFuzzyMatchingManualDividend,
  normalizeDividendTickerKey,
} from "./dividend-deduplication";
import { countMarketBusinessDays, getMarketZonedParts } from "./market-calendar";
import { getCuratedDividendInstrument } from "./tickers-catalog";
import { FALLBACK_USD_RATE } from "./valuation";

export interface SuggestedDividendItem {
  corporateDividendId: string | null;
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
  trustTier?: DividendTrustTier | null;
  isTypeUncertain?: boolean;
  isOver120DaysWithoutPayment?: boolean;
  isManual?: boolean;
  notes?: string | null;
  revision?: number;
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
  trackingStartDate?: string | null;
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

/**
 * Calcula a posição de custódia de um ativo até o fechamento da Data COM (`America/Sao_Paulo`).
 *
 * Delega ao avaliador puro `evaluateLotCutoffAtComDate` para aplicar Marco Zero global,
 * corte individual (`dividends_start_date`), prova de baseline pré-ledger e proteção
 * de ativos com acumulado positivo sem corte calibrado.
 */
export function getCustodyAtComDate(
  asset: PortfolioAsset,
  transactions: PortfolioTransaction[],
  comDate: string,
  trackingStartDate: string | null = null,
): number {
  return evaluateLotCutoffAtComDate(asset, transactions, comDate, trackingStartDate).qtyAtCom;
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
    trackingStartDate = null,
  } = input;

  const effectiveFx = Number.isFinite(usdRate) && usdRate > 0 ? usdRate : FALLBACK_USD_RATE;
  const dismissedIds = new Set(dismissals.map((d) => d.corporate_dividend_id));

  const assetsByGroup = new Map<string, PortfolioAsset[]>();
  const assetTickerMap = new Map<string, string>();
  for (const a of assets) {
    const assetCurrency = (a.currency ?? "BRL").trim().toUpperCase() === "USD" ? "USD" : "BRL";
    const canonNorm = normalizeCanonicalDividendTicker(a.ticker, assetCurrency);
    assetTickerMap.set(a.id, normalizeDividendTickerKey(a.ticker, assetCurrency));

    const groupKey = `${assetCurrency}:${canonNorm}`;
    const listGroup = assetsByGroup.get(groupKey) ?? [];
    listGroup.push(a);
    assetsByGroup.set(groupKey, listGroup);
  }

  const available: SuggestedDividendItem[] = [];
  const projected: SuggestedDividendItem[] = [];
  const consumedManualDividends = new Set<(typeof manualDividends)[number]>();

  let availBRLCents = 0;
  let availUSDCents = 0;
  let projBRLCents = 0;
  let projUSDCents = 0;

  for (const event of corporateEvents) {
    if (dismissedIds.has(event.id)) continue;
    if (!matchesOperationalCatalogWindow(event, referenceDate)) continue;

    const eventCurrency: "BRL" | "USD" =
      event.currency.trim().toUpperCase() === "USD" ? "USD" : "BRL";
    const normTicker = normalizeCanonicalDividendTicker(event.ticker, eventCurrency);
    const matchingAssets = assetsByGroup.get(`${eventCurrency}:${normTicker}`) ?? [];
    if (matchingAssets.length === 0) continue;

    const comDateClean = event.com_date.slice(0, 10);
    if (comDateClean > referenceDate) continue;

    const eligibleLots: PortfolioAsset[] = [];
    let totalGroupQty = 0;
    for (const asset of matchingAssets) {
      const lotQty = getCustodyAtComDate(asset, transactions, comDateClean, trackingStartDate);
      if (lotQty > 0) {
        eligibleLots.push(asset);
        totalGroupQty += lotQty;
      }
    }
    const quantity = Math.round(totalGroupQty * 100_000_000) / 100_000_000;
    if (quantity <= 0 || eligibleLots.length === 0) continue;

    const primaryAsset = selectPrimaryLotForGroup(eligibleLots);
    if (!primaryAsset) continue;

    const grossCents = Math.round(quantity * event.rate * 100);
    const netCents = Math.round(quantity * event.net_rate * 100);
    if (!Number.isFinite(netCents) || netCents <= 0 || !Number.isFinite(grossCents)) continue;

    const grossAmount = grossCents / 100;
    const totalAmount = netCents / 100;

    // Deduplicação fuzzy contra lançamentos manuais não consumidos por outro evento
    const remainingManuals = manualDividends.filter((m) => !consumedManualDividends.has(m));
    const matchedManual = findFuzzyMatchingManualDividend(
      event,
      totalAmount,
      remainingManuals,
      assetTickerMap,
    );
    if (matchedManual) {
      consumedManualDividends.add(matchedManual as (typeof manualDividends)[number]);
      continue;
    }

    const paymentDateClean = event.payment_date ? event.payment_date.slice(0, 10) : null;
    const instrument = getCuratedDividendInstrument(primaryAsset.ticker, eventCurrency);
    const statusEval = resolveOpenDividendEventStatus({
      comDate: comDateClean,
      paymentDate: paymentDateClean,
      referenceDate,
      market: eventCurrency === "USD" ? "US" : "BR",
      instrumentKind: instrument.kind,
      countBusinessDays: (fromIso, toIso, market) => countMarketBusinessDays(fromIso, toIso, market),
    });
    const isAvailable = statusEval.status === "PENDING_CONFIRMATION";
    const inferredTaxPct =
      event.tax_rate_pct ??
      (event.rate > 0
        ? Math.max(0, Math.round((1 - event.net_rate / event.rate) * 10000) / 100)
        : 0);

    const item: SuggestedDividendItem = {
      corporateDividendId: event.id,
      eventId: null,
      assetId: primaryAsset.id,
      ticker: normTicker,
      type: event.type,
      comDate: comDateClean,
      paymentDate: paymentDateClean,
      quantityOnComDate: quantity,
      rate: event.rate,
      netRate: event.net_rate,
      taxRatePct: inferredTaxPct,
      grossAmount,
      totalAmount,
      currency: eventCurrency,
      status: isAvailable ? "available" : "projected",
      provider: event.provider ?? null,
      trustTier: event.trust_tier ?? null,
      isTypeUncertain: Boolean(event.is_type_uncertain),
      isOver120DaysWithoutPayment: statusEval.isOver120DaysWithoutPayment,
      isManual: false,
    };

    if (isAvailable) {
      available.push(item);
      if (eventCurrency === "USD") {
        availUSDCents += netCents;
      } else {
        availBRLCents += netCents;
      }
    } else {
      projected.push(item);
      if (eventCurrency === "USD") {
        projUSDCents += netCents;
      } else {
        projBRLCents += netCents;
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
