/**
 * Motor Preditivo de Reserva de Emergência — Domínio de Projeção (§3.7 / §3.11).
 *
 * Projeta o tempo e a data estimada para atingimento dos marcos de
 * 3, 6 e 12 meses de custo de vida com base no capital acumulado e
 * na velocidade de poupança mensal.
 *
 * Também orquestra a resolução flexível da composição da reserva:
 * contas correntes + seleção de ativos e classes da carteira de investimentos.
 *
 * 100% puro — sem dependências de UI, DOM ou Supabase.
 */

import { shiftMonth } from "@/lib/date";
import { isCashAssetClass, isFiiClass, isStockClass } from "@/domain/portfolio/valuation";
import type { EmergencyFundConfig, EmergencySelectionMode } from "@/types";

export type { EmergencyFundConfig, EmergencySelectionMode };

export type EmergencyHealth = "critico" | "baixo" | "adequado" | "saudavel";

export const EMERGENCY_HEALTH_LABELS: Record<EmergencyHealth, string> = {
  critico: "Crítico",
  baixo: "Baixo",
  adequado: "Adequado",
  saudavel: "Saudável",
};

export interface EmergencyMilestone {
  monthsOfExpenses: 3 | 6 | 12;
  targetCents: number;
  progressPercent: number;
  isReached: boolean;
  monthsRemaining: number | null;
  estimatedCompletionMonth: string | null;
}

export interface EmergencyProjectionParams {
  /** Saldo acumulado destinado à reserva (centavos). */
  currentLiquidCents: number;
  /** Custo de vida mensal de referência (centavos). */
  monthlyExpensesCents: number;
  /** Velocidade / aporte mensal destinado à reserva (centavos). */
  monthlySavingsVelocityCents: number;
  /** Mês de referência no formato "YYYY-MM". */
  referenceMonth: string;
}

export interface EmergencyProjectionResult {
  monthlyExpensesCents: number;
  currentLiquidCents: number;
  currentMonthsCovered: number;
  health: EmergencyHealth;
  monthlySavingsVelocityCents: number;
  milestone3m: EmergencyMilestone;
  milestone6m: EmergencyMilestone;
  milestone12m: EmergencyMilestone;
}

/** Configuração padrão inicial da Reserva de Emergência */
export const DEFAULT_EMERGENCY_CONFIG: EmergencyFundConfig = {
  includeCheckingAccounts: true,
  selectionMode: "auto_cash",
  selectedAssetIds: [],
  selectedClasses: [],
  useNetValue: true,
  targetMonths: 6,
};

export interface PortfolioPositionRowLike {
  assetId: string;
  ticker: string;
  assetClass?: string | null;
  quantity: number;
  valueBRL?: number;
  netValueBRL?: number;
  isCash?: boolean;
  isMatured?: boolean;
  maturityDate?: string | null;
}

export interface EmergencyFundWarning {
  id: string;
  severity: "info" | "warning";
  message: string;
}

export interface EmergencyItemBreakdown {
  id: string;
  label: string;
  type: "checking_account" | "asset";
  assetClass?: string | null;
  grossCents: number;
  netCents: number;
  selectedCents: number;
  pctOfTotal: number;
  isCashEquivalent: boolean;
  isVolatile: boolean;
  hasMaturityWarning: boolean;
  warningMessage?: string;
}

export interface EmergencyFundComposition {
  totalReserveCents: number;
  cashInAccountsCents: number;
  portfolioReserveCents: number;
  breakdown: EmergencyItemBreakdown[];
  warnings: EmergencyFundWarning[];
  targetMonths: 3 | 6 | 12;
  targetMonthsProgressPercent: number;
  targetMonthsCents: number;
}

/**
 * Classifica a saúde da reserva com base nos meses de custo de vida cobertos:
 *   - < 3 meses: crítico
 *   - 3 a 5.9 meses: baixo
 *   - 6 a 11.9 meses: adequado
 *   - >= 12 meses: saudável
 */
export function classifyEmergencyHealth(monthsCovered: number): EmergencyHealth {
  if (monthsCovered < 3) return "critico";
  if (monthsCovered < 6) return "baixo";
  if (monthsCovered < 12) return "adequado";
  return "saudavel";
}

/**
 * Detecta se um ativo tem perfil compatível com reserva de emergência
 * (Selic, LFT, CDI, 100% CDI, DI, Caixa, RDB).
 */
