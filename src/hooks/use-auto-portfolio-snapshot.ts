import { useEffect, useRef } from "react";
import { currentMonth } from "@/lib/date";
import {
  useAllPortfolioTransactions,
  usePortfolioAssets,
  usePortfolioDividends,
  usePortfolioPosition,
  usePortfolioSnapshots,
  useUpsertPortfolioSnapshot,
} from "@/state";
import { calculatePointInTimePosition } from "@/domain/portfolio";

/**
 * Rotina autônoma de materialização de snapshots patrimoniais mensais (§F50/F51).
 *
 * 1. Ao carregar a posição da carteira, verifica se o mês corrente possui snapshot.
 *    Se houver patrimônio em custódia e nenhum snapshot para o mês, materializa
 *    automaticamente o `total_value` e `total_cost`, garantindo série histórica
 *    contínua sem exigir ações manuais.
 * 2. Recálculo automático retroativo: se foram identificadas movimentações ou
 *    proventos em meses retroativos (< mês corrente) que não possuem snapshot gravado
 *    ou que demandem reconciliação, recalcula a posição no ponto-de-tempo em background
 *    e grava o snapshot, com trava de deduplicação via `useRef`.
 */
export function useAutoPortfolioSnapshot() {
  const position = usePortfolioPosition();
  const snapshotsQuery = usePortfolioSnapshots();
  const upsertMutation = useUpsertPortfolioSnapshot();
  const assetsQuery = usePortfolioAssets();
  const transactionsQuery = useAllPortfolioTransactions();
  const dividendsQuery = usePortfolioDividends();

  const isTriggeredRef = useRef(false);
  const processedRetroMonthsRef = useRef<Set<string>>(new Set());

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
    const hasThisMonthSnapshot = existingSnapshots.some((s) => s.month === thisMonth);

    // 1. Mês corrente
    if (!isTriggeredRef.current && !hasThisMonthSnapshot && (position.totalBRL > 0 || position.totalCostBRL > 0)) {
      isTriggeredRef.current = true;
      upsertMutation.mutate({
        month: thisMonth,
        total_value: position.totalBRL,
        total_cost: position.totalCostBRL,
      });
      return;
    }

    // 2. Meses retroativos sem snapshot mas com movimentações registradas
    if (
      assetsQuery.isLoading ||
      transactionsQuery.isLoading ||
      !assetsQuery.data ||
      !transactionsQuery.data
    ) {
      return;
    }

    const snapshotMonthSet = new Set(existingSnapshots.map((s) => s.month));
    const retroMonthsToProcess = new Set<string>();

    for (const tx of transactionsQuery.data) {
      if (tx.date) {
        const txMonth = tx.date.slice(0, 7);
        if (
          txMonth < thisMonth &&
          !snapshotMonthSet.has(txMonth) &&
          !processedRetroMonthsRef.current.has(txMonth)
        ) {
          retroMonthsToProcess.add(txMonth);
        }
      }
    }

    for (const div of dividendsQuery.data ?? []) {
      if (div.date) {
        const divMonth = div.date.slice(0, 7);
        if (
          divMonth < thisMonth &&
          !snapshotMonthSet.has(divMonth) &&
          !processedRetroMonthsRef.current.has(divMonth)
        ) {
          retroMonthsToProcess.add(divMonth);
        }
      }
    }

    // Processa o mês retroativo mais recente pendente
    const nextRetroMonth = Array.from(retroMonthsToProcess).sort().pop();
    if (nextRetroMonth) {
      processedRetroMonthsRef.current.add(nextRetroMonth);
      const pointInTime = calculatePointInTimePosition({
        month: nextRetroMonth,
        assets: assetsQuery.data,
        transactions: transactionsQuery.data,
        dividends: dividendsQuery.data ?? [],
      });

      if (pointInTime.totalValueBRL > 0 || pointInTime.totalCostBRL > 0) {
        upsertMutation.mutate({
          month: nextRetroMonth,
          total_value: pointInTime.totalValueBRL,
          total_cost: pointInTime.totalCostBRL,
        });
      }
    }
  }, [
    position,
    snapshotsQuery,
    upsertMutation,
    assetsQuery.data,
    assetsQuery.isLoading,
    transactionsQuery.data,
    transactionsQuery.isLoading,
    dividendsQuery.data,
  ]);
}

