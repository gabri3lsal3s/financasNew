/**
 * Stale Quote Guard — Guarda de Consistência Temporal para Cotações e Câmbio (Bloco B).
 *
 * Detecta de forma 100% pura (sem UI/Supabase):
 *   1. `missing_or_fallback`: ativo cotado em bolsa sem preço de API válido (usando fallback/PM);
 *   2. `post_trade_stale`: operação registrada em D+0 (America/Sao_Paulo) cujo cache ainda
 *      aponta para pregão anterior ou timestamp nulo;
 *   3. `stale_market_data`: cotação API defasada em > 1 dia útil do respectivo mercado
 *      (B3 / ANBIMA para BR; NYSE / NASDAQ com DST para US) ou > 24h para CRYPTO;
 *   4. `fxWarning`: alerta explícito quando houver custódia em USD usando taxa estimada
 *      (fallback) ou câmbio API defasado (> 1 dia útil BR em relação ao último fechamento BCB).
 */

import type { PortfolioAsset, PortfolioTransaction } from "@/types";
import type { CanonicalFxMetadata } from "./canonical-types";
import {
  classifyTickerMarket,
  countMarketBusinessDays,
  getLastMarketCloseUtc,
  getMarketTimeZone,
  getMarketZonedParts,
  isBusinessDayForMarket,
  type QuoteMarket,
} from "./market-calendar";
import { isPrivateFixedIncomeTicker, normalizeTesouroTicker } from "./quotes";
import {
  isCashAssetClass,
  isCustomValuationAsset,
  isFixedIncomeClass,
  isTesouroAsset,
  FALLBACK_USD_RATE,
} from "./valuation";

export type StaleQuoteIssueKind =
  | "post_trade_stale"
  | "missing_or_fallback"
  | "stale_market_data";

export interface StaleQuoteGuardRowLike {
  assetId?: string;
  ticker: string;
  assetClass?: string | null;
  currency?: string | null;
  quantity: number;
  priceBRL?: number;
  currentPrice?: number;
  valueBRL?: number;
  source?: string | null;
  isEstimate?: boolean;
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
  isCash?: boolean;
  pricingMode?: string | null;
  notes?: string | null;
  fixedIncomeMetadata?: unknown;
}

export interface StaleQuoteAssetIssue {
  assetId?: string;
  ticker: string;
  market: QuoteMarket;
  kind: StaleQuoteIssueKind;
  marketPriceAt: string | null;
  provider: string | null;
  latestTradeDate: string | null;
  message: string;
}

export interface StaleQuoteGuardResult {
  issues: StaleQuoteAssetIssue[];
  postTradeStaleTickers: string[];
  fallbackTickers: string[];
  staleMarketTickers: string[];
  hasPostTradeStale: boolean;
  hasFallback: boolean;
  hasStaleMarketData: boolean;
  fxWarning: string | null;
  hasAnyIssue: boolean;
  issueByTicker: Record<string, StaleQuoteAssetIssue>;
}

const CRYPTO_STALE_MS = 24 * 60 * 60 * 1000;
const TRADE_TX_TYPES = new Set(["buy", "sell", "subscription"]);

/** Retorna o rótulo legível da procedência real da taxa de câmbio USD/BRL. */
export function formatFxSourceLabel(fxMetadata?: CanonicalFxMetadata | null): string {
  if (!fxMetadata || fxMetadata.isFallback || fxMetadata.source === "fallback") {
    return "Taxa Estimada (Fallback)";
  }
  if (fxMetadata.source === "manual" || fxMetadata.provider === "manual") {
    return "Câmbio Manual";
  }
  if (fxMetadata.source === "closing_saved") {
    return "Fechamento Salvo";
  }
  const provider = (fxMetadata.provider ?? "").toLowerCase().trim();
  if (provider === "bcb_ptax") return "PTAX Oficial BCB";
  if (provider === "yahoo") return "Yahoo Finance";
  if (provider === "awesomeapi") return "AwesomeAPI";
  return "Cotação API";
}

