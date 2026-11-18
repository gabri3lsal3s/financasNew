/**
 * Canonical Normalizer — Normalizador Determinístico de Eventos de Carteira (§Fase 40).
 *
 * Unifica e reconcilia deterministicamente as três fontes de dados de eventos do aplicativo:
 *   1. `portfolio_transactions` (Ledger de custódia e proventos);
 *   2. `portfolio_contributions` (Aportes e resgates externos do bolso);
 *   3. `portfolio_dividends` (Tabela especializada de proventos).
 *
 * Salvaguardas Implementadas:
 *   • Salvaguarda S2: Preservação da Custódia Base (aportes diretos em ativos sem ordem prévia);
 *   • Salvaguarda S4: Compatibilidade retroativa integral com anotações legadas ([Resgate], Marco Zero, [Rent: %]);
 *   • Salvaguarda S12: Resolução dinâmica da taxa de câmbio PTAX via USDBRL=X;
 *   • Salvaguarda S13: Normalização estrita de fuso horário local e corte civil YYYY-MM-DD;
 *   • Salvaguarda S14: Invariante contábil de precisão monetária ao centavo (numberToCents);
 *   • Salvaguarda S15: Segregação de moedas BRL / USD e conversão cambial determinística;
 *   • Salvaguarda S17: Invariante de desdobramentos e grupamentos (splits / reverse splits) com Custo Total constante.
 *
 * Módulo puramente algorítmico, sem React, TanStack Query ou Supabase.
 * Cumpre rigorosamente todas as regras do AGENTS.md e do FINANCIAL_MATH_SPEC.md.
 */

import { numberToCents } from "@/domain/money";
import type {
  AssetCurrency,
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioMonthlyPrice,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/types";
import { isDividendType } from "./dividends";
import { isHistoricalWithdrawal } from "./irr";
import { cleanContributionNotes, extractExplicitRateFromNotes } from "./statement-parser";
import { FALLBACK_USD_RATE, isCashAssetClass } from "./valuation";

// ---------------------------------------------------------------------------
// Constantes e Padrões Regex
// ---------------------------------------------------------------------------

const DATE_CIVIL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** Lista canônica de termos e marcadores indicadores de Marco Zero / aporte histórico inicial (§Salvaguarda S4). */
export const CANONICAL_MARCO_ZERO_TERMS: readonly string[] = Object.freeze([
  "marco",
  "marco zero",
  "marco historico",
  "marco histórico",
  "custo inicial",
  "custo historico inicial",
  "custo histórico inicial",
  "historico inicial",
  "histórico inicial",
  "aporte historico",
  "aporte histórico",
  "saldo inicial",
  "saldo historico",
  "saldo histórico",
  "patrimonio inicial",
  "patrimônio inicial",
  "posicao inicial",
  "posição inicial",
  "inaugural",
  "implantacao",
  "implantação",
  "ground zero",
]);

/** Lista canônica de marcadores de resgate/retirada histórica de capital do bolso (§Salvaguarda S4). */
export const CANONICAL_WITHDRAWAL_MARKERS: readonly string[] = Object.freeze([
  "[resgate]",
  "[retirada]",
  "[saque]",
  "(resgate)",
  "(retirada)",
  "(saque)",
]);

export const MARCO_ZERO_TERMS = CANONICAL_MARCO_ZERO_TERMS;

/** Ticker canônico oficial de apuração da taxa de câmbio PTAX USD/BRL (§Salvaguarda S12). */
export const CANONICAL_PTAX_TICKER = "USDBRL=X";

/** Aliases aceitos para cotações e pares cambiais USD/BRL. */
export const PTAX_TICKER_ALIASES: readonly string[] = Object.freeze([
  "USDBRL=X",
  "USD-BRL",
  "USDBRL",
  "PTAX",
  "USD_BRL",
]);

/** Taxa cambial de fallback oficial adotada pelo sistema (5,25). */
export const CANONICAL_FALLBACK_USD_RATE = FALLBACK_USD_RATE;

/** Aliases aceitos para eventos de desdobramento (split) (§Salvaguarda S17). */
export const CANONICAL_SPLIT_ALIASES: readonly string[] = Object.freeze([
  "split",
  "desdobramento",
  "desdobro",
]);

/** Aliases aceitos para eventos de grupamento (reverse split) (§Salvaguarda S17). */
export const CANONICAL_REVERSE_SPLIT_ALIASES: readonly string[] = Object.freeze([
  "reverse_split",
  "grupamento",
  "inplit",
  "reversesplit",
  "reverse-split",
]);

// ---------------------------------------------------------------------------
// Tipos de Eventos Societários & Desdobramentos (§Salvaguarda S17)
// ---------------------------------------------------------------------------

/**
 * Razão ou proporção estruturada de um evento de split ou reverse_split (§Salvaguarda S17).
 */
export interface CanonicalSplitRatio {
  /** Quantidade de cotas de origem (De cada X cotas). */
  ratioFrom: number;
  /** Quantidade de cotas de destino (Para Y cotas). */
  ratioTo: number;
  /** Fator multiplicador (para split) ou divisor (para reverse_split) positivo (> 0). */
  factor: number;
  /** Indica se o evento se trata de um grupamento (reverse split). */
  isReverseSplit: boolean;
}

/**
 * Diagnóstico auditável da resolução do fator de evento corporativo societário (§Salvaguarda S17).
 */
export interface CanonicalCorporateActionResolution {
  /** Tipo normalizado de evento corporativo. */
  type: "split" | "reverse_split";
  /** Fator numérico normalizado estritamente positivo (> 0). */
  factor: number;
  /** Proporção de origem (De). */
  ratioFrom: number;
  /** Proporção de destino (Para). */
  ratioTo: number;
  /** Se o fator foi obtido via fallback neutro (1.0). */
  isFallback: boolean;
  /** Notas de auditoria ou explicação da resolução. */
  notes?: string;
}

/**
 * Parâmetros de entrada para ajuste canônico de posição por split ou reverse_split (§Salvaguarda S17).
 */
export interface CanonicalPositionAdjustmentInput {
  /** Quantidade atual de cotas antes do evento societário. */
  currentQuantity: number;
  /** Custo total de aquisição acumulado antes do evento (em R$ ou moeda nativa). */
  currentTotalCost: number;
  /** Preço médio ponderado unitário antes do evento (opcional; derivado se omitido). */
  currentAveragePrice?: number;
  /** Fator da operação (> 0). */
  factor: number;
  /** Tipo da operação societária. */
  type: "split" | "reverse_split";
}

/**
 * Resultado do ajuste canônico de posição societária (§Salvaguarda S17).
 * Garante conservação estrita do Custo Total (totalCost constante).
 */
export interface CanonicalPositionAdjustmentResult {
  /** Nova quantidade de cotas ajustada. */
  newQuantity: number;
  /** Novo preço médio ponderado unitário ajustado. */
  newAveragePrice: number;
  /** Custo total da posição rigorosamente preservado (constante). */
  totalCost: number;
  /** Fator efetivo aplicado. */
  factor: number;
  /** Tipo de evento corporativo. */
  type: "split" | "reverse_split";
  /** Variação da quantidade de cotas (newQuantity - currentQuantity). */
  deltaQuantity: number;
  /** Variação do preço médio ponderado (newAveragePrice - currentAveragePrice). */
  deltaAveragePrice: number;
  /** Razão de origem. */
  ratioFrom: number;
  /** Razão de destino. */
  ratioTo: number;
  /** Indicador de conservação matemática do custo total. */
  isPreserved: boolean;
}

/**
 * Estado reconstituído de custódia e histórico de um ativo (§Salvaguarda S17).
 */
export interface CanonicalAssetLedgerState {
  /** Quantidade final de cotas em custódia. */
  quantity: number;
  /** Custo total acumulado em moeda nativa (conservado em desdobramentos). */
  totalCost: number;
  /** Preço médio ponderado final na moeda nativa. */
  averagePrice: number;
  /** Custo total histórico acumulado em BRL ponderado pela taxa de câmbio de cada compra (Fase 2). */
  totalCostBRL: number;
  /** Preço médio ponderado final em BRL (Fase 2). */
  averageCostBRL: number;
  /** Taxa de câmbio média histórica implícita da posição (totalCostBRL / totalCost) (Fase 2). */
  impliedHistoricalFxRate: number | null;
  /** Proventos totais acumulados no histórico. */
  dividendsTotal: number;
  /** Lucro/prejuízo realizado líquido em operações de venda ou amortização excedente (PnL Realizado). */
  realizedPnl: number;
  /** Quantidade total de eventos societários (splits / reverse_splits) processados. */
  corporateActionsCount: number;
  /** Quantidade total de transações processadas. */
  transactionsProcessed: number;
}

// ---------------------------------------------------------------------------
// Tipos de Resolução Cambial Dinâmica PTAX (§Salvaguarda S12)
// ---------------------------------------------------------------------------

/**
 * Procedência auditável da taxa de câmbio PTAX resolvida (§Salvaguarda S12).
 */
export type CanonicalPtaxSource =
  | "saved_monthly_price"
  | "explicit"
  | "live"
  | "previous_monthly_price"
  | "fallback";

/**
 * Detalhes estruturados da resolução cambial da taxa PTAX (§Salvaguarda S12).
 */
export interface CanonicalPtaxResolution {
  /** Taxa de câmbio USD/BRL resolvida (ex.: 5.78). */
  rate: number;
  /** Procedência auditável da taxa resolvida. */
  source: CanonicalPtaxSource;
  /** Ticker utilizado para a apuração da cotação (ex.: "USDBRL=X"). */
  ticker: string;
  /** Competência YYYY-MM referente à cotação ou corte temporal. */
  month: string;
  /** Indica se a taxa foi obtida a partir de um fallback na ausência de registro oficial salvo. */
  isFallback: boolean;
  /** Valor numérico bruto retornado da fonte (antes de qualquer normalização). */
  rawPrice?: number;
  /** Informações adicionais ou notas de auditoria. */
  notes?: string;
}

/**
 * Opções para a resolução da taxa de câmbio PTAX.
 */
export interface ResolvePtaxRateOptions {
  /** Taxa explícita de câmbio USD/BRL (ex.: passada via parâmetro direto). */
  explicitRate?: number | null;
  /** Cotação live/tempo real recente em caso de ausência de cotação histórica salva. */
  liveRate?: number | null;
  /** Taxa de fallback final na ausência de qualquer cotação (padrão: 5.25). */
  fallbackRate?: number;
  /** Se uma taxa explícita válida (> 0) deve ter precedência sobre o preço salvo no banco (padrão: false). */
  preferExplicitOverSaved?: boolean;
  /** Se deve buscar a cotação PTAX do mês anterior mais próximo caso o mês de corte não possua registro salvo (padrão: true). */
  allowPreviousMonthFallback?: boolean;
  /** Fuso horário civil para normalização de corte (padrão: CANONICAL_TIMEZONE_BR). */
  timeZone?: string;
}

// ---------------------------------------------------------------------------
// Tipos e Contratos da Reconciliação Canônica
// ---------------------------------------------------------------------------

export interface CanonicalReconciliationOptions {
  /** Tolerância monetária para deduplicação em R$ (padrão: 0.01). */
  monetaryToleranceBRL?: number;
  /** Se deve incluir accumulated_dividends dos ativos como proventos de histórico (Marco Zero). Padrão: true. */
  includeAccumulatedDividends?: boolean;
  /** Fuso horário civil para resolução de timestamps (padrão: "America/Sao_Paulo"). */
  timeZone?: string;
}

export interface CanonicalReconcileParams {
  /** Transações cadastradas no ledger (portfolio_transactions). */
  transactions?: readonly PortfolioTransaction[];
  /** Aportes e retiradas do bolso (portfolio_contributions). */
  contributions?: readonly PortfolioContribution[];
  /** Proventos registrados na tabela especializada (portfolio_dividends). */
  dividends?: readonly PortfolioDividend[];
  /** Ativos cadastrados na custódia (portfolio_assets) para resolução de ticker, classe e câmbio. */
  assets?: readonly PortfolioAsset[];
  /** Mapeamento adicional de ticker por asset_id. */
  tickerByAssetId?: ReadonlyMap<string, string>;
  /** Data civil de corte ou competência (YYYY-MM-DD ou YYYY-MM). Se informada, eventos posteriores são ignorados. */
  asOfDate?: string;
  /** Taxa de câmbio USD/BRL para conversão de proventos/transações em USD. Se omitida, resolvida dinamicamente via monthlyPrices. */
  usdRate?: number;
  /** Cotações históricas mensais (portfolio_monthly_prices) para resolução dinâmica de PTAX (USDBRL=X) (§Salvaguarda S12). */
  monthlyPrices?: readonly PortfolioMonthlyPrice[];
  /** Opções de tolerância e reconciliação. */
  options?: CanonicalReconciliationOptions;
}

/**
 * Provento reconciliado sem duplicidade.
 */
export interface CanonicalReconciledDividend {
  id: string;
  assetId: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  type: string; // "dividend" | "jcp" | "fii_yield" | "other"
  amountBRL: number;
  amountNative: number;
  currency: AssetCurrency;
  source: "table" | "ledger" | "accumulated" | "reconciled";
  originIds: string[];
  notes?: string | null;
  cleanNotes?: string | null;
  linkedTxId?: string | null;
  syncCash?: boolean;
  isAccumulatedBallast?: boolean;
}

/**
 * Fluxo externo do bolso reconciliado (aporte ou retirada externa).
 */
export interface CanonicalReconciledFlow {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // com sinal (+ aporte, - resgate)
  grossInflow: number; // >= 0
  grossOutflow: number; // >= 0
  isWithdrawal: boolean;
  isMarcoZero: boolean;
  assetId?: string | null;
  ticker?: string | null;
  notes?: string | null;
  cleanNotes?: string | null;
  linkedTxId?: string | null;
  explicitRatePct?: number | null;
  source: "contribution" | "cash_sell" | "reconciled";
  originIds: string[];
}

/**
 * Transação de custódia do ledger expurgada de proventos e duplicidades.
 */
export interface CanonicalReconciledTransaction {
  id: string;
  assetId: string;
  ticker: string;
  date: string; // YYYY-MM-DD
  type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total: number;
  currency: AssetCurrency;
  source: "ledger" | "contribution_derived";
  originId: string;
}

/**
 * Resumo estatístico auditável da reconciliação de eventos.
 */
export interface CanonicalReconciliationSummary {
  totalDividendsBRL: number;
  totalGrossContributionsBRL: number;
  totalGrossWithdrawalsBRL: number;
  netExternalCashFlowBRL: number;
  totalBuysBRL: number;
  totalSellsBRL: number;
  totalTransactionsCount: number;
  totalDividendsCount: number;
  totalContributionsCount: number;
  duplicateDividendsAvoided: number;
  duplicateWithdrawalsAvoided: number;
  duplicateContributionsAvoided: number;
  totalCorporateActionsCount?: number;
}

/**
 * Registro de auditoria de deduplicação e reconciliação.
 */
export interface CanonicalAuditEntry {
  category: "dividend" | "withdrawal" | "contribution";
  reason: string;
  date: string;
  amount: number;
  matchedIds: string[];
}

/**
 * Resultado completo da reconciliação de eventos de carteira.
 */
export interface CanonicalReconciliationResult {
  /** Proventos unificados sem duplicidade. */
  dividends: CanonicalReconciledDividend[];
  /** Fluxos externos de capital (aportes e resgates) unificados. */
  externalFlows: CanonicalReconciledFlow[];
  /** Transações de custódia filtradas (sem poluição de proventos). */
  custodyTransactions: CanonicalReconciledTransaction[];
  /** Mapa de total de proventos em BRL por assetId. */
  dividendsByAssetId: Map<string, number>;
  /** Mapa de total de proventos em moeda nativa por assetId. */
  dividendsNativeByAssetId: Map<string, number>;
  /** Mapa de total comprado em BRL por assetId. */
  boughtByAssetId: Map<string, number>;
  /** Mapa de total vendido em BRL por assetId. */
  soldByAssetId: Map<string, number>;
  /** Mapa de total de proventos em BRL por mês (YYYY-MM). */
  dividendsByMonth: Map<string, number>;
  /** Mapa de fluxo externo líquido em BRL por mês (YYYY-MM). */
  netFlowByMonth: Map<string, number>;
  /** Mapa de aportes brutos em BRL por mês (YYYY-MM). */
  grossContributionsByMonth: Map<string, number>;
  /** Mapa de resgates brutos em BRL por mês (YYYY-MM). */
  grossWithdrawalsByMonth: Map<string, number>;
  /** Data da primeira operação real na carteira (transação ou aporte). */
  firstOperationDate: string | null;
  /** Se foi detectado marco zero entre os aportes ou notas. */
  hasMarcoZero: boolean;
  /** Data civil de corte efetiva aplicada na filtragem (YYYY-MM-DD), se asOfDate foi fornecido. */
  cutoffDate?: string | null;
  /** Timestamp de corte exato aplicado no fim do dia (YYYY-MM-DDT23:59:59.999), se asOfDate foi fornecido. */
  cutoffTimestamp?: string | null;
  /** Taxa de câmbio USD/BRL (PTAX) efetivamente aplicada (§Salvaguarda S12). */
  effectiveUsdRate: number;
  /** Diagnóstico auditável da resolução cambial da taxa PTAX (§Salvaguarda S12). */
  ptaxResolution: CanonicalPtaxResolution;
  /** Resumo quantitativo auditável da reconciliação. */
  summary: CanonicalReconciliationSummary;
  /** Trilha de auditoria das deduplicações efetuadas. */
  auditLog: CanonicalAuditEntry[];
}

// ---------------------------------------------------------------------------
// Funções Utilitárias de Normalização Temporal e Textual (§Salvaguardas S4 e S13)
// ---------------------------------------------------------------------------

/** Fuso horário civil canônico brasileiro das operações financeiras e de mercado (B3/ANBIMA). */
export const CANONICAL_TIMEZONE_BR = "America/Sao_Paulo";

/**
 * Estrutura auditável de corte temporal civil com término exato às 23:59:59 (§Salvaguarda S13).
 */
export interface CanonicalCivilCutoff {
  /** Data civil de corte no formato YYYY-MM-DD (ex.: "2026-10-31"). */
  date: string;
  /** Timestamp de corte exato no fim do dia civil com milissegundos (ex.: "2026-10-31T23:59:59.999"). */
  timestamp: string;
  /** Timestamp civil simplificado no segundo final (ex.: "2026-10-31T23:59:59"). */
  endOfDaySeconds: string;
  /** Competência YYYY-MM associada ao corte civil. */
  month: string;
  /** Fuso horário civil adotado na resolução. */
  timeZone: string;
}

/**
 * Retorna o último dia civil do mês YYYY-MM no formato civil YYYY-MM-DD.
 * Computa anos bissextos e meses de 28, 29, 30 e 31 dias (§Salvaguarda S13).
 */
export function getMonthEndCutoffDate(monthOrDate: string): string {
  const trimmed = monthOrDate.trim();
  const match = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])/);
  if (!match || !match[1] || !match[2]) {
    return trimmed.slice(0, 10);
  }
  const year = Number.parseInt(match[1], 10);
  const monthNum = Number.parseInt(match[2], 10);
  // new Date(year, monthNum, 0) retorna o último dia do mês indicado (1-indexed)
  const lastDay = new Date(year, monthNum, 0).getDate();
  const padMonth = String(monthNum).padStart(2, "0");
  const padDay = String(lastDay).padStart(2, "0");
  return `${year}-${padMonth}-${padDay}`;
}

