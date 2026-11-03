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
  PortfolioTransaction,
} from "@/types";
import { calculateFixedIncomeBalance } from "./fixed-income";
import { resolveHistoricalQuotePriority, type ResolvedHistoricalQuote } from "./historical-quotes";

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
}

export interface PointInTimeCalculationParams {
  /** Competência de fechamento YYYY-MM */
  month: string;
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
  dividends?: PortfolioDividend[];
  monthlyPrices?: PortfolioMonthlyPrice[];
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

  // Filtrar transações até a data de corte cronologicamente ordenadas
  const eligibleTransactions = transactions
    .filter((tx) => tx.date && tx.date.slice(0, 10) <= cutoffDate)
    .sort((a, b) => a.date.localeCompare(b.date));

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

    const assetTxs = eligibleTransactions.filter((tx) => tx.asset_id === asset.id);
    const assetCurrency = asset.currency ?? "BRL";
    const fxRate = assetCurrency === "USD" ? usdRate : 1;
    const tickerUpper = asset.ticker.toUpperCase().trim();

    // Reconstituição cronológica de Quantidade e Preço Médio (PMM)
    let runningQty = 0;
    let runningCost = 0;
    let lastTxPriceInMonth: number | null = null;

    if (assetTxs.length > 0) {
      for (const tx of assetTxs) {
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
            // Desdobramento: aumenta quantidade sem alterar o custo total
            if (txQty > 0) {
              runningQty += txQty;
            }
            break;
          }
          case "reverse_split": {
            // Grupamento: reduz quantidade sem alterar o custo total
            if (txQty > 0) {
              runningQty = Math.max(0, runningQty - txQty);
            }
            break;
          }
        }
      }
    } else {
      // Se existem transações registradas no histórico do usuário para este ativo,
      // mas nenhuma até a data de corte (ex: ativo comprado no futuro), runningQty deve ser 0.
      const hasAnyFutureTx = transactions.some((tx) => tx.asset_id === asset.id);
      if (hasAnyFutureTx) {
        runningQty = 0;
        runningCost = 0;
      } else {
        // Ativo sem nenhuma transação cadastrada no histórico (posição estática/importada)
        runningQty = asset.quantity ?? 0;
        runningCost = (asset.quantity ?? 0) * (asset.average_price ?? 0);
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
  };
}
