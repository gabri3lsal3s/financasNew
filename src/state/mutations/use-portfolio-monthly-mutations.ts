/**
 * Mutação para salvar e consolidar o fechamento mensal da carteira de investimentos (§F10/F40/F51).
 *
 * Responsabilidades atômicas:
 * 1. Upsert em lote das cotações mensais em `portfolio_monthly_prices`;
 * 2. Atualização / upsert do snapshot patrimonial na tabela `portfolio_snapshots`;
 * 3. Invalidação seletiva de cache TanStack Query;
 * 4. Feedback sensorial tátil ("success") e notificação via toast.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertPortfolioMonthlyPricesBatch } from "@/data/repositories/portfolio-monthly-prices";
import { upsertPortfolioSnapshot } from "@/data/repositories/portfolio";
import { PORTFOLIO_QUERY_KEYS } from "./use-portfolio-mutations";
import { PORTFOLIO_MONTHLY_PRICES_QUERY_KEY } from "@/state/queries/use-portfolio-monthly-prices";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { MonthlyPriceInput } from "@/types";

export interface SaveMonthlyClosingInput {
  month: string;
  prices: MonthlyPriceInput[];
  totalValueBRL: number;
  totalCostBRL: number;
}

export function useSaveMonthlyClosing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMonthlyClosingInput) => {
      // 1. Grava as cotações mensais auditadas
      if (input.prices.length > 0) {
        await upsertPortfolioMonthlyPricesBatch(input.prices);
      }

      // 2. Grava ou atualiza o snapshot consolidado do mês
      await upsertPortfolioSnapshot({
        month: input.month,
        total_value: input.totalValueBRL,
        total_cost: input.totalCostBRL,
      });

      return input;
    },
    onSuccess: (data) => {
      // Invalidação de queries relevantes
      void queryClient.invalidateQueries({
        queryKey: [PORTFOLIO_MONTHLY_PRICES_QUERY_KEY, data.month],
      });
      void queryClient.invalidateQueries({
        queryKey: PORTFOLIO_QUERY_KEYS.snapshots,
      });
      void queryClient.invalidateQueries({
        queryKey: ["portfolio_position"],
      });

      pushToast({
        title: "Fechamento salvo",
        description: `O fechamento de ${data.month} foi salvo e o relatório atualizado com sucesso.`,
        variant: "success",
      });
      triggerSensory("success");
    },
    onError: (err) => {
      pushToast({
        title: "Erro ao salvar fechamento",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      triggerSensory("destructive");
    },
  });
}