/**
 * Formata um objeto Date para string YYYY-MM-DD em um determinado fuso horário.
 */
function formatDateInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Normaliza qualquer formato de data ou timestamp ISO para a data civil local YYYY-MM-DD.
 * Imune a fusos horários e variações UTC (§Salvaguarda S13).
 *
 * Blindagens:
 * 1. Strings nulas ou vazias retornam "".
 * 2. Objetos Date são formatados para YYYY-MM-DD no fuso civil indicado (padrão: America/Sao_Paulo).
 * 3. Formato civil puro YYYY-MM-DD (ex.: "2026-10-31") é preservado sem conversões de fuso,
 *    eliminando qualquer risco de deslocamento retrógrado de dia por Date() nativo em UTC-3.
 * 4. Formato de competência YYYY-MM (ex.: "2026-10") é normalizado para o último dia civil daquele mês (ex.: "2026-10-31").
 * 5. Timestamps com fuso explícito (ex.: "2026-11-01T01:30:00Z" ou "2026-10-31T23:59:59-03:00")
 *    são convertidos explicitamente para a data civil no fuso de apuração,
 *    evitando que transações de fim de noite vazem artificialmente para o mês seguinte devido a UTC.
 * 6. Timestamps sem fuso explícito (ex.: "2026-10-31 23:59:59" ou "2026-10-31T23:59:59")
 *    têm sua componente de data civil YYYY-MM-DD extraída diretamente.
 */