/** Formata um instante ISO UTC no fuso oficial de Brasília (`DD/MM/YYYY HH:mm`). */
export function formatMarketReferenceTimestampBR(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const parts = getMarketZonedParts(new Date(ms), "America/Sao_Paulo");
  const d = String(parts.day).padStart(2, "0");
  const m = String(parts.month).padStart(2, "0");
  const hh = String(parts.hour).padStart(2, "0");
  const min = String(parts.minute).padStart(2, "0");
  return `${d}/${m}/${parts.year} ${hh}:${min}`;
}

function toBrIsoDate(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return getMarketZonedParts(new Date(ms), "America/Sao_Paulo").isoDate;
}

function toMarketIsoDate(iso: string | null | undefined, market: QuoteMarket): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return getMarketZonedParts(new Date(ms), getMarketTimeZone(market)).isoDate;
}

function hasMarketOpenedToday(market: QuoteMarket, now: Date): boolean {
  if (market === "CRYPTO") return true;
  const tz = getMarketTimeZone(market);
  const zoned = getMarketZonedParts(now, tz);
  if (!isBusinessDayForMarket(zoned.isoDate, market)) return false;
  const minutes = zoned.hour * 60 + zoned.minute;
  if (market === "US") return minutes >= 9 * 60 + 25;
  if (market === "FX") return minutes >= 9 * 60;
  return minutes >= 9 * 60 + 55;
}

function shouldSkipRow(row: StaleQuoteGuardRowLike): boolean {
  if ((Number(row.quantity) || 0) <= 0) return true;
  if (row.isCash) return true;
  if (row.pricingMode === "cash" || row.pricingMode === "total_value") return true;
  if (row.fixedIncomeMetadata != null) return true;

  const ticker = row.ticker.trim().toUpperCase();
  if (
    !ticker ||
    ticker === "CAIXA" ||
    ticker === "CASH" ||
    ticker.startsWith("CAIXA_") ||
    ticker.startsWith("CASH_")
  ) {
    return true;
  }

  if (isCashAssetClass(row.assetClass ?? null)) return true;
  if (isFixedIncomeClass(row.assetClass ?? null) && !isTesouroAsset(ticker, row.assetClass)) {
    return true;
  }
  if (isPrivateFixedIncomeTicker(ticker)) return true;
  if (isTesouroAsset(ticker, row.assetClass) || Boolean(normalizeTesouroTicker(ticker))) {
    return true;
  }
  if (isCustomValuationAsset({ ticker, asset_class: row.assetClass, notes: row.notes })) {
    return true;
  }
  if (row.source === "manual") return true;

  return false;
}

/**
 * Avalia integridade e frescor temporal das cotações e câmbio USD/BRL na custódia ativa.
 */
