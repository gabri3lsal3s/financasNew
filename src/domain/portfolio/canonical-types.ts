/**
 * Canonical Types — Contratos Tipados Canônicos de Investimentos (Fase 40).
 *
 * Consolidação canônica de representações de ativos, fotogramas patrimoniais,
 * extratos mensais e relatórios de fidelidade da carteira de investimentos.
 *
 * Módulo puramente algorítmico e desacoplado de banco, React e UI.
 * Cumpre rigorosamente as regras do AGENTS.md e do FINANCIAL_MATH_SPEC.md.
 */

import type {
  AssetCurrency,
  FixedIncomeIssuerType,
  FixedIncomeMetadata,
  FixedIncomeRateType,
} from "@/types";
import { isDividendType } from "./dividends";
import type { FixedIncomeBalanceResult, TaxReductionCountdown } from "./fixed-income";
import { isHistoricalWithdrawal, type XIRRResult } from "./irr";
import {
  calculateWeightedCashFlow,
  type TwrCashFlowItem,
  type TwrConsolidatedResult,
} from "./twr";
import { isCashAssetClass } from "./valuation";

// ---------------------------------------------------------------------------
// Arredondamentos e Auxiliares Matemáticos (FINANCIAL_MATH_SPEC §1)
// ---------------------------------------------------------------------------

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const round4 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 10000) / 10000;

// ---------------------------------------------------------------------------
// Modos de Precificação & Fontes de Cotação
// ---------------------------------------------------------------------------

/**
 * Modo polimórfico de precificação por natureza do ativo (§Salvaguarda S5).
 * - "unit_price": precificado por cota unitária de mercado (ações, FIIs, BDRs, ETFs, cripto).
 * - "total_value": precificado por saldo global com capitalização por dias úteis e IR regressivo (CDB, LCI, LCA, CRI, CRA, Tesouro).
 * - "custom_valuation": precificado por valoração própria / custo de aquisição (ativos manuais não cotados na B3).
 * - "cash": reserva financeira ou caixa com paridade 1:1.
 */
export type CanonicalPricingMode =
  | "unit_price"
  | "total_value"
  | "custom_valuation"
  | "cash";

/**
 * Procedência auditável da cotação resolvida (§Salvaguarda S7 e S12).
 */
export type CanonicalQuoteSource =
  | "api"
  | "manual"
  | "closing_saved"
  | "fallback"
  | "fixed_income"
  | "cash"
  | "custom_valuation";

// ---------------------------------------------------------------------------
// Cotação Resolvida Canônica
// ---------------------------------------------------------------------------

export interface CanonicalResolvedPrice {
  /** Ticker normalizado ao qual a cotação se aplica. */
  ticker: string;
  /** Cotação unitária na moeda nativa do ativo (USD ou BRL). */
  priceQuote: number;
  /** Cotação unitária convertida em BRL (para BRL: priceBRL === priceQuote; caixa = 1.0). */
  priceBRL: number;
  /** Taxa de câmbio USD/BRL adotada para a conversão (1.0 para ativos nacionais). */
  usdRate: number;
  /** Origem e precedência da cotação resolvida. */
  source: CanonicalQuoteSource;
  /** Flag indicando se o preço resulta de estimativa ou fallback na ausência de cotação oficial. */
  isEstimate: boolean;
  /** Data civil (YYYY-MM-DD) referente à cotação resolvida. */
  asOfDate?: string;
  /** Rótulo visual de auditoria para exibição em tabelas e relatórios (ex.: "Oficial API", "Manual", "Sugerida"). */
  badgeLabel?: string;
}

// ---------------------------------------------------------------------------
// Diagnóstico Integral de Renda Fixa
// ---------------------------------------------------------------------------

export interface CanonicalFixedIncomeDiagnostic {
  /** Confirmação de que o ativo pertence à classe de renda fixa privada ou pública. */
  isFixedIncome: true;
  /** Tipo de indexador contratado ("cdi", "selic", "pre", "ipca"). */
  rateType: FixedIncomeRateType;
  /** Valor numérico da taxa contratada (ex: 110 para 110% CDI ou 12.5 para 12,5% a.a.). */
  rateValue: number;
  /** Classificação do emissor e garantia de crédito ("tesouro", "bancario_fgc", "credito_privado"). */
  issuerType: FixedIncomeIssuerType | null;
  /** Data base do saldo de partida (Marco Zero D₀, YYYY-MM-DD). */
  baseDate: string;
  /** Saldo de partida na data base (D₀). */
  baseValue: number;
  /** Data do aporte inicial original (YYYY-MM-DD), para contagem da tabela regressiva de IR. */
  initialInvestmentDate: string | null;
  /** Valor original aportado no título. */
  initialInvestmentValue: number | null;
  /** Data de vencimento contratual pactuada (YYYY-MM-DD). */
  maturityDate: string | null;
  /** Indicador de vencimento atingido (hoje >= maturityDate). */
  isMatured: boolean;
  /** Se o título possui isenção legal de IR (LCI, LCA, CRI, CRA, Debêntures Incentivadas). */
  isTaxExempt: boolean;
  /** Alíquota manual de IR fixada pelo usuário, ou null para aplicação automática da regressiva. */
  manualTaxRatePct: number | null;
  /** Valor de mercado bruto atualizado com juros compostos em BRL. */
  grossValueBRL: number;
  /** Valor líquido estimado de resgate em BRL após desconto de IR e IOF. */
  netValueBRL: number;
  /** Total de juros brutos auferidos desde a data base (baseDate) em BRL. */
  accruedInterestBRL: number;
  /** Lucro bruto total acumulado sobre o investimento original em BRL. */
  totalProfitBRL: number;
  /** Montante estimado de Imposto de Renda a ser retido na fonte em BRL. */
  estimatedTaxBRL: number;
  /** Alíquota efetiva de IR calculada pela regra regressiva (22.5%, 20%, 17.5%, 15% ou 0%). */
  effectiveTaxRatePct: number;
  /** Montante estimado de IOF retido para resgates com menos de 30 dias em BRL. */
  estimatedIofBRL: number;
  /** Alíquota de IOF aplicável (0–96%). */
  iofRatePct: number;
  /** Dias úteis acumulados de capitalização a 252 d.u./ano. */
  businessDaysAccrued: number;
  /** Dias corridos totais desde a aplicação inicial para enquadramento da tabela regressiva. */
  calendarDaysTotal: number;
  /** Contagem regressiva de dias para a próxima redução de alíquota de IR, se houver. */
  taxCountdown: TaxReductionCountdown | null;
  /** Se o ativo possui dados explícitos de cadastro fiscal e tributário. */
  hasExplicitTaxInfo: boolean;
}

// ---------------------------------------------------------------------------
// Modelo Unificado de Ativo em Custódia: CanonicalAssetHolding
// ---------------------------------------------------------------------------

export interface CanonicalAssetHolding {
  /** Identificador único do ativo (UUID da tabela portfolio_assets ou sintético). */
  assetId: string;
  /** Identificador alternativo para interoperabilidade com componentes legados. */
  id?: string;
  /** Ticker / símbolo oficial do ativo (ex: "PETR4", "AAPL", "CDB-DI-BCO"). */
  ticker: string;
  /** Classe de ativo normalizada (ex: "Ações", "FIIs", "Renda Fixa", "Internacional", "Cripto", "Caixa / Reserva"). */
  assetClass: string | null;
  /** Setor ou segmento de atuação econômica (ex: "Petróleo", "Financeiro", "Logística"). */
  sector: string | null;
  /** Moeda de denominação nativa do ativo ("BRL" ou "USD"). */
  currency: AssetCurrency;
  /** Quantidade física de cotas ou unidades em custódia (>= 0). */
  quantity: number;
  /** Custo médio unitário de aquisição na moeda nativa (USD ou BRL). */
  averageCost: number;
  /** Custo total de aquisição acumulado na moeda nativa (USD ou BRL). */
  totalCost: number;
  /** Custo médio unitário de aquisição convertido para BRL. */
  averageCostBRL: number;
  /** Custo total de aquisição acumulado convertido para BRL (base contábil para apuração de PnL). */
  totalCostBRL: number;
  /** Preço médio unitário na moeda estrangeira (USD) para ativos internacionais (alias para averageCost quando currency === 'USD'). */
  avgPriceUSD?: number;
  /** Custo total na moeda estrangeira (USD) para ativos internacionais (alias para totalCost quando currency === 'USD'). */
  totalCostUSD?: number;
  /** Taxa de câmbio média histórica implícita da posição em USD (Custo BRL / Custo USD). */
  impliedHistoricalFxRate?: number | null;
  /** Variação da cota na moeda original em %: ((P_USD / PM_USD) - 1) * 100. */
  pricePnlPctUSD?: number | null;
  /** Variação cambial implícita em %: ((PTAX_atual / FX_hist) - 1) * 100. */
  fxPnlPct?: number | null;
  /** Variação da cota em BRL em %: ((V_BRL / C_BRL) - 1) * 100. */
  pricePnlPctBRL?: number | null;

  /** Cotação resolvida e auditável com metadados de procedência e câmbio. */
  resolvedPrice: CanonicalResolvedPrice;
  /** Preço unitário na moeda nativa (atalho direto para resolvedPrice.priceQuote). */
  priceQuote: number;
  /** Preço unitário em BRL (atalho direto para resolvedPrice.priceBRL). */
  priceBRL: number;
  /** Taxa de câmbio USD/BRL adotada na conversão (1.0 para BRL). */
  usdRate: number;
  /** Fonte de apuração da cotação resolvida. */
  quoteSource: CanonicalQuoteSource;

  /** Valor de mercado bruto consolidado em BRL (quantity * priceBRL ou grossValue de RF). */
  marketValueBRL: number;
  /** Alias para marketValueBRL (interoperabilidade com PortfolioPositionRow e PointInTimeAssetPosition). */
  valueBRL: number;

  /** Lucro/prejuízo não realizado (Ganho de Capital aberto) em BRL (marketValueBRL - totalCostBRL). */
  unrealizedPnl: number;
  /** Variação da cotação % sobre o custo em BRL (null quando totalCostBRL <= 0 ou ativo de caixa). */
  unrealizedPct: number | null;

  /** Proventos totais acumulados auferidos pelo ativo convertidos para BRL. */
  accumulatedDividendsBRL: number;
  /** Alias para accumulatedDividendsBRL (interoperabilidade com PortfolioPositionRow). */
  dividends: number;
  /** Proventos totais auferidos na moeda nativa do ativo (USD ou BRL). */
  dividendsNative: number;
  /** Proventos recebidos na competência mensal isolada analisada (point-in-time). */
  monthDividendsBRL?: number;

