/**
 * Motor Puro de Composição Patrimonial de Metas (§Plano 12).
 *
 * Integra contas bancárias (com dedução de obrigações pendentes) e ativos de custódia,
 * calcula decomposição visual (Aportes Realizados vs. Rendimentos de Mercado)
 * e aplica teto exclusivo para prevenção rigorosa de double counting.
 *
 * 100% puro — sem dependências de UI, DOM ou Supabase.
 */

import {
  MAX_ACTIVE_GOALS,
  type GoalCompositionConfig,
  type GoalCompositionResult,
} from "@/types/goals";

export { MAX_ACTIVE_GOALS };

export interface AccountCompositionItem {
  id: string;
  name?: string;
  balanceCents: number;
  /** Faturas ou contas a pagar vinculadas a esta conta no curto prazo. */
  pendingObligationsCents?: number;
}

export interface PortfolioAssetCompositionItem {
  id: string;
  ticker: string;
  assetClass?: string | null;
  quantity: number;
  /** Valor atual de mercado em centavos. */
  valueCents: number;
  /** Custo total de aquisição/aportes acumulados em centavos. */
  totalCostCents?: number;
}

export interface ResolveGoalCompositionParams {
  config?: GoalCompositionConfig | null;
  targetCents: number;
  accounts?: readonly AccountCompositionItem[];
  assets?: readonly PortfolioAssetCompositionItem[];
  /** Se a meta já foi previamente concluída e está travada contra recuo. */
  previouslyLockedAsCompleted?: boolean;
}

/**
 * Validação de disciplina financeira: o usuário pode ter no máximo 5 metas ativas simultâneas.
 */
export function canCreateActiveGoal(activeGoalsCount: number): boolean {
  return activeGoalsCount < MAX_ACTIVE_GOALS;
}

/**
 * Resolve a composição financeira e patrimonial de uma meta.
 */
export function resolveGoalComposition({
  config,
  targetCents,
  accounts = [],
  assets = [],
  previouslyLockedAsCompleted = false,
}: ResolveGoalCompositionParams): GoalCompositionResult {
  const safeTargetCents = Math.max(0, targetCents);

  if (!config) {
    return {
      currentCents: 0,
      grossAvailableCents: 0,
      targetCents: safeTargetCents,
      progressPercent: 0,
      isReached: false,
      checkingAccountsCents: 0,
      investmentsCents: 0,
      totalDesembolsadoCents: 0,
      totalRendimentosCents: 0,
      isCapApplied: false,
      warnings: [],
    };
  }

  const warnings: string[] = [];

  // 1. Contas Bancárias / Saldo Livre em Conta Corrente
  let checkingAccountsCents = 0;
  if (config.includeCheckingAccounts) {
    const selectedAccountIds =
      config.accountIds && config.accountIds.length > 0 ? new Set(config.accountIds) : null;

    for (const acc of accounts) {
      if (selectedAccountIds && !selectedAccountIds.has(acc.id)) {
        continue;
      }
      const obligations = Math.max(0, acc.pendingObligationsCents ?? 0);
      const freeBalance = Math.max(0, acc.balanceCents - obligations);
      checkingAccountsCents += freeBalance;
    }
  }

  // 2. Investimentos em Custódia
  let investmentsCents = 0;
  let totalCostFromAssets = 0;
  let hasVolatileAssets = false;

  if (config.includeInvestments) {
    const selectedAssetIds =
      config.assetIds && config.assetIds.length > 0 ? new Set(config.assetIds) : null;
    const selectedClasses =
      config.classes && config.classes.length > 0
        ? new Set(config.classes.map((c) => c.toLowerCase().trim()))
        : null;

    for (const asset of assets) {
      if (asset.quantity <= 0 || asset.valueCents <= 0) continue;

      let isIncluded = false;
      if (config.investmentMode === "entire_portfolio") {
        isIncluded = true;
      } else if (config.investmentMode === "selected_assets" && selectedAssetIds) {
        isIncluded = selectedAssetIds.has(asset.id);
      } else if (config.investmentMode === "selected_classes" && selectedClasses) {
        const assetClassLower = (asset.assetClass ?? "").toLowerCase().trim();
        isIncluded = selectedClasses.has(assetClassLower);
      }

      if (isIncluded) {
        investmentsCents += asset.valueCents;
        totalCostFromAssets += asset.totalCostCents ?? asset.valueCents;

        const cls = (asset.assetClass ?? "").toLowerCase();
        if (
          cls.includes("ação") ||
          cls.includes("acoes") ||
          cls.includes("fii") ||
          cls.includes("cripto") ||
          cls.includes("stock")
        ) {
          hasVolatileAssets = true;
        }
      }
    }
  }

  if (hasVolatileAssets) {
    warnings.push("Contém ativos voláteis sujeitos a oscilações normais de mercado.");
  }

  // 3. Total Bruto e Aplicação do Teto Anti-Double Counting
  const grossAvailableCents = checkingAccountsCents + investmentsCents;
  let currentCents = grossAvailableCents;
  let isCapApplied = false;

  if (config.allocationCapCents !== null && config.allocationCapCents !== undefined && config.allocationCapCents > 0) {
    if (grossAvailableCents > config.allocationCapCents) {
      currentCents = config.allocationCapCents;
      isCapApplied = true;
      warnings.push("Saldo limitado ao teto configurado para prevenir dupla contagem patrimonial.");
    }
  }

  // 4. Trava de Meta Conquistada contra oscilações negativas
  if (config.isCompletedLocked && previouslyLockedAsCompleted) {
    if (currentCents < safeTargetCents) {
      currentCents = safeTargetCents;
      warnings.push("Meta congelada no marco conquistado.");
    }
  }

  // 5. Decomposição entre Aportes Desembolsados e Rendimentos
  // Proporção de capital próprio desembolsado vs rendimento
  const rawDesembolsado = checkingAccountsCents + totalCostFromAssets;
  let totalDesembolsadoCents = Math.min(currentCents, rawDesembolsado);
  let totalRendimentosCents = Math.max(0, currentCents - totalDesembolsadoCents);

  if (currentCents === 0) {
    totalDesembolsadoCents = 0;
    totalRendimentosCents = 0;
  }

  const progressPercent =
    safeTargetCents > 0 ? (currentCents / safeTargetCents) * 100 : currentCents > 0 ? 100 : 0;

  const isReached = safeTargetCents > 0 && currentCents >= safeTargetCents;

  return {
    currentCents,
    grossAvailableCents,
    targetCents: safeTargetCents,
    progressPercent,
    isReached,
    checkingAccountsCents,
    investmentsCents,
    totalDesembolsadoCents,
    totalRendimentosCents,
    isCapApplied,
    warnings,
  };
}
