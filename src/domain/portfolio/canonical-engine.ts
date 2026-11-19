/**
 * Canonical Engine — Motor Unificado de Valoração, Ponto-no-Tempo e Carteira 360° (§Fase 40).
 *
 * Consolidação canônica que unifica os submotores de investimentos:
 *   • Modo "instant": Valoração instantânea da carteira viva em O(1);
 *   • Modo "point_in_time": Reconstrução cronológica retroativa imune a distorções;
 *   • Homogeneidade temporal de bases contábeis (Salvaguarda S9);
 *   • Tolerância soberana de fidelidade de 3% (Salvaguarda S10);
 *   • Resolução cambial PTAX dinâmica via USDBRL=X (Salvaguarda S12);
 *   • Preservação de Custo Total em splits/reverse splits (Salvaguarda S17);
 *   • Blindagem contra fallback zero em ativos não cotados (Salvaguarda S7);
 *   • Segregação multimoeda e fechamento ao centavo (Salvaguardas S14 e S15).
 *
 * Módulo puramente algorítmico, sem dependências de React, TanStack Query ou Supabase.
 * Cumpre todas as regras do AGENTS.md e do FINANCIAL_MATH_SPEC.md.
 */

import type {
  AssetCurrency,
  MonthlyPriceRow,
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioMonthlyPrice,
  PortfolioSnapshot,
  PortfolioTransaction,
} from "@/types";
import {
  computeCanonicalAssetLedger,
  normalizeCutoffDate,
  reconcilePortfolioEvents,
  resolveDynamicPtaxRate,
  type CanonicalReconciledDividend,
  type CanonicalReconciledFlow,
  type CanonicalReconciledTransaction,
} from "./canonical-normalizer";
import {
  calculateCanonicalTwrSeries,
  calculateCanonicalXirr,
  calculateHomogeneousMonthlyStatement,
  evaluateCanonicalFidelity,
  getPreviousMonthISO,
  getSnapshotEffectiveCost,
  getSnapshotEffectiveValue,
} from "./canonical-returns";
import {
  type CanonicalAssetHolding,
  type CanonicalFidelityReport,
  type CanonicalMonthlyStatement,
  type CanonicalPortfolioState,
  type CanonicalPricingMode,
  type CanonicalResolvedPrice,
  createCanonicalAssetHolding,
  createCanonicalPortfolioState,
  DEFAULT_CANONICAL_TWR,
} from "./canonical-types";
import {
  calculateFixedIncomeBalance,
  type FixedIncomeBalanceResult,
} from "./fixed-income";
import {
  resolveHistoricalQuotePriority,
  type ResolvedHistoricalQuote,
} from "./historical-quotes";
import { isHistoricalWithdrawal } from "./irr";
import { extractExplicitRateFromNotes } from "./statement-parser";
import {
  annualizeRateFromMonths,
  type TwrCashFlowItem,
  type TwrConsolidatedResult,
  type TwrMonthlyInputPoint,
  type TwrMonthlyPointResult,
} from "./twr";
import {
  FALLBACK_USD_RATE,
  fallbackPriceFor,
  isCashAssetClass,
  isCustomValuationAsset,
  resolvePrice,
  usdRateFromPrices,
  type PriceCandidate,
} from "./valuation";
import {
  buildPortfolioMonthlySeries,
  type PortfolioMonthlySeriesPoint,
} from "./summary";
import { resolveFixedIncomeIndexer } from "./tickers-catalog";

// ---------------------------------------------------------------------------
// Arredondamentos e Auxiliares
// ---------------------------------------------------------------------------

const round2 = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const round4 = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000;

// ---------------------------------------------------------------------------
// Contratos de Entrada do Motor Canônico
// ---------------------------------------------------------------------------

export interface CanonicalAssetPriceItem {
  ticker: string;
  price: number;
  currency?: AssetCurrency;
  source?: "api" | "fallback" | "manual" | string;
  manual_price?: number | null;
}

export interface CanonicalEngineParams {
  /** Data civil ou competência de avaliação (YYYY-MM-DD ou YYYY-MM). */
  asOfDate: string;
  /** Modo de apuração: "instant" para mês corrente O(1); "point_in_time" para competências passadas. */
  mode?: "instant" | "point_in_time";
  /** Ativos cadastrados na custódia (portfolio_assets). */
  assets: readonly PortfolioAsset[];
  /** Transações do ledger (portfolio_transactions). */
  transactions?: readonly PortfolioTransaction[];
  /** Aportes e retiradas do bolso (portfolio_contributions). */
  contributions?: readonly PortfolioContribution[];
  /** Proventos registrados (portfolio_dividends). */
  dividends?: readonly PortfolioDividend[];
  /** Cotações históricas mensais salvas (portfolio_monthly_prices). */
  monthlyPrices?: readonly PortfolioMonthlyPrice[];
  /** Snapshots patrimoniais arquivados (portfolio_snapshots). */
  snapshots?: readonly PortfolioSnapshot[];
  /** Snapshot consolidado da competência atual (override ou modo isolado). */
  snapshot?: PortfolioSnapshot | null;
  /** Snapshot da competência anterior M-1 (override ou modo isolado). */
  previousSnapshot?: PortfolioSnapshot | null;
  /** Saldo patrimonial inicial de fechamento do mês anterior M-1 em BRL. */
  startBalanceBRL?: number;
  /** Cache de cotações live/recentes em servidor ou API (ticker -> cotação ou array de cotações). */
  assetPrices?: Readonly<Record<string, number>> | readonly CanonicalAssetPriceItem[];
  /** Cotações buscadas sob demanda via API externa (ticker -> cotação). */
  apiPrices?: Readonly<Record<string, number>>;
  /** Taxa anual do CDI (%) vigente ou de fechamento (padrão: 10.5). */
  annualCdiRate?: number;
  /** Saldo de caixa declarado ou de override direto em BRL. */
  cashBalance?: number;
  /** Taxa explícita de câmbio USD/BRL (se omitida, resolvida dinamicamente via PTAX). */
  usdRate?: number;
  /** Taxa explícita de retorno do mês (% informada em nota de corretagem). */
  explicitRatePct?: number | null;
  /** Se deve desativar a memoização em memória para testes unitários ou auditorias forçadas. */
  disableMemoization?: boolean;
}

export interface CandidateAssetItem {
  ticker: string;
  assetClass: string | null;
  currency: AssetCurrency;
  quantity: number;
  priceQuote: number;
  priceBRL: number;
  valueBRL: number;
  source: string;
  isEstimate: boolean;
}

