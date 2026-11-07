import { useCallback } from "react";
import { useUserPreferences } from "./use-user-preferences";
import { useUpdateAppMode } from "@/state/mutations/use-preference-mutations";
import type { AppMode } from "@/types";

export interface UseAppModeResult {
  /** Modo ativo atual ('investor' ou 'essential'). Padrão: 'investor'. */
  appMode: AppMode;
  /** Se o modo Investidor completo está ativo (acesso à carteira, aportes e proventos). */
  isInvestorMode: boolean;
  /** Se o modo Essencial está ativo (foco exclusivo em contas, faturas e orçamentos do dia a dia). */
  isEssentialMode: boolean;
  /** Altera o modo do usuário com persistência em nuvem e atualização otimista instantânea. */
  setAppMode: (nextMode: AppMode) => Promise<void>;
  /** Se a mutação de alteração de modo está em andamento. */
  isUpdating: boolean;
  /** Se as preferências ainda estão sendo carregadas inicialmente. */
  isLoading: boolean;
}

/**
 * Hook de governança para Perfis de Visualização e Divulgação Progressiva (§Plano 07).
 * Fornece estado reativo sem recarregar a janela e alternância em 1 clique.
 */
export function useAppMode(): UseAppModeResult {
  const { data: preferences, isLoading } = useUserPreferences();
  const updateAppModeMutation = useUpdateAppMode();

  const appMode: AppMode = preferences?.app_mode ?? "investor";
  const isInvestorMode = appMode === "investor";
  const isEssentialMode = appMode === "essential";

  const setAppMode = useCallback(
    async (nextMode: AppMode) => {
      await updateAppModeMutation.mutateAsync(nextMode);
    },
    [updateAppModeMutation],
  );

  return {
    appMode,
    isInvestorMode,
    isEssentialMode,
    setAppMode,
    isUpdating: updateAppModeMutation.isPending,
    isLoading,
  };
}
