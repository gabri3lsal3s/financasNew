/**
 * Hook de consulta dos proventos corporativos (B3 e EUA), eventos persistidos
 * (`user_dividend_events`) e apuração de proventos provisionados / a confirmar.
 *
 * Integra a inteligência em nuvem com o cálculo em custódia na Data COM,
 * segregando BRL e USD e mantendo isolamento contábil estrito.
 */

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { consolidateAssetPrices } from "@/data/repositories/asset-prices";
import {
  listCorporateDividends,
  listPortfolioDividendDismissals,
  listUserDividendEvents,
} from "@/data/repositories/portfolio";
import {
  calculateSuggestedDividends,
  countMarketBusinessDays,
  evaluateGroupCutoffEligibility,
  FALLBACK_USD_RATE,
  getCuratedDividendInstrument,
  isAssetPendingDividendCalibration,
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  normalizeCanonicalDividendTicker,
  normalizeDividendTickerKey,
  reconcileCorporateWithManualDividends,
  resolveOpenDividendEventStatus,
  suggestedDividendToSummaryItem,
  summarizeProvisionedDividends,
  todaySaoPauloISO,
  usdRateFromPrices,
  type ProvisionedDividendsSummary,
  type SuggestedDividendItem,
  type SuggestedDividendsResult,
} from "@/domain/portfolio";
import { useDemoSession } from "@/state/demo-mode";
import type { CorporateDividend, PortfolioAsset, UserDividendEvent } from "@/types";
import { useAssetPrices } from "./use-asset-prices";
import * as userPreferencesHooks from "./use-user-preferences";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
} from "./use-portfolio";

const useOptionalUserPreferencesHook: typeof userPreferencesHooks.useUserPreferences =
  typeof userPreferencesHooks.useUserPreferences === "function"
    ? userPreferencesHooks.useUserPreferences
    : ((() => ({ data: null, isLoading: false, isError: false })) as unknown as typeof userPreferencesHooks.useUserPreferences);

export const CORPORATE_DIVIDENDS_QUERY_KEY = ["corporate_dividends"] as const;
export const PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY = ["portfolio_dividend_dismissals"] as const;
export const USER_DIVIDEND_EVENTS_QUERY_KEY = ["user_dividend_events"] as const;