export function evaluateStaleQuoteGuard(params: {
  rows: readonly StaleQuoteGuardRowLike[];
  transactions?: readonly Pick<PortfolioTransaction, "asset_id" | "type" | "date">[];
  assets?: readonly Pick<PortfolioAsset, "id" | "ticker">[];
  fxMetadata?: CanonicalFxMetadata | null;
  now?: Date;
}): StaleQuoteGuardResult {
  const now = params.now ?? new Date();
  const todayBR = getMarketZonedParts(now, "America/Sao_Paulo").isoDate;

  // Mapeia última data civil de operação (compra/venda/subscrição) por asset_id e por ticker
  const tickerByAssetId = new Map<string, string>();
  for (const asset of params.assets ?? []) {
    tickerByAssetId.set(asset.id, asset.ticker.trim().toUpperCase());
  }

  const latestTradeByAssetId = new Map<string, string>();
  const latestTradeByTicker = new Map<string, string>();

  for (const tx of params.transactions ?? []) {
    if (!TRADE_TX_TYPES.has(tx.type)) continue;
    const txDate = (tx.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate)) continue;

    if (tx.asset_id) {
      const prevAssetDate = latestTradeByAssetId.get(tx.asset_id);
      if (!prevAssetDate || txDate > prevAssetDate) {
        latestTradeByAssetId.set(tx.asset_id, txDate);
      }
      const mappedTicker = tickerByAssetId.get(tx.asset_id);
      if (mappedTicker) {
        const prevTickerDate = latestTradeByTicker.get(mappedTicker);
        if (!prevTickerDate || txDate > prevTickerDate) {
          latestTradeByTicker.set(mappedTicker, txDate);
        }
      }
    }
  }

  const issues: StaleQuoteAssetIssue[] = [];
  const postTradeStaleTickers: string[] = [];
  const fallbackTickers: string[] = [];
  const staleMarketTickers: string[] = [];
  const issueByTicker: Record<string, StaleQuoteAssetIssue> = {};

  let hasUsdCustody = false;

  for (const row of params.rows) {
    if ((Number(row.quantity) || 0) > 0 && (row.currency ?? "BRL").toUpperCase() === "USD") {
      hasUsdCustody = true;
    }

    if (shouldSkipRow(row)) continue;

    const ticker = row.ticker.trim().toUpperCase();
    const market = classifyTickerMarket(ticker);
    const effectivePrice =
      row.priceBRL && row.priceBRL > 0
        ? row.priceBRL
        : row.currentPrice && row.currentPrice > 0
          ? row.currentPrice
          : row.valueBRL && row.valueBRL > 0 && row.quantity > 0
            ? row.valueBRL / row.quantity
            : 0;

    const latestTradeDate =
      (row.assetId ? latestTradeByAssetId.get(row.assetId) : undefined) ??
      latestTradeByTicker.get(ticker) ??
      null;

    // 1. Preço ausente ou fallback/estimado
    if (row.isEstimate === true || row.source === "fallback" || effectivePrice <= 0) {
      const issue: StaleQuoteAssetIssue = {
        assetId: row.assetId,
        ticker,
        market,
        kind: "missing_or_fallback",
        marketPriceAt: row.marketPriceAt ?? null,
        provider: row.provider ?? null,
        latestTradeDate,
        message: `${ticker}: cotação oficial indisponível no momento (valor estimado por fallback/preço médio).`,
      };
      issues.push(issue);
      fallbackTickers.push(ticker);
      issueByTicker[ticker] = issue;
      continue;
    }

    // 2. Ordem D+0 sem cotação atualizada na data civil de Brasília (apenas após abertura do pregão no dia útil)
    if (latestTradeDate && latestTradeDate === todayBR && hasMarketOpenedToday(market, now)) {
      const priceDateBR = toBrIsoDate(row.marketPriceAt ?? null);
      if (!row.marketPriceAt || !priceDateBR || priceDateBR < latestTradeDate) {
        const issue: StaleQuoteAssetIssue = {
          assetId: row.assetId,
          ticker,
          market,
          kind: "post_trade_stale",
          marketPriceAt: row.marketPriceAt ?? null,
          provider: row.provider ?? null,
          latestTradeDate,
          message: `${ticker}: operação registrada hoje aguarda cotação do pregão atual (${priceDateBR ? `referência ${priceDateBR}` : "sem timestamp de mercado"}).`,
        };
        issues.push(issue);
        postTradeStaleTickers.push(ticker);
        issueByTicker[ticker] = issue;
        continue;
      }
    }

    // 3. Defasagem de mercado (> 1 dia útil do respectivo mercado para ações/B3/US; > 24h para Cripto; ou API sem timestamps)
    const refTimestamp = row.marketPriceAt ?? row.fetchedAt ?? null;
    if (!refTimestamp) {
      const issue: StaleQuoteAssetIssue = {
        assetId: row.assetId,
        ticker,
        market,
        kind: "stale_market_data",
        marketPriceAt: null,
        provider: row.provider ?? null,
        latestTradeDate,
        message: `${ticker}: cotação API sem timestamp de referência de mercado.`,
      };
      issues.push(issue);
      staleMarketTickers.push(ticker);
      issueByTicker[ticker] = issue;
      continue;
    }

    if (market === "CRYPTO") {
      const refMs = Date.parse(refTimestamp);
      if (!Number.isFinite(refMs) || now.getTime() - refMs > CRYPTO_STALE_MS) {
        const issue: StaleQuoteAssetIssue = {
          assetId: row.assetId,
          ticker,
          market,
          kind: "stale_market_data",
          marketPriceAt: row.marketPriceAt ?? null,
          provider: row.provider ?? null,
          latestTradeDate,
          message: `${ticker}: cotação cripto com mais de 24h sem atualização de mercado.`,
        };
        issues.push(issue);
        staleMarketTickers.push(ticker);
        issueByTicker[ticker] = issue;
      }
      continue;
    }

    const lastCloseUtc = getLastMarketCloseUtc(ticker, now);
    const priceDateLocal = toMarketIsoDate(refTimestamp, market);
    if (!priceDateLocal) {
      const issue: StaleQuoteAssetIssue = {
        assetId: row.assetId,
        ticker,
        market,
        kind: "stale_market_data",
        marketPriceAt: row.marketPriceAt ?? null,
        provider: row.provider ?? null,
        latestTradeDate,
        message: `${ticker}: timestamp de cotação inválido para verificação de frescor.`,
      };
      issues.push(issue);
      staleMarketTickers.push(ticker);
      issueByTicker[ticker] = issue;
      continue;
    }

    if (lastCloseUtc) {
      const lastClosedDateLocal = getMarketZonedParts(lastCloseUtc, getMarketTimeZone(market)).isoDate;
      if (countMarketBusinessDays(priceDateLocal, lastClosedDateLocal, market) > 1) {
        const issue: StaleQuoteAssetIssue = {
          assetId: row.assetId,
          ticker,
          market,
          kind: "stale_market_data",
          marketPriceAt: row.marketPriceAt ?? null,
          provider: row.provider ?? null,
          latestTradeDate,
          message: `${ticker}: cotação de mercado defasada (referência ${priceDateLocal}, último pregão encerrado ${lastClosedDateLocal}).`,
        };
        issues.push(issue);
        staleMarketTickers.push(ticker);
        issueByTicker[ticker] = issue;
      }
    }
  }

  // 4. Guarda cambial USD/BRL para custódia internacional
  let fxWarning: string | null = null;
  if (hasUsdCustody) {
    if (!params.fxMetadata || params.fxMetadata.isFallback || params.fxMetadata.source === "fallback") {
      fxWarning =
        "Taxa de câmbio USD/BRL em modo estimado (fallback). A conversão patrimonial em dólar pode divergir da PTAX oficial.";
    } else if (params.fxMetadata.source === "api") {
      const fxRefIso = params.fxMetadata.fxRateAt ?? params.fxMetadata.fetchedAt;
      const fxDateBR = toBrIsoDate(fxRefIso);
      const lastFxClose = getLastMarketCloseUtc("USDBRL=X", now);
      if (!fxRefIso || !fxDateBR) {
        fxWarning = "Taxa de câmbio USD/BRL sem timestamp de referência de mercado.";
      } else if (lastFxClose) {
        const lastFxDateBR = getMarketZonedParts(lastFxClose, "America/Sao_Paulo").isoDate;
        if (countMarketBusinessDays(fxDateBR, lastFxDateBR, "FX") > 1) {
          fxWarning = `Taxa de câmbio USD/BRL defasada (referência ${fxDateBR}, último fechamento ${lastFxDateBR}).`;
        }
      }
    }
  }

  const hasPostTradeStale = postTradeStaleTickers.length > 0;
  const hasFallback = fallbackTickers.length > 0;
  const hasStaleMarketData = staleMarketTickers.length > 0;

  return {
    issues,
    postTradeStaleTickers,
    fallbackTickers,
    staleMarketTickers,
    hasPostTradeStale,
    hasFallback,
    hasStaleMarketData,
    fxWarning,
    hasAnyIssue: issues.length > 0 || fxWarning !== null,
    issueByTicker,
  };
}

