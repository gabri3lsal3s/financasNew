import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";
import { useSaveSimulationToAccount } from "@/state";
import { getPendingSimulation, clearPendingSimulation } from "@/domain/share";

/**
 * Hook para processar simulações financeiras pendentes salvas nos simuladores
 * públicos (/ferramentas/*) para transferência na conta do usuário pós-cadastro (auto-onboarding).
 * Executa automaticamente quando o usuário confirma e ativa sua sessão.
 */
export function usePendingSimulation() {
  const { session } = useAuth();
  const saveMutation = useSaveSimulationToAccount();
  const processedRef = useRef(false);

  useEffect(() => {
    if (!session?.user || processedRef.current) return;

    const pending = getPendingSimulation();
    if (!pending) return;

    processedRef.current = true;
    clearPendingSimulation();

    void saveMutation.mutateAsync(pending).catch(() => {
      // Falha tratada no onError da mutation via toast institucional
    });
  }, [session, saveMutation]);
}