  /** Retorno Total financeiro em BRL: Ganho de Capital Não Realizado + Proventos Acumulados. */
  totalReturnPnl: number;
  /** Retorno Total percentual sobre o custo em BRL (null quando totalCostBRL <= 0 ou ativo de caixa). */
  totalReturnPct: number | null;

  /** Diagnóstico integral de renda fixa (nulo para ativos de renda variável, cripto e caixa). */
  fixedIncomeDiagnostic: CanonicalFixedIncomeDiagnostic | null;
  /** Metadados originais de cadastro do título de renda fixa, se houver. */
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  /** Resultado bruto e líquido da simulação de juros diários de renda fixa. */
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  /** Trava de vencimento: verdadeiro quando a data for maior ou igual ao vencimento contratual. */
  isMatured?: boolean;
  /** Data contratual de vencimento (YYYY-MM-DD), se aplicável. */
  maturityDate?: string | null;
  /** Valor líquido de mercado em BRL após desconto de IR e IOF (Renda Fixa). */
  netValueBRL?: number;
  /** Montante estimado de Imposto de Renda a ser retido na fonte (Renda Fixa). */
  taxAmountBRL?: number;
  /** Alíquota efetiva de Imposto de Renda aplicável segundo a tabela regressiva (Renda Fixa). */
  taxRatePct?: number;

  /** Flag indicando se o ativo atua como reserva financeira de liquidez imediata (Caixa). */
  isCash: boolean;
  /** Modo polimórfico de precificação adotado (§Salvaguarda S5). */
  pricingMode: CanonicalPricingMode;
  /** Peso percentual da posição frente ao patrimônio total da carteira (0–100%). */
  weightPct: number;
  /** Lucro/prejuízo realizado em vendas passadas em BRL ou moeda nativa (PnL realizado). */
  realizedPnl?: number;
  /** Anotações e observações livres salvas pelo investidor. */
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Parâmetros para Construção Canônica
// ---------------------------------------------------------------------------

export interface CreateCanonicalAssetHoldingParams {
  assetId: string;
  ticker: string;
  assetClass?: string | null;
  sector?: string | null;
  currency?: AssetCurrency;
  quantity: number;
  averageCost?: number;
  totalCost?: number;
  averageCostBRL?: number;
  totalCostBRL?: number;
  resolvedPrice: CanonicalResolvedPrice;
  accumulatedDividendsBRL?: number;
  dividendsNative?: number;
  monthDividendsBRL?: number;
  fixedIncomeDiagnostic?: CanonicalFixedIncomeDiagnostic | null;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  pricingMode?: CanonicalPricingMode;
  isCash?: boolean;
  totalPortfolioValueBRL?: number;
  realizedPnl?: number;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Valores Padrão / Neutros de Rentabilidade (FINANCIAL_MATH_SPEC §4)
// ---------------------------------------------------------------------------

export const DEFAULT_CANONICAL_TWR: TwrConsolidatedResult = {
  accumulatedRatePct: 0,
  annualizedRatePct: null,
  monthsElapsed: 0,
  currentSharePrice: 100.0,
  status: "empty",
  series: [],
};

export const DEFAULT_CANONICAL_IRR: XIRRResult = {
  annualizedRatePct: null,
  rawAnnualizedRatePct: null,
  periodRatePct: null,
  daysElapsed: 0,
  isEligible: false,
  capitalCoveragePct: 100,
  status: "insufficient_history",
};

// ---------------------------------------------------------------------------
// Modelo Unificado de Estado Consolidado da Carteira: CanonicalPortfolioState
// ---------------------------------------------------------------------------

/**
 * Fotografia consolidada da carteira para uma data de corte asOfDate (§Fase 40).
 *
 * Unifica a representação patrimonial, contábil, de caixa multimoeda e de rentabilidade
 * da carteira inteira, eliminando divergências entre o Carrossel, os Cards da Home,
 * a Tabela Analítica, os Relatórios Executivos em PDF e a Central Geral de Relatórios.
 *
 * Cumpre as Salvaguardas S1 a S18 do PLANO 40 e do FINANCIAL_MATH_SPEC.md:
 * - S1: Suporta modos "instant" (mês atual em O(1)) e "point_in_time" (reconstrução cronológica);
 * - S9: Homogeneidade temporal de bases;
 * - S11: Universalidade multiusuário, cotização contínua e tolerância a divisão por zero;
 * - S14: Invariante contábil de fechamento ao centavo: Total = Ativos + Caixa;
 * - S15: Segregação estrita de caixa multimoeda: cashBRL e cashUSD com conversão PTAX.
 */
export interface CanonicalPortfolioState {
  /** Data civil de referência e corte temporal (YYYY-MM-DD). */
  asOfDate: string;
  /** Modo de apuração e valoração adotado pelo motor ("instant" ou "point_in_time"). */
  mode: "instant" | "point_in_time";
  /** Taxa de câmbio USD/BRL oficial adotada para a data de corte (PTAX). */
  usdRate: number;

  /** Posições analíticas consolidadas de ativos em custódia na data de corte. */
  holdings: CanonicalAssetHolding[];
  /** Alias para holdings (interoperabilidade com PortfolioPositionRow[] e usePortfolioPosition). */
  rows: CanonicalAssetHolding[];

  /** Patrimônio total consolidado em BRL: soma dos ativos + caixa BRL + caixa USD convertido. */
  totalBRL: number;
  /** Alias para totalBRL (interoperabilidade com componentes de relatórios e fechamento). */
  totalValueBRL: number;

  /** Custo total de aquisição acumulado da carteira em BRL (ativos com quantidade > 0). */
  totalCostBRL: number;
  /** Custo total de aquisição exclusivo dos ativos em custódia (sem caixa) em BRL. */
  assetsTotalCostBRL: number;
  /** Custo total consolidado aplicado na carteira (ativos + caixa) em BRL. */
  totalAppliedCostBRL: number;

  /** Saldo de caixa / reserva financeira denominado em moeda nacional BRL. */
  cashBRL: number;
  /** Saldo de caixa na corretora internacional denominado em USD. */
  cashUSD: number;
  /** Saldo de caixa USD convertido para BRL na taxa de corte (cashUSD * usdRate). */
  cashUSDBRL: number;
  /** Total de disponibilidades / caixa líquido em BRL (cashBRL + cashUSDBRL). */
  totalCashBRL: number;

  /** Proventos totais em BRL acumulados na carteira (ativos vivos + encerrados). */
  totalDividendsBRL: number;
  /** Proventos exclusivos de posições ativas em custódia na data de corte em BRL. */
  activeDividendsBRL: number;
  /** Proventos históricos de posições já encerradas no passado em BRL. */
  closedDividendsBRL: number;

  /** Ganho de capital não realizado em BRL (patrimônio dos ativos vivos − custo dos ativos vivos). */
  unrealizedPnlBRL: number;
  /** Alias para unrealizedPnlBRL (interoperabilidade com PortfolioConsolidatedReturn). */
  capitalGainPnl: number;
  /** Variação da cotação % consolidada sobre o custo ((valor − custo) ÷ custo), null se custo <= 0. */
  unrealizedPct: number | null;
  /** Alias para unrealizedPct (interoperabilidade com PortfolioConsolidatedReturn). */
  capitalGainPct: number | null;

  /** Retorno Total financeiro da custódia viva em BRL (unrealizedPnlBRL + activeDividendsBRL). */
  totalReturnPnlBRL: number;
  /** Alias para totalReturnPnlBRL. */
  totalReturnPnl: number;
  /** Retorno Total % da custódia viva sobre o custo (totalReturnPnlBRL ÷ totalCostBRL), null se custo <= 0. */
  totalReturnPct: number | null;

  /** Lucro realizado líquido acumulado em BRL de posições encerradas no passado (vendas/resgates). */
  realizedPnlBRL: number;
  /** Alias para realizedPnlBRL. */
  realizedPnl: number;

  /**
   * P&L Econômico Histórico Acumulado em BRL:
   * Ganho de capital aberto + proventos totais + lucro realizado no passado.
   * Representa a totalidade de riqueza financeira gerada pela estratégia desde a origem.
   */
  allTimeEconomicPnlBRL: number;
  /** Alias para allTimeEconomicPnlBRL. */
  allTimeEconomicPnl: number;

  /** Capital líquido total injetado do bolso em BRL (Aportes externos − Resgates do bolso). */
  netInjectedCapitalBRL: number;
  /** Ganho líquido real do bolso em BRL (totalBRL − netInjectedCapitalBRL). */
  netPocketGainBRL: number;

  /** Rentabilidade por Cotas Ponderada no Tempo (TWR / Time-Weighted Return - CVM/ANBIMA). */
  twr: TwrConsolidatedResult;
  /** Alias para twr (interoperabilidade com PortfolioPosition.portfolioTwr). */
  portfolioTwr: TwrConsolidatedResult;

  /** Taxa Interna de Retorno (TIR / Money-Weighted Return / XIRR) ponderada pelos fluxos de caixa. */
  irr: XIRRResult;
  /** Alias para irr (interoperabilidade com PortfolioPosition.portfolioIrr). */
  portfolioIrr: XIRRResult;