export interface UseCorporateDividendsState extends SuggestedDividendsResult {
  pendingConfirmation: SuggestedDividendItem[];
  provisioned: SuggestedDividendItem[];
  recentlySettled: UserDividendEvent[];
  userEvents: UserDividendEvent[];
  assetsNeedingCalibration: PortfolioAsset[];
  trackingStartDate: string | null;
  provisionedSummary: ProvisionedDividendsSummary;
  monthlyForecast?: {
    month: string;
    count: number;
    totalBRLCents: number;
    totalBRL: number;
    nativeBRLCents: number;
    usdCents: number;
  };
  fxRate: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export interface UseCorporateDividendsOptions {
  enabled?: boolean;
}

function mapUserEventToSuggestedItem(
  ev: UserDividendEvent,
  referenceDate: string,
  corpById: ReadonlyMap<string, CorporateDividend>,
): SuggestedDividendItem {
  const paymentDateClean = ev.payment_date ? ev.payment_date.slice(0, 10) : null;
  const corp = ev.corporate_dividend_id ? corpById.get(ev.corporate_dividend_id) : undefined;
  const instrument = getCuratedDividendInstrument(ev.ticker, ev.currency);
  const statusEval = resolveOpenDividendEventStatus({
    comDate: ev.com_date,
    paymentDate: paymentDateClean,
    referenceDate,
    market: ev.currency === "USD" ? "US" : "BR",
    instrumentKind: instrument.kind,
    currentStatus: ev.status === "PENDING_CONFIRMATION" ? "PENDING_CONFIRMATION" : "PROVISIONED",
    isManual: ev.is_manual,
    manualReviewRequired: ev.manual_review_required,
    countBusinessDays: (fromIso, toIso, market) => countMarketBusinessDays(fromIso, toIso, market),
  });

  const isAvailable =
    ev.manual_review_required || ev.is_manual
      ? ev.status === "PENDING_CONFIRMATION" ||
        (paymentDateClean !== null && paymentDateClean <= referenceDate)
      : statusEval.status === "PENDING_CONFIRMATION";

  return {
    corporateDividendId: ev.corporate_dividend_id ?? null,
    eventId: ev.id,
    assetId: ev.asset_id,
    ticker: ev.ticker.trim().toUpperCase(),
    type: ev.type,
    comDate: ev.com_date.slice(0, 10),
    paymentDate: paymentDateClean,
    quantityOnComDate: Number(ev.quantity_on_com_date),
    rate: Number(ev.gross_rate),
    netRate: Number(ev.net_rate),
    taxRatePct: Number(ev.tax_rate_pct ?? 0),
    grossAmount: Number(ev.gross_amount),
    totalAmount: Number(ev.net_amount),
    currency: ev.currency,
    status: isAvailable ? "available" : "projected",
    provider: ev.is_manual ? "manual" : (corp?.provider ?? null),
    trustTier: corp?.trust_tier ?? null,
    isTypeUncertain: Boolean(ev.is_type_uncertain),
    isOver120DaysWithoutPayment: statusEval.isOver120DaysWithoutPayment,
    isManual: Boolean(ev.is_manual),
    notes: ev.notes ?? null,
    revision: ev.revision ?? 1,
  };
}

/** Lista eventos persistidos de proventos do usuário (`user_dividend_events`). */
export function useUserDividendEvents(options?: UseCorporateDividendsOptions) {
  const { isDemoActive } = useDemoSession();
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: USER_DIVIDEND_EVENTS_QUERY_KEY,
    queryFn: () => listUserDividendEvents(),
    enabled: enabled && !isDemoActive,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCorporateDividends(
  options?: UseCorporateDividendsOptions,
): UseCorporateDividendsState {
  const enabled = options?.enabled ?? true;
  const { isDemoActive } = useDemoSession();
  const assetsQuery = usePortfolioAssets({ enabled });
  const transactionsQuery = useAllPortfolioTransactions({ enabled });
  const manualDividendsQuery = usePortfolioDividends({ enabled });
  const assetPricesQuery = useAssetPrices({ enabled });
  const userPrefsQuery = useOptionalUserPreferencesHook({ enabled: enabled && !isDemoActive });

  const trackingStartDate = useMemo(() => {
    const raw = userPrefsQuery.data?.custom_settings?.dividendAutomation?.trackingStartDate;
    return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null;
  }, [userPrefsQuery.data]);

  const assetsNeedingCalibration = useMemo(
    () => (assetsQuery.data ?? []).filter(isAssetPendingDividendCalibration),
    [assetsQuery.data],
  );

  const portfolioTickers = useMemo(() => {
    const tickers = new Set<string>();
    const assetsWithLedger = new Set<string>();
    for (const tx of transactionsQuery.data ?? []) {
      if (tx.asset_id) {
        assetsWithLedger.add(tx.asset_id);
      }
    }

    for (const a of assetsQuery.data ?? []) {
      const hasQty = Number(a.quantity) > 0;
      const hadLedgerActivity = assetsWithLedger.has(a.id);
      if (!hasQty && !hadLedgerActivity) continue;
      if (isCashAssetClass(a.asset_class)) continue;
      if (isFixedIncomeClass(a.asset_class) && !isTesouroAsset(a.ticker, a.asset_class)) continue;
      if (isPrivateFixedIncomeTicker(a.ticker) || isCustomValuationAsset(a)) continue;
      if (isTesouroAsset(a.ticker, a.asset_class)) continue;
      const clean = a.ticker.trim().toUpperCase();
      if (clean) tickers.add(clean);
    }
    return Array.from(tickers).sort();
  }, [assetsQuery.data, transactionsQuery.data]);

  const corporateQuery = useQuery({
    queryKey: [...CORPORATE_DIVIDENDS_QUERY_KEY, portfolioTickers.join(",")],
    queryFn: () => listCorporateDividends(portfolioTickers),
    enabled: enabled && !assetsQuery.isLoading && !transactionsQuery.isLoading && portfolioTickers.length > 0,
    staleTime: 1000 * 60 * 15, // 15 minutos
  });

  const dismissalsQuery = useQuery({
    queryKey: PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY,
    queryFn: () => listPortfolioDividendDismissals(),
    enabled: enabled && !isDemoActive,
    staleTime: 1000 * 60 * 5,
  });

  const userEventsQuery = useUserDividendEvents({ enabled });

  const fxRate = useMemo(() => {
    const consolidated = consolidateAssetPrices(assetPricesQuery.data ?? []);
    return usdRateFromPrices(consolidated, FALLBACK_USD_RATE);
  }, [assetPricesQuery.data]);

  const isLoading =
    enabled &&
    (assetsQuery.isLoading ||
      transactionsQuery.isLoading ||
      manualDividendsQuery.isLoading ||
      (!assetsQuery.isLoading && !transactionsQuery.isLoading && portfolioTickers.length > 0 && corporateQuery.isLoading) ||
      (!isDemoActive &&
        (dismissalsQuery.isLoading ||
          userEventsQuery.isLoading ||
          Boolean(userPrefsQuery.isLoading))));

  const isError =
    enabled &&
    (assetsQuery.isError ||
      transactionsQuery.isError ||
      manualDividendsQuery.isError ||
      corporateQuery.isError ||
      (!isDemoActive && (dismissalsQuery.isError || userEventsQuery.isError)));

  const refetchCorporate = corporateQuery.refetch;
  const refetchDismissals = dismissalsQuery.refetch;
  const refetchUserEvents = userEventsQuery.refetch;

  const refetch = useCallback(() => {
    void refetchCorporate();
    if (!isDemoActive) {
      void refetchDismissals();
      void refetchUserEvents();
    }
  }, [isDemoActive, refetchCorporate, refetchDismissals, refetchUserEvents]);

  const stateResult = useMemo(() => {
    const emptySummary = summarizeProvisionedDividends([], fxRate);

    if (!enabled || isLoading || isError) {
      return {
        available: [] as SuggestedDividendItem[],
        projected: [] as SuggestedDividendItem[],
        recentlySettled: [] as UserDividendEvent[],
        userEvents: [] as UserDividendEvent[],
        assetsNeedingCalibration,
        trackingStartDate,
        totalAvailableAmount: 0,
        totalProjectedAmount: 0,
        totalAvailableBRL: 0,
        totalAvailableUSD: 0,
        totalProjectedBRL: 0,
        totalProjectedUSD: 0,
        usdRateUsed: fxRate,
        provisionedSummary: emptySummary,
      };
    }

    const referenceDate = todaySaoPauloISO();
    const recentSettledCutoff = addDaysIso(referenceDate, -7);
    const assets = assetsQuery.data ?? [];
    const activeAssetIds = new Set(assets.map((a) => a.id));
    const transactions = transactionsQuery.data ?? [];
    const manualDividends = manualDividendsQuery.data ?? [];
    const dismissals = isDemoActive ? [] : (dismissalsQuery.data ?? []);
    const userEvents = isDemoActive ? [] : (userEventsQuery.data ?? []);

    const assetById = new Map(assets.map((a) => [a.id, a]));
    const tickerByAssetId = new Map(
      assets.map((a) => [a.id, normalizeDividendTickerKey(a.ticker, a.currency)]),
    );
    const corpById = new Map((corporateQuery.data ?? []).map((c) => [c.id, c]));
    const dismissedCorpIds = new Set(
      dismissals.map((d) => d.corporate_dividend_id).filter(Boolean),
    );

    // Corporativos já materializados em `user_dividend_events` (inclusive zerados) ficam reservados para nunca voltarem via fallback
    const handledCorpIds = new Set<string>();
    const persistedAvailable: SuggestedDividendItem[] = [];
    const persistedProjected: SuggestedDividendItem[] = [];
    const recentlySettled: UserDividendEvent[] = [];

    for (const ev of userEvents) {
      if (ev.corporate_dividend_id) {
        handledCorpIds.add(ev.corporate_dividend_id);
      }
      if (!activeAssetIds.has(ev.asset_id)) continue;

      if (ev.status === "SETTLED") {
        if (ev.settlement_origin === "auto") {
          const refDay = (ev.payment_date ?? ev.updated_at ?? ev.com_date).slice(0, 10);
          if (refDay >= recentSettledCutoff) {
            recentlySettled.push(ev);
          }
        }
        continue;
      }
      if (ev.status === "DISMISSED") continue;
      if (ev.corporate_dividend_id && dismissedCorpIds.has(ev.corporate_dividend_id)) {
        continue;
      }

      if (!ev.is_manual && !ev.manual_review_required) {
        if (Number(ev.quantity_on_com_date) <= 0 || Number(ev.net_amount) <= 0) {
          continue;
        }
        const groupEval = evaluateGroupCutoffEligibility({
          canonicalTicker: normalizeCanonicalDividendTicker(ev.ticker, ev.currency),
          currency: ev.currency,
          comDate: ev.com_date,
          trackingStartDate,
          lots: assets,
          transactions,
        });
        if (!groupEval.eligible) {
          continue;
        }
        if (
          groupEval.hasMixedEligibility &&
          Math.abs(Number(ev.quantity_on_com_date) - groupEval.totalEligibleQty) > 1e-6
        ) {
          continue;
        }
      }

      const mapped = mapUserEventToSuggestedItem(ev, referenceDate, corpById);
      if (mapped.totalAmount <= 0) continue;

      if (mapped.status === "available") {
        persistedAvailable.push(mapped);
      } else {
        persistedProjected.push(mapped);
      }
    }

    const rawOpenPersisted = [...persistedAvailable, ...persistedProjected];
    const openReconciled = reconcileCorporateWithManualDividends(
      rawOpenPersisted.map((item) => ({
        id: item.eventId ?? item.corporateDividendId ?? `${item.assetId}:${item.comDate}`,
        ticker: item.ticker,
        currency: item.currency,
        instrumentKind: getCuratedDividendInstrument(item.ticker, item.currency).kind,
        comDate: item.comDate,
        paymentDate: item.paymentDate,
        grossCents: Math.round(item.grossAmount * 100),
        netCents: Math.round(item.totalAmount * 100),
        type: item.type,
        isTypeUncertain: Boolean(item.isTypeUncertain),
        manualReviewRequired: false,
        status: item.status === "available" ? "PENDING_CONFIRMATION" : "PROVISIONED",
      })),
      manualDividends
        .filter((d) => !d.source_event_id)
        .map((d) => ({
          id: d.id,
          ticker: d.ticker ?? (d.asset_id ? (tickerByAssetId.get(d.asset_id) ?? "") : ""),
          currency: (d.asset_id ? assetById.get(d.asset_id)?.currency : null) === "USD" ? ("USD" as const) : ("BRL" as const),
          date: d.date,
          monthly: typeof d.notes === "string" && /\[MENSAL\]/i.test(d.notes),
          cents: Math.round(Number(d.amount) * 100),
          sourceEventId: d.source_event_id ?? null,
          alreadyLinked: false,
        })),
    );

    const autoMatchedEventIds = new Set(openReconciled.aplicar.flatMap((l) => l.eventos));
    const manualById = new Map(manualDividends.map((m) => [m.id, m]));
    const suggestedMatchByEventId = new Map<
      string,
      NonNullable<SuggestedDividendItem["suggestedManualMatch"]>
    >();
    for (const link of openReconciled.sugerir) {
      const m = manualById.get(link.manual);
      if (!m) continue;
      for (const evId of link.eventos) {
        if (!suggestedMatchByEventId.has(evId)) {
          suggestedMatchByEventId.set(evId, {
            manualId: m.id,
            manualDate: m.date.slice(0, 10),
            manualAmount: Number(m.amount),
            reason: link.reason,
          });
        }
      }
    }

    const filterAndEnrichPersisted = (list: SuggestedDividendItem[]) =>
      list
        .filter((item) => {
          const id = item.eventId ?? item.corporateDividendId ?? `${item.assetId}:${item.comDate}`;
          return !autoMatchedEventIds.has(id);
        })
        .map((item) => {
          const id = item.eventId ?? item.corporateDividendId ?? `${item.assetId}:${item.comDate}`;
          const match = suggestedMatchByEventId.get(id);
          return match ? { ...item, suggestedManualMatch: match } : item;
        });

    const reconciledAvailable = filterAndEnrichPersisted(persistedAvailable);
    const reconciledProjected = filterAndEnrichPersisted(persistedProjected);

    const shouldRunClientFallback = isDemoActive || userEvents.length === 0;
    const unmaterializedCorp = shouldRunClientFallback
      ? (corporateQuery.data ?? []).filter((c) => !handledCorpIds.has(c.id))
      : [];

    const clientFallback = shouldRunClientFallback
      ? calculateSuggestedDividends({
          corporateEvents: unmaterializedCorp,
          dismissals,
          assets,
          transactions,
          manualDividends,
          referenceDate,
          usdRate: fxRate,
          trackingStartDate,
        })
      : { available: [], projected: [] };

    const available = [...reconciledAvailable, ...clientFallback.available].sort((a, b) =>
      (b.paymentDate ?? b.comDate).localeCompare(a.paymentDate ?? a.comDate),
    );
    const projected = [...reconciledProjected, ...clientFallback.projected].sort((a, b) => {
      if (!a.paymentDate && !b.paymentDate) return a.comDate.localeCompare(b.comDate);
      if (!a.paymentDate) return 1;
      if (!b.paymentDate) return -1;
      return a.paymentDate.localeCompare(b.paymentDate);
    });

    let availBRLCents = 0;
    let availUSDCents = 0;
    let availConvertedBRLCents = 0;
    for (const item of available) {
      if (item.isOver120DaysWithoutPayment && !item.paymentDate) continue;
      const cents = Math.round(item.totalAmount * 100);
      if (item.currency === "USD") {
        availUSDCents += cents;
        availConvertedBRLCents += Math.round(cents * fxRate);
      } else {
        availBRLCents += cents;
      }
    }

    let projBRLCents = 0;
    let projUSDCents = 0;
    let projConvertedBRLCents = 0;
    for (const item of projected) {
      if (item.isOver120DaysWithoutPayment && !item.paymentDate) continue;
      const cents = Math.round(item.totalAmount * 100);
      if (item.currency === "USD") {
        projUSDCents += cents;
        projConvertedBRLCents += Math.round(cents * fxRate);
      } else {
        projBRLCents += cents;
      }
    }

    const totalAvailableBRLCents = availBRLCents + availConvertedBRLCents;
    const totalProjectedBRLCents = projBRLCents + projConvertedBRLCents;

    const provisionedSummary = summarizeProvisionedDividends(
      [...available, ...projected].map(suggestedDividendToSummaryItem),
      fxRate,
      { referenceDate, forecastMonth: referenceDate.slice(0, 7) },
    );

    const monthlyForecastTotalBRLCents = provisionedSummary.monthlyForecastBRLCents ?? 0;
    const monthlyForecast = {
      month: referenceDate.slice(0, 7),
      count: provisionedSummary.monthlyForecastCount ?? 0,
      totalBRLCents: monthlyForecastTotalBRLCents,
      totalBRL: monthlyForecastTotalBRLCents / 100,
      nativeBRLCents: provisionedSummary.monthlyForecastNativeBRLCents ?? 0,
      usdCents: provisionedSummary.monthlyForecastUSDCents ?? 0,
    };

    return {
      available,
      projected,
      recentlySettled,
      userEvents,
      assetsNeedingCalibration,
      trackingStartDate,
      totalAvailableAmount: totalAvailableBRLCents / 100,
      totalProjectedAmount: totalProjectedBRLCents / 100,
      totalAvailableBRL: availBRLCents / 100,
      totalAvailableUSD: availUSDCents / 100,
      totalProjectedBRL: projBRLCents / 100,
      totalProjectedUSD: projUSDCents / 100,
      usdRateUsed: fxRate,
      provisionedSummary,
      monthlyForecast,
    };
  }, [
    enabled,
    isLoading,
    isError,
    isDemoActive,
    fxRate,
    assetsNeedingCalibration,
    trackingStartDate,
    assetsQuery.data,
    transactionsQuery.data,
    manualDividendsQuery.data,
    dismissalsQuery.data,
    userEventsQuery.data,
    corporateQuery.data,
  ]);

  return {
    ...stateResult,
    pendingConfirmation: stateResult.available,
    provisioned: stateResult.projected,
    fxRate,
    isLoading,
    isError,
    refetch,
  };
}
