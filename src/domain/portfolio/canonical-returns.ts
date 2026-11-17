/**
 * Canonical Returns — Apurador de Rentabilidade Homogênea, TWR e TIR da Carteira (§Fase 40).
 *
 * Módulo puramente algorítmico e desacoplado de banco, React e UI.
 * Implementa as salvaguardas matemáticas centrais do PLANO 40 e FINANCIAL_MATH_SPEC.md:
 *   • Salvaguarda S9: Invariante de Homogeneidade Temporal de Bases (Antiestouro de TWR / Modified Dietz);
 *   • Salvaguarda S10: Tolerância Soberana de Fidelidade (3,0%);
 *   • Salvaguarda S11: Universalidade Multiusuário e Continuidade de Cotização (Share Price);
 *   • Salvaguarda S3: Soberania Incondicional de Snapshots Calibrados Manualmente;
 *   • Salvaguarda de Colapso de Denominador (Capital ponderado < R$ 10,00).
 */

import type { PortfolioSnapshot } from "@/types";
import {
  type CanonicalAccountingBase,
  type CanonicalBalanceOrigin,
  type CanonicalFidelityReport,
  type CanonicalMonthlyCashFlow,
  type CanonicalMonthlyDividend,
  type CanonicalMonthlyStatement,
  type CanonicalMonthlyTransaction,
  createCanonicalFidelityReport,
  createCanonicalMonthlyStatement,
  DEFAULT_CANONICAL_TWR,
} from "./canonical-types";
import {
  buildPortfolioCashFlows,
  calculateNetInjectedCapital,
  calculateNetPocketGain,
  calculateXIRR,
  type CashFlow,
  type ContributionFlowItem,
  type XIRRResult,
} from "./irr";
import {
  calculateTwrSeries,
  type TwrConsolidatedResult,
  type TwrMonthlyInputPoint,
} from "./twr";

// ---------------------------------------------------------------------------
// Auxiliares Matemáticos & Arredondamentos
// ---------------------------------------------------------------------------

const round2 = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

/**
 * Retorna o mês civil anterior no formato YYYY-MM.
 */
export function getPreviousMonthISO(month: string): string {
  const parts = month.slice(0, 7).split("-");
  const yearStr = parts[0] ?? "2026";
  const monthStr = parts[1] ?? "01";
  let year = Number.parseInt(yearStr, 10);
  let monthNum = Number.parseInt(monthStr, 10);

  monthNum -= 1;
  if (monthNum < 1) {
    monthNum = 12;
    year -= 1;
  }
  return `${year}-${String(monthNum).padStart(2, "0")}`;
}

/**
 * Extrai o valor patrimonial efetivo de um snapshot respeitando a soberania de calibração manual (§Salvaguarda S3).
 */
export function getSnapshotEffectiveValue(snapshot?: PortfolioSnapshot | null): number {
  if (!snapshot) return 0;
  if (snapshot.is_manually_calibrated && snapshot.manual_total_value != null) {
    return Math.max(0, round2(Number(snapshot.manual_total_value)));
  }
  return Math.max(0, round2(Number(snapshot.total_value) || 0));
}

/**
 * Extrai o custo total de um snapshot.
 */
export function getSnapshotEffectiveCost(snapshot?: PortfolioSnapshot | null): number | null {
  if (!snapshot || snapshot.total_cost == null) return null;
  return Math.max(0, round2(Number(snapshot.total_cost)));
}

// ---------------------------------------------------------------------------
// 1. Apurador de Extrato Mensal Homogêneo (§Salvaguarda S9)
// ---------------------------------------------------------------------------

export interface ResolveHomogeneousStatementParams {
  /** Competência apurada no formato YYYY-MM. */
  month: string;
  /** Snapshots persistidos no banco de dados para reconciliação histórica. */
  snapshots?: readonly PortfolioSnapshot[];
  /** Saldo patrimonial reconstruído analiticamente para o fim da competência (M). */
  reconstructedEndBalanceBRL?: number;
  /** Saldo patrimonial reconstruído analiticamente para o fim da competência anterior (M-1). */
  reconstructedStartBalanceBRL?: number;
  /** Saldo inicial bruto direto (override, se houver). */
  explicitStartBalanceBRL?: number;
  /** Saldo final bruto direto (override, se houver). */
  explicitEndBalanceBRL?: number;
  /** Fluxos de caixa externos do bolso na competência (aportes e resgates). */
  externalFlows?: readonly CanonicalMonthlyCashFlow[];
  /** Fluxo líquido padrão na ausência de fluxos detalhados com data. */
  netExternalCashFlowBRL?: number;
  /** Proventos recebidos na competência. */
  dividends?: readonly CanonicalMonthlyDividend[];
  /** Transações de custódia realizadas na competência. */
  transactions?: readonly CanonicalMonthlyTransaction[];
  /** Taxa explícita de retorno informada no extrato da corretora (% ex: +1,15%). */
  explicitRatePct?: number | null;
}