export interface MarketReferenceSummary {
  hasB3Custody: boolean;
  b3RefIso: string | null;
  b3RefLabel: string | null;
  hasForeignCustody: boolean;
  usdRefIso: string | null;
  usdRefLabel: string | null;
  fxRate: number;
  fxSourceLabel: string;
  fxRefIso: string | null;
  fxRefLabel: string | null;
}

/**
 * Resume de forma pura os timestamps de referência de cotações B3, Exterior USD
 * e Câmbio USD/BRL para exibição editorial em telas e cabeçalhos A4/PDF.
 */
export function buildMarketReferenceSummary(params: {
  rows: readonly StaleQuoteGuardRowLike[];
  fxMetadata?: CanonicalFxMetadata | null;
  usdRate?: number;
}): MarketReferenceSummary {
  let hasB3Custody = false;
  let hasForeignCustody = false;
  let maxB3Ms = -1;
  let b3RefIso: string | null = null;
  let maxUsdMs = -1;
  let usdRefIso: string | null = null;

  for (const row of params.rows) {
    if ((Number(row.quantity) || 0) <= 0) continue;
    const isUsd = (row.currency ?? "BRL").toUpperCase() === "USD";
    if (isUsd) {
      hasForeignCustody = true;
    }

    if (shouldSkipRow({ ...row, source: row.source === "manual" ? "api" : row.source })) {
      continue;
    }

    const market = classifyTickerMarket(row.ticker);
    if (!isUsd && market === "BR") {
      hasB3Custody = true;
    }

    if (row.source !== "api") continue;
    const refIso = row.marketPriceAt ?? row.fetchedAt ?? null;
    if (!refIso) continue;
    const ms = Date.parse(refIso);
    if (!Number.isFinite(ms)) continue;

    if (isUsd || market === "US") {
      if (ms > maxUsdMs) {
        maxUsdMs = ms;
        usdRefIso = refIso;
      }
    } else if (market === "BR" && ms > maxB3Ms) {
      maxB3Ms = ms;
      b3RefIso = refIso;
    }
  }

  const fxRate =
    params.fxMetadata?.rate && params.fxMetadata.rate > 0
      ? params.fxMetadata.rate
      : params.usdRate && params.usdRate > 0
        ? params.usdRate
        : FALLBACK_USD_RATE;

  const effectiveFxMetadata: CanonicalFxMetadata | null =
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
      : null);

  const fxRefIso = effectiveFxMetadata?.fxRateAt ?? effectiveFxMetadata?.fetchedAt ?? null;

  return {
    hasB3Custody,
    b3RefIso,
    b3RefLabel: formatMarketReferenceTimestampBR(b3RefIso),
    hasForeignCustody,
    usdRefIso,
    usdRefLabel: formatMarketReferenceTimestampBR(usdRefIso),
    fxRate,
    fxSourceLabel: formatFxSourceLabel(effectiveFxMetadata),
    fxRefIso,
    fxRefLabel: formatMarketReferenceTimestampBR(fxRefIso),
  };
}

