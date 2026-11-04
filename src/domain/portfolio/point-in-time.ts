/**
 * Motor de Ponto-no-Tempo (Point-in-Time Engine) para Posição de Carteira (§F10/F40/F51).
 *
 * Reconstrói deterministicamente a carteira de investimentos em qualquer
 * competência histórica (mês YYYY-MM) através de:
 * 1. Filtragem de transações cronológicas até o último dia do mês;
 * 2. Reconstituição do Preço Médio Ponderado e Quantidade em custódia (compras, vendas, desdobramentos);
 * 3. Proventos auferidos no mês e acumulados até a data de corte;
 * 4. Acréscimo e juros de Renda Fixa parametrizada na data de corte;
 * 5. Aplicação da cotação histórica resolvida (API, Manual ou Fallback) com conversão de câmbio (PTAX);
 * 6. Segregação e desacoplamento do Caixa.
 *
 * Função pura, sem dependência de UI ou Supabase.
 */

import type {
  PortfolioAsset,
  PortfolioDividend,
  PortfolioMonthlyPrice,
  PortfolioSnapshot,
  PortfolioTransaction,
} from "@/types";
import { calculateFixedIncomeBalance } from "./fixed-income";
import { resolveHistoricalQuotePriority, type ResolvedHistoricalQuote } from "./historical-quotes";

export type PointInTimeFidelityStatus = "complete" | "balance_only" | "insufficient";

export interface PointInTimeFidelity {
  status: PointInTimeFidelityStatus;
  canGenerateExecutiveReport: boolean;
  reasons: string[];
  snapshotTotalValue?: number | null;
  snapshotTotalCost?: number | null;
  reconstructedTotalValue: number;
  discrepancyBRL?: number;
  discrepancyPct?: number;
  totalAssetsCount: number;
  calibratedQuotesCount: number;
  apiQuotesCount: number;
  fallbackQuotesCount: number;
}

export interface PointInTimeAssetPosition {
  assetId: string;
  ticker: string;
  assetClass: string;
  sector: string | null;
  currency: "BRL" | "USD";
  quantity: number;
  averagePrice: number;
  totalCost: number;
  totalCostBRL: number;
  priceQuote: number;
  priceBRL: number;
  valueBRL: number;
  quoteSource: ResolvedHistoricalQuote["source"];
  isEstimate: boolean;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  monthDividendsBRL: number;
  accumulatedDividendsBRL: number;
  totalReturnPnl: number;
  totalReturnPct: number | null;
}

export interface PointInTimeResult {
  month: string;
  cutoffDate: string;
  positions: PointInTimeAssetPosition[];
  cashQuantity: number;
  totalInvestedBRL: number;
  totalCostBRL: number;
  totalValueBRL: number;
  monthDividendsTotalBRL: number;
  accumulatedDividendsTotalBRL: number;
  /** Status de integridade e fidedignidade analítica para a competência */
  fidelity: PointInTimeFidelity;
}

export interface PointInTimeCalculationParams {
  /** Competência de fechamento YYYY-MM */
  month: string;
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
  dividends?: PortfolioDividend[];
  monthlyPrices?: PortfolioMonthlyPrice[];
  /** Snapshot consolidado gravado no banco de dados para a competência (se houver) */
  snapshot?: PortfolioSnapshot | null;
  /** Cotações de fechamento retornadas via API de mercado para o mês (ticker -> cotação) */
  apiPrices?: Record<string, number>;
  /** Taxa de câmbio USD/BRL na data de fechamento (padrão 5.25) */
  usdRate?: number;
  /** Taxa CDI anualizada vigente no mês para Renda Fixa (padrão 10.5) */
  annualCdiRate?: number;
  /** Saldo de caixa na competência (se registrado) */
  cashBalance?: number;
}

/**
 * Retorna o último dia civil do mês YYYY-MM em formato YYYY-MM-DD.
 */
export function getMonthEndCutoffDate(month: string): string {
  const parts = month.split("-");
  const yearStr = parts[0] ?? "2026";
  const monthStr = parts[1] ?? "01";
  const year = Number.parseInt(yearStr, 10);
  const monthNum = Number.parseInt(monthStr, 10);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const padDay = String(lastDay).padStart(2, "0");
  return `${yearStr}-${monthStr}-${padDay}`;
}

