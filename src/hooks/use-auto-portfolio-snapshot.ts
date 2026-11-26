import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { evaluateStaleQuoteGuard } from "@/domain/portfolio/stale-quote-guard";
import { todaySaoPauloISO } from "@/domain/portfolio/dividend-suggester";
import { useAllPortfolioTransactions, usePortfolioSnapshots } from "@/state/queries/use-portfolio";
import { usePortfolioPosition } from "@/state/queries/use-portfolio-position";
import { useUpsertPortfolioSnapshot } from "@/state/mutations/use-portfolio-snapshots-mutations";
import {
  getMarketQuotesSwrSnapshot,
  subscribeMarketQuotesSwr,
} from "@/state/queries/use-market-quotes-swr";

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
  const transactionsQuery = useAllPortfolioTransactions();
  const snapshotsQuery = usePortfolioSnapshots();
  const upsertMutation = useUpsertPortfolioSnapshot();
  const swrSnapshot = useSyncExternalStore(
    subscribeMarketQuotesSwr,
    getMarketQuotesSwrSnapshot,
    getMarketQuotesSwrSnapshot,
  );

  const lastPersistedSigRef = useRef<string | null>(null);

  const hasPostTradeStale = useMemo(() => {
    if (
      position.isLoading ||
      Boolean(position.error) ||
      transactionsQuery.isLoading ||
      Boolean(transactionsQuery.isError)
    ) {
      return true;
    }
    return evaluateStaleQuoteGuard({
      rows: position.rows,
      transactions: transactionsQuery.data ?? [],
      fxMetadata: position.fxMetadata,
    }).hasPostTradeStale;
  }, [
    position.isLoading,
    position.error,
    position.rows,
    position.fxMetadata,
    transactionsQuery.isLoading,
    transactionsQuery.isError,
    transactionsQuery.data,
  ]);

  useEffect(() => {
    if (
      position.isLoading ||
      Boolean(position.error) ||
      transactionsQuery.isLoading ||
      Boolean(transactionsQuery.isError) ||
      snapshotsQuery.isLoading ||
      Boolean(snapshotsQuery.isError) ||
      upsertMutation.isPending ||
      swrSnapshot.isSyncing ||
      hasPostTradeStale
    ) {
      return;
    }

    const thisMonth = todaySaoPauloISO().slice(0, 7);
    const existingSnapshots = snapshotsQuery.data ?? [];
    const thisMonthSnapshot = existingSnapshots.find((s) => s.month === thisMonth);

    // Mês corrente: aplica a regra canônica de total_value e total_cost
    // - Se status for 'closed', respeita estritamente a imutabilidade do fechamento oficial.
    if (thisMonthSnapshot?.status === "closed") {
      return;
    }

    // position.totalCostBRL já incorpora CAIXA no motor canônico (zero dupla contagem)
    const currentCost = Math.round(position.totalCostBRL * 100) / 100;
    const currentTotalValue = Math.round(position.totalBRL * 100) / 100;

    if (currentTotalValue <= 0 && currentCost <= 0) {
      return;
    }

    const nextSignature = `${thisMonth}|${currentTotalValue.toFixed(2)}|${currentCost.toFixed(2)}`;
    if (lastPersistedSigRef.current === nextSignature) {
      return;
    }

    if (!thisMonthSnapshot) {
      lastPersistedSigRef.current = nextSignature;
      upsertMutation.mutate({
        month: thisMonth,
        total_value: currentTotalValue,
        total_cost: currentCost,
        status: "provisional",
      });
      return;
    }

    if (thisMonthSnapshot.status === "provisional") {
      const valDiff = Math.abs(currentTotalValue - (Number(thisMonthSnapshot.total_value) || 0));
      const costDiff = Math.abs(currentCost - (Number(thisMonthSnapshot.total_cost) || 0));
      if (valDiff >= 1.0 || costDiff >= 1.0) {
        lastPersistedSigRef.current = nextSignature;
        upsertMutation.mutate({
          month: thisMonth,
          total_value: currentTotalValue,
          total_cost: currentCost,
          status: "provisional",
        });
      }
    }
  }, [
    position,
    transactionsQuery.isLoading,
    transactionsQuery.isError,
    snapshotsQuery,
    upsertMutation,
    swrSnapshot.isSyncing,
    hasPostTradeStale,
  ]);
}