export interface CanonicalEngineResult extends CanonicalPortfolioState {
  /** Extrato isolado da competência mensal (Modified Dietz homogêneo). */
  monthlyStatement?: CanonicalMonthlyStatement;
  /** Diagnóstico completo de integridade e fidelidade patrimonial. */
  fidelity?: CanonicalFidelityReport;
  /** Lista de ativos candidatos avaliados (para editor de fechamento e auditoria). */
  candidateAssets?: CandidateAssetItem[];
  /** Série mensal a partir de snapshots com proventos integrados (F36 & F37). */
  monthlySeries: PortfolioMonthlySeriesPoint[];
  /** Série mensal completa histórica sem limite de meses. */
  allMonthlySeries: PortfolioMonthlySeriesPoint[];
  /** Sinaliza se a síntese patrimonial executiva adotou soberanamente o snapshot oficial. */
  isDerivedFromSnapshot?: boolean;
  /** Data civil de corte efetiva aplicada (YYYY-MM-DD). */
  cutoffDate: string;
  /** Competência mensal referente ao corte (YYYY-MM). */
  month: string;
  /** Saldo de caixa total segregado em BRL. */
  cashTotal: number;
  /** Proventos recebidos no mês da competência em BRL. */
  monthDividends: number;
  /** Alias para holdings (interoperabilidade com PointInTimeResult). */
  positions: CanonicalAssetHolding[];
}

// ---------------------------------------------------------------------------
// Cache de Memoização em Memória para Competências Históricas Fechadas
// ---------------------------------------------------------------------------

interface MemoizedEngineCacheEntry {
  result: CanonicalEngineResult;
  timestamp: number;
  assetsLength: number;
  transactionsLength: number;
  monthlyPricesLength: number;
  snapshotsLength: number;
}

const memoizedEngineCache = new Map<string, MemoizedEngineCacheEntry>();

function getMemoCacheKey(month: string, asOfDate: string): string {
  return `${month}:${asOfDate}`;
}

export function clearCanonicalEngineCache(): void {
  memoizedEngineCache.clear();
}

// ---------------------------------------------------------------------------
// Execução do Motor Canônico
// ---------------------------------------------------------------------------

/**
 * Avalia o estado patrimonial e contábil da carteira de forma unificada e puramente determinística.
 *
 * Características:
 * - Modo "instant": Tempo de execução O(1), perfeito para renderização fluida da Home a 60 FPS;
 * - Modo "point_in_time": Reconstrução cronológica precisa com salvaguarda antiestouro de Dietz (-3,6% em Out/2026);
 * - Homogeneidade estrita de bases contábeis (Salvaguarda S9);
 * - Tolerância soberana de fidelidade de 3% (Salvaguarda S10);
 * - Câmbio PTAX dinâmico para ativos em USD (Salvaguarda S12);
 * - Conservação exata do Custo Total em desdobramentos (Salvaguarda S17);
 * - Imunidade a divisão por zero e ausência de cotações em ativos não cotados (Salvaguardas S7 e S11).
 */
export function evaluatePortfolioCanonicalState(
  params: CanonicalEngineParams,
): CanonicalEngineResult {
  const asOfDateRaw = params.asOfDate.trim();
  const cutoffDate = normalizeCutoffDate(asOfDateRaw);
  const month = cutoffDate ? cutoffDate.slice(0, 7) : asOfDateRaw.slice(0, 7);
  const mode = params.mode ?? "instant";

  // Verificação de cache para competências passadas
  const cacheKey = getMemoCacheKey(month, cutoffDate);
  if (!params.disableMemoization && mode === "point_in_time") {
    const cached = memoizedEngineCache.get(cacheKey);
    if (
      cached &&
      cached.assetsLength === params.assets.length &&
      cached.transactionsLength === (params.transactions?.length ?? 0) &&
      cached.monthlyPricesLength === (params.monthlyPrices?.length ?? 0) &&
      cached.snapshotsLength === (params.snapshots?.length ?? 0)
    ) {
      return cached.result;
    }
  }

  // 1. Resolução Dinâmica de Câmbio PTAX (USDBRL=X) (§Salvaguarda S12)
  const livePriceUsd = params.assetPrices ? usdRateFromPrices(params.assetPrices) : undefined;
  const liveRate = livePriceUsd && livePriceUsd !== FALLBACK_USD_RATE ? livePriceUsd : undefined;

  const effectiveUsdRate = resolveDynamicPtaxRate(
    params.monthlyPrices,
    month,
    {
      explicitRate: params.usdRate,
      preferExplicitOverSaved: Boolean(params.usdRate && params.usdRate !== FALLBACK_USD_RATE),
      liveRate,
      fallbackRate: FALLBACK_USD_RATE,
    },
  );

  const annualCdiRate = params.annualCdiRate ?? 10.5;

  // 2. Execução Segregada por Modo
  let engineResult: CanonicalEngineResult;

  if (mode === "instant") {
    engineResult = evaluateInstantState({
      ...params,
      asOfDate: cutoffDate,
      effectiveUsdRate,
      annualCdiRate,
      month,
    });
  } else {
    engineResult = evaluatePointInTimeState({
      ...params,
      asOfDate: cutoffDate,
      cutoffDate,
      effectiveUsdRate,
      annualCdiRate,
      month,
    });
  }

  // Armazena em cache de memoização para point_in_time
  if (!params.disableMemoization && mode === "point_in_time") {
    memoizedEngineCache.set(cacheKey, {
      result: engineResult,
      timestamp: Date.now(),
      assetsLength: params.assets.length,
      transactionsLength: params.transactions?.length ?? 0,
      monthlyPricesLength: params.monthlyPrices?.length ?? 0,
      snapshotsLength: params.snapshots?.length ?? 0,
    });
  }

  return engineResult;
}

// ---------------------------------------------------------------------------
// Submotor: Valoração Instantânea O(1) (Modo "instant")
// ---------------------------------------------------------------------------

interface InternalInstantParams extends CanonicalEngineParams {
  effectiveUsdRate: number;
  annualCdiRate: number;
  month: string;
}

