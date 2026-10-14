import { useState, useCallback, type ReactNode } from "react";
import { useUserSubscription } from "@/state";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import type { SubscriptionPlan } from "@/types";

export interface UseMutationGuardOptions {
  /** Contexto padrão caso nenhum seja fornecido ao invocar guardAction. */
  defaultContext?: string;
}

export interface UseMutationGuardReturn {
  /** Verdadeiro se o usuário tem permissão de escrita. */
  canWrite: boolean;
  /** Verdadeiro se o usuário está bloqueado em modo somente-leitura. */
  isReadOnlyMode: boolean;
  /**
   * Executa a ação se tiver permissão de escrita.
   * Se estiver em modo somente-leitura, intercepta e abre o UpgradeDialog com o contexto especificado.
   */
  guardAction: (action: () => void, contextName?: string) => void;
  /**
   * Componente de modal de upgrade para renderizar no JSX do componente.
   * Retorna null se não houver necessidade ou renderiza o UpgradeDialog controlado.
   */
  upgradeModal: ReactNode;
}

/**
 * Hook central DRY para blindagem de mutações contra o modo Somente-Leitura.
 *
 * Utilizado em todas as telas e diálogos onde ocorrem ações de criação, edição ou exclusão.
 */
export function useMutationGuard(options?: UseMutationGuardOptions): UseMutationGuardReturn {
  const subscription = useUserSubscription();

  const [isOpen, setIsOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<string | undefined>(options?.defaultContext);

  const canWrite = subscription?.canWrite ?? true;
  const isReadOnlyMode = subscription?.isReadOnly ?? false;

  const guardAction = useCallback(
    (action: () => void, contextName?: string) => {
      if (isReadOnlyMode) {
        setActiveContext(contextName ?? options?.defaultContext);
        setIsOpen(true);
        return;
      }
      action();
    },
    [isReadOnlyMode, options?.defaultContext],
  );

  const handleProceedToCheckout = useCallback((plan: SubscriptionPlan) => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign(`/assinatura?plano=${plan}`);
    }
  }, []);

  const upgradeModal = (
    <UpgradeDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      context={activeContext}
      onProceedToCheckout={handleProceedToCheckout}
    />
  );

  return {
    canWrite,
    isReadOnlyMode,
    guardAction,
    upgradeModal,
  };
}
