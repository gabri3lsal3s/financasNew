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
 * Centraliza com exclusividade a materialização autônoma de snapshots patrimoniais (§2.2 PLANO_AUDITORIA):
 * 1. Ao carregar a posição da carteira, verifica se o mês corrente possui snapshot.
 *    Se houver patrimônio em custódia e nenhum snapshot para o mês, materializa
 *    automaticamente o `total_value` e `total_cost` segundo a regra canônica:
 *    - total_value: Ativos valorados + Saldo de Caixa
 *    - total_cost: Custo de aquisição dos ativos + Saldo de Caixa (paridade 1:1)
 *    garantindo série histórica contínua sem concorrência ou mutações duplicadas.
 * 2. Recálculo automático retroativo: se foram identificadas movimentações ou
 *    proventos em meses retroativos (< mês corrente) que não possuem snapshot gravado
 *    ou que demandem reconciliação, recalcula a posição no ponto-de-tempo em background
 *    e grava o snapshot com a mesma regra canônica, com trava de deduplicação via `useRef`.
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

    // 1. Mês corrente: aplica a regra canônica de total_value e total_cost
    const currentCost = Math.round((position.totalCostBRL + position.cashBRL) * 100) / 100;
    if (
      !isTriggeredRef.current &&
      !hasThisMonthSnapshot &&
      (position.totalBRL > 0 || currentCost > 0)
    ) {
      isTriggeredRef.current = true;
      upsertMutation.mutate({
        month: thisMonth,
        total_value: position.totalBRL,
        total_cost: currentCost,
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

      const retroCost = Math.round((pointInTime.totalCostBRL + pointInTime.cashQuantity) * 100) / 100;
      if (pointInTime.totalValueBRL > 0 || retroCost > 0) {
        upsertMutation.mutate({
          month: nextRetroMonth,
          total_value: pointInTime.totalValueBRL,
          total_cost: retroCost,
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