function evaluateInstantState(params: InternalInstantParams): CanonicalEngineResult {
  const {
    asOfDate,
    assets,
    effectiveUsdRate,
    annualCdiRate,
    month,
    apiPrices = {},
  } = params;

  const livePriceMap: Record<string, number> = {};
  if (Array.isArray(params.assetPrices)) {
    for (const p of params.assetPrices) {
      if (p.ticker && typeof p.price === "number") {
        livePriceMap[p.ticker.toUpperCase().trim()] = p.price;
      }
    }
  } else if (params.assetPrices) {
    for (const [k, v] of Object.entries(params.assetPrices)) {
      if (typeof v === "number") {
        livePriceMap[k.toUpperCase().trim()] = v;
      }
    }
  }

  // 1. Reconciliação Determinística de Eventos (instant mode)
  const reconciliation = reconcilePortfolioEvents({
    transactions: params.transactions ?? [],
    contributions: params.contributions ?? [],
    dividends: params.dividends ?? [],
    assets,
    asOfDate,
    usdRate: effectiveUsdRate,
    monthlyPrices: params.monthlyPrices,
  });

  const holdings: CanonicalAssetHolding[] = [];
  const candidateAssets: CandidateAssetItem[] = [];

  for (const asset of assets) {
    const rawClass = (asset.asset_class ?? "").toLowerCase().trim();
    const tickerUpper = asset.ticker.toUpperCase().trim();
    const currency = asset.currency ?? "BRL";

    const isCash =
      isCashAssetClass(asset.asset_class) ||
      rawClass.includes("caixa") ||
      rawClass.includes("reserva") ||
      rawClass.includes("cash") ||
      tickerUpper === "CAIXA" ||
      tickerUpper === "CASH" ||
      tickerUpper.startsWith("CASH_") ||
      tickerUpper.startsWith("CAIXA_");

    if (isCash) {
      const qty = Number(asset.quantity) || 0;
      const holding = createCanonicalAssetHolding({
        assetId: asset.id,
        ticker: tickerUpper,
        assetClass: asset.asset_class ?? "Caixa / Reserva",
        sector: asset.sector,
        currency,
        quantity: qty,
        averageCost: 1.0,
        totalCost: qty,
        averageCostBRL: currency === "USD" ? effectiveUsdRate : 1.0,
        totalCostBRL: currency === "USD" ? round2(qty * effectiveUsdRate) : qty,
        resolvedPrice: {
          ticker: tickerUpper,
          priceQuote: 1.0,
          priceBRL: currency === "USD" ? effectiveUsdRate : 1.0,
          usdRate: currency === "USD" ? effectiveUsdRate : 1.0,
          source: "cash",
          isEstimate: false,
          asOfDate,
          badgeLabel: "Caixa 1:1",
        },
        accumulatedDividendsBRL: Number(asset.accumulated_dividends) || 0,
        pricingMode: "cash",
        isCash: true,
        notes: asset.notes,
      });
      holdings.push(holding);
      continue;
    }

    // Resolução de Preço e Modo de Precificação (§Salvaguardas S5 e S7)
    const fiMeta = asset.fixed_income_metadata;
    const isFixedIncome =
      rawClass.includes("renda fixa") ||
      rawClass.includes("tesouro") ||
      Boolean(fiMeta);

    const allAssetTxs = (params.transactions ?? []).filter((t) => t.asset_id === asset.id);
    const assetLedger = allAssetTxs.length > 0
      ? computeCanonicalAssetLedger(allAssetTxs, undefined, {
          currency,
          monthlyPrices: params.monthlyPrices,
          defaultFxRate: effectiveUsdRate,
          assetFxRateAtPurchase: asset.fx_rate_at_purchase,
          isFixedIncome,
          fixedIncomeMetadata: fiMeta,
        })
      : null;
    const realizedPnl = assetLedger ? assetLedger.realizedPnl : undefined;

    const quantity = Math.max(0, Number(asset.quantity) || 0);
    const averageCost = Math.max(0, Number(asset.average_price) || 0);
    const totalCost = round2(quantity * averageCost);
    const assetUsdRate = currency === "USD" ? effectiveUsdRate : 1.0;

    let totalCostBRL: number;
    let averageCostBRL: number;

    if (currency === "USD") {
      if (assetLedger && assetLedger.quantity > 0 && assetLedger.totalCostBRL > 0) {
        totalCostBRL = assetLedger.totalCostBRL;
        averageCostBRL = assetLedger.averageCostBRL;
      } else if (asset.total_cost_brl != null && asset.total_cost_brl > 0) {
        const candidateCostBRL = round2(asset.total_cost_brl);
        // Salvaguarda cambial v5: detecção de custo USD corrompido em BRL (< 3.5x) restaurando PTAX histórica
        const isCorrupted = totalCost > 0 && candidateCostBRL < totalCost * 3.5;
        const snapshotRate = (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot;
        const purchaseRate = asset.fx_rate_at_purchase && asset.fx_rate_at_purchase > 1
          ? asset.fx_rate_at_purchase
          : snapshotRate && snapshotRate > 1
            ? snapshotRate
            : effectiveUsdRate;
        totalCostBRL = isCorrupted ? round2(totalCost * purchaseRate) : candidateCostBRL;
        averageCostBRL = quantity > 0
          ? (asset.average_cost_brl && asset.average_cost_brl >= averageCost * 3.5 && !isCorrupted
              ? asset.average_cost_brl
              : round4(totalCostBRL / quantity))
          : 0;
      } else if (asset.fx_rate_at_purchase != null && asset.fx_rate_at_purchase > 0) {
        totalCostBRL = round2(totalCost * asset.fx_rate_at_purchase);
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      } else if ((asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot != null && (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot! > 0) {
        const snapRate = (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot!;
        totalCostBRL = round2(totalCost * snapRate);
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      } else if (asset.average_cost_brl != null && asset.average_cost_brl > 0) {
        totalCostBRL = round2(quantity * asset.average_cost_brl);
        averageCostBRL = asset.average_cost_brl;
      } else {
        totalCostBRL = round2(totalCost * (asset.fx_rate_at_purchase ?? effectiveUsdRate));
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      }
    } else {
      totalCostBRL = totalCost;
      averageCostBRL = averageCost;
    }
      Boolean(fiMeta);

    let resolvedPrice: CanonicalResolvedPrice;
    let fixedIncomeResult: FixedIncomeBalanceResult | null = null;
    let pricingMode: CanonicalPricingMode = "unit_price";

    if (isFixedIncome && fiMeta) {
      pricingMode = "total_value";
      fixedIncomeResult = calculateFixedIncomeBalance({
        baseValue: fiMeta.base_value ?? averageCost,
        baseDate: fiMeta.base_date,
        initialInvestmentDate: fiMeta.initial_investment_date,
        maturityDate: fiMeta.maturity_date,
        rateType: fiMeta.rate_type,
        rateValue: fiMeta.rate_value,
        isTaxExempt: fiMeta.is_tax_exempt,
        manualTaxRatePct: fiMeta.manual_tax_rate_pct,
        annualCdiRate,
        today: asOfDate,
      });
      const grossVal = fixedIncomeResult.grossValue;
      const unitPriceBRL = quantity > 0 ? grossVal / quantity : grossVal;

      const hasActiveRate = Boolean(fiMeta.rate_value && fiMeta.rate_value > 0);

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(unitPriceBRL),
        priceBRL: round4(unitPriceBRL),
        usdRate: 1.0,
        source: hasActiveRate ? "fixed_income" : "manual",
        isEstimate: !hasActiveRate,
        asOfDate,
        badgeLabel: hasActiveRate ? "Renda Fixa Atualizada" : "Saldo Manual",
      };
    } else {
      // Ativo de Renda Variável ou Alternativo
      const priceFromLive = apiPrices[tickerUpper] ?? livePriceMap[tickerUpper] ?? null;
      const fallbackPrice = fallbackPriceFor(currency);

      const candidate: PriceCandidate = {
        manualPrice: null,
        cachePrice: priceFromLive,
        fallbackPrice,
      };

      const resolved = resolvePrice(candidate);
      let quoteSource = resolved.source === "manual" ? "manual" : resolved.source === "api" ? "api" : "fallback";

      // Ativos não cotados com preço firme (Salvaguarda S7)
      if (quoteSource === "fallback" && averageCost > 0) {
        quoteSource = "custom_valuation";
        pricingMode = "custom_valuation";
      }

      const quotePrice = quoteSource === "custom_valuation" ? averageCost : resolved.price;
      const priceBRL = currency === "USD" ? round4(quotePrice * effectiveUsdRate) : round4(quotePrice);

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(quotePrice),
        priceBRL,
        usdRate: assetUsdRate,
        source: quoteSource as CanonicalResolvedPrice["source"],
        isEstimate: quoteSource === "fallback",
        asOfDate,
        badgeLabel: quoteSource === "api" ? "Oficial API" : quoteSource === "manual" ? "Manual" : "Sugerida",
      };
    }

    const holding = createCanonicalAssetHolding({
      assetId: asset.id,
      ticker: tickerUpper,
      assetClass: asset.asset_class,
      sector: isFixedIncome ? resolveFixedIncomeIndexer(asset).macroLabel : asset.sector,
      currency,
      quantity,
      averageCost,
      totalCost,
      averageCostBRL,
      totalCostBRL,
      resolvedPrice,
      accumulatedDividendsBRL:
        reconciliation.dividendsByAssetId.get(asset.id) ??
        (currency === "USD"
          ? round2((Number(asset.accumulated_dividends) || 0) * effectiveUsdRate)
          : Number(asset.accumulated_dividends) || 0),
      dividendsNative:
        reconciliation.dividendsNativeByAssetId.get(asset.id) ??
        (Number(asset.accumulated_dividends) || 0),
      realizedPnl,
      fixedIncomeMetadata: fiMeta,
      fixedIncomeResult,
      pricingMode,
      notes: asset.notes,
    });

    holdings.push(holding);

    candidateAssets.push({
      ticker: tickerUpper,
      assetClass: asset.asset_class,
      currency,
      quantity,
      priceQuote: resolvedPrice.priceQuote,
      priceBRL: resolvedPrice.priceBRL,
      valueBRL: holding.marketValueBRL,
      source: resolvedPrice.source,
      isEstimate: resolvedPrice.isEstimate,
    });
  }

  // Captura posições totalmente encerradas no passado a partir do ledger de transações
  const knownAssetIds = new Set(assets.map((a) => a.id));
  const orphanTxs = (params.transactions ?? []).filter((t) => t.asset_id && !knownAssetIds.has(t.asset_id));
  if (orphanTxs.length > 0) {
    const orphanMap = new Map<string, typeof orphanTxs>();
    for (const tx of orphanTxs) {
      const list = orphanMap.get(tx.asset_id) ?? [];
      list.push(tx);
      orphanMap.set(tx.asset_id, list);
    }
    for (const [orphanId, txs] of orphanMap.entries()) {
      const ledger = computeCanonicalAssetLedger(txs);
      holdings.push(
        createCanonicalAssetHolding({
          assetId: orphanId,
          ticker: "ENCERRADO",
          assetClass: "Encerrados",
          quantity: 0,
          averageCost: 0,
          totalCost: 0,
          averageCostBRL: 0,
          totalCostBRL: 0,
          resolvedPrice: {
            ticker: "ENCERRADO",
            priceQuote: 0,
            priceBRL: 0,
            usdRate: 1.0,
            source: "fallback",
            isEstimate: false,
            asOfDate,
          },
          accumulatedDividendsBRL: ledger.dividendsTotal,
          realizedPnl: ledger.realizedPnl,
          pricingMode: "unit_price",
        }),
      );
    }
  }

  // 4. Montagem do Estado Consolidado Inicial
  const baseState = createCanonicalPortfolioState({
    asOfDate,
    mode: "instant",
    usdRate: effectiveUsdRate,
    holdings,
    cashBRL: params.cashBalance ?? 0,
    closedSnapshotsCount: (params.snapshots ?? []).filter((s) => s.month < month).length,
  });

  // 5. Preparação da Série Mensal e Espinha Dorsal Contínua do Calendário
  const rawSnapshotsForSeries = (params.snapshots ?? []).map((s) => ({
    month: s.month,
    total_value: Number(s.total_value),
    total_cost: Number(s.total_cost),
    auto_total_value: s.auto_total_value != null ? Number(s.auto_total_value) : null,
    auto_total_cost: s.auto_total_cost != null ? Number(s.auto_total_cost) : null,
    manual_total_value: s.manual_total_value != null ? Number(s.manual_total_value) : null,
    manual_total_cost: s.manual_total_cost != null ? Number(s.manual_total_cost) : null,
    is_manually_calibrated: Boolean(s.is_manually_calibrated),
    calibrated_at: s.calibrated_at ?? null,
    status: s.status ?? "closed",
  }));

  const rawDividendsForSeries = reconciliation.dividends.map((d) => ({
    date: d.date,
    amount: d.amountBRL,
  }));

  const rawContributionsForSeries = reconciliation.externalFlows.map((c) => ({
    date: c.date,
    amount: c.amount,
    notes: c.notes,
  }));

  const firstSnapshotMonth = (params.snapshots ?? []).length > 0
    ? [...(params.snapshots ?? [])].sort((a, b) => a.month.localeCompare(b.month))[0]?.month
    : month;

  // Proventos acumulados anteriores ao início da série cronológica
  const initialAccumulatedDividends = reconciliation.dividends
    .filter((d) => firstSnapshotMonth && d.date && d.date < `${firstSnapshotMonth}-01`)
    .reduce((acc, d) => acc + d.amountBRL, 0);

  const currentMonthPoint =
    baseState.totalBRL > 0 || (params.assets ?? []).length > 0
      ? {
          month,
          total_value: baseState.totalBRL,
          total_cost: baseState.totalCostBRL,
          capital_gain_pnl: baseState.unrealizedPnlBRL,
          capital_gain_pct: baseState.unrealizedPct,
          total_return_pnl: baseState.totalReturnPnlBRL,
          total_return_pct: baseState.totalReturnPct,
          status: "provisional" as const,
        }
      : null;

  const monthlySeries = buildPortfolioMonthlySeries({
    rawSnapshots: rawSnapshotsForSeries,
    currentMonthPoint,
    dividends: rawDividendsForSeries,
    contributions: rawContributionsForSeries,
    initialAccumulatedDividends,
    openingDividendsBalance: initialAccumulatedDividends,
    segregateOpeningDividends: true,
    limit: 6,
  });

  const allMonthlySeries = buildPortfolioMonthlySeries({
    rawSnapshots: rawSnapshotsForSeries,
    currentMonthPoint,
    dividends: rawDividendsForSeries,
    contributions: rawContributionsForSeries,
    initialAccumulatedDividends,
    openingDividendsBalance: initialAccumulatedDividends,
    segregateOpeningDividends: true,
    limit: 0,
  });

  // 6. Unificação da Fonte Única da Verdade (SSOT) para TWR e Cotas
  // Garante congruência estrita entre Dossiê Executivo e Extrato Analítico (BUG-03)
  const unifiedTwrSeries: TwrMonthlyPointResult[] = allMonthlySeries.map((pt) => ({
    month: pt.month,
    monthRatePct: pt.twrMonthPct ?? 0,
    accumulatedRatePct: pt.twrAccumulatedPct ?? 0,
    sharePrice: pt.sharePrice ?? 100,
    totalShares: pt.sharePrice && pt.sharePrice > 0 ? pt.valueBRL / pt.sharePrice : 0,
    totalValueBRL: pt.valueBRL,
  }));

  const latestUnifiedPoint = unifiedTwrSeries[unifiedTwrSeries.length - 1];
  const unifiedAccumulatedRatePct = latestUnifiedPoint?.accumulatedRatePct ?? 0;
  const unifiedMonthsElapsed = unifiedTwrSeries.length;
  const unifiedCurrentSharePrice = latestUnifiedPoint?.sharePrice ?? 100;

  const twr: TwrConsolidatedResult = {
    accumulatedRatePct: unifiedAccumulatedRatePct,
    annualizedRatePct:
      unifiedMonthsElapsed >= 12
        ? annualizeRateFromMonths(unifiedAccumulatedRatePct, unifiedMonthsElapsed)
        : null,
    monthsElapsed: unifiedMonthsElapsed,
    currentSharePrice: unifiedCurrentSharePrice,
    status: unifiedMonthsElapsed < 2 ? "insufficient_history" : "ok",
    series: unifiedTwrSeries,
  };

  const closedSnapshotsCount = allMonthlySeries.filter((pt) => pt.month < month).length;

  // 7. TIR / XIRR do Bolso
  const xirrResult = calculateCanonicalXirr({
    contributions: reconciliation.externalFlows.map((c) => ({
      date: c.date,
      amount: c.amount,
      notes: c.notes,
    })),
    currentPortfolioValueBRL: baseState.totalBRL,
    today: asOfDate,
  });

  // 8. Extrato Mensal da Competência Atual
  const monthlyStatement = calculateHomogeneousMonthlyStatement({
    month,
    snapshots: params.snapshots,
    reconstructedEndBalanceBRL: baseState.totalBRL,
    externalFlows: reconciliation.externalFlows.map((c) => ({
      date: c.date,
      amount: c.amount,
      notes: c.notes,
    })),
    dividends: reconciliation.dividends.map((d) => ({
      date: d.date,
      amount: d.amountBRL,
      ticker: d.ticker,
      notes: d.notes,
    })),
    transactions: (params.transactions ?? []).map((t) => ({
      date: t.date,
      type: t.type,
      quantity: Number(t.quantity) || 0,
      price: Number(t.price) || 0,
      total: Number(t.total) || 0,
      ticker: null,
    })),
    explicitRatePct: params.explicitRatePct,
  });

  // 9. Fidelidade da Competência
  const currentSnapshot = (params.snapshots ?? []).find((s) => s.month === month);
  const fidelity = evaluateCanonicalFidelity({
    snapshot: currentSnapshot,
    reconstructedTotalValueBRL: baseState.totalBRL,
    reconstructedTotalCostBRL: baseState.totalCostBRL,
    totalAssetsCount: holdings.length,
    calibratedQuotesCount: (params.monthlyPrices ?? []).filter((p) => p.month === month).length,
    apiQuotesCount: holdings.filter((h) => h.quoteSource === "api").length,
    fallbackQuotesCount: holdings.filter((h) => h.resolvedPrice.isEstimate).length,
  });

  const finalHoldings = baseState.holdings;

  return {
    ...baseState,
    closedSnapshotsCount,
    twr,
    portfolioTwr: twr,
    irr: xirrResult.xirr,
    portfolioIrr: xirrResult.xirr,
    netInjectedCapitalBRL: xirrResult.netInjectedCapitalBRL,
    netPocketGainBRL: xirrResult.netPocketGainBRL,
    monthlyStatement,
    fidelity,
    candidateAssets,
    monthlySeries,
    allMonthlySeries,
    isDerivedFromSnapshot: fidelity.isDerivedFromSnapshot,
    cutoffDate: asOfDate,
    month,
    cashTotal: baseState.totalCashBRL,
    monthDividends: monthlyStatement.monthDividendsBRL,
    positions: finalHoldings,
  };
}

// ---------------------------------------------------------------------------
// Submotor: Reconstrução Cronológica Ponto-no-Tempo (Modo "point_in_time")
// ---------------------------------------------------------------------------

interface InternalPointInTimeParams extends CanonicalEngineParams {
  cutoffDate: string;
  effectiveUsdRate: number;
  annualCdiRate: number;
  month: string;
}

function evaluatePointInTimeState(params: InternalPointInTimeParams): CanonicalEngineResult {
  const {
    cutoffDate,
    effectiveUsdRate,
    annualCdiRate,
    month,
    assets,
    monthlyPrices = [],
    snapshots = [],
    apiPrices = {},
  } = params;

  const livePriceMap: Record<string, number> = {};
  if (Array.isArray(params.assetPrices)) {
    for (const p of params.assetPrices) {
      if (p.ticker && typeof p.price === "number") {
        livePriceMap[p.ticker.toUpperCase().trim()] = p.price;
      }
    }
  } else if (params.assetPrices) {
    for (const [k, v] of Object.entries(params.assetPrices)) {
      if (typeof v === "number") {
        livePriceMap[k.toUpperCase().trim()] = v;
      }
    }
  }

  // 1. Reconciliação Determinística de Eventos até a Data de Corte (Salvaguarda S13)
  const reconciliation = reconcilePortfolioEvents({
    transactions: params.transactions,
    contributions: params.contributions,
    dividends: params.dividends,
    assets,
    asOfDate: cutoffDate,
    usdRate: effectiveUsdRate,
    monthlyPrices,
  });

  const holdings: CanonicalAssetHolding[] = [];

  const hasExplicitCashBalance = params.cashBalance !== undefined;
  let cashBRL = params.cashBalance ?? 0;
  let cashUSD = 0;

  const targetSnapshot =
    params.snapshot ?? snapshots.find((s) => s.month === month) ?? null;
  const monthlyPriceMap = new Map<string, MonthlyPriceRow>();
  for (const mp of monthlyPrices) {
    if (mp.month === month) {
      monthlyPriceMap.set(mp.ticker.toUpperCase().trim(), {
        id: mp.id ?? "",
        user_id: mp.user_id ?? "",
        ticker: mp.ticker,
        month: mp.month,
        price: mp.price,
        currency: (mp.currency as "BRL" | "USD") ?? "BRL",
        source: (mp.source as "api" | "manual" | "fallback") ?? "api",
      });
    }
  }

  // 2. Reconstituição da Custódia de Ativo por Ativo
  for (const asset of assets) {
    const rawClass = (asset.asset_class ?? "").toLowerCase().trim();
    const tickerUpper = asset.ticker.toUpperCase().trim();
    const currency = asset.currency ?? "BRL";
    const assetUsdRate = currency === "USD" ? effectiveUsdRate : 1.0;

    const isCash =
      isCashAssetClass(asset.asset_class) ||
      rawClass.includes("caixa") ||
      rawClass.includes("reserva") ||
      rawClass.includes("cash") ||
      tickerUpper === "CAIXA" ||
      tickerUpper === "CASH" ||
      tickerUpper.startsWith("CASH_") ||
      tickerUpper.startsWith("CAIXA_");

    if (isCash) {
      const qty = Number(asset.quantity) || 0;
      if (currency === "USD") {
        cashUSD += qty;
      } else if (!hasExplicitCashBalance) {
        cashBRL += qty;
      }
      continue;
    }

    const allAssetTxs = (params.transactions ?? []).filter((tx) => tx.asset_id === asset.id);
    const eligibleAssetTxs = allAssetTxs
      .filter((tx) => tx.date && tx.date.slice(0, 10) <= cutoffDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const fiMeta = asset.fixed_income_metadata;
    const isFixedIncome =
      rawClass.includes("renda fixa") ||
      rawClass.includes("tesouro") ||
      Boolean(fiMeta);

    // Se é Renda Fixa e a data de início é posterior à data de corte, o título não existia na competência
    const fiStartDate = fiMeta?.base_date ?? fiMeta?.initial_investment_date ?? null;
    if (isFixedIncome && fiStartDate && fiStartDate.slice(0, 10) > cutoffDate) {
      continue;
    }

    // Reconstituição de Quantidade e Custo Médio via computeCanonicalAssetLedger (Salvaguardas S2, S16 e S17)
    const fullLedger = computeCanonicalAssetLedger(allAssetTxs);
    const currentAssetQty = Number(asset.quantity) || 0;
    const currentAvgCost = Number(asset.average_price) || 0;

    let initialPosition: { quantity: number; totalCost: number } | undefined;
    if (allAssetTxs.length === 0) {
      initialPosition = {
        quantity: currentAssetQty,
        totalCost: round2(currentAssetQty * currentAvgCost),
      };
    } else if (Math.abs(fullLedger.quantity - currentAssetQty) > 0.001) {
      // Falta histórico prévio: adiciona baseline complementar
      const baselineQty = Math.max(0, currentAssetQty - fullLedger.quantity);
      if (baselineQty > 0) {
        initialPosition = {
          quantity: baselineQty,
          totalCost: round2(baselineQty * currentAvgCost),
        };
      }
    }

    const pointInTimeLedger = computeCanonicalAssetLedger(eligibleAssetTxs, initialPosition, {
      currency,
      monthlyPrices: params.monthlyPrices,
      defaultFxRate: effectiveUsdRate,
      assetFxRateAtPurchase: asset.fx_rate_at_purchase,
      isFixedIncome,
      fixedIncomeMetadata: fiMeta,
    });
    const quantity = pointInTimeLedger.quantity;
    const totalCostNative = pointInTimeLedger.totalCost;

    if (quantity <= 0 && eligibleAssetTxs.length > 0) {
      // Posição totalmente liquidada antes da data de corte:
      // Preserva PnL realizado e proventos históricos recebidos (§Salvaguarda S17)
      const holdingDividendsBRL = reconciliation.dividendsByAssetId.get(asset.id) ?? pointInTimeLedger.dividendsTotal;
      const holding = createCanonicalAssetHolding({
        assetId: asset.id,
        ticker: tickerUpper,
        assetClass: asset.asset_class,
        sector: isFixedIncome ? resolveFixedIncomeIndexer(asset).macroLabel : asset.sector,
        currency,
        quantity: 0,
        averageCost: 0,
        totalCost: 0,
        averageCostBRL: 0,
        totalCostBRL: 0,
        resolvedPrice: {
          ticker: tickerUpper,
          priceQuote: 0,
          priceBRL: 0,
          usdRate: assetUsdRate,
          source: "fallback",
          isEstimate: false,
          asOfDate: cutoffDate,
        },
        accumulatedDividendsBRL: holdingDividendsBRL,
        realizedPnl: pointInTimeLedger.realizedPnl,
        pricingMode: "unit_price",
        notes: asset.notes,
      });
      holdings.push(holding);
      continue;
    }

    const averageCostNative = quantity > 0 ? totalCostNative / quantity : 0;

    let totalCostBRL: number;
    let averageCostBRL: number;

    if (currency === "USD") {
      if (pointInTimeLedger.quantity > 0 && pointInTimeLedger.totalCostBRL > 0) {
        totalCostBRL = pointInTimeLedger.totalCostBRL;
        averageCostBRL = pointInTimeLedger.averageCostBRL;
      } else if (asset.total_cost_brl != null && asset.total_cost_brl > 0 && totalCostNative > 0) {
        const baseCostNative = Math.max(0, Number(asset.quantity) || 0) * Math.max(0, Number(asset.average_price) || 0);
        const ratio = baseCostNative > 0 ? totalCostNative / baseCostNative : 1;
        const candidateCostBRL = round2(asset.total_cost_brl * ratio);
        const isCorrupted = totalCostNative > 0 && candidateCostBRL < totalCostNative * 3.5;
        const snapshotRate = (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot;
        const purchaseRate = asset.fx_rate_at_purchase && asset.fx_rate_at_purchase > 1
          ? asset.fx_rate_at_purchase
          : snapshotRate && snapshotRate > 1
            ? snapshotRate
            : effectiveUsdRate;
        totalCostBRL = isCorrupted
          ? round2(totalCostNative * purchaseRate)
          : candidateCostBRL;
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      } else if (asset.fx_rate_at_purchase != null && asset.fx_rate_at_purchase > 0) {
        totalCostBRL = round2(totalCostNative * asset.fx_rate_at_purchase);
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      } else if ((asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot != null && (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot! > 0) {
        const snapRate = (asset as unknown as { cost_fx_rate_snapshot?: number }).cost_fx_rate_snapshot!;
        totalCostBRL = round2(totalCostNative * snapRate);
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      } else if (asset.average_cost_brl != null && asset.average_cost_brl > 0) {
        totalCostBRL = round2(quantity * asset.average_cost_brl);
        averageCostBRL = asset.average_cost_brl;
      } else {
        totalCostBRL = round2(totalCostNative * (asset.fx_rate_at_purchase ?? effectiveUsdRate));
        averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;
      }
    } else {
      totalCostBRL = totalCostNative;
      averageCostBRL = averageCostNative;
    }

    // Resolução de Preço na Competência Passada (Salvaguardas S5, S7 e S12)
    let resolvedPrice: CanonicalResolvedPrice;
    let fixedIncomeResult: FixedIncomeBalanceResult | null = null;
    let pricingMode: CanonicalPricingMode = "unit_price";

    if (isFixedIncome && fiMeta) {
      pricingMode = "total_value";
      fixedIncomeResult = calculateFixedIncomeBalance({
        baseValue: fiMeta.base_value ?? averageCostNative,
        baseDate: fiMeta.base_date,
        initialInvestmentDate: fiMeta.initial_investment_date,
        maturityDate: fiMeta.maturity_date,
        rateType: fiMeta.rate_type,
        rateValue: fiMeta.rate_value,
        isTaxExempt: fiMeta.is_tax_exempt,
        manualTaxRatePct: fiMeta.manual_tax_rate_pct,
        annualCdiRate,
        today: cutoffDate,
      });
      const grossVal = fixedIncomeResult.grossValue;
      const unitPriceBRL = quantity > 0 ? grossVal / quantity : grossVal;

      const hasActiveRate = Boolean(fiMeta.rate_value && fiMeta.rate_value > 0);

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(unitPriceBRL),
        priceBRL: round4(unitPriceBRL),
        usdRate: 1.0,
        source: hasActiveRate ? "fixed_income" : "manual",
        isEstimate: !hasActiveRate,
        asOfDate: cutoffDate,
        badgeLabel: hasActiveRate ? "Renda Fixa na Competência" : "Saldo Manual",
      };
    } else {
      // Prioridade histórica de cotação
      const savedMonthlyPrice = monthlyPriceMap.get(tickerUpper) ?? null;
      const apiPrice = apiPrices[tickerUpper] ?? null;
      const livePrice = livePriceMap[tickerUpper] ?? null;

      const resolvedHistorical: ResolvedHistoricalQuote = resolveHistoricalQuotePriority({
        ticker: tickerUpper,
        currency,
        savedMonthlyPrice,
        apiClosePrice: apiPrice,
        currentLivePrice: livePrice,
      });

      let quoteSource: string = resolvedHistorical.source;
      if (quoteSource === "fallback" && isCustomValuationAsset(asset) && averageCostNative > 0) {
        quoteSource = "custom_valuation";
        pricingMode = "custom_valuation";
      }

      const quotePrice = quoteSource === "custom_valuation" ? averageCostNative : resolvedHistorical.price;
      const priceBRL = currency === "USD" ? round4(quotePrice * effectiveUsdRate) : round4(quotePrice);

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(quotePrice),
        priceBRL,
        usdRate: assetUsdRate,
        source: quoteSource as CanonicalResolvedPrice["source"],
        isEstimate: resolvedHistorical.isEstimate,
        asOfDate: cutoffDate,
        badgeLabel: quoteSource === "api" ? "Oficial API" : quoteSource === "manual" ? "Manual" : "Estimada",
      };
    }

    const holdingDividendsBRL = reconciliation.dividendsByAssetId.get(asset.id) ?? 0;
    const holdingDividendsNative = reconciliation.dividendsNativeByAssetId.get(asset.id) ?? holdingDividendsBRL;
    const assetMonthDividendsBRL = reconciliation.dividends
      .filter((d) => d.assetId === asset.id && d.date.slice(0, 7) === month)
      .reduce((acc, d) => acc + d.amountBRL, 0);

    const holding = createCanonicalAssetHolding({
      assetId: asset.id,
      ticker: tickerUpper,
      assetClass: asset.asset_class,
      sector: isFixedIncome ? resolveFixedIncomeIndexer(asset).macroLabel : asset.sector,
      currency,
      quantity,
      averageCost: averageCostNative,
      totalCost: totalCostNative,
      averageCostBRL,
      totalCostBRL,
      resolvedPrice,
      accumulatedDividendsBRL: holdingDividendsBRL,
      dividendsNative: holdingDividendsNative,
      monthDividendsBRL: round2(assetMonthDividendsBRL),
      realizedPnl: pointInTimeLedger.realizedPnl,
      fixedIncomeMetadata: fiMeta,
      fixedIncomeResult,
      pricingMode,
      notes: asset.notes,
    });

    holdings.push(holding);
  }

  const candidateAssets: CandidateAssetItem[] = [];
  const includedAssetIds = new Set(holdings.map((h) => h.assetId));

  for (const asset of assets) {
    const rawClass = (asset.asset_class ?? "").toLowerCase().trim();
    const isCash =
      isCashAssetClass(asset.asset_class) ||
      rawClass.includes("caixa") ||
      rawClass.includes("reserva") ||
      rawClass.includes("cash") ||
      asset.ticker.toUpperCase() === "CAIXA" ||
      asset.ticker.toUpperCase() === "CASH";
    if (isCash) continue;

    if (!includedAssetIds.has(asset.id)) {
      candidateAssets.push({
        ticker: asset.ticker.toUpperCase().trim(),
        assetClass: asset.asset_class,
        currency: asset.currency ?? "BRL",
        quantity: Number(asset.quantity) || 0,
        priceQuote: Number(asset.average_price) || 0,
        priceBRL: Number(asset.average_price) || 0,
        valueBRL: (Number(asset.quantity) || 0) * (Number(asset.average_price) || 0),
        source: "fallback",
        isEstimate: true,
      });
    }
  }

  // 3. Montagem do Estado Base
  const baseState = createCanonicalPortfolioState({
    asOfDate: cutoffDate,
    mode: "point_in_time",
    usdRate: effectiveUsdRate,
    holdings,
    cashBRL,
    cashUSD,
    totalDividendsBRL: reconciliation.summary.totalDividendsBRL,
    closedSnapshotsCount: snapshots.filter((s) => s.month < month).length,
  });

  // 4. Sentinela de Fidelidade e Avaliação de Soberania (Salvaguarda S10)
  const savedPricesInMonthCount = monthlyPrices.filter((p) => p.month === month).length;
  const fidelity = evaluateCanonicalFidelity({
    snapshot: targetSnapshot,
    reconstructedTotalValueBRL: baseState.totalBRL,
    reconstructedTotalCostBRL: baseState.totalCostBRL,
    totalAssetsCount: holdings.length,
    calibratedQuotesCount: savedPricesInMonthCount,
    apiQuotesCount: holdings.filter((h) => h.quoteSource === "api").length,
    fallbackQuotesCount: holdings.filter((h) => h.resolvedPrice.isEstimate).length,
  });

  // 5. Extrato Mensal Homogêneo (§Salvaguarda S9 — Eliminação dos -13,9% vs. -3,6%)
  const prevMonth = getPreviousMonthISO(month);
  const prevSnapshot =
    params.previousSnapshot ?? snapshots.find((s) => s.month === prevMonth) ?? null;

  // Se houver snapshot para a competência atual, adota o saldo oficial soberano para o Modified Dietz
  const endBalanceForStatement =
    fidelity.isDerivedFromSnapshot && targetSnapshot
      ? getSnapshotEffectiveValue(targetSnapshot)
      : baseState.totalBRL;

  const startBalanceForStatement =
    params.startBalanceBRL !== undefined
      ? params.startBalanceBRL
      : prevSnapshot
        ? getSnapshotEffectiveValue(prevSnapshot)
        : 0;

  const monthContributions = reconciliation.externalFlows.filter((f: CanonicalReconciledFlow) => f.date.slice(0, 7) === month);
  const explicitRate =
    params.explicitRatePct ??
    monthContributions.map((c: CanonicalReconciledFlow) => extractExplicitRateFromNotes(c.notes)).find((r: number | null) => r !== null) ??
    null;

  const monthlyStatement = calculateHomogeneousMonthlyStatement({
    month,
    snapshots,
    snapshot: targetSnapshot,
    previousSnapshot: prevSnapshot,
    reconstructedEndBalanceBRL: endBalanceForStatement,
    reconstructedStartBalanceBRL: startBalanceForStatement,
    startBalanceBRL: params.startBalanceBRL !== undefined ? params.startBalanceBRL : startBalanceForStatement,
    externalFlows: reconciliation.externalFlows,
    dividends: reconciliation.dividends.map((d: CanonicalReconciledDividend) => ({
      date: d.date,
      amount: d.amountBRL,
      ticker: d.ticker,
      notes: d.notes,
    })),
    transactions: reconciliation.custodyTransactions.map((t: CanonicalReconciledTransaction) => ({
      date: t.date,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      total: t.total,
      ticker: t.ticker,
    })),
    explicitRatePct: explicitRate,
  });

  // 6. Série TWR até a competência
  let twr: TwrConsolidatedResult = DEFAULT_CANONICAL_TWR;
  if (snapshots.length > 0) {
    const contributions = params.contributions ?? [];
    const monthlyPoints: TwrMonthlyInputPoint[] = snapshots
      .filter((s) => s.month <= month)
      .map((s) => {
        const monthPrefix = s.month.slice(0, 7);
        const monthContribs = contributions.filter((c) => Boolean(c.date && c.date.startsWith(monthPrefix)));

        let netFlow = 0;
        const monthFlows: TwrCashFlowItem[] = [];
        let rExplicit: number | null = null;

        for (const c of monthContribs) {
          const isWithdrawal = isHistoricalWithdrawal(c);
          const signed = isWithdrawal ? -Math.abs(c.amount) : Math.abs(c.amount);
          netFlow += signed;
          monthFlows.push({ date: c.date.slice(0, 10), amount: signed });
          const r = extractExplicitRateFromNotes(c.notes);
          if (r !== null) rExplicit = r;
        }

        return {
          month: s.month,
          totalValueBRL: getSnapshotEffectiveValue(s),
          totalCostBRL: getSnapshotEffectiveCost(s) ?? undefined,
          netExternalCashFlowBRL: round2(netFlow),
          flows: monthFlows.length > 0 ? monthFlows : undefined,
          explicitRatePct: rExplicit,
        };
      });

    twr = calculateCanonicalTwrSeries({
      monthlyPoints,
      asOfMonth: month,
    });
  }

  // 7. TIR até a competência
  const xirrResult = calculateCanonicalXirr({
    contributions: reconciliation.externalFlows.map((f: CanonicalReconciledFlow) => ({
      date: f.date,
      amount: f.amount,
      notes: f.notes,
    })),
    currentPortfolioValueBRL: fidelity.sovereignExecutiveBalanceBRL,
    today: cutoffDate,
  });

  return {
    ...baseState,
    totalBRL: fidelity.sovereignExecutiveBalanceBRL,
    totalValueBRL: fidelity.sovereignExecutiveBalanceBRL,
    twr,
    portfolioTwr: twr,
    irr: xirrResult.xirr,
    portfolioIrr: xirrResult.xirr,
    netInjectedCapitalBRL: xirrResult.netInjectedCapitalBRL,
    netPocketGainBRL: xirrResult.netPocketGainBRL,
    monthlyStatement,
    fidelity,
    candidateAssets,
    monthlySeries: [],
    allMonthlySeries: [],
    isDerivedFromSnapshot: fidelity.isDerivedFromSnapshot,
    cutoffDate,
    month,
    cashTotal: baseState.totalCashBRL,
    monthDividends: monthlyStatement.monthDividendsBRL,
    positions: baseState.holdings,
  };
}
