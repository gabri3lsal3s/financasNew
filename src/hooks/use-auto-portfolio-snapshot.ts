import { useEffect, useRef } from "react";
import { currentMonth } from "@/lib/date";
import {
  usePortfolioPosition,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
} from "@/state";

/**
 * Rotina autônoma de materialização de snapshots patrimoniais mensais (§F50).
 *
 * Ao carregar a posição da carteira, verifica se o mês corrente possui snapshot.
 * Se houver patrimônio em custódia e nenhum snapshot para o mês, materializa
 * automaticamente o `total_value` e `total_cost`, garantindo série histórica
 * contínua sem exigir ações manuais.
 */
export function useAutoPortfolioSnapshot() {
  const position = usePortfolioPosition();
  const snapshotsQuery = usePortfolioSnapshots();
  const upsertMutation = useUpsertPortfolioSnapshot();

  const isTriggeredRef = useRef(false);

  useEffect(() => {
    if (
      isTriggeredRef.current ||
      position.isLoading ||
      snapshotsQuery.isLoading ||
      upsertMutation.isPending
    ) {
      return;
    }

    const thisMonth = currentMonth();
    const existingSnapshots = snapshotsQuery.data ?? [];
    const hasThisMonthSnapshot = existingSnapshots.some((s) => s.month === thisMonth);

    if (!hasThisMonthSnapshot && (position.totalBRL > 0 || position.totalCostBRL > 0)) {
      isTriggeredRef.current = true;
      upsertMutation.mutate({
        month: thisMonth,
        total_value: position.totalBRL,
        total_cost: position.totalCostBRL,
      });
    }
  }, [position, snapshotsQuery, upsertMutation]);
}