export function isLikelyReserveAsset(row: PortfolioPositionRowLike): boolean {
  if (row.isCash || isCashAssetClass(row.assetClass)) return true;
  const upperTicker = row.ticker.toUpperCase();
  const upperClass = (row.assetClass ?? "").toUpperCase();

  // Exclui ações, FIIs ou cripto
  if (isStockClass(row.assetClass) || isFiiClass(row.assetClass) || upperClass.includes("CRIPTO")) {
    return false;
  }

  return (
    upperTicker.includes("SELIC") ||
    upperTicker.includes("LFT") ||
    upperTicker.includes("CDI") ||
    upperTicker.includes("RDB") ||
    upperTicker.includes("RESERVA") ||
    upperTicker.includes("CAIXA") ||
    upperTicker === "DI" ||
    upperTicker.startsWith("DI ") ||
    upperTicker.endsWith(" DI")
  );
}

/**
 * Detecta ativos com perfil de reserva na custódia e retorna seus IDs.
 */
export function detectSuggestedReserveAssets(rows: readonly PortfolioPositionRowLike[]): string[] {
  return rows
    .filter((r) => r.quantity > 0 && (r.valueBRL ?? 0) > 0 && isLikelyReserveAsset(r))
    .map((r) => r.assetId);
}

/**
 * Resolve a composição da reserva de emergência combinando o saldo de contas correntes
 * com a alocação configurada pelo usuário nos ativos da carteira.
 */
export function resolveEmergencyFundComposition(params: {
  config?: EmergencyFundConfig | null;
  realCashCents: number;
  portfolioRows: readonly PortfolioPositionRowLike[];
  monthlyExpensesCents?: number;
}): EmergencyFundComposition {
  const config: EmergencyFundConfig = {
    ...DEFAULT_EMERGENCY_CONFIG,
    ...(params.config ?? {}),
  };

  const useNet = config.useNetValue !== false;
  const targetMonths = config.targetMonths ?? 6;
  const breakdown: EmergencyItemBreakdown[] = [];
  const warnings: EmergencyFundWarning[] = [];

  // 1. Contas Correntes / Saldo em Caixa Real
  let cashInAccountsCents = 0;
  if (config.includeCheckingAccounts) {
    cashInAccountsCents = Math.max(0, params.realCashCents);
    if (cashInAccountsCents > 0) {
      breakdown.push({
        id: "checking_accounts",
        label: "Conta Corrente / Caixa Real",
        type: "checking_account",
        assetClass: "Caixa",
        grossCents: cashInAccountsCents,
        netCents: cashInAccountsCents,
        selectedCents: cashInAccountsCents,
        pctOfTotal: 0,
        isCashEquivalent: true,
        isVolatile: false,
        hasMaturityWarning: false,
      });
    }
  }

  // 2. Filtragem de Ativos Conforme a Política do Usuário
  const selectedAssetIdsSet = new Set(config.selectedAssetIds ?? []);
  const selectedClassesSet = new Set(
    (config.selectedClasses ?? []).map((c) => c.trim().toLowerCase()),
  );

  const eligibleRows = params.portfolioRows.filter((r) => {
    // Apenas ativos com custódia positiva
    if (r.quantity <= 0 || (r.valueBRL ?? 0) <= 0) return false;

    switch (config.selectionMode) {
      case "auto_cash":
        return r.isCash || isCashAssetClass(r.assetClass);
      case "selected_assets":
        return selectedAssetIdsSet.has(r.assetId);
      case "selected_classes": {
        const cls = (r.assetClass ?? "").trim().toLowerCase();
        return selectedClassesSet.has(cls);
      }
      case "entire_portfolio":
        return true;
      default:
        return r.isCash || isCashAssetClass(r.assetClass);
    }
  });

  let portfolioReserveCents = 0;

  for (const row of eligibleRows) {
    const grossCents = Math.max(0, Math.round((row.valueBRL ?? 0) * 100));
    const netBRL = row.netValueBRL != null && row.netValueBRL > 0 ? row.netValueBRL : (row.valueBRL ?? 0);
    const netCents = Math.max(0, Math.round(netBRL * 100));
    const selectedCents = useNet ? netCents : grossCents;

    portfolioReserveCents += selectedCents;

    // Diagnósticos de Risco & Liquidez
    const isVolatile = isStockClass(row.assetClass) || isFiiClass(row.assetClass);
    const upperTicker = row.ticker.toUpperCase();
    const isMarketMarked =
      upperTicker.includes("IPCA") ||
      upperTicker.includes("PREFIXADO") ||
      upperTicker.includes("NTN") ||
      upperTicker.includes("LTN");
    const hasMaturityWarning = Boolean(row.isMatured);

    let warningMessage: string | undefined;
    if (hasMaturityWarning) {
      warningMessage = `Título vencido (${row.maturityDate ?? "data atingida"}). Realoque o saldo para rentabilizar.`;
      warnings.push({
        id: `matured-${row.assetId}`,
        severity: "warning",
        message: `Título Vencido na Reserva: ${row.ticker} atingiu o vencimento. Realoque o montante.`,
      });
    } else if (isVolatile) {
      warningMessage = "Ativo sujeito a oscilação do mercado (renda variável). Não recomendado para reserva.";
      warnings.push({
        id: `volatile-${row.assetId}`,
        severity: "warning",
        message: `Volatilidade na Reserva: ${row.ticker} oscila com o mercado e pode gerar perda em saques emergenciais.`,
      });
    } else if (isMarketMarked) {
      warningMessage = "Título sujeito a marcação a mercado se resgatado antes do vencimento.";
      warnings.push({
        id: `marked-${row.assetId}`,
        severity: "info",
        message: `Marcação a Mercado: ${row.ticker} pode sofrer deságio em caso de resgate antecipado.`,
      });
    }

    breakdown.push({
      id: row.assetId,
      label: row.ticker,
      type: "asset",
      assetClass: row.assetClass,
      grossCents,
      netCents,
      selectedCents,
      pctOfTotal: 0,
      isCashEquivalent: isLikelyReserveAsset(row),
      isVolatile,
      hasMaturityWarning,
      warningMessage,
    });
  }

  const totalReserveCents = cashInAccountsCents + portfolioReserveCents;

  // Calcula % de participação no total
  if (totalReserveCents > 0) {
    for (const item of breakdown) {
      item.pctOfTotal = Number(((item.selectedCents / totalReserveCents) * 100).toFixed(1));
    }
  }

  // Meta personalizada
  const validExpenses = Math.max(0, params.monthlyExpensesCents ?? 0);
  const targetMonthsCents = Math.round(validExpenses * targetMonths);
  const targetMonthsProgressPercent = targetMonthsCents > 0
    ? Math.min(100, Math.round((totalReserveCents / targetMonthsCents) * 100))
    : 0;

  return {
    totalReserveCents,
    cashInAccountsCents,
    portfolioReserveCents,
    breakdown,
    warnings,
    targetMonths,
    targetMonthsProgressPercent,
    targetMonthsCents,
  };
}