export function calculatePointInTimePosition(
  params: PointInTimeCalculationParams,
): PointInTimeResult {
  const {
    month,
    assets,
    transactions,
    dividends = [],
    monthlyPrices = [],
    snapshot = null,
    apiPrices = {},
    usdRate = 5.25,
    annualCdiRate = 10.5,
    cashBalance,
  } = params;

  const cutoffDate = getMonthEndCutoffDate(month);
  const monthPrefix = month.slice(0, 7);

  // Mapeamentos rápidos
  const monthlyPriceMap = new Map<string, PortfolioMonthlyPrice>();
  for (const mp of monthlyPrices) {
    if (mp.month === month) {
      monthlyPriceMap.set(mp.ticker.toUpperCase().trim(), mp);
    }
  }

  // Filtrar proventos até a data de corte
  const eligibleDividends = dividends.filter(
    (div) => div.date && div.date.slice(0, 10) <= cutoffDate,
  );

  let cashTotal = cashBalance ?? 0;
  const positions: PointInTimeAssetPosition[] = [];

  for (const asset of assets) {
    const rawClass = (asset.asset_class ?? "").toLowerCase().trim();
    const isCash =
      rawClass === "caixa" ||
      asset.ticker.toUpperCase() === "CAIXA" ||
      asset.ticker.toUpperCase() === "CASH";

    if (isCash) {
      // Caixa é tratado como saldo puro de custódia
      if (cashBalance !== undefined) {
        cashTotal = cashBalance;
      } else {
        cashTotal = asset.quantity ?? 0;
      }
      continue;
    }

    const allAssetTxs = transactions.filter((tx) => tx.asset_id === asset.id);
    const eligibleAssetTxs = allAssetTxs
      .filter((tx) => tx.date && tx.date.slice(0, 10) <= cutoffDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const assetCurrency = asset.currency ?? "BRL";
    const fxRate = assetCurrency === "USD" ? usdRate : 1;
    const tickerUpper = asset.ticker.toUpperCase().trim();

    // Verificação de Renda Fixa parametrizada com metadados
    const fiMeta = asset.fixed_income_metadata;
    const isFixedIncome =
      rawClass.includes("renda fixa") ||
      rawClass.includes("tesouro") ||
      Boolean(fiMeta);

    // Se é Renda Fixa com data base / data inicial e ela for posterior à data de corte, o título não existia na data de corte
    const fiStartDate = fiMeta?.base_date ?? fiMeta?.initial_investment_date ?? null;
    if (isFixedIncome && fiStartDate && fiStartDate.slice(0, 10) > cutoffDate) {
      continue;
    }

    // Reconstituição de Quantidade e Preço Médio (PMM)
    let lastTxPriceInMonth: number | null = null;

    // Soma das quantidades negociadas no histórico total de transações cadastradas
    const totalBuysAll = allAssetTxs
      .filter((t) => t.type === "buy" || t.type === "subscription")
      .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
    const totalSellsAll = allAssetTxs
      .filter((t) => t.type === "sell")
      .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
    const netTransactionsQuantity = totalBuysAll - totalSellsAll;

    const currentAssetQty = asset.quantity ?? 0;
    const currentAvgPrice = asset.average_price ?? 0;

    // Determina se há custódia inicial (baseline) não explicada pelas transações registradas
    const transactionsFullyExplain =
      allAssetTxs.length > 0 &&
      Math.abs(netTransactionsQuantity - currentAssetQty) < 0.001;

    let baselineQty = 0;
    let baselineCost = 0;

    if (allAssetTxs.length === 0) {
      // Sem transações registradas: posição estática cadastrada diretamente na custódia
      baselineQty = currentAssetQty;
      baselineCost = currentAssetQty * currentAvgPrice;
    } else if (!transactionsFullyExplain) {
      // Há transações, mas não explicam a posição total (ex: usuário cadastrou custódia inicial e compras posteriores)
      baselineQty = Math.max(0, currentAssetQty - netTransactionsQuantity);
      baselineCost = baselineQty * currentAvgPrice;
    }

    let runningQty = baselineQty;
    let runningCost = baselineCost;

    if (eligibleAssetTxs.length > 0) {
      for (const tx of eligibleAssetTxs) {
        const txDate = tx.date.slice(0, 10);
        const txQty = Number(tx.quantity) || 0;
        const txPrice = Number(tx.price) || 0;
        const txTotal = Number(tx.total) || txQty * txPrice;

        if (txDate.startsWith(monthPrefix) && txPrice > 0) {
          lastTxPriceInMonth = txPrice;
        }

        switch (tx.type) {
          case "buy":
          case "subscription": {
            runningCost += txTotal;
            runningQty += txQty;
            break;
          }
          case "sell": {
            if (runningQty > 0) {
              const currentAvg = runningCost / runningQty;
              const reducedQty = Math.min(runningQty, txQty);
              runningCost = Math.max(0, runningCost - reducedQty * currentAvg);
              runningQty = Math.max(0, runningQty - txQty);
            } else {
              runningQty = 0;
              runningCost = 0;
            }
            break;
          }
          case "split": {
            if (txQty > 0) {
              runningQty += txQty;
            }
            break;
          }
          case "reverse_split": {
            if (txQty > 0) {
              runningQty = Math.max(0, runningQty - txQty);
            }
            break;
          }
        }
      }
    }

    // Se no ponto de corte a posição é zero ou negativa, não compõe a custódia do fechamento
    if (runningQty <= 0) {
      continue;
    }

    const averagePrice = runningQty > 0 ? runningCost / runningQty : 0;
    const totalCost = runningCost;
    const totalCostBRL = Math.round(totalCost * fxRate * 100) / 100;

    // Resolução de Cotação Histórica
    const savedMonthlyPrice = monthlyPriceMap.get(tickerUpper) ?? null;
    const apiPrice = apiPrices[tickerUpper] ?? null;

    const resolvedQuote = resolveHistoricalQuotePriority({
      ticker: tickerUpper,
      currency: assetCurrency,
      savedMonthlyPrice,
      apiClosePrice: apiPrice,
      lastTransactionPriceInMonth: lastTxPriceInMonth,
      currentLivePrice: asset.average_price > 0 ? asset.average_price : null,
    });

    let valueBRL: number;
    let priceQuote = resolvedQuote.price;
    let priceBRL = Math.round(priceQuote * fxRate * 100) / 100;

    // Tratamento especial para Renda Fixa com metadados de acréscimo diário
    if (
      rawClass.includes("renda fixa") ||
      rawClass.includes("tesouro") ||
      asset.fixed_income_metadata
    ) {
      if (asset.fixed_income_metadata) {
        const fiMeta = asset.fixed_income_metadata;
        const fiResult = calculateFixedIncomeBalance({
          baseValue: fiMeta.base_value && fiMeta.base_value > 0 ? fiMeta.base_value : totalCost,
          baseDate: fiMeta.base_date,
          initialInvestmentDate: fiMeta.initial_investment_date,
          maturityDate: fiMeta.maturity_date,
          rateType: fiMeta.rate_type,
          rateValue: fiMeta.rate_value,
          isTaxExempt: fiMeta.is_tax_exempt,
          manualTaxRatePct: fiMeta.manual_tax_rate_pct,
          totalCost: totalCostBRL,
          annualCdiRate,
          today: cutoffDate,
        });

        valueBRL = Math.round(fiResult.grossValue * 100) / 100;
        priceQuote = valueBRL;
        priceBRL = valueBRL;
      } else {
        // Sem metadados de juros, utiliza a cotação resolvida ou o custo como valor
        const unitPrice = priceQuote > 0 ? priceQuote : averagePrice;
        priceQuote = unitPrice;
        priceBRL = Math.round(unitPrice * fxRate * 100) / 100;
        valueBRL = Math.round(runningQty * priceBRL * 100) / 100;
      }
    } else {
      valueBRL = Math.round(runningQty * priceBRL * 100) / 100;
    }

    // Cálculo de Proventos (Mês e Acumulado até a data de corte)
    const assetDividends = eligibleDividends.filter(
      (d) => d.asset_id === asset.id || (d.ticker && d.ticker.toUpperCase().trim() === tickerUpper),
    );

    let monthDividendsNative = 0;
    let accumulatedDividendsNative = 0;

    for (const div of assetDividends) {
      const divAmount = Number(div.amount) || 0;
      const divDate = div.date.slice(0, 10);
      accumulatedDividendsNative += divAmount;
      if (divDate.startsWith(monthPrefix)) {
        monthDividendsNative += divAmount;
      }
    }

    // Adiciona proventos históricos legados informados no ativo
    if (asset.accumulated_dividends && asset.accumulated_dividends > 0) {
      accumulatedDividendsNative += asset.accumulated_dividends;
    }

    const monthDividendsBRL = Math.round(monthDividendsNative * fxRate * 100) / 100;
    const accumulatedDividendsBRL = Math.round(accumulatedDividendsNative * fxRate * 100) / 100;

    const unrealizedPnl = Math.round((valueBRL - totalCostBRL) * 100) / 100;
    const unrealizedPct =
      totalCostBRL > 0 ? Math.round(((valueBRL - totalCostBRL) / totalCostBRL) * 10000) / 100 : null;

    const totalReturnPnl = Math.round((unrealizedPnl + accumulatedDividendsBRL) * 100) / 100;
    const totalReturnPct =
      totalCostBRL > 0
        ? Math.round(((unrealizedPnl + accumulatedDividendsBRL) / totalCostBRL) * 10000) / 100
        : null;

    positions.push({
      assetId: asset.id,
      ticker: tickerUpper,
      assetClass: asset.asset_class || "Outros",
      sector: asset.sector ?? null,
      currency: assetCurrency,
      quantity: runningQty,
      averagePrice: Math.round(averagePrice * 10000) / 10000,
      totalCost: Math.round(totalCost * 100) / 100,
      totalCostBRL,
      priceQuote,
      priceBRL,
      valueBRL,
      quoteSource: resolvedQuote.source,
      isEstimate: resolvedQuote.isEstimate,
      unrealizedPnl,
      unrealizedPct,
      monthDividendsBRL,
      accumulatedDividendsBRL,
      totalReturnPnl,
      totalReturnPct,
    });
  }

  const totalInvestedBRL = positions.reduce((acc, p) => acc + p.valueBRL, 0);
  const totalCostBRL = positions.reduce((acc, p) => acc + p.totalCostBRL, 0);
  const monthDividendsTotalBRL = positions.reduce((acc, p) => acc + p.monthDividendsBRL, 0);
  const accumulatedDividendsTotalBRL = positions.reduce(
    (acc, p) => acc + p.accumulatedDividendsBRL,
    0,
  );
  const totalValueBRL = Math.round((totalInvestedBRL + cashTotal) * 100) / 100;

  // Diagnóstico de fidedignidade analítica
  let calibratedQuotesCount = 0;
  let apiQuotesCount = 0;
  let fallbackQuotesCount = 0;

  for (const pos of positions) {
    if (pos.quoteSource === "manual") {
      calibratedQuotesCount++;
    } else if (pos.quoteSource === "api" || !pos.isEstimate) {
      apiQuotesCount++;
    } else {
      fallbackQuotesCount++;
    }
  }

  const snapshotTotalValue = snapshot ? Number(snapshot.total_value) || 0 : null;
  const snapshotTotalCost = snapshot ? Number(snapshot.total_cost) || 0 : null;

  const discrepancyBRL =
    snapshotTotalValue !== null
      ? Math.round((totalValueBRL - snapshotTotalValue) * 100) / 100
      : undefined;

  const discrepancyPct =
    snapshotTotalValue !== null && snapshotTotalValue > 0 && discrepancyBRL !== undefined
      ? Math.round((discrepancyBRL / snapshotTotalValue) * 10000) / 100
      : undefined;

  const savedPricesInMonthCount = monthlyPrices.filter(
    (mp) => mp.month === month,
  ).length;

  let fidelityStatus: PointInTimeFidelityStatus;
  let canGenerateExecutiveReport: boolean;
  const reasons: string[] = [];

  if (snapshot) {
    if (savedPricesInMonthCount === 0) {
      if (
        (discrepancyPct !== undefined && Math.abs(discrepancyPct) > 3.0) ||
        fallbackQuotesCount > 0
      ) {
        fidelityStatus = "balance_only";
        canGenerateExecutiveReport = false;
        reasons.push(
          "Esta competência possui apenas registro consolidado de saldo patrimonial (histórico TWA/Marco Zero). Não há arquivo auditado de ativos e cotações para este mês.",
        );
      } else {
        fidelityStatus = "complete";
        canGenerateExecutiveReport = true;
      }
    } else {
      fidelityStatus = "complete";
      canGenerateExecutiveReport = true;
    }
  } else {
    if (positions.length === 0) {
      fidelityStatus = "insufficient";
      canGenerateExecutiveReport = false;
      reasons.push("Não há ativos ou movimentações registradas nesta competência.");
    } else if (fallbackQuotesCount > positions.length * 0.4) {
      fidelityStatus = "insufficient";
      canGenerateExecutiveReport = false;
      reasons.push(
        "Cotações históricas insuficientes para gerar relatório analítico oficial sem estimativas.",
      );
    } else {
      fidelityStatus = "complete";
      canGenerateExecutiveReport = true;
    }
  }

  const fidelity: PointInTimeFidelity = {
    status: fidelityStatus,
    canGenerateExecutiveReport,
    reasons,
    snapshotTotalValue,
    snapshotTotalCost,
    reconstructedTotalValue: totalValueBRL,
    discrepancyBRL,
    discrepancyPct,
    totalAssetsCount: positions.length,
    calibratedQuotesCount,
    apiQuotesCount,
    fallbackQuotesCount,
  };

  return {
    month,
    cutoffDate,
    positions,
    cashQuantity: cashTotal,
    totalInvestedBRL: Math.round(totalInvestedBRL * 100) / 100,
    totalCostBRL: Math.round(totalCostBRL * 100) / 100,
    totalValueBRL,
    monthDividendsTotalBRL: Math.round(monthDividendsTotalBRL * 100) / 100,
    accumulatedDividendsTotalBRL: Math.round(accumulatedDividendsTotalBRL * 100) / 100,
    fidelity,
  };
}