export function normalizeDateToCivil(
  rawDate?: string | Date | null,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): string {
  if (!rawDate) return "";

  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return "";
    return formatDateInTimeZone(rawDate, timeZone);
  }

  const str = String(rawDate).trim();
  if (str.length === 0) return "";

  // 1. Padrão estrito de data civil YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Padrão de competência mensal YYYY-MM
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(str)) {
    return getMonthEndCutoffDate(str);
  }

  // 3. Timestamps com fuso horário explícito (Z ou offset +/-HH[:MM])
  const hasExplicitTz = /[zZ]|[+-]\d{2}(?::?\d{2})?$/.test(str);
  if (hasExplicitTz) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return formatDateInTimeZone(parsed, timeZone);
    }
  }

  // 4. Timestamps sem fuso explícito (ex.: "2026-10-31 23:59:59" ou "2026-10-31T23:59:59")
  const match = str.match(DATE_CIVIL_PATTERN);
  if (match && match[1] && match[2] && match[3]) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return str.slice(0, 10);
}

/**
 * Normaliza qualquer especificação de competência ou corte temporal para a data civil YYYY-MM-DD.
 * Se informado mês YYYY-MM, retorna o último dia civil do mês.
 * Se informada data YYYY-MM-DD ou timestamp, extrai a data civil correspondente (§Salvaguarda S13).
 */
export function normalizeCutoffDate(
  rawCutoff?: string | Date | null,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): string {
  if (!rawCutoff) return "";
  return normalizeDateToCivil(rawCutoff, timeZone);
}

/**
 * Retorna o timestamp de corte exato no fim do dia civil: YYYY-MM-DDT23:59:59.999 (§Salvaguarda S13).
 */
export function normalizeCutoffTimestamp(
  rawCutoff?: string | Date | null,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): string {
  const civilDate = normalizeCutoffDate(rawCutoff, timeZone);
  if (!civilDate) return "";
  return `${civilDate}T23:59:59.999`;
}

/**
 * Constrói o descritor canônico completo de corte civil para uma competência ou data (§Salvaguarda S13).
 */
export function getCanonicalCivilCutoff(
  rawCutoff?: string | Date | null,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): CanonicalCivilCutoff {
  const date = normalizeCutoffDate(rawCutoff, timeZone);
  const timestamp = date ? `${date}T23:59:59.999` : "";
  const endOfDaySeconds = date ? `${date}T23:59:59` : "";
  const month = date ? date.slice(0, 7) : "";
  return {
    date,
    timestamp,
    endOfDaySeconds,
    month,
    timeZone,
  };
}

/**
 * Compara se um evento temporal ocorreu em data/hora igual ou anterior ao corte civil (§Salvaguarda S13).
 *
 * Suporta comparações entre:
 * - Datas civis (YYYY-MM-DD vs YYYY-MM-DD);
 * - Evento com timestamp vs data/mês de corte (o corte cobre todo o dia civil até 23:59:59.999);
 * - Timestamps ISO com fusos UTC ou offset;
 *
 * Imune a vazamento de eventos por UTC ou viradas de fuso.
 */
export function isDateOnOrBefore(
  rawEventDate: string | Date,
  rawCutoff: string | Date,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): boolean {
  if (!rawEventDate || !rawCutoff) return true;

  const eventCivil = normalizeDateToCivil(rawEventDate, timeZone);
  const cutoffCivil = normalizeCutoffDate(rawCutoff, timeZone);

  if (!eventCivil || !cutoffCivil) return true;
  return eventCivil <= cutoffCivil;
}

/**
 * Compara dois instantes temporais com precisão de milissegundos.
 * Se o corte for uma data civil pura ou mês, o limite é estendido até 23:59:59.999 do dia de corte (§Salvaguarda S13).
 */
export function isWithinTemporalCutoff(
  rawEventDate: string | Date,
  rawCutoff: string | Date,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): boolean {
  if (!rawEventDate || !rawCutoff) return true;

  const eventCivil = normalizeDateToCivil(rawEventDate, timeZone);
  const cutoffCivil = normalizeCutoffDate(rawCutoff, timeZone);

  if (!eventCivil || !cutoffCivil) return true;
  if (eventCivil < cutoffCivil) return true;
  if (eventCivil > cutoffCivil) return false;

  // Mesma data civil. Se o cutoff fornecido contiver horário estrito diferente de fim de dia:
  const cutoffStr = typeof rawCutoff === "string" ? rawCutoff.trim() : "";
  const hasSpecificCutoffTime =
    cutoffStr.includes("T") &&
    !cutoffStr.includes("23:59:59") &&
    !/^\d{4}-\d{2}-\d{2}$/.test(cutoffStr);

  if (hasSpecificCutoffTime && typeof rawEventDate === "string" && rawEventDate.includes("T")) {
    const eventTime = new Date(rawEventDate).getTime();
    const cutoffTime = new Date(rawCutoff).getTime();
    if (!isNaN(eventTime) && !isNaN(cutoffTime)) {
      return eventTime <= cutoffTime;
    }
  }

  // Por padrão de Salvaguarda S13, o corte da competência cobre até 23:59:59.999 do dia
  return true;
}

/**
 * Remove diacríticos e acentos para comparação defensiva de strings (§Salvaguarda S4).
 */
export function normalizeLegacyText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Detecta se uma anotação de texto indica resgate/retirada histórica (§Salvaguarda S4).
 * Suporta formatos legados:
 * - Colchetes: "[Resgate]", "[Retirada]", "[Saque]"
 * - Parênteses: "(Resgate)", "(Retirada)", "(Saque)"
 * - Frases: "Retirada do Bolso", "Resgate do Bolso", "Saque do Bolso", "Resgate Histórico"
 * - Prefixos: "Resgate:", "Retirada:", "Saque:"
 */
export function isHistoricalWithdrawalNote(notes?: string | null): boolean {
  if (!notes) return false;
  const n = notes.toLowerCase();
  if (
    n.includes("[resgate]") ||
    n.includes("[retirada]") ||
    n.includes("[saque]") ||
    n.includes("(resgate)") ||
    n.includes("(retirada)") ||
    n.includes("(saque)")
  ) {
    return true;
  }
  const norm = normalizeLegacyText(notes);
  return (
    norm.startsWith("resgate:") ||
    norm.startsWith("retirada:") ||
    norm.startsWith("saque:") ||
    norm.startsWith("resgate -") ||
    norm.startsWith("retirada -") ||
    norm.startsWith("saque -") ||
    norm.includes("resgate do bolso") ||
    norm.includes("retirada do bolso") ||
    norm.includes("saque do bolso") ||
    norm.includes("resgate historico")
  );
}

/**
 * Detecta se uma anotação de texto indica Marco Zero ou aporte histórico inaugural (§Salvaguarda S4).
 * Suporta comparações resilientes a maiúsculas/minúsculas e acentuação gráfica.
 */
export function isMarcoZeroNote(notes?: string | null): boolean {
  if (!notes) return false;
  const norm = normalizeLegacyText(notes);
  return CANONICAL_MARCO_ZERO_TERMS.some((term) => {
    const normTerm = normalizeLegacyText(term);
    return norm.includes(normTerm);
  });
}

/**
 * Extrai identificador ou referência de transação vinculada em notas legadas (§Salvaguarda S4).
 * Suporta padrões:
 * - "[tx: 12345]" ou "[tx: buy_petr4]"
 * - "[tx_id: abc-def]"
 * - "[transacao: 999]" ou "[transação: 999]"
 * - "[origem: tx_123]"
 * - "tx: 12345" ou "tx_id: 12345"
 */
export function extractLinkedTxIdFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  // 1. Padrão bracketed: [tx: ...] / [tx_id: ...] / [origem: ...] / [transacao: ...]
  const bracketMatch = notes.match(/\[(?:tx|transacao|transação|tx_id|origem):\s*([^\]]+)\]/i);
  if (bracketMatch && bracketMatch[1]) {
    const id = bracketMatch[1].trim();
    if (id.length > 0) return id;
  }
  // 2. Padrão inline com separador de palavra: tx: <id> ou tx_id: <id>
  const inlineMatch = notes.match(/\b(?:tx|tx_id|transacao|transação|origem):\s*([a-zA-Z0-9_-]+)\b/i);
  if (inlineMatch && inlineMatch[1]) {
    const id = inlineMatch[1].trim();
    if (id.length > 0) return id;
  }
  return null;
}

/**
 * Detecta ticker de ativo mencionado explicitamente em colchetes dentro das notas (§Salvaguarda S4).
 * Ignora marcadores reservados de sistema (ex.: [Resgate], [Rent: ...], [tx: ...]).
 */
export function extractTickerFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const matches = notes.matchAll(/\[([A-Z0-9_.=-]{2,12})\]/gi);
  const reservedTags = new Set([
    "RESGATE",
    "RETIRADA",
    "SAQUE",
    "RENT",
    "TAXA",
    "RETORNO",
    "SPLIT",
    "TX",
    "ORIGEM",
    "PROVENTO",
    "MARCO",
    "DESDOBRAMENTO",
    "GRUPAMENTO",
  ]);
  for (const match of matches) {
    const candidate = match[1]?.toUpperCase().trim();
    if (candidate && !reservedTags.has(candidate) && !candidate.startsWith("RENT:") && !candidate.startsWith("TX:")) {
      return candidate;
    }
  }
  return null;
}

/**
 * Remove marcadores técnicos de sistema ([Resgate], [Retirada], [Saque], [Rent: ...], [tx: ...], etc.)
 * produzindo texto limpo para visualização na UI (§Salvaguarda S4).
 */
