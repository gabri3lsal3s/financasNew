/**
 * Motor Matemático Puro de Metas & Patrimônio Familiar (wealth.ts).
 *
 * Módulo de domínio responsável por cálculos de:
 *   1. Autonomia e saúde da Reserva de Emergência Conjunta da Casa;
 *   2. Runrate e cobertura de proventos/dividendos sobre os gastos fixos familiares;
 *   3. Progresso percentual de metas patrimoniais coletivas em centavos.
 *
 * Em conformidade estrita com:
 *   - AGENTS.md §3: Função 100% pura, sem imports de UI, React ou Supabase;
 *   - AGENTS.md §4.8: Zero emojis no produto;
 *   - FINANCIAL_MATH_SPEC.md §1: Moeda tratada estritamente em centavos inteiros.
 */

import type {
  FamilyEmergencyReserveReport,
  FamilyEmergencyReserveStatus,
  FamilyPassiveIncomeReport,
} from "@/types/family-wealth";

function sanitizeCents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Avalia o nível de cobertura da reserva de emergência da casa em meses de teto ou gastos consolidados.
 * Suporta o cálculo contra o teto de gastos estipulado pela família (recomendado) ou gastos realizados.
 */
export function calculateFamilyEmergencyReserveHealth(
  totalFamilyCashCents: number,
  monthlyReferenceCents: number,
  options?: {
    isCeiling?: boolean;
    targetMonths?: number;
  },
): FamilyEmergencyReserveReport {
  const safeCash = sanitizeCents(totalFamilyCashCents);
  const safeReference = sanitizeCents(monthlyReferenceCents);
  const targetMonths = options?.targetMonths && options.targetMonths > 0 ? options.targetMonths : 6;
  const isCeiling = options?.isCeiling ?? false;

  if (safeReference <= 0) {
    return {
      months_covered: safeCash > 0 ? 12 : 0,
      total_cash_cents: safeCash,
      monthly_expenses_cents: 0,
      status: safeCash > 0 ? "excellent" : "critical",
      label: safeCash > 0 ? "Excelente (> 12 meses)" : "Sem teto ou gastos registrados",
      target_months: targetMonths,
      target_cents: 0,
      progress_percent: safeCash > 0 ? 100 : 0,
      remaining_cents: 0,
      has_ceiling: isCeiling,
    };
  }

  const rawMonths = safeCash / safeReference;
  const monthsCovered = Math.round(rawMonths * 10) / 10;
  const targetCents = safeReference * targetMonths;
  const progressPercent =
    targetCents > 0 ? Math.min(100, Math.round((safeCash / targetCents) * 100)) : 0;
  const remainingCents = Math.max(0, targetCents - safeCash);

  let status: FamilyEmergencyReserveStatus = "critical";
  let label = "Crítico (< 3 meses)";

  if (monthsCovered >= 12) {
    status = "excellent";
    label = "Excelente (> 12 meses)";
  } else if (monthsCovered >= 6) {
    status = "solid";
    label = "Sólido (6 a 12 meses)";
  } else if (monthsCovered >= 3) {
    status = "moderate";
    label = "Moderado (3 a 6 meses)";
  }

  return {
    months_covered: monthsCovered,
    total_cash_cents: safeCash,
    monthly_expenses_cents: safeReference,
    status,
    label,
    target_months: targetMonths,
    target_cents: targetCents,
    progress_percent: progressPercent,
    remaining_cents: remainingCents,
    has_ceiling: isCeiling,
  };
}

/**
 * Calcula o percentual dos gastos fixos da casa que são cobertos pelos proventos dos investimentos familiares.
 */
export function calculateFamilyPassiveIncomeRunrate(
  dividends12mCents: number,
  monthlyFixedExpensesCents: number,
): FamilyPassiveIncomeReport {
  const safeDividends = sanitizeCents(dividends12mCents);
  const safeExpenses = sanitizeCents(monthlyFixedExpensesCents);

  if (safeExpenses <= 0) {
    return {
      fixed_expenses_coverage_percent: safeDividends > 0 ? 100 : 0,
      dividends_12m_cents: safeDividends,
      monthly_fixed_expenses_cents: 0,
      is_independent: safeDividends > 0,
    };
  }

  const monthlyDividendsAvg = safeDividends / 12;
  const coveragePercent = Math.round((monthlyDividendsAvg / safeExpenses) * 100);

  return {
    fixed_expenses_coverage_percent: coveragePercent,
    dividends_12m_cents: safeDividends,
    monthly_fixed_expenses_cents: safeExpenses,
    is_independent: coveragePercent >= 100,
  };
}

/**
 * Calcula o progresso percentual seguro de uma meta patrimonial em centavos (0 a 100%).
 */
export function calculateGoalProgress(
  currentCents: number,
  targetCents: number,
): number {
  const safeCurrent = sanitizeCents(currentCents);
  const safeTarget = sanitizeCents(targetCents);

  if (safeTarget <= 0) return 0;
  return Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
}

export interface IsAssetSharedParams {
  is_family?: boolean | null;
  asset_class?: string | null;
  share_all_portfolio?: boolean | null;
  shared_asset_classes?: readonly string[] | string[] | null;
}

/**
 * Determina se um ativo pertence ao patrimônio compartilhado com a família
 * considerando as três instâncias de governança:
 * 1. Compartilhamento integral da carteira do membro (share_all_portfolio);
 * 2. Compartilhamento por classe de ativo (shared_asset_classes);
 * 3. Marcação direta e explícita no ativo individual (is_family).
 */
export function isAssetSharedWithFamily(params: IsAssetSharedParams): boolean {
  if (params.share_all_portfolio) return true;
  if (
    params.shared_asset_classes &&
    params.shared_asset_classes.length > 0 &&
    params.asset_class &&
    params.shared_asset_classes.some(
      (c) => c.trim().toLowerCase() === params.asset_class?.trim().toLowerCase(),
    )
  ) {
    return true;
  }
  return Boolean(params.is_family);
}

/**
 * Determina se um ativo possui perfil de liquidez imediata (caixa/reserva)
 * para fins de consolidação da Reserva de Emergência da Família.
 *
 * Espelha fielmente a regra SQL da RPC get_family_portfolio_summary:
 * 1. Classe 'caixa', 'reserva' ou 'reserva de emergência';
 * 2. OU ticker exatamente 'CAIXA';
 * 3. OU ticker contendo 'selic' ou 'cdi'.
 */
export function isAssetCashLike(ticker: string, assetClass?: string | null): boolean {
  const normClass = (assetClass ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normClass === "caixa" ||
    normClass === "reserva" ||
    normClass === "reserva de emergencia"
  ) {
    return true;
  }

  const normTicker = ticker.trim().toLowerCase();
  if (normTicker === "caixa") {
    return true;
  }

  return normTicker.includes("selic") || normTicker.includes("cdi");
}
