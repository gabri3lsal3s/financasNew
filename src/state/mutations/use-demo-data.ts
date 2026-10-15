import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearDemoData, loadDemoData } from "@/services/demo-data";
import type { DemoClearSummary, DemoLoadSummary } from "@/services/demo-data";
import { pushToast } from "@/services/toast";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";

/**
 * Hook para carregar dados de demonstração com 1 clique no primeiro uso.
 */
export function useLoadDemoData() {
  const queryClient = useQueryClient();

  return useMutation<DemoLoadSummary, Error, void>({
    mutationFn: () => loadDemoData(),
    onSuccess: (summary) => {
      void queryClient.invalidateQueries();
      triggerSensory("success");
      pushToast({
        title: "Dados de exemplo carregados",
        description: `Adicionados ${summary.expenses} despesas, ${summary.incomes} receitas, 1 cartão e investimentos para teste.`,
        variant: "success",
      });
    },
    onError: (err) => {
      triggerSensory("destructive");
      pushToast({
        title: "Não foi possível carregar os dados de exemplo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook para limpar cirurgicamente todos os dados de demonstração.
 */
export function useClearDemoData() {
  const queryClient = useQueryClient();

  return useMutation<DemoClearSummary, Error, void>({
    mutationFn: () => clearDemoData(),
    onSuccess: (summary) => {
      void queryClient.invalidateQueries();
      triggerSensory("action");
      const total = summary.expenses + summary.incomes + summary.cards + summary.assets;
      pushToast({
        title: "Dados de exemplo removidos",
        description: `${total} itens de demonstração foram limpos com sucesso.`,
        variant: "success",
      });
    },
    onError: (err) => {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao limpar dados de exemplo",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });
}
