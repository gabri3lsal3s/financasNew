import { useMemo } from "react";
import { useUserAccess } from "./use-user-access";
import { useUserSubscription } from "./use-user-subscription";
import type { ModuleAccessLevel, SystemFeatureKey } from "@/types";

export interface PermissionResult {
  /** Verdadeiro se o usuário pode visualizar os dados do módulo. */
  canRead: boolean;
  /** Verdadeiro se o usuário pode criar, editar ou excluir dados no módulo. */
  canWrite: boolean;
  /** Verdadeiro se o módulo está totalmente oculto para o usuário (acesso 'none' ou kill-switch). */
  isHidden: boolean;
  /** Nível de acesso bruto ('none', 'read', 'write', 'admin'). */
  accessLevel: ModuleAccessLevel;
  /** Verdadeiro se o usuário está em modo somente-leitura geral ou para este módulo. */
  isReadOnlyMode: boolean;
}

/**
 * Hook de domínio para avaliar permissões granulares de leitura/escrita por módulo.
 *
 * Consolida regras de Kill-Switch global, Role (SuperAdmin/Admin), Overrides individuais
 * e Tier de Assinatura (Vitalício, Pro, Trial, Modo Somente-Leitura).
 */
export function usePermission(moduleKey: SystemFeatureKey | string): PermissionResult {
  const { hasFeature, isAdmin } = useUserAccess();
  const subscription = useUserSubscription();

  return useMemo((): PermissionResult => {
    // 1. Kill-Switch global ou feature desativada para o usuário
    const isFeatureEnabled = hasFeature(moduleKey);
    if (!isFeatureEnabled) {
      return {
        canRead: false,
        canWrite: false,
        isHidden: true,
        accessLevel: "none",
        isReadOnlyMode: false,
      };
    }

    // 2. SuperAdmin ou Admin têm permissão irrestrita de escrita e administração
    if (isAdmin) {
      return {
        canRead: true,
        canWrite: true,
        isHidden: false,
        accessLevel: "admin",
        isReadOnlyMode: false,
      };
    }

    // 3. Verifica override modular específico na assinatura
    const explicitLevel = subscription.moduleAccess?.[moduleKey];
    if (explicitLevel) {
      const canRead = explicitLevel !== "none";
      const canWrite = explicitLevel === "write" || explicitLevel === "admin";
      return {
        canRead,
        canWrite,
        isHidden: explicitLevel === "none",
        accessLevel: explicitLevel,
        isReadOnlyMode: canRead && !canWrite,
      };
    }

    // 4. Fallback pelo status global da assinatura
    const canWrite = subscription.canWrite;
    return {
      canRead: true,
      canWrite,
      isHidden: false,
      accessLevel: canWrite ? "write" : "read",
      isReadOnlyMode: !canWrite,
    };
  }, [moduleKey, hasFeature, isAdmin, subscription]);
}
