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
  FALLBACK_USD_RATE,
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isPrivateFixedIncomeTicker,
  isTesouroAsset,
  suggestedDividendToSummaryItem,
  summarizeProvisionedDividends,
  todaySaoPauloISO,
  usdRateFromPrices,
  type ProvisionedDividendsSummary,
  type SuggestedDividendItem,
  type SuggestedDividendsResult,
} from "@/domain/portfolio";
import { useDemoSession } from "@/state/demo-mode";
import type { UserDividendEvent } from "@/types";
import { useAssetPrices } from "./use-asset-prices";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
} from "./use-portfolio";

export const CORPORATE_DIVIDENDS_QUERY_KEY = ["corporate_dividends"] as const;
export const PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY = ["portfolio_dividend_dismissals"] as const;
export const USER_DIVIDEND_EVENTS_QUERY_KEY = ["user_dividend_events"] as const;

export interface UseCorporateDividendsState extends SuggestedDividendsResult {
  pendingConfirmation: SuggestedDividendItem[];
  provisioned: SuggestedDividendItem[];
  recentlySettled: UserDividendEvent[];
  userEvents: UserDividendEvent[];
  provisionedSummary: ProvisionedDividendsSummary;
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

function mapUserEventToSuggestedItem(
  ev: UserDividendEvent,
  referenceDate: string,
): SuggestedDividendItem {
  const paymentDateClean = ev.payment_date ? ev.payment_date.slice(0, 10) : null;
  const isAvailable =
    ev.status === "PENDING_CONFIRMATION" ||
    (ev.status === "PROVISIONED" &&
      paymentDateClean !== null &&
      paymentDateClean <= referenceDate);

  return {
    corporateDividendId: ev.corporate_dividend_id ?? ev.id,
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
    provider: ev.is_manual ? "manual" : ev.is_type_uncertain ? "yahoo" : "brapi",
    isTypeUncertain: Boolean(ev.is_type_uncertain),
    isManual: Boolean(ev.is_manual),
  };
}

/** Lista eventos persistidos de proventos do usuário (`user_dividend_events`). */
export function useUserDividendEvents() {
  const { isDemoActive } = useDemoSession();
  return useQuery({
    queryKey: USER_DIVIDEND_EVENTS_QUERY_KEY,
    queryFn: () => listUserDividendEvents(),
    enabled: !isDemoActive,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCorporateDividends(): UseCorporateDividendsState {
  const { isDemoActive } = useDemoSession();
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const manualDividendsQuery = usePortfolioDividends();
  const assetPricesQuery = useAssetPrices();

  const portfolioTickers = useMemo(() => {
    const tickers = new Set<string>();
    for (const a of assetsQuery.data ?? []) {
      if (Number(a.quantity) <= 0) continue;
      if (isCashAssetClass(a.asset_class)) continue;
      if (isFixedIncomeClass(a.asset_class) && !isTesouroAsset(a.ticker, a.asset_class)) continue;
      if (isPrivateFixedIncomeTicker(a.ticker) || isCustomValuationAsset(a)) continue;
      if (isTesouroAsset(a.ticker, a.asset_class)) continue;
      const clean = a.ticker.trim().toUpperCase();
      if (clean) tickers.add(clean);
    }
    return Array.from(tickers).sort();
  }, [assetsQuery.data]);

  const corporateQuery = useQuery({
    queryKey: [...CORPORATE_DIVIDENDS_QUERY_KEY, portfolioTickers.join(",")],
    queryFn: () => listCorporateDividends(portfolioTickers),
    enabled: !assetsQuery.isLoading && portfolioTickers.length > 0,
    staleTime: 1000 * 60 * 15, // 15 minutos
  });

  const dismissalsQuery = useQuery({
    queryKey: PORTFOLIO_DIVIDEND_DISMISSALS_QUERY_KEY,
    queryFn: () => listPortfolioDividendDismissals(),
    enabled: !isDemoActive,
    staleTime: 1000 * 60 * 5,
  });

  const userEventsQuery = useUserDividendEvents();

  const fxRate = useMemo(() => {
    const consolidated = consolidateAssetPrices(assetPricesQuery.data ?? []);
    return usdRateFromPrices(consolidated, FALLBACK_USD_RATE);
  }, [assetPricesQuery.data]);

  const isLoading =
    assetsQuery.isLoading ||
    transactionsQuery.isLoading ||
    manualDividendsQuery.isLoading ||
    (!assetsQuery.isLoading && portfolioTickers.length > 0 && corporateQuery.isLoading) ||
    (!isDemoActive && (dismissalsQuery.isLoading || userEventsQuery.isLoading));

  const isError =
    assetsQuery.isError ||
    transactionsQuery.isError ||
    manualDividendsQuery.isError ||
    corporateQuery.isError ||
    (!isDemoActive && (dismissalsQuery.isError || userEventsQuery.isError));

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

    if (isLoading || isError) {
      return {
        available: [] as SuggestedDividendItem[],
        projected: [] as SuggestedDividendItem[],
        recentlySettled: [] as UserDividendEvent[],
        userEvents: [] as UserDividendEvent[],
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

    // Corporativos já materializados em `user_dividend_events` não duplicam na fallback client-side
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
        const refDay = (ev.payment_date ?? ev.updated_at ?? ev.com_date).slice(0, 10);
        if (refDay >= recentSettledCutoff) {
          recentlySettled.push(ev);
        }
        continue;
      }
      if (ev.status === "DISMISSED") continue;

      const mapped = mapUserEventToSuggestedItem(ev, referenceDate);
      if (mapped.totalAmount <= 0) continue;
      if (mapped.status === "available") {
        persistedAvailable.push(mapped);
      } else {
        persistedProjected.push(mapped);
      }
    }

    const unmaterializedCorp = (corporateQuery.data ?? []).filter(
      (c) => !handledCorpIds.has(c.id),
    );

    const clientFallback = calculateSuggestedDividends({
      corporateEvents: unmaterializedCorp,
      dismissals,
      assets,
      transactions,
      manualDividends,
      referenceDate,
      usdRate: fxRate,
    });

    const available = [...persistedAvailable, ...clientFallback.available].sort((a, b) =>
      (b.paymentDate ?? b.comDate).localeCompare(a.paymentDate ?? a.comDate),
    );
    const projected = [...persistedProjected, ...clientFallback.projected].sort((a, b) => {
      if (!a.paymentDate && !b.paymentDate) return a.comDate.localeCompare(b.comDate);
      if (!a.paymentDate) return 1;
      if (!b.paymentDate) return -1;
      return a.paymentDate.localeCompare(b.paymentDate);
    });

    let availBRLCents = 0;
    let availUSDCents = 0;
    for (const item of available) {
      const cents = Math.round(item.totalAmount * 100);
      if (item.currency === "USD") availUSDCents += cents;
      else availBRLCents += cents;
    }

    let projBRLCents = 0;
    let projUSDCents = 0;
    for (const item of projected) {
      const cents = Math.round(item.totalAmount * 100);
      if (item.currency === "USD") projUSDCents += cents;
      else projBRLCents += cents;
    }

    const totalAvailableBRLCents = availBRLCents + Math.round(availUSDCents * fxRate);
    const totalProjectedBRLCents = projBRLCents + Math.round(projUSDCents * fxRate);

    const provisionedSummary = summarizeProvisionedDividends(
      [...available, ...projected].map(suggestedDividendToSummaryItem),
      fxRate,
    );

    return {
      available,
      projected,
      recentlySettled,
      userEvents,
      totalAvailableAmount: totalAvailableBRLCents / 100,
      totalProjectedAmount: totalProjectedBRLCents / 100,
      totalAvailableBRL: availBRLCents / 100,
      totalAvailableUSD: availUSDCents / 100,
      totalProjectedBRL: projBRLCents / 100,
      totalProjectedUSD: projUSDCents / 100,
      usdRateUsed: fxRate,
      provisionedSummary,
    };
  }, [
    isLoading,
    isError,
    isDemoActive,
    fxRate,
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