  /** Quantidade de fechamentos mensais de snapshots persistidos no histórico. */
  closedSnapshotsCount: number;
  /** Aporte líquido do mês corrente em centavos (se aplicável). */
  monthlyContributionCents: number;
  /** Indicador de existência de Marco Zero do Bolso registrado para o investidor. */
  hasMarcoZeroContribution: boolean;
  /** Mês de referência (Marco Zero YYYY-MM) do cadastro inicial da carteira. */
  marcoZeroMonth: string | null;
}

// ---------------------------------------------------------------------------
// Parâmetros para Construção de CanonicalPortfolioState
// ---------------------------------------------------------------------------

export interface CreateCanonicalPortfolioStateParams {
  /** Data civil de referência e corte temporal (YYYY-MM-DD). */
  asOfDate: string;
  /** Modo de apuração e valoração adotado pelo motor ("instant" ou "point_in_time"). */
  mode?: "instant" | "point_in_time";
  /** Taxa de câmbio USD/BRL oficial adotada para a data de corte (PTAX). */
  usdRate?: number;
  /** Posições analíticas consolidadas de ativos em custódia na data de corte. */
  holdings?: readonly CanonicalAssetHolding[];
  /** Saldo de caixa / reserva em BRL adicional ou explícito. */
  cashBRL?: number;
  /** Saldo de caixa em USD adicional ou explícito. */
  cashUSD?: number;
  /** Custo total em BRL exclusivo dos ativos em custódia (sem caixa). */
  assetsTotalCostBRL?: number;
  /** Custo total consolidado aplicado na carteira (ativos + caixa) em BRL. */
  totalAppliedCostBRL?: number;
  /** Custo total em BRL da carteira (se omitido, deriva da soma dos holdings ativos). */
  totalCostBRL?: number;
  /** Proventos totais em BRL da carteira (se omitido, deriva da soma dos holdings). */
  totalDividendsBRL?: number;
  /** Proventos de ativos vivos em BRL (se omitido, deriva dos holdings com quantidade > 0). */
  activeDividendsBRL?: number;
  /** Proventos de posições encerradas no passado em BRL. */
  closedDividendsBRL?: number;
  /** Lucro realizado líquido de posições encerradas no passado em BRL. */
  realizedPnlBRL?: number;
  /** Capital líquido total injetado do bolso em BRL (Aportes - Saques). */
  netInjectedCapitalBRL?: number;
  /** Resultado consolidado de TWR (se omitido, utiliza DEFAULT_CANONICAL_TWR). */
  twr?: TwrConsolidatedResult;
  /** Resultado consolidado de TIR / XIRR (se omitido, utiliza DEFAULT_CANONICAL_IRR). */
  irr?: XIRRResult;
  /** Quantidade de fechamentos de snapshots persistidos. */
  closedSnapshotsCount?: number;
  /** Aporte líquido do mês corrente em centavos. */
  monthlyContributionCents?: number;
  /** Indicador de existência de Marco Zero do Bolso. */
  hasMarcoZeroContribution?: boolean;
  /** Mês de referência (Marco Zero YYYY-MM). */
  marcoZeroMonth?: string | null;
}

// ---------------------------------------------------------------------------
// Funções Construtoras Puras & Type Guards
// ---------------------------------------------------------------------------

/**
 * Constrói o diagnóstico canônico de renda fixa a partir dos metadados e do resultado do cálculo.
 * Retorna null se não houver metadados válidos de renda fixa.
 */
export function createFixedIncomeDiagnostic(
  metadata: FixedIncomeMetadata | null | undefined,
  result: FixedIncomeBalanceResult | null | undefined,
): CanonicalFixedIncomeDiagnostic | null {
  if (!metadata) return null;

  const baseVal = metadata.base_value ?? 0;
  const gross = result?.grossValue ?? baseVal;
  const net = result?.netValue ?? baseVal;
  const accruedInterest = result?.totalAccruedInterest ?? 0;
  const profit = result?.totalProfit ?? 0;
  const tax = result?.taxAmount ?? 0;
  const iof = result?.iofAmount ?? 0;

  return {
    isFixedIncome: true,
    rateType: metadata.rate_type,
    rateValue: metadata.rate_value,
    issuerType: metadata.issuer_type ?? null,
    baseDate: metadata.base_date,
    baseValue: round2(baseVal),
    initialInvestmentDate: metadata.initial_investment_date ?? null,
    initialInvestmentValue: metadata.initial_investment_value != null ? round2(metadata.initial_investment_value) : null,
    maturityDate: metadata.maturity_date ?? null,
    isMatured: Boolean(result?.isMatured),
    isTaxExempt: Boolean(metadata.is_tax_exempt),
    manualTaxRatePct: metadata.manual_tax_rate_pct ?? null,
    grossValueBRL: round2(gross),
    netValueBRL: round2(net),
    accruedInterestBRL: round2(accruedInterest),
    totalProfitBRL: round2(profit),
    estimatedTaxBRL: round2(tax),
    effectiveTaxRatePct: result?.taxRatePct ?? 0,
    estimatedIofBRL: round2(iof),
    iofRatePct: result?.iofRatePct ?? 0,
    businessDaysAccrued: result?.businessDaysAccrued ?? 0,
    calendarDaysTotal: result?.calendarDaysTotal ?? 0,
    taxCountdown: result?.taxCountdown ?? null,
    hasExplicitTaxInfo: Boolean(result?.hasExplicitTaxInfo),
  };
}

/**
 * Construtor determinístico puro de CanonicalAssetHolding.
 * Aplica as invariantes de FINANCIAL_MATH_SPEC.md:
 * - Divisão por zero blindada (retornos nulos para custo zero ou caixa);
 * - Moeda com arredondamento simétrico half-up (round2 e round4);
 * - Conversão cambial USD -> BRL rigorosa;
 * - Suporte a diagnóstico de Renda Fixa e Caixa 1:1.
 */
export function createCanonicalAssetHolding(
  params: CreateCanonicalAssetHoldingParams,
): CanonicalAssetHolding {
  const currency: AssetCurrency = params.currency ?? "BRL";
  const tickerUpper = params.ticker.toUpperCase().trim();
  const rawQuantity = Math.max(0, params.quantity);
  const normClass = params.assetClass ? params.assetClass.trim().toLowerCase() : "";
  const isCash = Boolean(
    params.isCash ||
      isCashAssetClass(params.assetClass) ||
      normClass.includes("caixa") ||
      normClass.includes("reserva") ||
      normClass.includes("cash") ||
      tickerUpper === "CAIXA" ||
      tickerUpper === "CASH" ||
      tickerUpper.startsWith("CASH_") ||
      tickerUpper.startsWith("CAIXA_") ||
      params.pricingMode === "cash",
  );

  // Determinação do Pricing Mode (§Salvaguarda S5)
  let pricingMode: CanonicalPricingMode = params.pricingMode ?? "unit_price";
  if (isCash) {
    pricingMode = "cash";
  } else if (params.fixedIncomeMetadata || params.fixedIncomeDiagnostic) {
    pricingMode = "total_value";
  }

  const usdRate = params.resolvedPrice.usdRate > 0 ? params.resolvedPrice.usdRate : 1.0;

  // Resolução de Custo Nativo e Custo BRL
  let totalCostNative = 0;
  let averageCostNative = 0;
  if (rawQuantity > 0) {
    if (isCash) {
      totalCostNative = round2(rawQuantity * 1.0);
      averageCostNative = 1.0;
    } else if (params.totalCost != null) {
      totalCostNative = round2(Math.max(0, params.totalCost));
      averageCostNative = params.averageCost != null ? params.averageCost : totalCostNative / rawQuantity;
    } else if (params.averageCost != null) {
      averageCostNative = Math.max(0, params.averageCost);
      totalCostNative = round2(averageCostNative * rawQuantity);
    }
  }

  let totalCostBRL: number;
  let averageCostBRL: number;

  if (currency === "USD") {
    if (isCash) {
      totalCostBRL = round2(totalCostNative * usdRate);
      averageCostBRL = usdRate;
    } else if (params.totalCostBRL != null) {
      totalCostBRL = round2(Math.max(0, params.totalCostBRL));
      averageCostBRL = rawQuantity > 0 ? (params.averageCostBRL ?? totalCostBRL / rawQuantity) : 0;
    } else {
      totalCostBRL = round2(totalCostNative * usdRate);
      averageCostBRL = rawQuantity > 0 ? totalCostBRL / rawQuantity : 0;
    }
  } else {
    totalCostBRL = totalCostNative;
    averageCostBRL = averageCostNative;
  }

  // Diagnóstico de Renda Fixa
  const fixedIncomeDiagnostic =
    params.fixedIncomeDiagnostic ??
    (params.fixedIncomeMetadata
      ? createFixedIncomeDiagnostic(params.fixedIncomeMetadata, params.fixedIncomeResult)
      : null);

  // Resolução do Valor de Mercado em BRL
  let marketValueBRL: number;
  if (isCash) {
    marketValueBRL = currency === "USD" ? round2(rawQuantity * usdRate) : round2(rawQuantity * 1.0);
  } else if (fixedIncomeDiagnostic) {
    marketValueBRL = fixedIncomeDiagnostic.grossValueBRL;
  } else {
    marketValueBRL = round2(rawQuantity * params.resolvedPrice.priceBRL);
  }

  // Ganho de Capital Não Realizado (PnL)
  let unrealizedPnl = 0;
  let unrealizedPct: number | null = null;
  if (!isCash) {
    unrealizedPnl = round2(marketValueBRL - totalCostBRL);
    if (totalCostBRL > 0) {
      unrealizedPct = round4(((marketValueBRL - totalCostBRL) / totalCostBRL) * 100);
    }
  }

  // Proventos Acumulados
  const accumulatedDividendsBRL = round2(params.accumulatedDividendsBRL ?? 0);
  let dividendsNative = params.dividendsNative ?? 0;
  if (params.dividendsNative == null) {
    dividendsNative =
      currency === "USD" && usdRate > 0
        ? round2(accumulatedDividendsBRL / usdRate)
        : accumulatedDividendsBRL;
  }

  // Retorno Total Econômico (Ganho de Capital + Proventos)
  let totalReturnPnl = 0;
  let totalReturnPct: number | null = null;
  if (!isCash) {
    totalReturnPnl = round2(unrealizedPnl + accumulatedDividendsBRL);
    if (totalCostBRL > 0) {
      totalReturnPct = round4((totalReturnPnl / totalCostBRL) * 100);
    }
  }

  // Peso Percentual na Carteira
  let weightPct = 0;
  if (params.totalPortfolioValueBRL && params.totalPortfolioValueBRL > 0) {
    weightPct = round4((marketValueBRL / params.totalPortfolioValueBRL) * 100);
  }

  // Decomposição Cambial e Retorno Multi-Moeda (§Fase 2 / Etapa 2.2)
  let avgPriceUSD: number | undefined;
  let totalCostUSD: number | undefined;
  let impliedHistoricalFxRate: number | null = null;
  let pricePnlPctUSD: number | null = null;
  let fxPnlPct: number | null = null;
  let pricePnlPctBRL: number | null = null;

  if (currency === "USD") {
    avgPriceUSD = averageCostNative;
    totalCostUSD = totalCostNative;
    if (totalCostNative > 0 && totalCostBRL > 0) {
      impliedHistoricalFxRate = round4(totalCostBRL / totalCostNative);
    }
    if (averageCostNative > 0) {
      pricePnlPctUSD = round4(((params.resolvedPrice.priceQuote / averageCostNative) - 1) * 100);
    }
    if (impliedHistoricalFxRate && impliedHistoricalFxRate > 0) {
      fxPnlPct = round4(((usdRate / impliedHistoricalFxRate) - 1) * 100);
    }
    if (totalCostBRL > 0) {
      pricePnlPctBRL = round4(((marketValueBRL - totalCostBRL) / totalCostBRL) * 100);
    }
  } else {
    impliedHistoricalFxRate = 1.0;
    pricePnlPctBRL = unrealizedPct;
  }

  return {
    assetId: params.assetId,
    id: params.assetId,
    ticker: tickerUpper,
    assetClass: params.assetClass ?? null,
    sector: params.sector ?? null,
    currency,
    quantity: rawQuantity,
    averageCost: averageCostNative,
    totalCost: totalCostNative,
    averageCostBRL,
    totalCostBRL,
    avgPriceUSD,
    totalCostUSD,
    impliedHistoricalFxRate,
    pricePnlPctUSD,
    fxPnlPct,
    pricePnlPctBRL,

    resolvedPrice: params.resolvedPrice,
    priceQuote: params.resolvedPrice.priceQuote,
    priceBRL: params.resolvedPrice.priceBRL,
    usdRate,
    quoteSource: params.resolvedPrice.source,

    marketValueBRL,
    valueBRL: marketValueBRL,

    unrealizedPnl,
    unrealizedPct,

    accumulatedDividendsBRL,
    dividends: accumulatedDividendsBRL,
    dividendsNative,
    monthDividendsBRL: params.monthDividendsBRL != null ? round2(params.monthDividendsBRL) : undefined,

    totalReturnPnl,
    totalReturnPct,

    realizedPnl: params.realizedPnl != null ? round2(params.realizedPnl) : undefined,

    fixedIncomeDiagnostic,
    fixedIncomeMetadata: params.fixedIncomeMetadata,
    fixedIncomeResult: params.fixedIncomeResult,
    isMatured: fixedIncomeDiagnostic?.isMatured,
    maturityDate: fixedIncomeDiagnostic?.maturityDate ?? params.fixedIncomeMetadata?.maturity_date,
    netValueBRL: fixedIncomeDiagnostic?.netValueBRL,
    taxAmountBRL: fixedIncomeDiagnostic?.estimatedTaxBRL,
    taxRatePct: fixedIncomeDiagnostic?.effectiveTaxRatePct,

    isCash,
    pricingMode,
    weightPct,
    notes: params.notes ?? null,
  };
}

/**
 * Type guard que valida se um objeto desconhecido atende a interface CanonicalAssetHolding.
 */
export function isCanonicalAssetHolding(val: unknown): val is CanonicalAssetHolding {
  if (!val || typeof val !== "object") return false;
  const holding = val as Record<string, unknown>;
  return (
    typeof holding.assetId === "string" &&
    typeof holding.ticker === "string" &&
    typeof holding.currency === "string" &&
    typeof holding.quantity === "number" &&
    typeof holding.averageCost === "number" &&
    typeof holding.totalCost === "number" &&
    typeof holding.averageCostBRL === "number" &&
    typeof holding.totalCostBRL === "number" &&
    typeof holding.marketValueBRL === "number" &&
    typeof holding.unrealizedPnl === "number" &&
    typeof holding.totalReturnPnl === "number" &&
    typeof holding.isCash === "boolean" &&
    typeof holding.pricingMode === "string" &&
    typeof holding.resolvedPrice === "object" &&
    holding.resolvedPrice !== null
  );
}

/**
 * Construtor determinístico puro de CanonicalPortfolioState (§Fase 40).
 *
 * Consolida a fotografia da carteira aplicando as invariantes do FINANCIAL_MATH_SPEC.md:
 * - Invariante S14 (Fechamento ao centavo): Total = Ativos + Caixa BRL + (Caixa USD * PTAX);
 * - Invariante S15 (Segregação multimoeda): Caixa BRL e Caixa USD tratados separadamente;
 * - Blindagem S11 contra divisão por zero em percentuais quando o custo for nulo ou zero;
 * - Normalização proporcional de pesos de alocação de holdings;
 * - Separação limpa entre Retorno Total da custódia viva e P&L Histórico Econômico acumulado.
 */
export function createCanonicalPortfolioState(
  params: CreateCanonicalPortfolioStateParams,
): CanonicalPortfolioState {
  const asOfDate = params.asOfDate.trim();
  const mode = params.mode ?? "instant";
  const usdRate = params.usdRate && params.usdRate > 0 ? params.usdRate : 1.0;

  const rawHoldings = params.holdings ?? [];
  let derivedCashBRL = 0;
  let derivedCashUSD = 0;
  let activeAssetsMarketValueBRL = 0;
  let activeAssetsTotalCostBRL = 0;
  let derivedActiveDividendsBRL = 0;
  let derivedClosedDividendsBRL = 0;
  let derivedRealizedPnlBRL = 0;

  for (const holding of rawHoldings) {
    if (holding.isCash) {
      if (holding.currency === "USD") {
        derivedCashUSD += holding.quantity;
      } else {
        derivedCashBRL += holding.marketValueBRL;
      }
      continue;
    }

    if (holding.quantity > 0) {
      activeAssetsMarketValueBRL += holding.marketValueBRL;
      activeAssetsTotalCostBRL += holding.totalCostBRL;
      derivedActiveDividendsBRL += holding.accumulatedDividendsBRL;
      if (typeof holding.realizedPnl === "number") {
        derivedRealizedPnlBRL += holding.realizedPnl;
      }
    } else {
      derivedClosedDividendsBRL += holding.accumulatedDividendsBRL;
      if (typeof holding.realizedPnl === "number") {
        derivedRealizedPnlBRL += holding.realizedPnl;
      } else if (holding.unrealizedPnl !== 0) {
        derivedRealizedPnlBRL += holding.unrealizedPnl;
      }
    }
  }

  const cashBRL = round2((params.cashBRL ?? 0) + derivedCashBRL);
  const cashUSD = round2((params.cashUSD ?? 0) + derivedCashUSD);
  const cashUSDBRL = round2(cashUSD * usdRate);
  const totalCashBRL = round2(cashBRL + cashUSDBRL);

  activeAssetsMarketValueBRL = round2(activeAssetsMarketValueBRL);
  const totalBRL = round2(activeAssetsMarketValueBRL + totalCashBRL);

  const assetsTotalCostBRL = round2(
    params.assetsTotalCostBRL != null ? Math.max(0, params.assetsTotalCostBRL) : activeAssetsTotalCostBRL,
  );
  const totalAppliedCostBRL = round2(
    params.totalAppliedCostBRL != null
      ? Math.max(0, params.totalAppliedCostBRL)
      : assetsTotalCostBRL + totalCashBRL,
  );

  const totalCostBRL = round2(
    params.totalCostBRL != null ? Math.max(0, params.totalCostBRL) : totalAppliedCostBRL,
  );

  const activeDividendsBRL = round2(params.activeDividendsBRL ?? derivedActiveDividendsBRL);
  const closedDividendsBRL = round2(params.closedDividendsBRL ?? derivedClosedDividendsBRL);
  const totalDividendsBRL = round2(
    params.totalDividendsBRL ?? activeDividendsBRL + closedDividendsBRL,
  );

  // Ganho de Capital Não Realizado em BRL (custódia ativa)
  // Invariante de Engenharia Financeira: P_total - C_total == V_ativos - C_ativos == Ganho Aberto
  const unrealizedPnlBRL = round2(totalBRL - totalCostBRL);
  const unrealizedPct =
    assetsTotalCostBRL > 0 ? round4((unrealizedPnlBRL / assetsTotalCostBRL) * 100) : null;

  // Retorno Total em BRL e % (custódia ativa: valorização + proventos ativos)
  const totalReturnPnlBRL = round2(unrealizedPnlBRL + activeDividendsBRL);
  const totalReturnPct =
    assetsTotalCostBRL > 0 ? round4((totalReturnPnlBRL / assetsTotalCostBRL) * 100) : null;

  // Lucro Realizado Passado e P&L Econômico Histórico Acumulado em BRL
  const realizedPnlBRL = round2(params.realizedPnlBRL ?? derivedRealizedPnlBRL);
  const allTimeEconomicPnlBRL = round2(
    unrealizedPnlBRL + totalDividendsBRL + realizedPnlBRL,
  );

  // Capital Injetado do Bolso e Ganho Líquido Real
  const netInjectedCapitalBRL = round2(
    params.netInjectedCapitalBRL ?? totalAppliedCostBRL,
  );
  const netPocketGainBRL = round2(totalBRL - netInjectedCapitalBRL);

  const twr = params.twr ?? DEFAULT_CANONICAL_TWR;
  const irr = params.irr ?? DEFAULT_CANONICAL_IRR;

  // Normalização proporcional dos pesos de cada holding frente ao patrimônio total consolidado
  const holdings: CanonicalAssetHolding[] = rawHoldings.map((h) => {
    const weightPct = totalBRL > 0 ? round4((h.marketValueBRL / totalBRL) * 100) : 0;
    return {
      ...h,
      weightPct,
    };
  });

  return {
    asOfDate,
    mode,
    usdRate,
    holdings,
    rows: holdings,

    totalBRL,
    totalValueBRL: totalBRL,
    totalCostBRL,
    assetsTotalCostBRL,
    totalAppliedCostBRL,

    cashBRL,
    cashUSD,
    cashUSDBRL,
    totalCashBRL,

    totalDividendsBRL,
    activeDividendsBRL,
    closedDividendsBRL,

    unrealizedPnlBRL,
    capitalGainPnl: unrealizedPnlBRL,
    unrealizedPct,
    capitalGainPct: unrealizedPct,

    totalReturnPnlBRL,
    totalReturnPnl: totalReturnPnlBRL,
    totalReturnPct,

    realizedPnlBRL,
    realizedPnl: realizedPnlBRL,

    allTimeEconomicPnlBRL,
    allTimeEconomicPnl: allTimeEconomicPnlBRL,

    netInjectedCapitalBRL,
    netPocketGainBRL,

    twr,
    portfolioTwr: twr,
    irr,
    portfolioIrr: irr,

    closedSnapshotsCount: params.closedSnapshotsCount ?? 0,
    monthlyContributionCents: params.monthlyContributionCents ?? 0,
    hasMarcoZeroContribution: Boolean(params.hasMarcoZeroContribution),
    marcoZeroMonth: params.marcoZeroMonth ?? null,
  };
}

/**
 * Type guard que valida se um objeto desconhecido atende a interface CanonicalPortfolioState.
 */
export function isCanonicalPortfolioState(val: unknown): val is CanonicalPortfolioState {
  if (!val || typeof val !== "object") return false;
  const state = val as Record<string, unknown>;
  return (
    typeof state.asOfDate === "string" &&
    (state.mode === "instant" || state.mode === "point_in_time") &&
    typeof state.usdRate === "number" &&
    typeof state.totalBRL === "number" &&
    typeof state.totalCostBRL === "number" &&
    typeof state.cashBRL === "number" &&
    typeof state.cashUSD === "number" &&
    typeof state.totalCashBRL === "number" &&
    typeof state.totalDividendsBRL === "number" &&
    typeof state.unrealizedPnlBRL === "number" &&
    typeof state.totalReturnPnlBRL === "number" &&
    typeof state.allTimeEconomicPnlBRL === "number" &&
    typeof state.netInjectedCapitalBRL === "number" &&
    typeof state.netPocketGainBRL === "number" &&
    typeof state.twr === "object" &&
    state.twr !== null &&
    typeof state.irr === "object" &&
    state.irr !== null &&
    Array.isArray(state.holdings)
  );
}

// ---------------------------------------------------------------------------
// Extrato Mensal da Competência Isolada: CanonicalMonthlyStatement (§Fase 40)
// ---------------------------------------------------------------------------

/**
 * Base contábil adotada na apuração da competência mensal (§Salvaguarda S9).
 * - "snapshot": ambos os saldos (inicial M-1 e final M) provêm de snapshots oficiais gravados/calibrados (portfolio_snapshots).
 * - "reconstructed_custody": ambos os saldos provêm da mesma reconstrução analítica cronológica de ativos via ledger e cotações.
 * - "inaugural": primeiro mês de histórico da carteira (Marco Zero / Mês 1), onde saldo inicial é zero e saldo final provém da base de partida.
 */
export type CanonicalAccountingBase =
  | "snapshot"
  | "reconstructed_custody"
  | "inaugural";

/**
 * Procedência de apuração de um saldo patrimonial específico (inicial ou final).
 */
export type CanonicalBalanceOrigin =
  | "snapshot"
  | "reconstructed_custody"
  | "zero";

/**
 * Fluxo de caixa externo do bolso elegível para apuração da competência mensal.
 */
export interface CanonicalMonthlyCashFlow {
  /** Data no formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss). */
  date: string;
  /** Valor monetário do fluxo em BRL: positivo (> 0) para aporte, negativo (< 0) para resgate. */
  amount: number;
  /** Notas descritivas que podem sinalizar [Resgate] ou [Retirada]. */
  notes?: string | null;
}

/**
 * Provento auferido elegível para apuração da competência mensal.
 */
export interface CanonicalMonthlyDividend {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Valor monetário do provento auferido em BRL. */
  amount: number;
  ticker?: string | null;
  notes?: string | null;
}

/**
 * Transação de custódia elegível para apuração de turnover da competência mensal.
 */
export interface CanonicalMonthlyTransaction {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Tipo da operação (buy, sell, subscription, split, etc.). */
  type: string;
  quantity?: number;
  price?: number;
  total?: number;
  ticker?: string | null;
}

/**
 * Extrato isolado da competência mensal da carteira de investimentos (§Fase 40).
 *
 * Apura o desempenho contábil, financeiro e de rentabilidade periódica de um mês específico (YYYY-MM),
 * com garantia estrita de HOMOGENEIDADE TEMPORAL DE BASES (Salvaguarda S9 do PLANO 40).
 *
 * Princípios e Salvaguardas:
 * - Salvaguarda S9: PROIBIÇÃO EXPRESSA DE MISTURA DE BASES HETEROGÊNEAS.
 *   Se startBalanceBRL vem de snapshot, endBalanceBRL DEVE vir de snapshot.
 *   Se for reconstrução analítica de ativos, início e fim devem vir da mesma base.
 *   Caso contrário, isHomogeneous será false e heterogeneityWarning alertará expressamente a anomalia.
 * - Metodologia Modified Dietz ANBIMA/GIPS (FINANCIAL_MATH_SPEC §4.3):
 *   r_M = (Saldo_Fim - Saldo_Ini - FluxoLiquido_M) / (Saldo_Ini + Σ (W_i * Fluxo_i))
 *   P&L_M = (Saldo_Fim - Saldo_Ini) - FluxoLiquido_M
 * - Salvaguarda de Colapso de Denominador (FINANCIAL_MATH_SPEC §4.3):
 *   Se o capital médio ponderado for inferior a R$ 10,00, isDenomCollapsed é ativado
 *   e a taxa percentual é neutralizada (monthRatePct = null), priorizando o P&L em reais.
 * - Invariante de Decomposição:
 *   deltaBalanceBRL = monthNetPnlBRL + netExternalCashFlowBRL
 *   monthNetPnlBRL = marketGainBRL + monthDividendsBRL
 */
export interface CanonicalMonthlyStatement {
  /** Competência apurada no formato YYYY-MM. */
  month: string;
  /** Saldo patrimonial bruto de fechamento do mês anterior M-1 em BRL na base homogênea. */
  startBalanceBRL: number;
  /** Saldo patrimonial bruto de fechamento no último dia do mês M em BRL na base homogênea. */
  endBalanceBRL: number;

