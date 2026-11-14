import { useEffect, useRef } from "react";
import { currentMonth } from "@/lib/date";
import {
  usePortfolioPosition,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
} from "@/state";

/**
 * Rotina autônoma de materialização de snapshots patrimoniais mensais (§F50/F51).
 *
 * Blindagem e Imutabilidade Canônica:
 * 1. Mês corrente:
 *    - Se inexiste snapshot para a competência ativa, materializa com status 'provisional'.
 *    - Se existe snapshot com status 'provisional' e houver divergência relevante (>= R$ 1,00),
 *      recalibra o snapshot provisório para acompanhar a custódia viva do mês.
 *    - Se o status for 'closed', respeita estritamente a imutabilidade do fechamento oficial.
 * 2. Imutabilidade pós-fechamento e meses passados:
 *    - Nenhuma rotina automática altera, cria ou sobrescreve snapshots de meses retroativos (< mês corrente).
 *    - Apenas o fechamento de mercado oficial (commit_monthly_closing_atomic) ou calibração manual do usuário
 *      (calibrate_portfolio_snapshot) podem gerar registros de meses fechados.
 */
export function useAutoPortfolioSnapshot() {
  const position = usePortfolioPosition();
  const snapshotsQuery = usePortfolioSnapshots();
  const upsertMutation = useUpsertPortfolioSnapshot();

  const isTriggeredRef = useRef(false);

  useEffect(() => {
    if (
      position.isLoading ||
      snapshotsQuery.isLoading ||
      upsertMutation.isPending
    ) {
      return;
    }

    const thisMonth = currentMonth();
    const existingSnapshots = snapshotsQuery.data ?? [];
    const thisMonthSnapshot = existingSnapshots.find((s) => s.month === thisMonth);

    // Mês corrente: aplica a regra canônica de total_value e total_cost
    // - Se status for 'closed', respeita estritamente a imutabilidade do fechamento oficial.
    if (thisMonthSnapshot?.status === "closed") {
      return;
    }

    const currentCost = Math.round((position.totalCostBRL + position.cashBRL) * 100) / 100;
    const currentTotalValue = Math.round(position.totalBRL * 100) / 100;

    if (!isTriggeredRef.current && (currentTotalValue > 0 || currentCost > 0)) {
      if (!thisMonthSnapshot) {
        isTriggeredRef.current = true;
        upsertMutation.mutate({
          month: thisMonth,
          total_value: currentTotalValue,
          total_cost: currentCost,
          status: "provisional",
        });
        return;
      } else if (thisMonthSnapshot.status === "provisional") {
        const valDiff = Math.abs(currentTotalValue - (Number(thisMonthSnapshot.total_value) || 0));
        const costDiff = Math.abs(currentCost - (Number(thisMonthSnapshot.total_cost) || 0));
        if (valDiff >= 1.0 || costDiff >= 1.0) {
          isTriggeredRef.current = true;
          upsertMutation.mutate({
            month: thisMonth,
            total_value: currentTotalValue,
            total_cost: currentCost,
            status: "provisional",
          });
          return;
        }
      }
    }
  }, [
    position,
    snapshotsQuery,
    upsertMutation,
  ]);
}