/**
 * Apura o extrato mensal garantindo a HOMOGENEIDADE TEMPORAL DE BASES (Salvaguarda S9).
 *
 * Previne categoricamente a anomalia histórica da mistura de bases:
 * - Se a competência possui Snapshot Oficial gravado (portfolio_snapshots) e o mês anterior também possui:
 *   AMBOS os saldos (inicial M-1 e final M) provêm da série de snapshots oficiais.
 *   Exemplo Out/2026: Set/2026 = 106.937,10; Out/2026 = 104.740,27; Fluxo = +1.635,33
 *   => P&L = -3.832,16; Retorno = -3,6% (e NUNCA os -13,9% distorcidos pela subtração com custódia analítica).
 * - Se a competência não possui snapshot gravado (mês corrente ou aberto):
 *   Se for apuração puramente analítica de ativos, tanto o início quanto o fim provêm da base de custódia.
 * - Se for mês inaugural (Marco Zero / Mês 1), saldo inicial = 0 e accountingBase = "inaugural".
 */
export function calculateHomogeneousMonthlyStatement(
  params: ResolveHomogeneousStatementParams,
): CanonicalMonthlyStatement {
  const month = params.month.slice(0, 7);
  const prevMonth = getPreviousMonthISO(month);

  const snapshotMap = new Map<string, PortfolioSnapshot>();
  for (const s of params.snapshots ?? []) {
    if (s.month) {
      snapshotMap.set(s.month.slice(0, 7), s);
    }
  }

  const currSnapshot = snapshotMap.get(month);
  const prevSnapshot = snapshotMap.get(prevMonth);

  let startBalanceBRL: number;
  let endBalanceBRL: number;
  let startBalanceBase: CanonicalBalanceOrigin;
  let endBalanceBase: CanonicalBalanceOrigin;
  let accountingBase: CanonicalAccountingBase;

  // 1. Resolução do Saldo Inicial (M-1)
  if (params.explicitStartBalanceBRL != null) {
    startBalanceBRL = Math.max(0, round2(params.explicitStartBalanceBRL));
    startBalanceBase = "snapshot";
  } else if (prevSnapshot) {
    startBalanceBRL = getSnapshotEffectiveValue(prevSnapshot);
    startBalanceBase = "snapshot";
  } else if (params.reconstructedStartBalanceBRL != null) {
    startBalanceBRL = Math.max(0, round2(params.reconstructedStartBalanceBRL));
    startBalanceBase = startBalanceBRL === 0 ? "zero" : "reconstructed_custody";
  } else {
    // Primeiro mês de histórico ou sem dados prévios
    startBalanceBRL = 0;
    startBalanceBase = "zero";
  }

  // 2. Resolução do Saldo Final (M) com garantia de Salvaguarda S9
  if (params.explicitEndBalanceBRL != null) {
    endBalanceBRL = Math.max(0, round2(params.explicitEndBalanceBRL));
    endBalanceBase = "snapshot";
  } else if (currSnapshot) {
    // Snapshot oficial existe para o mês: SOBERANO (§Salvaguarda S9 e S10)
    endBalanceBRL = getSnapshotEffectiveValue(currSnapshot);
    endBalanceBase = "snapshot";
  } else if (params.reconstructedEndBalanceBRL != null) {
    endBalanceBRL = Math.max(0, round2(params.reconstructedEndBalanceBRL));
    endBalanceBase = "reconstructed_custody";
  } else {
    endBalanceBRL = startBalanceBRL;
    endBalanceBase = startBalanceBase;
  }

  // 3. Auditoria de Homogeneidade (S9)
  if (startBalanceBase === "zero" || startBalanceBRL === 0) {
    accountingBase = "inaugural";
  } else if (startBalanceBase === endBalanceBase) {
    accountingBase = startBalanceBase === "snapshot" ? "snapshot" : "reconstructed_custody";
  } else {
    // Conflito detectado: ex.: start=snapshot vs end=reconstructed_custody (mês em aberto pós-fechamento)
    accountingBase = "reconstructed_custody";
  }

  return createCanonicalMonthlyStatement({
    month,
    startBalanceBRL,
    endBalanceBRL,
    accountingBase,
    startBalanceBase,
    endBalanceBase,
    externalFlows: params.externalFlows,
    netExternalCashFlowBRL: params.netExternalCashFlowBRL,
    dividends: params.dividends,
    transactions: params.transactions,
    explicitRatePct: params.explicitRatePct ?? null,
  });
}

// ---------------------------------------------------------------------------
// 2. Apurador Canônico de Série TWR por Cotas (§Salvaguarda S11)
// ---------------------------------------------------------------------------

export interface CanonicalTwrSeriesParams {
  /** Pontos mensais ordenados cronologicamente. */
  monthlyPoints: readonly TwrMonthlyInputPoint[];
  /** Se deve calcular apenas até um determinado mês de corte (YYYY-MM). */
  asOfMonth?: string;
}