export function cleanLegacyNotes(notes?: string | null): string {
  if (!notes) return "";
  return notes
    .replace(/^\[(?:resgate|retirada|saque)\]\s*/i, "")
    .replace(/\[(?:rent|taxa|retorno):\s*[+-]?\d+(?:[.,]\d+)?%?\]/gi, "")
    .replace(/\[(?:tx|transacao|transação|tx_id|origem):\s*[^\]]+\]/gi, "")
    .replace(/\b(?:tx|tx_id|transacao|transação|origem):\s*[a-zA-Z0-9_-]+\b/gi, "")
    .replace(/\[(?:custo|valor):\s*[^\]]+\]/gi, "")
    .replace(/^[–—\-:\s]+|[–—\-:\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export { cleanContributionNotes };

/**
 * Contrato canônico de anotação legada normalizada (§Salvaguarda S4).
 */
export interface CanonicalLegacyNoteAnnotation {
  /** Texto bruto original sem alterações. */
  rawNotes: string;
  /** Texto amigável limpo para visualização do usuário. */
  cleanNotes: string;
  /** Indica se a nota representa um resgate ou retirada de capital. */
  isWithdrawal: boolean;
  /** Indica se a nota representa um Marco Zero / aporte inaugural. */
  isMarcoZero: boolean;
  /** Rentabilidade percentual explícita extraída de [Rent: %] ou [Taxa: %]. */
  explicitRatePct: number | null;
  /** Identificador de transação vinculado via tx: ou [tx: ...]. */
  linkedTxId: string | null;
  /** Ticker de ativo detectado em colchetes (ex.: [PETR4]). */
  detectedTicker: string | null;
  /** Indica se a nota sinaliza provento (dividendo/jcp/rendimento). */
  isDividendSignal: boolean;
  /** Lista de tags de sistema identificadas e expurgadas. */
  extractedTags: readonly string[];
}

/**
 * Parser determinístico e seguro de anotações livres legadas (§Salvaguarda S4).
 */
export function parseLegacyTextAnnotation(notes?: string | null): CanonicalLegacyNoteAnnotation {
  const raw = notes ?? "";
  const isWithdrawal = isHistoricalWithdrawalNote(raw);
  const isMarcoZero = isMarcoZeroNote(raw);
  const explicitRatePct = extractExplicitRateFromNotes(raw);
  const linkedTxId = extractLinkedTxIdFromNotes(raw);
  const detectedTicker = extractTickerFromNotes(raw);
  const clean = cleanLegacyNotes(raw);

  const lower = raw.toLowerCase();
  const isDividendSignal =
    lower.includes("dividendo") ||
    lower.includes("jcp") ||
    lower.includes("rendimento") ||
    lower.includes("provento");

  const tags: string[] = [];
  if (isWithdrawal) tags.push("withdrawal");
  if (isMarcoZero) tags.push("marco_zero");
  if (explicitRatePct !== null) tags.push(`rate:${explicitRatePct}%`);
  if (linkedTxId !== null) tags.push(`tx:${linkedTxId}`);
  if (detectedTicker !== null) tags.push(`ticker:${detectedTicker}`);
  if (isDividendSignal) tags.push("dividend");

  return {
    rawNotes: raw,
    cleanNotes: clean,
    isWithdrawal,
    isMarcoZero,
    explicitRatePct,
    linkedTxId,
    detectedTicker,
    isDividendSignal,
    extractedTags: Object.freeze(tags),
  };
}

/**
 * Arredonda valor monetário para 2 casas decimais.
 */
const round2 = (val: number): number =>
  Math.round((val + Number.EPSILON) * 100) / 100;

/**
 * Arredonda taxa ou cotação para 4 casas decimais (§FINANCIAL_MATH_SPEC §1).
 */
const round4 = (val: number): number =>
  Math.round((val + Number.EPSILON) * 10000) / 10000;

// ---------------------------------------------------------------------------
// Resolução Dinâmica da Taxa de Câmbio PTAX (§Salvaguarda S12)
// ---------------------------------------------------------------------------

/**
 * Detecta se um ticker representa a taxa cambial USD/BRL (PTAX) (§Salvaguarda S12).
 */
export function isPtaxExchangeTicker(ticker?: string | null): boolean {
  if (!ticker) return false;
  const clean = ticker.trim().toUpperCase();
  return clean === CANONICAL_PTAX_TICKER || PTAX_TICKER_ALIASES.includes(clean);
}

/**
 * Localiza o registro de cotação PTAX (USDBRL=X) na coleção de preços mensais para a competência indicada.
 */
export function findPtaxMonthlyPrice(
  monthlyPrices?: readonly PortfolioMonthlyPrice[] | readonly { ticker: string; month?: string; price: number }[] | null,
  monthOrCutoffDate?: string | Date | null,
  timeZone: string = CANONICAL_TIMEZONE_BR,
): PortfolioMonthlyPrice | undefined {
  if (!monthlyPrices || monthlyPrices.length === 0) return undefined;
  const targetCivilDate = normalizeDateToCivil(monthOrCutoffDate, timeZone);
  const targetMonth = targetCivilDate ? targetCivilDate.slice(0, 7) : "";

  return (monthlyPrices as PortfolioMonthlyPrice[]).find((p) => {
    if (!isPtaxExchangeTicker(p.ticker)) return false;
    if (targetMonth && p.month && p.month.slice(0, 7) !== targetMonth) return false;
    return Number(p.price) > 0;
  });
}

/**
 * Resolução dinâmica e auditável da taxa de câmbio PTAX a partir de portfolio_monthly_prices para o ticker USDBRL=X (§Salvaguarda S12).
 *
 * Cascata de Precedência Inegociável:
 *   1. Taxa explícita prioritária (quando preferExplicitOverSaved === true e explicitRate > 0);
 *   2. Cotação oficial salva em `portfolio_monthly_prices` para a competência exata (ticker USDBRL=X e aliases com price > 0);
 *   3. Taxa explícita válida (quando explicitRate > 0);
 *   4. Cotação do mês anterior mais recente arquivada em `portfolio_monthly_prices` (quando allowPreviousMonthFallback !== false);
 *   5. Cotação live recente em tempo real (quando liveRate > 0);
 *   6. Fallback soberano do sistema (5.25 — FALLBACK_USD_RATE).
 */
export function resolveCanonicalPtaxResolution(
  monthlyPrices?: readonly PortfolioMonthlyPrice[] | readonly { ticker: string; month?: string; price: number }[] | null,
  monthOrCutoffDate?: string | Date | null,
  options?: ResolvePtaxRateOptions,
): CanonicalPtaxResolution {
  const timeZone = options?.timeZone ?? CANONICAL_TIMEZONE_BR;
  const targetCivilDate = normalizeDateToCivil(monthOrCutoffDate, timeZone);
  const targetMonth = targetCivilDate ? targetCivilDate.slice(0, 7) : "";
  const fallbackRate = options?.fallbackRate ?? FALLBACK_USD_RATE;

  // 1. Taxa explícita prioritária
  if (options?.preferExplicitOverSaved && options?.explicitRate && options.explicitRate > 0) {
    return {
      rate: round4(options.explicitRate),
      source: "explicit",
      ticker: CANONICAL_PTAX_TICKER,
      month: targetMonth,
      isFallback: false,
      rawPrice: options.explicitRate,
      notes: "Taxa explícita informada com preferência sobre registro salvo",
    };
  }

  // 2. Registro oficial salvo em portfolio_monthly_prices para a competência exata
  if (monthlyPrices && monthlyPrices.length > 0) {
    const savedExact = (monthlyPrices as PortfolioMonthlyPrice[]).find((p) => {
      if (!isPtaxExchangeTicker(p.ticker)) return false;
      const pMonth = p.month ? p.month.slice(0, 7) : "";
      if (targetMonth && pMonth && pMonth !== targetMonth) return false;
      return Number(p.price) > 0;
    });

    if (savedExact) {
      const priceNum = Number(savedExact.price);
      return {
        rate: round4(priceNum),
        source: "saved_monthly_price",
        ticker: savedExact.ticker.toUpperCase().trim(),
        month: targetMonth || (savedExact.month ? savedExact.month.slice(0, 7) : ""),
        isFallback: false,
        rawPrice: priceNum,
        notes: `Cotação oficial de fechamento gravada em portfolio_monthly_prices (${savedExact.source ?? "api"})`,
      };
    }
  }

  // 3. Taxa explícita padrão
  if (options?.explicitRate && options.explicitRate > 0) {
    return {
      rate: round4(options.explicitRate),
      source: "explicit",
      ticker: CANONICAL_PTAX_TICKER,
      month: targetMonth,
      isFallback: false,
      rawPrice: options.explicitRate,
      notes: "Taxa explícita informada nos parâmetros de cálculo",
    };
  }

  // 4. Fallback para competência anterior mais recente salva em portfolio_monthly_prices
  if (options?.allowPreviousMonthFallback !== false && monthlyPrices && monthlyPrices.length > 0 && targetMonth) {
    const historicalPtaxRows = (monthlyPrices as PortfolioMonthlyPrice[])
      .filter((p) => {
        if (!isPtaxExchangeTicker(p.ticker)) return false;
        const pMonth = p.month ? p.month.slice(0, 7) : "";
        return pMonth && pMonth < targetMonth && Number(p.price) > 0;
      })
      .sort((a, b) => (b.month ?? "").localeCompare(a.month ?? ""));

    const mostRecentPrevious = historicalPtaxRows[0];
    if (mostRecentPrevious) {
      const priceNum = Number(mostRecentPrevious.price);
      return {
        rate: round4(priceNum),
        source: "previous_monthly_price",
        ticker: mostRecentPrevious.ticker.toUpperCase().trim(),
        month: mostRecentPrevious.month ? mostRecentPrevious.month.slice(0, 7) : "",
        isFallback: true,
        rawPrice: priceNum,
        notes: `Cotação de competência anterior mais recente (${mostRecentPrevious.month})`,
      };
    }
  }

  // 5. Cotação live / tempo real recente
  if (options?.liveRate && options.liveRate > 0) {
    return {
      rate: round4(options.liveRate),
      source: "live",
      ticker: CANONICAL_PTAX_TICKER,
      month: targetMonth,
      isFallback: true,
      rawPrice: options.liveRate,
      notes: "Cotação estimada em tempo real",
    };
  }

  // 6. Fallback final do sistema
  return {
    rate: round4(fallbackRate),
    source: "fallback",
    ticker: CANONICAL_PTAX_TICKER,
    month: targetMonth,
    isFallback: true,
    rawPrice: fallbackRate,
    notes: `Fallback estático institucional (${fallbackRate})`,
  };
}

/**
 * Resolução dinâmica da taxa de câmbio PTAX a partir de portfolio_monthly_prices para o ticker USDBRL=X (§Salvaguarda S12).
 * Retorna o valor numérico puro da taxa cambial (ex: 5.78).
 */
export function resolveDynamicPtaxRate(
  monthlyPrices?: readonly PortfolioMonthlyPrice[] | readonly { ticker: string; month?: string; price: number }[] | null,
  monthOrCutoffDate?: string | Date | null,
  options?: ResolvePtaxRateOptions,
): number {
  return resolveCanonicalPtaxResolution(monthlyPrices, monthOrCutoffDate, options).rate;
}

// ---------------------------------------------------------------------------
// Normalização de Eventos Societários & Splits (§Salvaguarda S17)
// ---------------------------------------------------------------------------

/**
 * Peso de precedência de operações para ordenação determinística na mesma data civil (§Salvaguarda S17):
 * 1. Eventos corporativos societários (split / reverse_split): peso 0 (abertura de pregão);
 * 2. Compras e subscrições (buy / subscription): peso 1 (provisionam custódia disponível);
 * 3. Vendas e resgates (sell): peso 2 (liquidam da custódia disponível);
 * 4. Demais operações (dividendos, etc.): peso 3.
 */
export function getTransactionIntradayWeight(type: string): number {
  const clean = String(type || "").trim().toLowerCase();
  if (isCorporateActionType(clean)) return 0;
  if (clean === "buy" || clean === "subscription" || clean === "compra" || clean === "subscricao" || clean === "subscrição") {
    return 1;
  }
  if (clean === "sell" || clean === "venda" || clean === "resgate") {
    return 2;
  }
  return 3;
}

/**
 * Detecta se uma operação representa desdobramento de cotas (split) (§Salvaguarda S17).
 */
export function isSplitType(type?: string | null): boolean {
  if (!type) return false;
  const clean = type.trim().toLowerCase();
  return CANONICAL_SPLIT_ALIASES.includes(clean);
}

/**
 * Detecta se uma operação representa grupamento de cotas (reverse split) (§Salvaguarda S17).
 */
export function isReverseSplitType(type?: string | null): boolean {
  if (!type) return false;
  const clean = type.trim().toLowerCase();
  return CANONICAL_REVERSE_SPLIT_ALIASES.includes(clean);
}

/**
 * Detecta se uma operação se trata de qualquer evento corporativo societário (split ou reverse_split) (§Salvaguarda S17).
 */
export function isCorporateActionType(type?: string | null): boolean {
  return isSplitType(type) || isReverseSplitType(type);
}

/**
 * Normaliza o tipo de evento corporativo para os literais canônicos "split" ou "reverse_split" (§Salvaguarda S17).
 */
export function normalizeCorporateActionType(type?: string | null): "split" | "reverse_split" | null {
  if (isSplitType(type)) return "split";
  if (isReverseSplitType(type)) return "reverse_split";
  return null;
}

/**
 * Extrai proporções e fatores de split / reverse_split a partir de anotações de texto livre (§Salvaguardas S4 e S17).
 *
 * Padrões suportados:
 * - Proporções: "1:2", "1/2", "1 para 2", "1 -> 2", "2:1", "10:1", "10 para 1", "10/1"
 * - Contextualizados: "Desdobramento 1:5", "Grupamento 10:1", "Split 1:4", "Reverse Split 5:1"
 * - Fatores declarados: "Fator: 3", "Fator 4.5", "ratio: 1:10"
 */
export function extractSplitRatioFromNotes(notes?: string | null): CanonicalSplitRatio | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (trimmed.length === 0) return null;

  // 1. Proporção explícita no formato X:Y, X/Y, X para Y, X -> Y
  const ratioMatch = /(?:ratio|proporcao|proporção)?\s*(\d+(?:[.,]\d+)?)\s*(?::|\/|\bpara\b|->)\s*(\d+(?:[.,]\d+)?)/i.exec(trimmed);
  if (ratioMatch && ratioMatch[1] && ratioMatch[2]) {
    const rawFrom = Number(ratioMatch[1].replace(",", "."));
    const rawTo = Number(ratioMatch[2].replace(",", "."));
    if (rawFrom > 0 && rawTo > 0) {
      const isReverse = rawFrom > rawTo || isReverseSplitType(trimmed);
      const factor = isReverse ? rawFrom / rawTo : rawTo / rawFrom;
      return {
        ratioFrom: rawFrom,
        ratioTo: rawTo,
        factor: round4(factor),
        isReverseSplit: isReverse,
      };
    }
  }

  // 2. Fator numérico isolado: "Fator: 2", "Fator 3.5"
  const factorMatch = /\bfator[:\s]+(\d+(?:[.,]\d+)?)/i.exec(trimmed);
  if (factorMatch && factorMatch[1]) {
    const f = Number(factorMatch[1].replace(",", "."));
    if (f > 0) {
      const isReverse = isReverseSplitType(trimmed);
      return {
        ratioFrom: isReverse ? f : 1,
        ratioTo: isReverse ? 1 : f,
        factor: round4(f),
        isReverseSplit: isReverse,
      };
    }
  }

  return null;
}

/**
 * Resolve o fator multiplicador/divisor canônico de um evento societário (§Salvaguarda S17).
 *
 * Cascata de Precedência Inegociável:
 * 1. Fator numérico válido no campo quantity (> 0 e != 1);
 * 2. Proporção encontrada na anotação notes (ex.: "1:2", "10:1", "Fator: 4");
 * 3. Quantidade 1.0 declarada (operação neutra 1:1);
 * 4. Fallback seguro: fator 1.0 (operação neutra).
 */
export function resolveCanonicalCorporateActionFactor(tx: {
  type: string;
  quantity?: number | null;
  notes?: string | null;
}): CanonicalCorporateActionResolution {
  const normType = normalizeCorporateActionType(tx.type) ?? (isReverseSplitType(tx.type) ? "reverse_split" : "split");
  const rawQty = Number(tx.quantity) || 0;

  // 1. tx.quantity válido (> 0 e != 1)
  if (rawQty > 0 && rawQty !== 1) {
    const factor = round4(rawQty);
    return {
      type: normType,
      factor,
      ratioFrom: normType === "reverse_split" ? factor : 1,
      ratioTo: normType === "reverse_split" ? 1 : factor,
      isFallback: false,
      notes: `Fator extraído diretamente do campo quantity (${factor})`,
    };
  }

  // 2. Análise de notes
  if (tx.notes) {
    const parsedRatio = extractSplitRatioFromNotes(tx.notes);
    if (parsedRatio && parsedRatio.factor > 0) {
      const resolvedType = parsedRatio.isReverseSplit ? "reverse_split" : normType;
      return {
        type: resolvedType,
        factor: parsedRatio.factor,
        ratioFrom: parsedRatio.ratioFrom,
        ratioTo: parsedRatio.ratioTo,
        isFallback: false,
        notes: `Fator extraído das anotações (${parsedRatio.ratioFrom}:${parsedRatio.ratioTo})`,
      };
    }
  }

  // 3. tx.quantity == 1
  if (rawQty === 1) {
    return {
      type: normType,
      factor: 1,
      ratioFrom: 1,
      ratioTo: 1,
      isFallback: false,
      notes: "Fator unitário neutro (1:1)",
    };
  }

  // 4. Fallback seguro
  return {
    type: normType,
    factor: 1,
    ratioFrom: 1,
    ratioTo: 1,
    isFallback: true,
    notes: "Fator societário não especificado; adotado fallback neutro 1",
  };
}

/**
 * Aplica desdobramento (split) ou grupamento (reverse_split) sobre uma posição,
 * preservando RIGOROSAMENTE o Custo Total constante em R$ ou moeda nativa ao centavo (§Salvaguarda S17).
 *
 * Invariante Fundamental da Salvaguarda S17:
 *   Qtd_nova * PM_novo = CustoTotal constante
 *
 * Se split:
 *   Qtd_nova = Qtd_antiga * Fator
 *   PM_novo = CustoTotal / Qtd_nova
 *
 * Se reverse_split:
 *   Qtd_nova = Qtd_antiga / Fator
 *   PM_novo = CustoTotal / Qtd_nova
 */
export function applyCanonicalSplitToPosition(
  input: CanonicalPositionAdjustmentInput,
): CanonicalPositionAdjustmentResult {
  const currentQuantity = Math.max(0, Number(input.currentQuantity) || 0);
  const totalCost = round2(Math.max(0, Number(input.currentTotalCost) || 0));
  const rawFactor = Number(input.factor) || 1;
  const factor = rawFactor > 0 ? rawFactor : 1;
  const isSplit = input.type === "split";

  if (currentQuantity <= 0) {
    return {
      newQuantity: 0,
      newAveragePrice: 0,
      totalCost: 0,
      factor,
      type: input.type,
      deltaQuantity: 0,
      deltaAveragePrice: 0,
      ratioFrom: isSplit ? 1 : factor,
      ratioTo: isSplit ? factor : 1,
      isPreserved: true,
    };
  }

  // Novo quantitativo com precisão decimal adequada (4 casas decimais para cotas fracionárias/BDRs)
  let newQuantity: number;
  if (isSplit) {
    newQuantity = Math.round((currentQuantity * factor) * 10000) / 10000;
  } else {
    newQuantity = Math.round((currentQuantity / factor) * 10000) / 10000;
  }

  // Preço médio recalculado dividindo o CUSTO TOTAL CONSTANTE pela NOVA QUANTIDADE
  // Preservação estrita: Qtd_nova * PM_novo = CustoTotal
  const newAveragePrice = newQuantity > 0 ? round4(totalCost / newQuantity) : 0;
  const currentAveragePrice = input.currentAveragePrice ?? (currentQuantity > 0 ? round4(totalCost / currentQuantity) : 0);

  return {
    newQuantity,
    newAveragePrice,
    totalCost, // PRESERVADO RIGOROSAMENTE CONSTANTE AO CENTAVO
    factor,
    type: input.type,
    deltaQuantity: Math.round((newQuantity - currentQuantity) * 10000) / 10000,
    deltaAveragePrice: round4(newAveragePrice - currentAveragePrice),
    ratioFrom: isSplit ? 1 : factor,
    ratioTo: isSplit ? factor : 1,
    isPreserved: true,
  };
}

export interface ComputeCanonicalAssetLedgerOptions {
  currency?: AssetCurrency;
  defaultFxRate?: number;
  monthlyPrices?: readonly PortfolioMonthlyPrice[] | readonly { ticker: string; month?: string; price: number }[] | null;
}

/**
 * Reconstrói deterministicamente a evolução de custódia e custo de um ativo
 * ao longo de uma sequência cronológica de transações, aplicando a Salvaguarda S17
 * em cada desdobramento ou grupamento, a Salvaguarda S16 em vendas parciais e
 * a segregação estrita entre custo em moeda original e custo histórico em BRL (§Fase 2 / Etapa 2.1).
 */
export function computeCanonicalAssetLedger(
  transactions: readonly {
    date: string;
    type: string;
    quantity?: number | null;
    price?: number | null;
    total?: number | null;
    fx_rate?: number | null;
    total_cost_brl?: number | null;
    total_brl?: number | null;
    notes?: string | null;
  }[],
  initialPosition?: {
    quantity: number;
    totalCost: number;
    averagePrice?: number;
    totalCostBRL?: number;
    averageCostBRL?: number;
  },
  options?: ComputeCanonicalAssetLedgerOptions,
): CanonicalAssetLedgerState {
  let runningQty = initialPosition ? Math.max(0, initialPosition.quantity) : 0;
  let runningCost = initialPosition ? Math.max(0, round2(initialPosition.totalCost)) : 0;
  const isUSD = options?.currency === "USD";
  const defaultFx = options?.defaultFxRate && options.defaultFxRate > 0 ? options.defaultFxRate : 1.0;
  let runningCostBRL = initialPosition
    ? Math.max(0, round2(initialPosition.totalCostBRL ?? (isUSD ? runningCost * defaultFx : runningCost)))
    : 0;
  let dividendsTotal = 0;
  let realizedPnl = 0;
  let corporateActionsCount = 0;
  let transactionsProcessed = 0;

  const sorted = [...transactions].sort((a, b) => {
    const dateA = normalizeDateToCivil(a.date);
    const dateB = normalizeDateToCivil(b.date);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const weightA = getTransactionIntradayWeight(a.type);
    const weightB = getTransactionIntradayWeight(b.type);
    if (weightA !== weightB) return weightA - weightB;
    return 0;
  });

  for (const tx of sorted) {
    transactionsProcessed++;
    const rawQty = Number(tx.quantity) || 0;
    const rawPrice = Number(tx.price) || 0;
    const rawTotal = Number(tx.total) || rawQty * rawPrice;

    if (isDividendType(tx.type)) {
      dividendsTotal += round2(rawTotal);
      continue;
    }

    if (isCorporateActionType(tx.type)) {
      corporateActionsCount++;
      const resolution = resolveCanonicalCorporateActionFactor(tx);
      const adj = applyCanonicalSplitToPosition({
        currentQuantity: runningQty,
        currentTotalCost: runningCost,
        factor: resolution.factor,
        type: resolution.type,
      });
      runningQty = adj.newQuantity;
      runningCost = adj.totalCost; // RIGOROSAMENTE INALTERADO
      // runningCostBRL RIGOROSAMENTE INALTERADO
      continue;
    }

    // Resolução da taxa de câmbio efetiva da transação
    let txFxRate = 1.0;
    if (tx.fx_rate != null && Number(tx.fx_rate) > 0) {
      txFxRate = Number(tx.fx_rate);
    } else if (isUSD) {
      if (options?.monthlyPrices) {
        txFxRate = resolveDynamicPtaxRate(options.monthlyPrices, tx.date, { explicitRate: options?.defaultFxRate });
      } else {
        txFxRate = defaultFx;
      }
    }

    const getTxTotalBRL = (): number => {
      if (tx.total_cost_brl != null && Number(tx.total_cost_brl) > 0) {
        return round2(Number(tx.total_cost_brl));
      }
      if (tx.total_brl != null && Number(tx.total_brl) > 0) {
        return round2(Number(tx.total_brl));
      }
      return round2(rawTotal * txFxRate);
    };

    const normType = tx.type.toLowerCase().trim();
    if (normType === "buy" || normType === "subscription" || normType === "asset_buy") {
      const buyTotal = round2(rawTotal);
      runningQty = Math.round((runningQty + rawQty) * 10000) / 10000;
      runningCost = round2(runningCost + buyTotal);
      runningCostBRL = round2(runningCostBRL + getTxTotalBRL());
    } else if (normType === "sell" || normType === "asset_sell") {
      if (runningQty > 0) {
        const pmNative = runningCost / runningQty;
        const soldQty = Math.min(runningQty, rawQty);
        const costBasisNative = round2(soldQty * pmNative);
        const f = soldQty / runningQty;
        const costBasisBRL = round2(runningCostBRL * f);
        const proceedsNative = round2(rawTotal > 0 ? rawTotal : soldQty * rawPrice);
        const proceedsBRL = round2(proceedsNative * txFxRate);
        realizedPnl += round2(proceedsBRL - costBasisBRL);

        runningQty = Math.max(0, Math.round((runningQty - rawQty) * 10000) / 10000);
        if (runningQty === 0) {
          runningCost = 0;
          runningCostBRL = 0;
        } else {
          runningCost = Math.max(0, round2(runningCost - costBasisNative));
          runningCostBRL = Math.max(0, round2(runningCostBRL - costBasisBRL));
        }
      } else {
        // Venda a descoberto acidental (Salvaguarda S16): mantém custo 0
        const proceedsNative = round2(rawTotal > 0 ? rawTotal : rawQty * rawPrice);
        const proceedsBRL = round2(proceedsNative * txFxRate);
        realizedPnl += proceedsBRL;
        runningQty = 0;
        runningCost = 0;
        runningCostBRL = 0;
      }
    } else if (normType === "amortization" || normType === "amortizacao") {
      const amortAmountNative = round2(rawTotal > 0 ? rawTotal : rawQty * rawPrice);
      const amortAmountBRL = round2(amortAmountNative * txFxRate);
      if (amortAmountBRL > runningCostBRL) {
        realizedPnl += round2(amortAmountBRL - runningCostBRL);
        runningCostBRL = 0;
      } else {
        runningCostBRL = Math.max(0, round2(runningCostBRL - amortAmountBRL));
      }
      if (amortAmountNative > runningCost) {
        runningCost = 0;
      } else {
        runningCost = Math.max(0, round2(runningCost - amortAmountNative));
      }
    } else if (normType === "bonus_shares" || normType === "bonification" || normType === "bonificacao") {
      const bonusTotalNative = round2(rawTotal);
      const bonusTotalBRL = getTxTotalBRL();
      runningQty = Math.round((runningQty + rawQty) * 10000) / 10000;
      runningCost = round2(runningCost + bonusTotalNative);
      runningCostBRL = round2(runningCostBRL + bonusTotalBRL);
    }
  }

  const averagePrice = runningQty > 0 ? round4(runningCost / runningQty) : 0;
  const averageCostBRL = runningQty > 0 ? round4(runningCostBRL / runningQty) : 0;
  const impliedHistoricalFxRate =
    runningQty > 0 && runningCost > 0 && runningCostBRL > 0
      ? round4(runningCostBRL / runningCost)
      : null;

  return {
    quantity: runningQty,
    totalCost: runningCost,
    averagePrice,
    totalCostBRL: runningCostBRL,
    averageCostBRL,
    impliedHistoricalFxRate,
    dividendsTotal: round2(dividendsTotal),
    realizedPnl: round2(realizedPnl),
    corporateActionsCount,
    transactionsProcessed,
  };
}

// ---------------------------------------------------------------------------
// Motor Central de Reconciliação Unificada de Eventos
// ---------------------------------------------------------------------------

/**
 * Unifica a reconciliação entre `portfolio_transactions`, `portfolio_contributions` e `portfolio_dividends`.
 *
 * Elimina duplicatas de proventos cruzados, alinha retiradas de caixa entre transações de venda e aportes,
 * preserva compras originadas via aporte direto e computa resumos contábeis determinísticos.
 */
export function reconcilePortfolioEvents(
  params: CanonicalReconcileParams,
): CanonicalReconciliationResult {
  const {
    transactions = [],
    contributions = [],
    dividends = [],
    assets = [],
    tickerByAssetId,
    asOfDate,
    usdRate,
    monthlyPrices,
    options = {},
  } = params;

  const monetaryToleranceBRL = options.monetaryToleranceBRL ?? 0.01;
  const includeAccumulatedDividends = options.includeAccumulatedDividends ?? true;
  const timeZone = options.timeZone ?? CANONICAL_TIMEZONE_BR;
  const cutoffCivil = asOfDate ? normalizeCutoffDate(asOfDate, timeZone) : null;
  const cutoffTimestamp = cutoffCivil ? normalizeCutoffTimestamp(cutoffCivil, timeZone) : null;

  // Resolução dinâmica de taxa de câmbio PTAX (§Salvaguarda S12)
  const ptaxResolution = resolveCanonicalPtaxResolution(
    monthlyPrices,
    asOfDate,
    {
      explicitRate: usdRate,
      preferExplicitOverSaved: Boolean(usdRate && usdRate !== 1.0 && usdRate !== FALLBACK_USD_RATE),
      fallbackRate: usdRate && usdRate > 0 ? usdRate : 1.0,
      timeZone,
    },
  );
  const effectiveUsdRate = ptaxResolution.rate;

  // 1. Mapeamento de Ativos e Tickers
  const assetById = new Map<string, PortfolioAsset>();
  const tickerToAssetId = new Map<string, string>();
  const cashAssetIds = new Set<string>();

  for (const asset of assets) {
    assetById.set(asset.id, asset);
    const upperTicker = asset.ticker.trim().toUpperCase();
    tickerToAssetId.set(upperTicker, asset.id);

    const isCash =
      upperTicker === "CAIXA" ||
      upperTicker === "CASH" ||
      isCashAssetClass(asset.asset_class);
    if (isCash) {
      cashAssetIds.add(asset.id);
    }
  }

  const resolveTicker = (assetId?: string | null, directTicker?: string | null): string => {
    if (directTicker && directTicker.trim().length > 0) {
      return directTicker.trim().toUpperCase();
    }
    if (assetId) {
      const fromMap = tickerByAssetId?.get(assetId);
      if (fromMap) return fromMap.trim().toUpperCase();
      const fromAsset = assetById.get(assetId)?.ticker;
      if (fromAsset) return fromAsset.trim().toUpperCase();
    }
    return "";
  };

  const resolveAssetId = (assetId?: string | null, directTicker?: string | null): string => {
    if (assetId && assetId.trim().length > 0) return assetId.trim();
    if (directTicker) {
      const mapped = tickerToAssetId.get(directTicker.trim().toUpperCase());
      if (mapped) return mapped;
    }
    return "";
  };

  const resolveCurrency = (assetId?: string | null): AssetCurrency => {
    if (!assetId) return "BRL";
    return assetById.get(assetId)?.currency === "USD" ? "USD" : "BRL";
  };

  const auditLog: CanonicalAuditEntry[] = [];
  let duplicateDividendsAvoided = 0;
  let duplicateWithdrawalsAvoided = 0;
  let duplicateContributionsAvoided = 0;

  // -------------------------------------------------------------------------
  // 2. Reconciliação de Proventos (portfolio_dividends vs portfolio_transactions)
  // -------------------------------------------------------------------------

  // Filtrar proventos brutos com corte temporal civil
  const rawTableDividends = dividends.filter((d) => {
    const dDate = normalizeDateToCivil(d.date, timeZone);
    if (!dDate) return false;
    if (cutoffCivil && dDate > cutoffCivil) return false;
    return (Number(d.amount) || 0) > 0;
  });

  // Filtrar transações de proventos do ledger com corte temporal civil
  const rawTxDividends = transactions.filter((t) => {
    if (!isDividendType(t.type)) return false;
    const tDate = normalizeDateToCivil(t.date, timeZone);
    if (!tDate) return false;
    if (cutoffCivil && tDate > cutoffCivil) return false;
    const total = Number(t.total) || (Number(t.quantity) || 0) * (Number(t.price) || 0);
    return total > 0;
  });

  const reconciledDividends: CanonicalReconciledDividend[] = [];
  const matchedTxDividendIds = new Set<string>();

  // Processa proventos cadastrados na tabela de dividendos como base primária
  for (const div of rawTableDividends) {
    const dDate = normalizeDateToCivil(div.date, timeZone);
    const assetId = resolveAssetId(div.asset_id, div.ticker);
    const ticker = resolveTicker(assetId, div.ticker);
    const currency = resolveCurrency(assetId);
    const fx = currency === "USD" ? Math.max(0.01, effectiveUsdRate) : 1.0;

    const rawAmount = Number(div.amount) || 0;
    const amountNative = round2(rawAmount);
    const amountBRL = round2(amountNative * fx);
    const divAnnotation = parseLegacyTextAnnotation(div.notes);
    const linkedTxId = divAnnotation.linkedTxId;

    // Procura transação equivalente no ledger para deduplicar
    let matchedTx: PortfolioTransaction | null = null;
    if (linkedTxId) {
      matchedTx = rawTxDividends.find((t) => t.id === linkedTxId && !matchedTxDividendIds.has(t.id)) ?? null;
    }
    if (!matchedTx) {
      for (const tx of rawTxDividends) {
        if (matchedTxDividendIds.has(tx.id)) continue;
        const txAssetId = resolveAssetId(tx.asset_id);
        if (txAssetId && assetId && txAssetId !== assetId) continue;

        const txDate = normalizeDateToCivil(tx.date, timeZone);
        if (txDate !== dDate) continue;

        const txRawTotal = Number(tx.total) || (Number(tx.quantity) || 0) * (Number(tx.price) || 0);
        const txAmount = round2(txRawTotal);

        // Compara valor nativo ou valor BRL dentro da tolerância monetária
        if (Math.abs(amountNative - txAmount) <= monetaryToleranceBRL || Math.abs(amountBRL - txAmount) <= monetaryToleranceBRL) {
          matchedTx = tx;
          break;
        }
      }
    }

    if (matchedTx) {
      matchedTxDividendIds.add(matchedTx.id);
      duplicateDividendsAvoided += 1;
      auditLog.push({
        category: "dividend",
        reason: linkedTxId
          ? "Provento em portfolio_dividends pareado com lançamento no ledger por vínculo explícito tx:"
          : "Provento em portfolio_dividends pareado com lançamento no ledger portfolio_transactions",
        date: dDate,
        amount: amountBRL,
        matchedIds: [div.id, matchedTx.id],
      });

      reconciledDividends.push({
        id: div.id,
        assetId,
        ticker,
        date: dDate,
        type: matchedTx.type || "dividend",
        amountBRL,
        amountNative,
        currency,
        source: "reconciled",
        originIds: [div.id, matchedTx.id],
        notes: div.notes ?? null,
        cleanNotes: divAnnotation.cleanNotes || null,
        linkedTxId: matchedTx.id,
        syncCash: div.sync_cash ?? undefined,
      });
    } else {
      reconciledDividends.push({
        id: div.id,
        assetId,
        ticker,
        date: dDate,
        type: "dividend",
        amountBRL,
        amountNative,
        currency,
        source: "table",
        originIds: [div.id],
        notes: div.notes ?? null,
        cleanNotes: divAnnotation.cleanNotes || null,
        linkedTxId: divAnnotation.linkedTxId,
        syncCash: div.sync_cash ?? undefined,
      });
    }
  }

  // Adiciona transações de proventos do ledger que não existiam na tabela de dividendos
  for (const tx of rawTxDividends) {
    if (matchedTxDividendIds.has(tx.id)) continue;

    const tDate = normalizeDateToCivil(tx.date, timeZone);
    const assetId = resolveAssetId(tx.asset_id);
    const ticker = resolveTicker(assetId);
    const currency = resolveCurrency(assetId);
    const fx = currency === "USD" ? Math.max(0.01, effectiveUsdRate) : 1.0;

    const rawTotal = Number(tx.total) || (Number(tx.quantity) || 0) * (Number(tx.price) || 0);
    const amountNative = round2(rawTotal);
    const amountBRL = round2(amountNative * fx);

    reconciledDividends.push({
      id: tx.id,
      assetId,
      ticker,
      date: tDate,
      type: tx.type,
      amountBRL,
      amountNative,
      currency,
      source: "ledger",
      originIds: [tx.id],
      notes: "Provento registrado via Ledger",
      cleanNotes: "Provento registrado via Ledger",
      linkedTxId: tx.id,
    });
  }

  // -------------------------------------------------------------------------
  // 3. Reconciliação de Fluxos Externos e Retiradas de Caixa
  // -------------------------------------------------------------------------

  // Identifica vendas de ativos de caixa no ledger (potenciais retiradas externas do bolso)
  const cashSellTxs = transactions.filter((t) => {
    if (t.type !== "sell") return false;
    if (!cashAssetIds.has(t.asset_id)) return false;
    const tDate = normalizeDateToCivil(t.date, timeZone);
    if (!tDate) return false;
    if (cutoffCivil && tDate > cutoffCivil) return false;
    const total = Number(t.total) || (Number(t.quantity) || 0) * (Number(t.price) || 0);
    return total > 0;
  });

  // Filtrar contribuições até a data de corte
  const rawContributions = contributions.filter((c) => {
    const cDate = normalizeDateToCivil(c.date, timeZone);
    if (!cDate) return false;
    if (cutoffCivil && cDate > cutoffCivil) return false;
    return Math.abs(Number(c.amount) || 0) > 0.0001;
  });

  const reconciledFlows: CanonicalReconciledFlow[] = [];
  const matchedCashSellTxIds = new Set<string>();
  let hasMarcoZeroDetected = false;

  for (const contrib of rawContributions) {
    const cDate = normalizeDateToCivil(contrib.date, timeZone);
    const rawAmount = Number(contrib.amount) || 0;
    const annotation = parseLegacyTextAnnotation(contrib.notes);
    const isWithdrawal = rawAmount < 0 || isHistoricalWithdrawal(contrib) || annotation.isWithdrawal;
    const absAmount = round2(Math.abs(rawAmount));
    const isMarcoZero =
      annotation.isMarcoZero ||
      isMarcoZeroNote(contrib.notes) ||
      (!contrib.asset_id && isMarcoZeroNote(contrib.notes));
    if (isMarcoZero) {
      hasMarcoZeroDetected = true;
    }

    const explicitRate = annotation.explicitRatePct ?? extractExplicitRateFromNotes(contrib.notes);
    const linkedTxId = annotation.linkedTxId;
    const assetId = contrib.asset_id ? resolveAssetId(contrib.asset_id) : null;
    const ticker = assetId ? resolveTicker(assetId) : (annotation.detectedTicker ?? null);

    if (isWithdrawal) {
      // Procura venda equivalente em ativo de caixa no ledger para deduplicar
      let matchedCashSell: PortfolioTransaction | null = null;
      if (linkedTxId) {
        matchedCashSell = cashSellTxs.find((s) => s.id === linkedTxId && !matchedCashSellTxIds.has(s.id)) ?? null;
      }
      if (!matchedCashSell) {
        for (const sellTx of cashSellTxs) {
          if (matchedCashSellTxIds.has(sellTx.id)) continue;
          const sDate = normalizeDateToCivil(sellTx.date, timeZone);
          if (sDate !== cDate) continue;

          const sTotal = round2(Number(sellTx.total) || (Number(sellTx.quantity) || 0) * (Number(sellTx.price) || 0));
          if (Math.abs(sTotal - absAmount) <= monetaryToleranceBRL) {
            matchedCashSell = sellTx;
            break;
          }
        }
      }

      if (matchedCashSell) {
        matchedCashSellTxIds.add(matchedCashSell.id);
        duplicateWithdrawalsAvoided += 1;
        auditLog.push({
          category: "withdrawal",
          reason: linkedTxId
            ? "Resgate em portfolio_contributions pareado com venda de CAIXA por vínculo explícito tx:"
            : "Resgate em portfolio_contributions pareado com venda de CAIXA no ledger",
          date: cDate,
          amount: absAmount,
          matchedIds: [contrib.id, matchedCashSell.id],
        });

        reconciledFlows.push({
          id: contrib.id,
          date: cDate,
          amount: -absAmount,
          grossInflow: 0,
          grossOutflow: absAmount,
          isWithdrawal: true,
          isMarcoZero,
          assetId,
          ticker,
          notes: contrib.notes ?? null,
          cleanNotes: annotation.cleanNotes || null,
          linkedTxId: matchedCashSell.id,
          explicitRatePct: explicitRate,
          source: "reconciled",
          originIds: [contrib.id, matchedCashSell.id],
        });
      } else {
        reconciledFlows.push({
          id: contrib.id,
          date: cDate,
          amount: -absAmount,
          grossInflow: 0,
          grossOutflow: absAmount,
          isWithdrawal: true,
          isMarcoZero,
          assetId,
          ticker,
          notes: contrib.notes ?? null,
          cleanNotes: annotation.cleanNotes || null,
          linkedTxId,
          explicitRatePct: explicitRate,
          source: "contribution",
          originIds: [contrib.id],
        });
      }
    } else {
      // Aporte positivo
      reconciledFlows.push({
        id: contrib.id,
        date: cDate,
        amount: absAmount,
        grossInflow: absAmount,
        grossOutflow: 0,
        isWithdrawal: false,
        isMarcoZero,
        assetId,
        ticker,
        notes: contrib.notes ?? null,
        cleanNotes: annotation.cleanNotes || null,
        linkedTxId,
        explicitRatePct: explicitRate,
        source: "contribution",
        originIds: [contrib.id],
      });
    }
  }

  // Adiciona vendas de caixa remanescentes que não foram lançadas em portfolio_contributions
  for (const sellTx of cashSellTxs) {
    if (matchedCashSellTxIds.has(sellTx.id)) continue;
    const sDate = normalizeDateToCivil(sellTx.date, timeZone);
    const sTotal = round2(Number(sellTx.total) || (Number(sellTx.quantity) || 0) * (Number(sellTx.price) || 0));

    reconciledFlows.push({
      id: sellTx.id,
      date: sDate,
      amount: -sTotal,
      grossInflow: 0,
      grossOutflow: sTotal,
      isWithdrawal: true,
      isMarcoZero: false,
      assetId: sellTx.asset_id,
      ticker: resolveTicker(sellTx.asset_id),
      notes: "Retirada de Caixa via Ledger",
      cleanNotes: "Retirada de Caixa via Ledger",
      linkedTxId: sellTx.id,
      source: "cash_sell",
      originIds: [sellTx.id],
    });
  }

  // -------------------------------------------------------------------------
  // 4. Reconciliação de Transações de Custódia & Compras Diretas via Aporte
  // -------------------------------------------------------------------------

  // Filtrar ordens normais de custódia (excluindo proventos)
  const rawCustodyTxs = transactions.filter((t) => {
    if (isDividendType(t.type)) return false;
    const tDate = normalizeDateToCivil(t.date, timeZone);
    if (!tDate) return false;
    if (cutoffCivil && tDate > cutoffCivil) return false;
    return true;
  });

  const reconciledCustodyTxs: CanonicalReconciledTransaction[] = [];
  const boughtByAssetId = new Map<string, number>();
  const soldByAssetId = new Map<string, number>();
  let corporateActionsCount = 0;

  for (const tx of rawCustodyTxs) {
    const tDate = normalizeDateToCivil(tx.date, timeZone);
    const assetId = resolveAssetId(tx.asset_id);
    const ticker = resolveTicker(assetId);
    const currency = resolveCurrency(assetId);

    const isCorpAction = isCorporateActionType(tx.type);
    let resolvedType: PortfolioTransactionType = tx.type;
    let qty = Number(tx.quantity) || 0;
    let price = Number(tx.price) || 0;
    let total = round2(Number(tx.total) || qty * price);

    if (isCorpAction) {
      corporateActionsCount++;
      const resolution = resolveCanonicalCorporateActionFactor(tx);
      resolvedType = resolution.type;
      qty = resolution.factor;
      // Salvaguarda S17: Eventos corporativos societários possuem valor financeiro zero absoluto
      price = 0;
      total = 0;
    }

    reconciledCustodyTxs.push({
      id: tx.id,
      assetId,
      ticker,
      date: tDate,
      type: resolvedType,
      quantity: qty,
      price,
      total,
      currency,
      source: "ledger",
      originId: tx.id,
    });

    if (resolvedType === "buy" || resolvedType === "subscription") {
      boughtByAssetId.set(assetId, (boughtByAssetId.get(assetId) ?? 0) + total);
    } else if (resolvedType === "sell") {
      soldByAssetId.set(assetId, (soldByAssetId.get(assetId) ?? 0) + total);
    }
  }

  // Reconcilia aportes direcionados a ativos (Salvaguarda S2: Custódia Base Fallback)
  for (const contrib of rawContributions) {
    const rawAmount = Number(contrib.amount) || 0;
    if (rawAmount <= 0) continue;
    if (isHistoricalWithdrawal(contrib)) continue;
    if (!contrib.asset_id) continue;

    const assetId = resolveAssetId(contrib.asset_id);
    const cDate = normalizeDateToCivil(contrib.date, timeZone);
    const cAmount = round2(rawAmount);
    const linkedTxId = extractLinkedTxIdFromNotes(contrib.notes);

    // Verifica se já existe ordem de compra no ledger com mesma data e valor ou vínculo tx: explícito
    const alreadyInTx = reconciledCustodyTxs.some(
      (tx) =>
        (linkedTxId && (tx.id === linkedTxId || tx.originId === linkedTxId)) ||
        (tx.assetId === assetId &&
          (tx.type === "buy" || tx.type === "subscription") &&
          tx.date === cDate &&
          Math.abs(tx.total - cAmount) <= monetaryToleranceBRL),
    );

    if (alreadyInTx) {
      duplicateContributionsAvoided += 1;
      auditLog.push({
        category: "contribution",
        reason: linkedTxId
          ? "Aporte direcionado em portfolio_contributions já refletido em ordem de compra por vínculo explícito tx:"
          : "Aporte direcionado em portfolio_contributions já refletido em ordem de compra no ledger",
        date: cDate,
        amount: cAmount,
        matchedIds: [contrib.id],
      });
    } else {
      // Aporte financeiro direto em ativo sem ordem no ledger (agrega ao custo do ativo)
      boughtByAssetId.set(assetId, (boughtByAssetId.get(assetId) ?? 0) + cAmount);

      const ticker = resolveTicker(assetId);
      const currency = resolveCurrency(assetId);
      reconciledCustodyTxs.push({
        id: `derived_${contrib.id}`,
        assetId,
        ticker,
        date: cDate,
        type: "buy",
        quantity: 0,
        price: 0,
        total: cAmount,
        currency,
        source: "contribution_derived",
        originId: contrib.id,
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Proventos Acumulados Históricos (Marco Zero de Proventos)
  // -------------------------------------------------------------------------

  const dividendsByAssetId = new Map<string, number>();
  const dividendsNativeByAssetId = new Map<string, number>();
  const dividendsByMonth = new Map<string, number>();

  for (const div of reconciledDividends) {
    dividendsByAssetId.set(
      div.assetId,
      (dividendsByAssetId.get(div.assetId) ?? 0) + div.amountBRL,
    );
    dividendsNativeByAssetId.set(
      div.assetId,
      (dividendsNativeByAssetId.get(div.assetId) ?? 0) + div.amountNative,
    );

    const month = div.date.slice(0, 7);
    dividendsByMonth.set(
      month,
      (dividendsByMonth.get(month) ?? 0) + div.amountBRL,
    );
  }

  // Agrega accumulated_dividends dos ativos (lastro histórico)
  if (includeAccumulatedDividends) {
    for (const asset of assets) {
      const acc = Number(asset.accumulated_dividends) || 0;
      if (acc > 0) {
        const currency = asset.currency === "USD" ? "USD" : "BRL";
        const fx = currency === "USD" ? Math.max(0.01, effectiveUsdRate) : 1.0;
        const accBRL = round2(acc * fx);

        dividendsByAssetId.set(
          asset.id,
          (dividendsByAssetId.get(asset.id) ?? 0) + accBRL,
        );
        dividendsNativeByAssetId.set(
          asset.id,
          (dividendsNativeByAssetId.get(asset.id) ?? 0) + acc,
        );

        const assetDate =
          (asset as { created_at?: string }).created_at ||
          asset.fixed_income_metadata?.base_date ||
          asset.fixed_income_metadata?.initial_investment_date;
        const ballastDate = assetDate ? normalizeDateToCivil(assetDate, timeZone) : "1970-01-01";

        // Registra como provento de histórico sem alocar a um mês periódico específico
        reconciledDividends.push({
          id: `acc_${asset.id}`,
          assetId: asset.id,
          ticker: asset.ticker.toUpperCase().trim(),
          date: ballastDate,
          type: "dividend",
          amountBRL: accBRL,
          amountNative: acc,
          currency,
          source: "accumulated",
          originIds: [asset.id],
          notes: "Proventos acumulados históricos (Marco Zero)",
          isAccumulatedBallast: true,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Agregações Mensais de Fluxo de Caixa e Estatísticas
  // -------------------------------------------------------------------------

  const netFlowByMonth = new Map<string, number>();
  const grossContributionsByMonth = new Map<string, number>();
  const grossWithdrawalsByMonth = new Map<string, number>();

  let totalGrossContributionsCents = 0;
  let totalGrossWithdrawalsCents = 0;

  for (const flow of reconciledFlows) {
    const month = flow.date.slice(0, 7);
    netFlowByMonth.set(
      month,
      round2((netFlowByMonth.get(month) ?? 0) + flow.amount),
    );

    if (flow.grossInflow > 0) {
      grossContributionsByMonth.set(
        month,
        round2((grossContributionsByMonth.get(month) ?? 0) + flow.grossInflow),
      );
      totalGrossContributionsCents += numberToCents(flow.grossInflow);
    }
    if (flow.grossOutflow > 0) {
      grossWithdrawalsByMonth.set(
        month,
        round2((grossWithdrawalsByMonth.get(month) ?? 0) + flow.grossOutflow),
      );
      totalGrossWithdrawalsCents += numberToCents(flow.grossOutflow);
    }
  }

  // Ordenação cronológica estável dos eventos reconciliados
  reconciledDividends.sort((a, b) => a.date.localeCompare(b.date));
  reconciledFlows.sort((a, b) => a.date.localeCompare(b.date));
  // Ordenação intradiária determinística: splits/reverse_splits primeiro na abertura de pregão (Salvaguarda S17)
  reconciledCustodyTxs.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const weightDiff = getTransactionIntradayWeight(a.type) - getTransactionIntradayWeight(b.type);
    if (weightDiff !== 0) return weightDiff;
    return (a.originId || a.id).localeCompare(b.originId || b.id);
  });

  // Determina a primeira operação real (transação ou aporte)
  let firstOpDate: string | null = null;
  for (const tx of reconciledCustodyTxs) {
    if (tx.date && (!firstOpDate || tx.date < firstOpDate)) {
      firstOpDate = tx.date;
    }
  }
  for (const flow of reconciledFlows) {
    if (flow.date && (!firstOpDate || flow.date < firstOpDate)) {
      firstOpDate = flow.date;
    }
  }

  // Totais consolidados
  let totalDividendsCents = 0;
  for (const div of reconciledDividends) {
    totalDividendsCents += numberToCents(div.amountBRL);
  }

  let totalBuysCents = 0;
  let totalSellsCents = 0;
  for (const tx of reconciledCustodyTxs) {
    if (tx.type === "buy" || tx.type === "subscription") {
      totalBuysCents += numberToCents(tx.total);
    } else if (tx.type === "sell") {
      totalSellsCents += numberToCents(tx.total);
    }
  }

  const netExternalCashFlowCents = totalGrossContributionsCents - totalGrossWithdrawalsCents;

  const summary: CanonicalReconciliationSummary = {
    totalDividendsBRL: round2(totalDividendsCents / 100),
    totalGrossContributionsBRL: round2(totalGrossContributionsCents / 100),
    totalGrossWithdrawalsBRL: round2(totalGrossWithdrawalsCents / 100),
    netExternalCashFlowBRL: round2(netExternalCashFlowCents / 100),
    totalBuysBRL: round2(totalBuysCents / 100),
    totalSellsBRL: round2(totalSellsCents / 100),
    totalTransactionsCount: reconciledCustodyTxs.length,
    totalDividendsCount: reconciledDividends.length,
    totalContributionsCount: reconciledFlows.length,
    duplicateDividendsAvoided,
    duplicateWithdrawalsAvoided,
    duplicateContributionsAvoided,
    totalCorporateActionsCount: corporateActionsCount,
  };

  return {
    dividends: reconciledDividends,
    externalFlows: reconciledFlows,
    custodyTransactions: reconciledCustodyTxs,
    dividendsByAssetId,
    dividendsNativeByAssetId,
    boughtByAssetId,
    soldByAssetId,
    dividendsByMonth,
    netFlowByMonth,
    grossContributionsByMonth,
    grossWithdrawalsByMonth,
    firstOperationDate: firstOpDate,
    hasMarcoZero: hasMarcoZeroDetected,
    cutoffDate: cutoffCivil,
    cutoffTimestamp,
    effectiveUsdRate,
    ptaxResolution,
    summary,
    auditLog,
  };
}