  /** Base contábil adotada para a apuração da competência (§Salvaguarda S9). */
  accountingBase: CanonicalAccountingBase;
  /** Garantia estrita de que ambos os saldos pertencem à mesma base contábil (§Salvaguarda S9). */
  isHomogeneous: boolean;
  /** Base contábil de procedência do saldo inicial M-1. */
  startBalanceBase: CanonicalBalanceOrigin;
  /** Base contábil de procedência do saldo final M. */
  endBalanceBase: CanonicalBalanceOrigin;
  /** Alerta de auditoria caso haja violação ou risco de heterogeneidade de bases (S9). */
  heterogeneityWarning: string | null;

  /** Taxa de rentabilidade periódica isolada da competência (% via Modified Dietz ANBIMA/GIPS ou taxa explícita). */
  monthRatePct: number | null;
  /** Taxa explícita de retorno (% pré-calculada ou informada pela corretora), se houver. */
  explicitRatePct: number | null;
  /** Indicador se o denominador de capital caiu abaixo de R$ 10,00 (colapso de denominador). */
  isDenomCollapsed: boolean;

  /** Resultado econômico financeiro líquido gerado pela carteira no mês em BRL (P&L do mês). */
  monthNetPnlBRL: number;
  /** Ganho de capital líquido de mercado da carteira no mês em BRL (monthNetPnlBRL - monthDividendsBRL). */
  marketGainBRL: number;
  /** Variação patrimonial nominal bruta da carteira no mês em BRL (endBalanceBRL - startBalanceBRL). */
  deltaBalanceBRL: number;

