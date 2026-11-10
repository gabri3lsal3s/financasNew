import { useState, useCallback, type ReactNode } from "react";
import { useUserSubscription, usePermission } from "@/state";
import { UpgradeDialog } from "@/components/modules/subscription/upgrade-dialog";
import { buildCheckoutUrl } from "@/domain/subscription/plans";
import type { SubscriptionPlan, SystemFeatureKey } from "@/types";

export interface UseMutationGuardOptions {
  /** Contexto padrão caso nenhum seja fornecido ao invocar guardAction. */
  defaultContext?: string;
  /** Chave do módulo opcional para validação modular granular (§F43). */
  moduleKey?: SystemFeatureKey | string;
}

export interface UseMutationGuardReturn {
  /** Verdadeiro se o usuário tem permissão de escrita. */
  canWrite: boolean;
  /** Verdadeiro se o usuário está bloqueado em modo somente-leitura geral ou para este módulo. */
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
 * Consolida tanto a assinatura global quanto a permissão granular do módulo selecionado.
 * Utilizado em todas as telas e diálogos onde ocorrem ações de criação, edição ou exclusão.
 */
export function useMutationGuard(options?: UseMutationGuardOptions): UseMutationGuardReturn {
  const subscription = useUserSubscription();
  const modulePermission = usePermission(options?.moduleKey ?? "transactions");

  const [isOpen, setIsOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<string | undefined>(options?.defaultContext);

  const globalCanWrite = subscription?.canWrite ?? true;
  const globalReadOnly = subscription?.isReadOnly ?? false;

  const canWrite = options?.moduleKey
    ? globalCanWrite && modulePermission.canWrite
    : globalCanWrite && !globalReadOnly;

  const isReadOnlyMode = !canWrite || globalReadOnly || Boolean(options?.moduleKey && modulePermission.isReadOnlyMode);

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
      window.location.assign(buildCheckoutUrl({ plan }));
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
