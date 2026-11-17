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
import type {
  TwrCashFlowItem,
  TwrConsolidatedResult,
  TwrMonthlyInputPoint,
} from "./twr";
import {
  FALLBACK_USD_RATE,
  fallbackPriceFor,
  isCashAssetClass,
  resolvePrice,
  type PriceCandidate,
} from "./valuation";

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
  /** Cache de cotações live/recentes em servidor ou API (ticker -> cotação). */
  assetPrices?: Readonly<Record<string, number>>;
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
  const effectiveUsdRate = resolveDynamicPtaxRate(
    params.monthlyPrices,
    month,
    {
      explicitRate: params.usdRate,
      preferExplicitOverSaved: Boolean(params.usdRate && params.usdRate !== FALLBACK_USD_RATE),
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
    assetPrices = {},
    apiPrices = {},
  } = params;

  const holdings: CanonicalAssetHolding[] = [];
  const candidateAssets: CandidateAssetItem[] = [];

  let cashBRL = params.cashBalance ?? 0;
  let cashUSD = 0;

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
      if (currency === "USD") {
        cashUSD += qty;
      } else {
        cashBRL += qty;
      }
      continue;
    }

    const quantity = Math.max(0, Number(asset.quantity) || 0);
    const averageCost = Math.max(0, Number(asset.average_price) || 0);
    const totalCost = round2(quantity * averageCost);
    const assetUsdRate = currency === "USD" ? effectiveUsdRate : 1.0;
    const totalCostBRL = round2(totalCost * assetUsdRate);
    const averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;

    // Resolução de Preço e Modo de Precificação (§Salvaguardas S5 e S7)
    const fiMeta = asset.fixed_income_metadata;
    const isFixedIncome =
      rawClass.includes("renda fixa") ||
      rawClass.includes("tesouro") ||
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

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(unitPriceBRL),
        priceBRL: round4(unitPriceBRL),
        usdRate: 1.0,
        source: "fixed_income",
        isEstimate: false,
        asOfDate,
        badgeLabel: "Renda Fixa Atualizada",
      };
    } else {
      // Ativo de Renda Variável ou Alternativo
      const priceFromLive = apiPrices[tickerUpper] ?? assetPrices[tickerUpper] ?? null;
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
      sector: asset.sector,
      currency,
      quantity,
      averageCost,
      totalCost,
      averageCostBRL,
      totalCostBRL,
      resolvedPrice,
      accumulatedDividendsBRL: Number(asset.accumulated_dividends) || 0,
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

  // 3. Montagem do Estado Consolidado
  const baseState = createCanonicalPortfolioState({
    asOfDate,
    mode: "instant",
    usdRate: effectiveUsdRate,
    holdings,
    cashBRL,
    cashUSD,
    closedSnapshotsCount: (params.snapshots ?? []).filter((s) => s.month < month).length,
  });

  // 4. Série TWR e TIR
  let twr: TwrConsolidatedResult = DEFAULT_CANONICAL_TWR;
  if (params.snapshots && params.snapshots.length > 0) {
    const contributions = params.contributions ?? [];
    const monthlyPoints: TwrMonthlyInputPoint[] = params.snapshots.map((s) => {
      const monthPrefix = s.month.slice(0, 7);
      const monthContribs = contributions.filter((c) => Boolean(c.date && c.date.startsWith(monthPrefix)));

      let netFlow = 0;
      const monthFlows: TwrCashFlowItem[] = [];
      let explicitRate: number | null = null;

      for (const c of monthContribs) {
        const isWithdrawal = isHistoricalWithdrawal(c);
        const signed = isWithdrawal ? -Math.abs(c.amount) : Math.abs(c.amount);
        netFlow += signed;
        monthFlows.push({ date: c.date.slice(0, 10), amount: signed });
        const r = extractExplicitRateFromNotes(c.notes);
        if (r !== null) explicitRate = r;
      }

      return {
        month: s.month,
        totalValueBRL: getSnapshotEffectiveValue(s),
        totalCostBRL: getSnapshotEffectiveCost(s) ?? undefined,
        netExternalCashFlowBRL: round2(netFlow),
        flows: monthFlows.length > 0 ? monthFlows : undefined,
        explicitRatePct: explicitRate,
      };
    });

    twr = calculateCanonicalTwrSeries({
      monthlyPoints,
    });
  }

  const xirrResult = calculateCanonicalXirr({
    contributions: (params.contributions ?? []).map((c) => ({
      date: c.date,
      amount: Number(c.amount) || 0,
      notes: c.notes,
    })),
    currentPortfolioValueBRL: baseState.totalBRL,
    today: asOfDate,
  });

  // 5. Extrato Mensal da Competência Atual
  const monthlyStatement = calculateHomogeneousMonthlyStatement({
    month,
    snapshots: params.snapshots,
    reconstructedEndBalanceBRL: baseState.totalBRL,
    externalFlows: (params.contributions ?? []).map((c) => ({
      date: c.date,
      amount: Number(c.amount) || 0,
      notes: c.notes,
    })),
    dividends: (params.dividends ?? []).map((d) => ({
      date: d.date,
      amount: Number(d.amount) || 0,
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

  // 6. Fidelidade da Competência
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
    twr,
    portfolioTwr: twr,
    irr: xirrResult.xirr,
    portfolioIrr: xirrResult.xirr,
    netInjectedCapitalBRL: xirrResult.netInjectedCapitalBRL,
    netPocketGainBRL: xirrResult.netPocketGainBRL,
    monthlyStatement,
    fidelity,
    candidateAssets,
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
    assetPrices = {},
  } = params;

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
  const candidateAssets: CandidateAssetItem[] = [];

  let cashBRL = params.cashBalance ?? 0;
  let cashUSD = 0;

  const targetSnapshot = snapshots.find((s) => s.month === month);
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
      } else {
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

    const pointInTimeLedger = computeCanonicalAssetLedger(eligibleAssetTxs, initialPosition);
    const quantity = pointInTimeLedger.quantity;
    const totalCostNative = pointInTimeLedger.totalCost;

    if (quantity <= 0 && eligibleAssetTxs.length > 0) {
      // Posição totalmente liquidada antes da data de corte
      continue;
    }

    const averageCostNative = quantity > 0 ? totalCostNative / quantity : 0;
    const totalCostBRL = round2(totalCostNative * assetUsdRate);
    const averageCostBRL = quantity > 0 ? round4(totalCostBRL / quantity) : 0;

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

      resolvedPrice = {
        ticker: tickerUpper,
        priceQuote: round4(unitPriceBRL),
        priceBRL: round4(unitPriceBRL),
        usdRate: 1.0,
        source: "fixed_income",
        isEstimate: false,
        asOfDate: cutoffDate,
        badgeLabel: "Renda Fixa na Competência",
      };
    } else {
      // Prioridade histórica de cotação
      const savedMonthlyPrice = monthlyPriceMap.get(tickerUpper) ?? null;
      const apiPrice = apiPrices[tickerUpper] ?? null;
      const livePrice = assetPrices[tickerUpper] ?? null;

      const resolvedHistorical: ResolvedHistoricalQuote = resolveHistoricalQuotePriority({
        ticker: tickerUpper,
        currency,
        savedMonthlyPrice,
        apiClosePrice: apiPrice,
        currentLivePrice: livePrice,
      });

      let quoteSource: string = resolvedHistorical.source;
      if (quoteSource === "fallback" && averageCostNative > 0) {
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

    const holding = createCanonicalAssetHolding({
      assetId: asset.id,
      ticker: tickerUpper,
      assetClass: asset.asset_class,
      sector: asset.sector,
      currency,
      quantity,
      averageCost: averageCostNative,
      totalCost: totalCostNative,
      averageCostBRL,
      totalCostBRL,
      resolvedPrice,
      accumulatedDividendsBRL: holdingDividendsBRL,
      dividendsNative: holdingDividendsNative,
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
  const prevSnapshot = snapshots.find((s) => s.month === prevMonth);

  // Se houver snapshot para a competência atual, adota o saldo oficial soberano para o Modified Dietz
  const endBalanceForStatement =
    fidelity.isDerivedFromSnapshot && targetSnapshot
      ? getSnapshotEffectiveValue(targetSnapshot)
      : baseState.totalBRL;

  const startBalanceForStatement =
    prevSnapshot
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
    reconstructedEndBalanceBRL: endBalanceForStatement,
    reconstructedStartBalanceBRL: startBalanceForStatement,
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

  const finalHoldings = baseState.holdings;

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
    isDerivedFromSnapshot: fidelity.isDerivedFromSnapshot,
    cutoffDate,
    month,
    cashTotal: baseState.totalCashBRL,
    monthDividends: monthlyStatement.monthDividendsBRL,
    positions: finalHoldings,
  };
}