  /** Total de proventos auferidos exclusivamente no mês em BRL. */
  monthDividendsBRL: number;
  /** Total de compras e subscrições efetuadas na corretora no mês em BRL. */
  monthBuysBRL: number;
  /** Total de vendas e desinvestimentos efetuados na corretora no mês em BRL. */
  monthSellsBRL: number;

  /** Saldo líquido de aportes externos do bolso no mês em BRL (Aportes - Resgates). */
  netExternalCashFlowBRL: number;
  /** Total bruto de aportes externos do bolso no mês em BRL. */
  grossContributionsBRL: number;
  /** Total bruto de resgates/retiradas externas do bolso no mês em BRL. */
  grossWithdrawalsBRL: number;

  /** Base ponderada de capital utilizada no denominador do Modified Dietz em BRL (Saldo_Ini + WeightedFlow). */
  weightedCapitalBaseBRL: number;
  /** Fluxo de caixa ponderado aplicado no Modified Dietz em BRL (Σ W_i * Fluxo_i). */
  weightedCashFlowBRL: number;

  /** Quantidade de transações de custódia processadas na competência. */
  transactionsCount: number;
  /** Quantidade de lançamentos de proventos processados na competência. */
  dividendsCount: number;

  // Interoperabilidade estrita com MonthlyStatementResult legada:
  /** Alias para netExternalCashFlowBRL (interoperabilidade com MonthlyStatementResult). */
  monthNetContributionBRL: number;
  /** Alias para grossContributionsBRL (interoperabilidade com MonthlyStatementResult). */
  monthGrossContributionsBRL: number;
  /** Alias para grossWithdrawalsBRL (interoperabilidade com MonthlyStatementResult). */
  monthGrossWithdrawalsBRL: number;
}

/**
 * Parâmetros para Construção Canônica de CanonicalMonthlyStatement.
 */
export interface CreateCanonicalMonthlyStatementParams {
  /** Competência apurada no formato YYYY-MM. */
  month: string;
  /** Saldo patrimonial bruto de fechamento do mês anterior M-1 em BRL. */
  startBalanceBRL: number;
  /** Saldo patrimonial bruto de fechamento no último dia do mês M em BRL. */
  endBalanceBRL: number;
  /**
   * Base contábil unificada declarada (§Salvaguarda S9).
   * Se omitida, é inferida a partir de startBalanceBase e endBalanceBase.
   */
  accountingBase?: CanonicalAccountingBase;
  /** Base contábil de origem do saldo inicial ("snapshot" | "reconstructed_custody" | "zero"). */
  startBalanceBase?: CanonicalBalanceOrigin;
  /** Base contábil de origem do saldo final ("snapshot" | "reconstructed_custody" | "zero"). */
  endBalanceBase?: CanonicalBalanceOrigin;
  /**
   * Fluxos externos do bolso (aportes > 0 e resgates < 0).
   * Filtrados estritamente pela competência `month`.
   */
  externalFlows?: readonly CanonicalMonthlyCashFlow[];
  /**
   * Fluxo externo líquido padrão (fallback caso fluxos detalhados não sejam informados).
   * Se informado e externalFlows for vazio, adota ponderação de meio de mês (W = 0.5).
   */
  netExternalCashFlowBRL?: number;
  /**
   * Proventos auferidos (dividendos, JCP, rendimentos de FIIs).
   */
  dividends?: readonly CanonicalMonthlyDividend[];
  /**
   * Transações efetuadas na custódia (compras, vendas, subscrições, etc.).
   */
  transactions?: readonly CanonicalMonthlyTransaction[];
  /**
   * Taxa explícita de retorno do mês (% ex.: 1.15 para +1,15%).
   * Se informada pelo extrato oficial da corretora, substitui a taxa de Modified Dietz.
   */
  explicitRatePct?: number | null;
  /** Total de proventos pré-calculados do mês (opcional). */
  monthDividendsBRL?: number;
  /** Total de compras pré-calculadas do mês (opcional). */
  monthBuysBRL?: number;
  /** Total de vendas pré-calculadas do mês (opcional). */
  monthSellsBRL?: number;
  /** Contagem pré-calculada de transações (opcional). */
  transactionsCount?: number;
  /** Contagem pré-calculada de proventos (opcional). */
  dividendsCount?: number;
  /** Alerta explícito de auditoria (opcional). */
  heterogeneityWarning?: string | null;
}

/**
 * Construtor determinístico puro de CanonicalMonthlyStatement (§Fase 40).
 *
 * Apura o extrato mensal isolado de investimentos aplicando:
 * - Salvaguarda S9 (Invariante de Homogeneidade Temporal de Bases):
 *   Audita e valida a congruência contábil entre startBalance e endBalance;
 *   Identifica e sinaliza expressamente qualquer confronto de bases heterogêneas;
 * - Metodologia Modified Dietz ANBIMA/GIPS com ponderação exata por dias corridos;
 * - Salvaguarda contra colapso de denominador (weightedCapitalBaseBRL < 10.0);
 * - Decomposição patrimonial: Delta = P&L + Fluxo; P&L = Mercado + Dividendos.
 */
export function createCanonicalMonthlyStatement(
  params: CreateCanonicalMonthlyStatementParams,
): CanonicalMonthlyStatement {
  const month = (params.month ?? "").trim().slice(0, 7);
  const startBalance = Math.max(0, round2(params.startBalanceBRL ?? 0));
  const endBalance = Math.max(0, round2(params.endBalanceBRL ?? 0));

  // Resolução da Base de Origem do Saldo Inicial
  let startBalanceBase: CanonicalBalanceOrigin;
  if (params.startBalanceBase) {
    startBalanceBase = params.startBalanceBase;
  } else if (startBalance === 0) {
    startBalanceBase = "zero";
  } else if (params.accountingBase === "reconstructed_custody") {
    startBalanceBase = "reconstructed_custody";
  } else {
    startBalanceBase = "snapshot";
  }

  // Resolução da Base de Origem do Saldo Final
  let endBalanceBase: CanonicalBalanceOrigin;
  if (params.endBalanceBase) {
    endBalanceBase = params.endBalanceBase;
  } else if (params.accountingBase === "reconstructed_custody") {
    endBalanceBase = "reconstructed_custody";
  } else {
    endBalanceBase = "snapshot";
  }

  // Auditoria e Garantia da Salvaguarda S9 (Homogeneidade de Bases)
  const isStartZero = startBalanceBase === "zero" || startBalance === 0;
  let isHomogeneous: boolean;
  let accountingBase: CanonicalAccountingBase;
  let heterogeneityWarning: string | null = params.heterogeneityWarning ?? null;

  if (isStartZero) {
    // Mês inaugural / Marco Zero: não há base M-1 prévia para colidir
    isHomogeneous = true;
    accountingBase = "inaugural";
  } else if (startBalanceBase === endBalanceBase) {
    isHomogeneous = true;
    accountingBase =
      params.accountingBase ??
      (startBalanceBase === "reconstructed_custody" ? "reconstructed_custody" : "snapshot");
  } else {
    // Violação de S9 detectada (ex.: start=snapshot vs end=reconstructed_custody)
    isHomogeneous = false;
    accountingBase =
      params.accountingBase ??
      (endBalanceBase === "reconstructed_custody" ? "reconstructed_custody" : "snapshot");
    if (!heterogeneityWarning) {
      heterogeneityWarning =
        `[Salvaguarda S9] Violação de Homogeneidade Temporal: saldo inicial (${startBalanceBase}) e final (${endBalanceBase}) pertencem a bases contábeis distintas. Risco de distorção de Modified Dietz/TWR.`;
    }
  }

  // 1. Filtragem e apuração de fluxos externos do bolso
  const eligibleFlows = (params.externalFlows ?? []).filter(
    (f) => f.date && f.date.slice(0, 7) === month,
  );

  let grossContributions = 0;
  let grossWithdrawals = 0;
  const twrFlows: TwrCashFlowItem[] = [];

  for (const flow of eligibleFlows) {
    const isWithdrawal = isHistoricalWithdrawal(flow);
    const amt = Math.abs(flow.amount || 0);
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
    params.netExternalCashFlowBRL !== undefined &&
    params.netExternalCashFlowBRL !== 0
  ) {
    const fallbackNet = params.netExternalCashFlowBRL || 0;
    if (fallbackNet > 0) {
      grossContributions = fallbackNet;
    } else {
      grossWithdrawals = Math.abs(fallbackNet);
    }
  }

  const { totalFlow, weightedFlow } = calculateWeightedCashFlow(
    month,
    twrFlows.length > 0 ? twrFlows : undefined,
    twrFlows.length === 0 ? params.netExternalCashFlowBRL ?? 0 : 0,
  );

  const grossContributionsBRL = round2(grossContributions);
  const grossWithdrawalsBRL = round2(grossWithdrawals);
  const netExternalCashFlowBRL = round2(totalFlow);
  const weightedCashFlowBRL = round2(weightedFlow);

  // 2. Base de capital ponderada e Resultado Econômico Financeiro (P&L do mês)
  // P&L_M = (Saldo_Fim - Saldo_Ini) - FluxoLiquido_M
  const deltaBalanceBRL = round2(endBalance - startBalance);
  const rawGain = endBalance - startBalance - totalFlow;
  let monthNetPnlBRL = round2(rawGain);
  if (Object.is(monthNetPnlBRL, -0) || Math.abs(monthNetPnlBRL) === 0) {
    monthNetPnlBRL = 0;
  }

  const weightedCapitalBaseBRL = round2(startBalance + weightedFlow);

  // 3. Taxa isolada do mês (% Modified Dietz ANBIMA/GIPS) com salvaguarda de colapso de denominador
  let monthRatePct: number | null;
  let isDenomCollapsed: boolean;

  if (params.explicitRatePct !== undefined && params.explicitRatePct !== null) {
    monthRatePct = round2(params.explicitRatePct);
    isDenomCollapsed = false;
  } else if (weightedCapitalBaseBRL < 10.0) {
    // Salvaguarda de Colapso de Denominador (FINANCIAL_MATH_SPEC §4.3)
    isDenomCollapsed = true;
    monthRatePct = null;
  } else {
    isDenomCollapsed = false;
    const rawRate = rawGain / weightedCapitalBaseBRL;
    // Piso de perda total (-100%) e teto protetivo de +1000%
    const clampedRate = Math.max(-1.0, Math.min(10.0, rawRate));
    monthRatePct = Math.round(clampedRate * 10000) / 100;
  }

  if (monthRatePct !== null && (Object.is(monthRatePct, -0) || Math.abs(monthRatePct) === 0)) {
    monthRatePct = 0;
  }

  // 4. Proventos auferidos exclusivamente no mês
  let monthDividendsBRL = params.monthDividendsBRL ?? 0;
  let dividendsCount = params.dividendsCount ?? 0;

  if (params.monthDividendsBRL === undefined) {
    const eligibleDividends = (params.dividends ?? []).filter(
      (d) => d.date && d.date.slice(0, 7) === month,
    );
    for (const d of eligibleDividends) {
      monthDividendsBRL += Math.max(0, d.amount || 0);
      dividendsCount++;
    }

    if (params.transactions && params.transactions.length > 0) {
      for (const tx of params.transactions) {
        if (tx.date && tx.date.slice(0, 7) === month && isDividendType(tx.type)) {
          const val = Math.max(0, tx.total || (tx.quantity || 0) * (tx.price || 0));
          const txTicker = (tx.ticker ?? "").toUpperCase().trim();
          const txDate = tx.date.slice(0, 10);

          const alreadyCovered = eligibleDividends.some((d) => {
            const dTicker = (d.ticker ?? "").toUpperCase().trim();
            const dDate = d.date.slice(0, 10);
            const sameTicker = Boolean(txTicker && dTicker && txTicker === dTicker);
            return (
              dDate === txDate &&
              (sameTicker || !txTicker || !dTicker) &&
              Math.abs((d.amount || 0) - val) < 0.01
            );
          });

          if (!alreadyCovered) {
            monthDividendsBRL += val;
            dividendsCount++;
          }
        }
      }
    }
  }

  monthDividendsBRL = round2(monthDividendsBRL);

  // 5. Transações efetuadas na custódia exclusivamente no mês
  let monthBuysBRL = params.monthBuysBRL ?? 0;
  let monthSellsBRL = params.monthSellsBRL ?? 0;
  let transactionsCount = params.transactionsCount ?? 0;

  if (
    params.monthBuysBRL === undefined &&
    params.monthSellsBRL === undefined &&
    params.transactions &&
    params.transactions.length > 0
  ) {
    for (const tx of params.transactions) {
      if (!tx.date || tx.date.slice(0, 7) !== month) continue;

      const ticker = (tx.ticker || "").toUpperCase().trim();
      if (ticker === "CAIXA") continue;

      const type = (tx.type || "").toLowerCase().trim();
      const val = Math.abs(tx.total || (tx.quantity || 0) * (tx.price || 0));

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
      } else if (isDividendType(type) && (!params.dividends || params.dividends.length === 0)) {
        transactionsCount++;
      }
    }
  }

