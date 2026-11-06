/**
 * Apuração da Competência Mensal da Carteira de Investimentos.
 *
 * Motor puro de cálculo contábil e de rentabilidade isolada do mês (Modified Dietz ANBIMA/GIPS).
 *
 * Princípios de Engenharia Financeira:
 * 1. Segregação Temporal Estrita: calcula única e exclusivamente os indicadores da competência
 *    solicitada (YYYY-MM), sem contaminação com retornos ou saldos de anos/meses anteriores.
 * 2. Modified Dietz com Ponderação Exata (ANBIMA / GIPS):
 *    r_M = (Saldo_Fim - Saldo_Ini - FluxoLiquido_M) / (Saldo_Ini + Σ (W_i * Fluxo_i))
 *    onde W_i = (DiasNoMes - DiaDoFluxo + 1) / DiasNoMes.
 * 3. Invariante de Consistência: Se Saldo_Fim < Saldo_Ini sem retiradas externas, r_M é estritamente negativo.
 * 4. P&L Econômico do Mês (em R$):
 *    P&L_M = (Saldo_Fim - Saldo_Ini) - FluxoLiquido_M
 *    Representa o montante financeiro líquido gerado pelos ativos no mês (ganho de capital + proventos).
 * 5. Segregação de Turnover: Compras e vendas de ativos na corretora não constituem novos aportes externos;
 *    afetam apenas a composição interna da carteira.
 *
 * Módulo puro — sem import de UI ou Supabase; 100% testável isoladamente.
 */

import { isDividendType } from "./dividends";
import { isHistoricalWithdrawal } from "./irr";
import { calculateWeightedCashFlow, type TwrCashFlowItem } from "./twr";

export interface MonthlyStatementCashFlow {
  /** Data no formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss). */
  date: string;
  /** Valor monetário do fluxo em BRL. Se > 0 é aporte, se < 0 é resgate. */
  amount: number;
  /** Notas descritivas que podem sinalizar [Resgate] ou [Retirada]. */
  notes?: string | null;
}

export interface MonthlyStatementDividend {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Valor monetário do provento auferido em BRL. */
  amount: number;
  ticker?: string | null;
  notes?: string | null;
}

export interface MonthlyStatementTransaction {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Tipo da operação (buy, sell, subscription, split, etc.). */
  type: string;
  quantity?: number;
  price?: number;
  total?: number;
  ticker?: string | null;
}

export interface MonthlyStatementParams {
  /** Competência apurada no formato YYYY-MM. */
  month: string;
  /** Saldo patrimonial bruto de fechamento do mês anterior M-1 em BRL. */
  startBalanceBRL: number;
  /** Saldo patrimonial bruto de fechamento no último dia do mês M em BRL. */
  endBalanceBRL: number;
  /**
   * Fluxos externos do bolso (aportes > 0 e resgates < 0).
   * Apenas registros com data pertencente à competência `month` serão processados.
   */
  externalFlows?: readonly MonthlyStatementCashFlow[];
  /**
   * Fluxo externo líquido padrão (fallback caso fluxos detalhados não sejam informados).
   * Se informado e externalFlows for vazio, adota ponderação de meio de mês (W = 0.5).
   */
  netExternalCashFlowBRL?: number;
  /**
   * Proventos auferidos (dividendos, JCP, rendimentos de FIIs).
   * Apenas registros pertencentes à competência `month` serão processados.
   */
  dividends?: readonly MonthlyStatementDividend[];
  /**
   * Transações efetuadas na custódia (compras, vendas, subscrições, etc.).
   * Apenas registros pertencentes à competência `month` serão processados.
   */
  transactions?: readonly MonthlyStatementTransaction[];
  /**
   * Taxa explícita de retorno do mês (% ex.: 1.15 para +1,15%).
   * Se informada pelo extrato oficial da corretora, substitui a taxa derivada de Modified Dietz.
   */
  explicitRatePct?: number | null;
}