export interface ReportPrintWarningSummary {
  title: string;
  description: string;
  confirmLabel: string;
}

/** Constrói mensagem unificada de confirmação pré-impressão quando há cotações/câmbio pendentes. */
export function buildReportPrintWarning(
  staleGuard?: StaleQuoteGuardResult | null,
): ReportPrintWarningSummary | null {
  if (!staleGuard || !staleGuard.hasAnyIssue) return null;

  const details: string[] = [];
  if (staleGuard.postTradeStaleTickers.length > 0) {
    details.push(
      `operações de hoje ainda sem cotação do pregão atual (${staleGuard.postTradeStaleTickers.join(", ")})`,
    );
  }
  if (staleGuard.fallbackTickers.length > 0) {
    details.push(
      `ativos com preço estimado por fallback (${staleGuard.fallbackTickers.join(", ")})`,
    );
  }
  if (staleGuard.staleMarketTickers.length > 0) {
    details.push(
      `ativos com cotação defasada acima de 1 pregão (${staleGuard.staleMarketTickers.join(", ")})`,
    );
  }
  if (staleGuard.fxWarning) {
    details.push("câmbio USD/BRL em fallback ou defasado");
  }

  return {
    title: "Emitir PDF com pendências de cotação?",
    description: `Foram detectados ${details.join("; ")}. Você pode emitir o relatório agora mesmo assim ou cancelar e aguardar a sincronização.`,
    confirmLabel: "Emitir PDF mesmo assim",
  };
}