  monthBuysBRL = round2(monthBuysBRL);
  monthSellsBRL = round2(monthSellsBRL);

  // 6. Decomposição de Mercado: Ganho de Capital Líquido do Mês (Market Gain)
  const marketGainBRL = round2(monthNetPnlBRL - monthDividendsBRL);

  return {
    month,
    startBalanceBRL: startBalance,
    endBalanceBRL: endBalance,
    accountingBase,
    isHomogeneous,
    startBalanceBase,
    endBalanceBase,
    heterogeneityWarning,

    monthRatePct,
    explicitRatePct: params.explicitRatePct != null ? round2(params.explicitRatePct) : null,
    isDenomCollapsed,

    monthNetPnlBRL,
    marketGainBRL,
    deltaBalanceBRL,

    monthDividendsBRL,
    monthBuysBRL,
    monthSellsBRL,

    netExternalCashFlowBRL,
    grossContributionsBRL,
    grossWithdrawalsBRL,

    weightedCapitalBaseBRL,
    weightedCashFlowBRL,

    transactionsCount,
    dividendsCount,

    monthNetContributionBRL: netExternalCashFlowBRL,
    monthGrossContributionsBRL: grossContributionsBRL,
    monthGrossWithdrawalsBRL: grossWithdrawalsBRL,
  };
}

/**
 * Type guard que valida se um objeto desconhecido atende a interface CanonicalMonthlyStatement.
 */
export function isCanonicalMonthlyStatement(val: unknown): val is CanonicalMonthlyStatement {
  if (!val || typeof val !== "object") return false;
  const stmt = val as Record<string, unknown>;
  return (
    typeof stmt.month === "string" &&
    typeof stmt.startBalanceBRL === "number" &&
    typeof stmt.endBalanceBRL === "number" &&
    typeof stmt.accountingBase === "string" &&
    typeof stmt.isHomogeneous === "boolean" &&
    typeof stmt.startBalanceBase === "string" &&
    typeof stmt.endBalanceBase === "string" &&
    (stmt.monthRatePct === null || typeof stmt.monthRatePct === "number") &&
    typeof stmt.isDenomCollapsed === "boolean" &&
    typeof stmt.monthNetPnlBRL === "number" &&
    typeof stmt.marketGainBRL === "number" &&
    typeof stmt.deltaBalanceBRL === "number" &&
    typeof stmt.monthDividendsBRL === "number" &&
    typeof stmt.netExternalCashFlowBRL === "number" &&
    typeof stmt.weightedCapitalBaseBRL === "number" &&
    typeof stmt.weightedCashFlowBRL === "number"
  );
}

// ---------------------------------------------------------------------------
// Diagnóstico de Integridade e Sentinela de Fidelidade: CanonicalFidelityReport (§Fase 40)
// ---------------------------------------------------------------------------

/**
 * Tolerância soberana incondicional de discrepância patrimonial (§Salvaguarda S10 do PLANO 40).
 * Se a divergência entre a custódia analítica reconstruída e o snapshot gravado exceder 3,0%,
 * a auditoria sinaliza conciliação necessária e adota soberanamente o saldo do snapshot
 * para a síntese executiva, evitando distorções de rentabilidade institucional (Salvaguarda S10).
 */
export const CANONICAL_FIDELITY_TOLERANCE_PCT = 3.0;

/**
 * Classificação canônica do estado de fidelidade e integridade da competência.
 * - "complete": Alta fidelidade — custódia analítica 100% conciliada com o fechamento oficial (<= 3%).
 * - "discrepant": Divergência patrimonial superior à tolerância soberana de 3% (Salvaguarda S10).
 * - "balance_only": Histórico consolidado em snapshot/Marco Zero/TWA sem custódia analítica de ativos.
 * - "insufficient": Movimentações ausentes ou cotações insuficientes (> 40% de fallbacks).
 */
export type CanonicalFidelityStatus =
  | "complete"
  | "discrepant"
  | "balance_only"
  | "insufficient";

/**
 * Variante de estilo para o badge da sentinela de fidelidade (DESIGN_SYSTEM §14).
 */
export type CanonicalFidelityBadgeVariant =
  | "positive"
  | "warning"
  | "critical"
  | "neutral";

/**
 * Diagnóstico completo de integridade analítica e auditoria de fidelidade patrimonial (§Fase 40).
 *
 * Implementa a Salvaguarda S10 (Tolerância Soberana de Fidelidade de 3%):
 * - A verificação de discrepância (|discrepancyPct| <= 3.0%) é OBRIGATÓRIA e SOBERANA,
 *   mesmo quando houver cotações salvas em portfolio_monthly_prices.
 * - Se a divergência exceder 3.0%:
 *   1. Define status = "discrepant", isTolerant = false, requiresCalibration = true;
 *   2. Adota sovereignExecutiveBalanceBRL = snapshotTotalValueBRL para a síntese patrimonial executiva;
 *   3. Exibe badge "Conciliação Sugerida" e notas transparentes de auditoria;
 *   4. Previne a anomalia histórica da mistura de bases (-13,9% vs. -3,6%).
 * - Mantém interoperabilidade estrita com PointInTimeFidelity legada.
 */
export interface CanonicalFidelityReport {
  /** Status canônico de integridade da competência (§Salvaguarda S10). */
  status: CanonicalFidelityStatus;
  /** Status compatível com o contrato legado PointInTimeFidelityStatus. */
  legacyStatus: "complete" | "balance_only" | "insufficient";