/**
 * Calcula os marcos e projeção da Reserva de Emergência.
 */
export function calculateEmergencyFund(params: EmergencyProjectionParams): EmergencyProjectionResult {
  const { currentLiquidCents, monthlyExpensesCents, monthlySavingsVelocityCents, referenceMonth } = params;

  const validLiquid = Math.max(0, currentLiquidCents);
  const validExpenses = Math.max(0, monthlyExpensesCents);
  const validSavings = Math.max(0, monthlySavingsVelocityCents);

  const currentMonthsCovered = validExpenses > 0
    ? Number((validLiquid / validExpenses).toFixed(1))
    : 0;

  const health = classifyEmergencyHealth(currentMonthsCovered);

  function calculateMilestone(months: 3 | 6 | 12): EmergencyMilestone {
    const targetCents = Math.round(validExpenses * months);
    const isReached = targetCents > 0 ? validLiquid >= targetCents : false;
    const progressPercent = targetCents > 0
      ? Math.min(100, Math.round((validLiquid / targetCents) * 100))
      : 0;

    let monthsRemaining: number | null = null;
    let estimatedCompletionMonth: string | null = null;

    if (isReached) {
      monthsRemaining = 0;
      estimatedCompletionMonth = referenceMonth;
    } else if (validSavings > 0 && targetCents > validLiquid) {
      const remainingCents = targetCents - validLiquid;
      monthsRemaining = Math.ceil(remainingCents / validSavings);
      estimatedCompletionMonth = shiftMonth(referenceMonth, monthsRemaining);
    }

    return {
      monthsOfExpenses: months,
      targetCents,
      progressPercent,
      isReached,
      monthsRemaining,
      estimatedCompletionMonth,
    };
  }

  return {
    monthlyExpensesCents: validExpenses,
    currentLiquidCents: validLiquid,
    currentMonthsCovered,
    health,
    monthlySavingsVelocityCents: validSavings,
    milestone3m: calculateMilestone(3),
    milestone6m: calculateMilestone(6),
    milestone12m: calculateMilestone(12),
  };
}