export interface MonthlyStatementResult {
  /** Competência (YYYY-MM). */
  month: string;
  /** Saldo de fechamento do mês anterior M-1 em BRL. */
  startBalanceBRL: number;
  /** Saldo de fechamento do mês M em BRL. */
  endBalanceBRL: number;
  /** Taxa de rentabilidade isolada do mês (% via Modified Dietz). */
  monthRatePct: number;
  /** Resultado financeiro líquido gerado pela carteira no mês em R$ (P&L do mês). */
  monthNetPnlBRL: number;
  /** Total de proventos auferidos exclusivamente no mês em BRL. */
  monthDividendsBRL: number;
  /** Total de compras e subscrições efetuadas no mês em BRL. */
  monthBuysBRL: number;
  /** Total de vendas e desinvestimentos efetuados no mês em BRL. */
  monthSellsBRL: number;
  /** Saldo líquido de aportes externos do mês em BRL (Aportes - Resgates). */
  monthNetContributionBRL: number;
  /** Total bruto de aportes externos do mês em BRL. */
  monthGrossContributionsBRL: number;
  /** Total bruto de resgates/retiradas externas do mês em BRL. */
  monthGrossWithdrawalsBRL: number;
  /** Base ponderada de capital utilizada no denominador do Modified Dietz em BRL. */
  weightedCapitalBaseBRL: number;
  /** Fluxo de caixa ponderado aplicado no Modified Dietz em BRL. */
  weightedCashFlowBRL: number;
  /** Quantidade de transações processadas na competência. */
  transactionsCount: number;
  /** Quantidade de lançamentos de proventos processados na competência. */
  dividendsCount: number;
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function sanitizeNumber(value: number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  return Number.isFinite(value) ? value : 0;
}

/**
 * Apura os dados do extrato mensal de uma competência isolada.
 *
 * Imunidade Temporal: Todos os arrays de entrada (fluxos, proventos, transações)
 * são filtrados estritamente pelo prefixo da competência (YYYY-MM).
 */
export function calculateMonthlyStatement(params: MonthlyStatementParams): MonthlyStatementResult {
  const {
    month,
    startBalanceBRL,
    endBalanceBRL,
    externalFlows,
    netExternalCashFlowBRL,
    dividends,
    transactions,
    explicitRatePct,
  } = params;

  const monthPrefix = (month ?? "").slice(0, 7);
  const startBalance = Math.max(0, round2(sanitizeNumber(startBalanceBRL)));
  const endBalance = Math.max(0, round2(sanitizeNumber(endBalanceBRL)));

  // 1. Filtragem e apuração de fluxos externos do bolso
  const eligibleFlows = (externalFlows ?? []).filter(
    (f) => f.date && f.date.slice(0, 7) === monthPrefix,
  );

  let grossContributions = 0;
  let grossWithdrawals = 0;
  const twrFlows: TwrCashFlowItem[] = [];

  for (const flow of eligibleFlows) {
    const isWithdrawal = isHistoricalWithdrawal(flow);
    const amt = Math.abs(sanitizeNumber(flow.amount));
    if (isWithdrawal) {
      grossWithdrawals += amt;
      twrFlows.push({
        date: flow.date.slice(0, 10),
        amount: -amt,
      });
    } else {
      grossContributions += amt;
      twrFlows.push({
        date: flow.date.slice(0, 10),
        amount: amt,
      });
    }
  }

  // Fallback quando não há detalhamento de fluxos com data, mas há fluxo líquido informado
  if (
    eligibleFlows.length === 0 &&
    netExternalCashFlowBRL !== undefined &&
    netExternalCashFlowBRL !== 0
  ) {
    const fallbackNet = sanitizeNumber(netExternalCashFlowBRL);
    if (fallbackNet > 0) {
      grossContributions = fallbackNet;
    } else {
      grossWithdrawals = Math.abs(fallbackNet);
    }
  }

  const { totalFlow, weightedFlow } = calculateWeightedCashFlow(
    monthPrefix,
    twrFlows.length > 0 ? twrFlows : undefined,
    twrFlows.length === 0 ? sanitizeNumber(netExternalCashFlowBRL) : 0,
  );

  const monthGrossContributionsBRL = round2(grossContributions);
  const monthGrossWithdrawalsBRL = round2(grossWithdrawals);
  const monthNetContributionBRL = round2(totalFlow);
  const weightedCashFlowBRL = round2(weightedFlow);

  // 2. Base de capital ponderada e Resultado Econômico Financeiro (P&L do mês em R$)
  // P&L_M = (Saldo_Fim - Saldo_Ini) - FluxoLiquido_M
  const rawGain = endBalance - startBalance - totalFlow;
  let monthNetPnlBRL = round2(rawGain);
  if (Object.is(monthNetPnlBRL, -0) || Math.abs(monthNetPnlBRL) === 0) {
    monthNetPnlBRL = 0;
  }

  const weightedCapitalBaseBRL = round2(startBalance + weightedFlow);

  // 3. Taxa isolada do mês (% TWR via Modified Dietz)
  let monthRatePct: number;

  if (explicitRatePct !== undefined && explicitRatePct !== null) {
    monthRatePct = round2(explicitRatePct);
  } else if (weightedCapitalBaseBRL > 0) {
    const rawRate = rawGain / weightedCapitalBaseBRL;
    // Piso de perda total (-100%) e teto protetivo de +1000%
    const clampedRate = Math.max(-1.0, Math.min(10.0, rawRate));
    monthRatePct = Math.round(clampedRate * 10000) / 100;
  } else {
    // Colapso de denominador ou carteira sem histórico prévio e sem capital base
    monthRatePct = 0;
  }

  if (Object.is(monthRatePct, -0) || Math.abs(monthRatePct) === 0) {
    monthRatePct = 0;
  }

  // 4. Proventos auferidos exclusivamente no mês
  const eligibleDividends = (dividends ?? []).filter(
    (d) => d.date && d.date.slice(0, 7) === monthPrefix,
  );

  let monthDividendsBRL = 0;
  let dividendsCount = 0;

  for (const d of eligibleDividends) {
    monthDividendsBRL += Math.max(0, sanitizeNumber(d.amount));
    dividendsCount++;
  }

  // Agrega também proventos lançados via transação no ledger não cobertos pela tabela de dividendos
  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      if (tx.date && tx.date.slice(0, 7) === monthPrefix && isDividendType(tx.type)) {
        const val = Math.max(
          0,
          sanitizeNumber(tx.total) ||
            sanitizeNumber(tx.quantity) * sanitizeNumber(tx.price),
        );
        const txTicker = (tx.ticker ?? "").toUpperCase().trim();
        const txDate = tx.date.slice(0, 10);

        const alreadyCovered = eligibleDividends.some((d) => {
          const dTicker = (d.ticker ?? "").toUpperCase().trim();
          const dDate = d.date.slice(0, 10);
          const sameTicker = Boolean(txTicker && dTicker && txTicker === dTicker);
          return (
            dDate === txDate &&
            (sameTicker || !txTicker || !dTicker) &&
            Math.abs(sanitizeNumber(d.amount) - val) < 0.01
          );
        });

        if (!alreadyCovered) {
          monthDividendsBRL += val;
          dividendsCount++;
        }
      }
    }
  }

  monthDividendsBRL = round2(monthDividendsBRL);

  // 5. Transações efetuadas na custódia exclusivamente no mês
  let monthBuysBRL = 0;
  let monthSellsBRL = 0;
  let transactionsCount = 0;

  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      if (!tx.date || tx.date.slice(0, 7) !== monthPrefix) {
        continue;
      }

      const ticker = (tx.ticker || "").toUpperCase().trim();
      if (ticker === "CAIXA") {
        continue;
      }

      const type = (tx.type || "").toLowerCase().trim();
      const val = Math.abs(
        sanitizeNumber(tx.total) ||
          sanitizeNumber(tx.quantity) * sanitizeNumber(tx.price),
      );

      const isBuy =
        type === "buy" ||
        type === "subscription" ||
        type === "compra" ||
        type === "subscricao" ||
        type === "subscrição";

      const isSell =
        type === "sell" ||
        type === "venda" ||
        type === "resgate";

      if (isBuy) {
        monthBuysBRL += val;
        transactionsCount++;
      } else if (isSell) {
        monthSellsBRL += val;
        transactionsCount++;
      } else if (
        type === "split" ||
        type === "reverse_split" ||
        type === "desdobramento" ||
        type === "grupamento"
      ) {
        transactionsCount++;
      } else if (isDividendType(type)) {
        if (eligibleDividends.length === 0) {
          transactionsCount++;
        }
      }
    }
  }

  monthBuysBRL = round2(monthBuysBRL);
  monthSellsBRL = round2(monthSellsBRL);

  return {
    month: monthPrefix,
    startBalanceBRL: startBalance,
    endBalanceBRL: endBalance,
    monthRatePct,
    monthNetPnlBRL,
    monthDividendsBRL,
    monthBuysBRL,
    monthSellsBRL,
    monthNetContributionBRL,
    monthGrossContributionsBRL,
    monthGrossWithdrawalsBRL,
    weightedCapitalBaseBRL,
    weightedCashFlowBRL,
    transactionsCount,
    dividendsCount,
  };
}