  /** Indicador se a discrepância patrimonial está rigorosamente dentro do teto de tolerância (<= 3,0%). */
  isTolerant: boolean;
  /** Teto soberano de tolerância percentual aplicado (3.0% segundo a Salvaguarda S10). */
  toleranceThresholdPct: number;

  /** Indicador se o relatório analítico executivo pode ser emitido para a competência. */
  canGenerateExecutiveReport: boolean;
  /** Sinaliza se a síntese executiva deve adotar o saldo consolidado do snapshot oficial (S10). */
  isDerivedFromSnapshot: boolean;
  /** Indicador se a custódia está 100% conciliada com o snapshot (sem discrepância significativa). */
  isConciliated: boolean;
  /** Indicador se é necessária calibração de cotações ou reconciliação de ordens pelo usuário (> 3,0%). */
  requiresCalibration: boolean;

  /** Saldo patrimonial total oficial do snapshot gravado na competência em BRL (null se não houver). */
  snapshotTotalValueBRL: number | null;
  /** Custo total oficial gravado no snapshot da competência em BRL (null se não houver). */
  snapshotTotalCostBRL: number | null;

  /** Saldo patrimonial total derivado da reconstrução analítica de ativos e caixa em BRL. */
  reconstructedTotalValueBRL: number;
  /** Custo de aquisição total derivado da reconstrução analítica de ativos em BRL. */
  reconstructedTotalCostBRL: number;

  /**
   * Saldo patrimonial soberano para a Síntese Executiva (§Salvaguarda S10).
   * Se houver snapshot e discrepância > 3% (ou balance_only), adota snapshotTotalValueBRL.
   * Se conciliado (<= 3%), adota reconstructedTotalValueBRL.
   * Elimina qualquer risco de colapso de rentabilidade por mistura de bases no Relatório Executivo.
   */
  sovereignExecutiveBalanceBRL: number;

  /** Discrepância patrimonial nominal em BRL (reconstructedTotalValueBRL - snapshotTotalValueBRL). */
  discrepancyBRL: number;
  /** Discrepância patrimonial percentual relativa ao snapshot em % (null se não houver snapshot). */
  discrepancyPct: number | null;

  /** Discrepância de custo nominal em BRL (reconstructedTotalCostBRL - snapshotTotalCostBRL). */
  costDiscrepancyBRL: number | null;
  /** Discrepância de custo percentual relativa ao snapshot em % (null se não houver snapshot). */
  costDiscrepancyPct: number | null;

  /** Quantidade total de ativos avaliados na competência. */
  totalAssetsCount: number;
  /** Quantidade de cotações calibradas pelo usuário ou salvas em portfolio_monthly_prices. */
  calibratedQuotesCount: number;
  /** Quantidade de cotações obtidas de API oficial. */
  apiQuotesCount: number;
  /** Quantidade de cotações que utilizaram fallback ou estimativa. */
  fallbackQuotesCount: number;

  /** Notas descritivas e justificativas transparentes de auditoria. */
  reasons: string[];

  /** Variante de estilo para Badge de UI (DESIGN_SYSTEM §14). */
  badgeVariant: CanonicalFidelityBadgeVariant;
  /** Rótulo textual limpo em pt-BR para exibição na interface (ex.: "Fidelidade Alta (100% Conciliado)"). */
  badgeLabel: string;

  // Interoperabilidade estrita com PointInTimeFidelity legada:
  /** Alias legado para snapshotTotalValueBRL. */
  snapshotTotalValue?: number | null;
  /** Alias legado para snapshotTotalCostBRL. */
  snapshotTotalCost?: number | null;
  /** Alias legado para reconstructedTotalValueBRL. */
  reconstructedTotalValue: number;
}

/**
 * Parâmetros para Construção Canônica de CanonicalFidelityReport.
 */
export interface CreateCanonicalFidelityReportParams {
  /** Saldo patrimonial oficial do snapshot gravado na competência em BRL. */
  snapshotTotalValueBRL?: number | null;
  /** Custo total oficial gravado no snapshot da competência em BRL. */
  snapshotTotalCostBRL?: number | null;

  /** Saldo patrimonial reconstruído pela soma analítica dos ativos e disponibilidades em BRL. */
  reconstructedTotalValueBRL: number;
  /** Custo total reconstruído pela soma analítica dos ativos em BRL. */
  reconstructedTotalCostBRL?: number;

  /** Quantidade total de ativos em custódia na competência. */
  totalAssetsCount: number;
  /** Quantidade de cotações salvas na tabela portfolio_monthly_prices na competência. */
  calibratedQuotesCount?: number;
  /** Quantidade de cotações obtidas de API oficial. */
  apiQuotesCount?: number;
  /** Quantidade de cotações que dependeram de fallback/estimativa. */
  fallbackQuotesCount?: number;

  /** Tolerância customizada em %, se houver (padrão: CANONICAL_FIDELITY_TOLERANCE_PCT = 3.0). */
  toleranceThresholdPct?: number;