/**
 * Calcula a rentabilidade ponderada no tempo (TWR) e a série de cotização contínua.
 * Aplica a Salvaguarda S11 (Universalidade e Continuidade de Cotização):
 * - Cota base 100,00 contínua;
 * - Imunidade a fluxos externos de aportes e retiradas;
 * - Tolerância e estabilização para períodos de caixa zerado ou sem movimentação.
 */
export function calculateCanonicalTwrSeries(
  params: CanonicalTwrSeriesParams,
): TwrConsolidatedResult {
  const cutoff = params.asOfMonth ? params.asOfMonth.slice(0, 7) : null;
  const filteredPoints = cutoff
    ? params.monthlyPoints.filter((p) => p.month.slice(0, 7) <= cutoff)
    : params.monthlyPoints;

  if (filteredPoints.length === 0) {
    return DEFAULT_CANONICAL_TWR;
  }

  return calculateTwrSeries(filteredPoints);
}

// ---------------------------------------------------------------------------
// 3. Solver Canônico de TIR / Fluxo do Bolso (XIRR)
// ---------------------------------------------------------------------------

export interface CanonicalXirrParams {
  /** Aportes e retiradas do bolso (portfolio_contributions). */
  contributions: readonly ContributionFlowItem[];
  /** Valor patrimonial consolidado atual da carteira em BRL (para encerramento virtual). */
  currentPortfolioValueBRL: number;
  /** Retiradas externas de caixa registradas como transação. */
  cashWithdrawals?: readonly { date: string; amount: number }[];
  /** Data atual ISO (YYYY-MM-DD). */
  today?: string;
  /** Fluxos de caixa brutos pré-montados (se fornecidos, sobrepõem os contributions). */
  cashFlows?: readonly CashFlow[];
}

export interface CanonicalXirrConsolidatedResult {
  xirr: XIRRResult;
  netInjectedCapitalBRL: number;
  netPocketGainBRL: number;
  cashFlows: CashFlow[];
}

/**
 * Resolve a Taxa Interna de Retorno (TIR / XIRR) ponderada pelos fluxos de caixa reais do investidor.
 */
export function calculateCanonicalXirr(
  params: CanonicalXirrParams,
): CanonicalXirrConsolidatedResult {
  let flows: CashFlow[];

  if (params.cashFlows && params.cashFlows.length > 0) {
    flows = [...params.cashFlows];
  } else {
    flows = buildPortfolioCashFlows({
      contributions: params.contributions,
      currentPortfolioValueBRL: params.currentPortfolioValueBRL,
      cashWithdrawals: params.cashWithdrawals,
      today: params.today,
    });
  }

  const xirr = calculateXIRR(flows);
  const netInjectedCapitalBRL = calculateNetInjectedCapital(
    params.contributions,
    params.cashWithdrawals,
  );
  const netPocketGainBRL = calculateNetPocketGain(
    params.currentPortfolioValueBRL,
    netInjectedCapitalBRL,
  );

  return {
    xirr,
    netInjectedCapitalBRL,
    netPocketGainBRL,
    cashFlows: flows,
  };
}

// ---------------------------------------------------------------------------
// 4. Sentinela Canônica de Fidelidade Patrimonial (§Salvaguarda S10)
// ---------------------------------------------------------------------------

export interface EvaluateCanonicalFidelityParams {
  snapshot?: PortfolioSnapshot | null;
  reconstructedTotalValueBRL: number;
  reconstructedTotalCostBRL?: number;
  totalAssetsCount: number;
  calibratedQuotesCount?: number;
  apiQuotesCount?: number;
  fallbackQuotesCount?: number;
  toleranceThresholdPct?: number;
}

/**
 * Avalia incondicionalmente a fidelidade patrimonial entre a custódia analítica e o snapshot oficial gravado.
 * Implementa a Salvaguarda S10:
 * - Tolerância soberana de 3,0% incondicional;
 * - Se discrepância > 3,0%, força o saldo soberano do snapshot para a síntese executiva;
 * - Alerta conciliação necessária de cotações/ordens no editor de fechamento.
 */
export function evaluateCanonicalFidelity(
  params: EvaluateCanonicalFidelityParams,
): CanonicalFidelityReport {
  const snapshotTotalValueBRL = params.snapshot
    ? getSnapshotEffectiveValue(params.snapshot)
    : null;
  const snapshotTotalCostBRL = params.snapshot
    ? getSnapshotEffectiveCost(params.snapshot)
    : null;

  return createCanonicalFidelityReport({
    snapshotTotalValueBRL,
    snapshotTotalCostBRL,
    reconstructedTotalValueBRL: params.reconstructedTotalValueBRL,
    reconstructedTotalCostBRL: params.reconstructedTotalCostBRL,
    totalAssetsCount: params.totalAssetsCount,
    calibratedQuotesCount: params.calibratedQuotesCount,
    apiQuotesCount: params.apiQuotesCount,
    fallbackQuotesCount: params.fallbackQuotesCount,
    toleranceThresholdPct: params.toleranceThresholdPct ?? 3.0,
  });
}
