import {
  resolveGoalComposition,
  type AccountCompositionItem,
  type PortfolioAssetCompositionItem,
} from "@/domain/goals";
import type { GoalCompositionConfig, PublicShare } from "@/types";

export interface GoalProgressAssetInput {
  assetId: string;
  ticker: string;
  assetClass?: string | null;
  quantity: number;
  valueBRL: number;
  totalCostBRL: number;
}

export interface LiveGoalProgressItem {
  currentCents: number;
  percentage: number;
  isCompleted: boolean;
}

/** Calcula o progresso em tempo real das metas patrimoniais com composição de saldo/ativos. */
export function buildLiveGoalProgressMap(params: {
  currentBalanceCents: number;
  positionRows: readonly GoalProgressAssetInput[];
  goalShares: PublicShare[];
}): Map<string, LiveGoalProgressItem> {
  const { currentBalanceCents, positionRows, goalShares } = params;
  const accounts: AccountCompositionItem[] = [
    {
      id: "main_cash",
      name: "Saldo em Conta Corrente / Caixa Geral",
      balanceCents: Math.max(0, currentBalanceCents),
      pendingObligationsCents: 0,
    },
  ];

  const assets: PortfolioAssetCompositionItem[] = positionRows
    .filter((r) => r.quantity > 0 || r.valueBRL > 0)
    .map((r) => ({
      id: r.assetId,
      ticker: r.ticker,
      assetClass: r.assetClass,
      quantity: r.quantity > 0 ? r.quantity : 1,
      valueCents: Math.round(r.valueBRL * 100),
      totalCostCents: Math.round(r.totalCostBRL * 100),
    }));

  const map = new Map<string, LiveGoalProgressItem>();
  for (const share of goalShares) {
    const payload = share.payload ?? {};
    const config = payload.composition_config as GoalCompositionConfig | undefined;
    const targetCents = Number(payload.target_cents ?? 0);
    const isCompletedInDb = payload.status === "completed";

    if (config) {
      const resolved = resolveGoalComposition({
        config,
        targetCents,
        accounts,
        assets,
        previouslyLockedAsCompleted: isCompletedInDb && targetCents > 0 ? false : isCompletedInDb,
      });
      map.set(share.id, {
        currentCents: resolved.currentCents,
        percentage: Math.round(resolved.progressPercent),
        isCompleted: targetCents > 0 ? resolved.currentCents >= targetCents : isCompletedInDb,
      });
    } else {
      const currentCents = Number(payload.current_cents ?? 0);
      map.set(share.id, {
        currentCents,
        percentage: targetCents > 0 ? Math.round((currentCents / targetCents) * 100) : 0,
        isCompleted: targetCents > 0 ? currentCents >= targetCents : isCompletedInDb,
      });
    }
  }

  return map;
}
