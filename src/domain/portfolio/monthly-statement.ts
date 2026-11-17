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

import { createCanonicalMonthlyStatement } from "./canonical-types";

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


/**
 * Apura os dados do extrato mensal de uma competência isolada através do Motor Canônico Unificado (§Fase 40 / Plano 41).
 *
 * Imunidade Temporal: Todos os arrays de entrada (fluxos, proventos, transações)
 * são filtrados estritamente pelo prefixo da competência (YYYY-MM).
 */
export function calculateMonthlyStatement(params: MonthlyStatementParams): MonthlyStatementResult {
  const statement = createCanonicalMonthlyStatement({
    month: params.month,
    startBalanceBRL: params.startBalanceBRL,
    endBalanceBRL: params.endBalanceBRL,
    externalFlows: params.externalFlows,
    netExternalCashFlowBRL: params.netExternalCashFlowBRL,
    dividends: params.dividends,
    transactions: params.transactions,
    explicitRatePct: params.explicitRatePct,
  });

  return {
    ...statement,
    monthRatePct: statement.monthRatePct ?? 0,
  };
}