  /** Notas explicativas adicionais de auditoria. */
  customReasons?: readonly string[];
}

/**
 * Formata valor monetário para texto sóbrio e legível em pt-BR sem símbolos gráficos ad-hoc.
 */
function formatAuditMoneyBRL(val: number): string {
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Construtor determinístico puro de CanonicalFidelityReport (§Fase 40).
 *
 * Implementa a Salvaguarda S10 (Tolerância Soberana de Fidelidade de 3%):
 * - A validação de divergência (|discrepancyPct| <= 3%) é incondicional, soberana e obrigatória,
 *   mesmo quando existirem cotações salvas em portfolio_monthly_prices;
 * - Se |discrepancyPct| > 3.0%, sinaliza status = "discrepant", ativa requiresCalibration e força
 *   a adoção de sovereignExecutiveBalanceBRL = snapshotTotalValueBRL, blindando a síntese patrimonial;
 * - Detecta histórico consolidado sem ativos (Marco Zero / TWA) e sinaliza status = "balance_only";
 * - Audita qualidade de precificação, sinalizando status = "insufficient" quando fallbacks > 40%;
 * - Fornece badges padronizados e razões de auditoria transparentes em pt-BR.
 */
export function createCanonicalFidelityReport(
  params: CreateCanonicalFidelityReportParams,
): CanonicalFidelityReport {
  const tolerance =
    params.toleranceThresholdPct && params.toleranceThresholdPct > 0
      ? params.toleranceThresholdPct
      : CANONICAL_FIDELITY_TOLERANCE_PCT;

  const reconstructedTotalValueBRL = round2(Math.max(0, params.reconstructedTotalValueBRL));
  const reconstructedTotalCostBRL = round2(Math.max(0, params.reconstructedTotalCostBRL ?? 0));
  const totalAssetsCount = Math.max(0, params.totalAssetsCount);
  const calibratedQuotesCount = Math.max(0, params.calibratedQuotesCount ?? 0);
  const apiQuotesCount = Math.max(0, params.apiQuotesCount ?? 0);
  const fallbackQuotesCount = Math.max(0, params.fallbackQuotesCount ?? 0);

  const reasons: string[] = [];
  if (params.customReasons && params.customReasons.length > 0) {
    reasons.push(...params.customReasons);
  }

  // Caso 1: Competência possui Snapshot Oficial gravado (portfolio_snapshots)
  if (params.snapshotTotalValueBRL !== undefined && params.snapshotTotalValueBRL !== null) {
    const snapshotTotalValueBRL = round2(Math.max(0, params.snapshotTotalValueBRL));
    const snapshotTotalCostBRL =
      params.snapshotTotalCostBRL != null ? round2(Math.max(0, params.snapshotTotalCostBRL)) : null;

    const discrepancyBRL = round2(reconstructedTotalValueBRL - snapshotTotalValueBRL);
    const discrepancyPct =
      snapshotTotalValueBRL > 0
        ? round4((discrepancyBRL / snapshotTotalValueBRL) * 100)
        : 0;

    let costDiscrepancyBRL: number | null = null;
    let costDiscrepancyPct: number | null = null;
    if (snapshotTotalCostBRL != null) {
      costDiscrepancyBRL = round2(reconstructedTotalCostBRL - snapshotTotalCostBRL);
      if (snapshotTotalCostBRL > 0) {
        costDiscrepancyPct = round4((costDiscrepancyBRL / snapshotTotalCostBRL) * 100);
      }
    }

    // Cenário 1.1: Sem ativos na competência, mas com snapshot registrado (Marco Zero / TWA histórico)
    if (totalAssetsCount === 0 && snapshotTotalValueBRL > 0) {
      reasons.push(
        "Esta competência possui apenas registro consolidado de saldo patrimonial (histórico TWA/Marco Zero). Não há arquivo auditado de ativos e cotações para este mês.",
      );
      return {
        status: "balance_only",
        legacyStatus: "balance_only",
        isTolerant: false,
        toleranceThresholdPct: tolerance,
        canGenerateExecutiveReport: false,
        isDerivedFromSnapshot: true,
        isConciliated: false,
        requiresCalibration: true,
        snapshotTotalValueBRL,
        snapshotTotalCostBRL,
        reconstructedTotalValueBRL,
        reconstructedTotalCostBRL,
        sovereignExecutiveBalanceBRL: snapshotTotalValueBRL,
        discrepancyBRL,
        discrepancyPct,
        costDiscrepancyBRL,
        costDiscrepancyPct,
        totalAssetsCount,
        calibratedQuotesCount,
        apiQuotesCount,
        fallbackQuotesCount,
        reasons,
        badgeVariant: "neutral",
        badgeLabel: "Saldo Consolidado",
        snapshotTotalValue: snapshotTotalValueBRL,
        snapshotTotalCost: snapshotTotalCostBRL,
        reconstructedTotalValue: reconstructedTotalValueBRL,
      };
    }

    // Cenário 1.2: Existem ativos em custódia na competência
    const isExceedingTolerance = Math.abs(discrepancyPct) > tolerance;

    if (isExceedingTolerance) {
      // Discrepância patrimonial > 3% detectada (§Salvaguarda S10)
      const sign = discrepancyPct > 0 ? "+" : "";
      reasons.push(
        `[Salvaguarda S10] Discrepância patrimonial de ${sign}${discrepancyPct.toFixed(2)}% detectada entre a custódia analítica (R$ ${formatAuditMoneyBRL(reconstructedTotalValueBRL)}) e o snapshot oficial (R$ ${formatAuditMoneyBRL(snapshotTotalValueBRL)}), excedendo a tolerância soberana de ${tolerance}%. Saldo oficial adotado para a síntese executiva.`,
      );
      if (fallbackQuotesCount > 0) {
        reasons.push(
          `Identificadas ${fallbackQuotesCount} cotações em fallback que podem justificar a diferença patrimonial.`,
        );
      }

      return {
        status: "discrepant",
        legacyStatus: "balance_only",
        isTolerant: false,
        toleranceThresholdPct: tolerance,
        canGenerateExecutiveReport: true,
        isDerivedFromSnapshot: true,
        isConciliated: false,
        requiresCalibration: true,
        snapshotTotalValueBRL,
        snapshotTotalCostBRL,
        reconstructedTotalValueBRL,
        reconstructedTotalCostBRL,
        sovereignExecutiveBalanceBRL: snapshotTotalValueBRL,
        discrepancyBRL,
        discrepancyPct,
        costDiscrepancyBRL,
        costDiscrepancyPct,
        totalAssetsCount,
        calibratedQuotesCount,
        apiQuotesCount,
        fallbackQuotesCount,
        reasons,
        badgeVariant: "warning",
        badgeLabel: "Conciliação Sugerida",
        snapshotTotalValue: snapshotTotalValueBRL,
        snapshotTotalCost: snapshotTotalCostBRL,
        reconstructedTotalValue: reconstructedTotalValueBRL,
      };
    }

    // Cenário 1.3: Dentro da tolerância soberana de 3%, verificar integridade de cotações
    if (totalAssetsCount > 0 && fallbackQuotesCount > totalAssetsCount * 0.4) {
      reasons.push(
        "Cotações históricas insuficientes (> 40% em fallback) para gerar relatório analítico oficial sem estimativas.",
      );
      return {
        status: "insufficient",
        legacyStatus: "insufficient",
        isTolerant: true,
        toleranceThresholdPct: tolerance,
        canGenerateExecutiveReport: false,
        isDerivedFromSnapshot: false,
        isConciliated: false,
        requiresCalibration: true,
        snapshotTotalValueBRL,
        snapshotTotalCostBRL,
        reconstructedTotalValueBRL,
        reconstructedTotalCostBRL,
        sovereignExecutiveBalanceBRL: reconstructedTotalValueBRL,
        discrepancyBRL,
        discrepancyPct,
        costDiscrepancyBRL,
        costDiscrepancyPct,
        totalAssetsCount,
        calibratedQuotesCount,
        apiQuotesCount,
        fallbackQuotesCount,
        reasons,
        badgeVariant: "critical",
        badgeLabel: "Cotações Insuficientes",
        snapshotTotalValue: snapshotTotalValueBRL,
        snapshotTotalCost: snapshotTotalCostBRL,
        reconstructedTotalValue: reconstructedTotalValueBRL,
      };
    }

    // Cenário 1.4: 100% Conciliado e com cotações firmes
    return {
      status: "complete",
      legacyStatus: "complete",
      isTolerant: true,
      toleranceThresholdPct: tolerance,
      canGenerateExecutiveReport: true,
      isDerivedFromSnapshot: false,
      isConciliated: true,
      requiresCalibration: false,
      snapshotTotalValueBRL,
      snapshotTotalCostBRL,
      reconstructedTotalValueBRL,
      reconstructedTotalCostBRL,
      sovereignExecutiveBalanceBRL: reconstructedTotalValueBRL,
      discrepancyBRL,
      discrepancyPct,
      costDiscrepancyBRL,
      costDiscrepancyPct,
      totalAssetsCount,
      calibratedQuotesCount,
      apiQuotesCount,
      fallbackQuotesCount,
      reasons,
      badgeVariant: "positive",
      badgeLabel: "Fidelidade Alta (100% Conciliado)",
      snapshotTotalValue: snapshotTotalValueBRL,
      snapshotTotalCost: snapshotTotalCostBRL,
      reconstructedTotalValue: reconstructedTotalValueBRL,
    };
  }

  // Caso 2: Competência NÃO possui snapshot gravado (apuração estritamente analítica)
  if (totalAssetsCount === 0) {
    reasons.push("Não há ativos ou movimentações registradas nesta competência.");
    return {
      status: "insufficient",
      legacyStatus: "insufficient",
      isTolerant: false,
      toleranceThresholdPct: tolerance,
      canGenerateExecutiveReport: false,
      isDerivedFromSnapshot: false,
      isConciliated: false,
      requiresCalibration: false,
      snapshotTotalValueBRL: null,
      snapshotTotalCostBRL: null,
      reconstructedTotalValueBRL,
      reconstructedTotalCostBRL,
      sovereignExecutiveBalanceBRL: reconstructedTotalValueBRL,
      discrepancyBRL: 0,
      discrepancyPct: null,
      costDiscrepancyBRL: null,
      costDiscrepancyPct: null,
      totalAssetsCount,
      calibratedQuotesCount,
      apiQuotesCount,
      fallbackQuotesCount,
      reasons,
      badgeVariant: "critical",
      badgeLabel: "Dados Insuficientes",
      snapshotTotalValue: null,
      snapshotTotalCost: null,
      reconstructedTotalValue: reconstructedTotalValueBRL,
    };
  }

  if (fallbackQuotesCount > totalAssetsCount * 0.4) {
    reasons.push(
      "Cotações históricas insuficientes para gerar relatório analítico oficial sem estimativas.",
    );
    return {
      status: "insufficient",
      legacyStatus: "insufficient",
      isTolerant: false,
      toleranceThresholdPct: tolerance,
      canGenerateExecutiveReport: false,
      isDerivedFromSnapshot: false,
      isConciliated: false,
      requiresCalibration: true,
      snapshotTotalValueBRL: null,
      snapshotTotalCostBRL: null,
      reconstructedTotalValueBRL,
      reconstructedTotalCostBRL,
      sovereignExecutiveBalanceBRL: reconstructedTotalValueBRL,
      discrepancyBRL: 0,
      discrepancyPct: null,
      costDiscrepancyBRL: null,
      costDiscrepancyPct: null,
      totalAssetsCount,
      calibratedQuotesCount,
      apiQuotesCount,
      fallbackQuotesCount,
      reasons,
      badgeVariant: "critical",
      badgeLabel: "Cotações Insuficientes",
      snapshotTotalValue: null,
      snapshotTotalCost: null,
      reconstructedTotalValue: reconstructedTotalValueBRL,
    };
  }

  return {
    status: "complete",
    legacyStatus: "complete",
    isTolerant: true,
    toleranceThresholdPct: tolerance,
    canGenerateExecutiveReport: true,
    isDerivedFromSnapshot: false,
    isConciliated: true,
    requiresCalibration: false,
    snapshotTotalValueBRL: null,
    snapshotTotalCostBRL: null,
    reconstructedTotalValueBRL,
    reconstructedTotalCostBRL,
    sovereignExecutiveBalanceBRL: reconstructedTotalValueBRL,
    discrepancyBRL: 0,
    discrepancyPct: null,
    costDiscrepancyBRL: null,
    costDiscrepancyPct: null,
    totalAssetsCount,
    calibratedQuotesCount,
    apiQuotesCount,
    fallbackQuotesCount,
    reasons,
    badgeVariant: "positive",
    badgeLabel: "Fidelidade Alta (100% Conciliado)",
    snapshotTotalValue: null,
    snapshotTotalCost: null,
    reconstructedTotalValue: reconstructedTotalValueBRL,
  };
}

/**
 * Type guard que valida se um objeto desconhecido atende a interface CanonicalFidelityReport.
 */
export function isCanonicalFidelityReport(val: unknown): val is CanonicalFidelityReport {
  if (!val || typeof val !== "object") return false;
  const rep = val as Record<string, unknown>;
  return (
    typeof rep.status === "string" &&
    typeof rep.legacyStatus === "string" &&
    typeof rep.isTolerant === "boolean" &&
    typeof rep.toleranceThresholdPct === "number" &&
    typeof rep.canGenerateExecutiveReport === "boolean" &&
    typeof rep.isDerivedFromSnapshot === "boolean" &&
    typeof rep.isConciliated === "boolean" &&
    typeof rep.requiresCalibration === "boolean" &&
    typeof rep.reconstructedTotalValueBRL === "number" &&
    typeof rep.reconstructedTotalCostBRL === "number" &&
    typeof rep.sovereignExecutiveBalanceBRL === "number" &&
    typeof rep.discrepancyBRL === "number" &&
    typeof rep.totalAssetsCount === "number" &&
    Array.isArray(rep.reasons) &&
    typeof rep.badgeVariant === "string" &&
    typeof rep.badgeLabel === "string"
  );
}

