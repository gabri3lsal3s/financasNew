import { useState, useSyncExternalStore } from "react";
import { Toast } from "@/components/ui/toast";
import { dismissUpdateForSession, isUpdateDismissedForSession } from "@/domain/native";
import { useActiveOverlays } from "@/hooks/use-active-overlays";
import { useAppUpdate } from "@/hooks/use-app-update";
import { isNativePlatform } from "@/services/native/platform";

const UNIFIED_HOST_EVENT = "axir:update-toast-host-change";

function subscribeUnifiedMount(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UNIFIED_HOST_EVENT, listener);
  return () => {
    window.removeEventListener(UNIFIED_HOST_EVENT, listener);
  };
}

function getIsUnifiedToastMounted(): boolean {
  if (typeof document === "undefined") return false;
  return Number(document.documentElement.dataset.appUpdateToastCount ?? "0") > 0;
}

export interface NativeUpdateToastProps {
  /** Uso interno do `AppUpdateToast` para renderizar o fluxo nativo unificado. */
  bypassUnifiedGuard?: boolean;
}

/**
 * Toast global de atualização para plataforma Android Nativa.
 * Realiza verificação remota no manifesto do Cloudflare R2 e exibe
 * notificação de atualização in-app com botão de 1 clique para download e instalação.
 *
 * Fase 4: Suprime a exibição enquanto houver overlays bloqueantes ativos
 * (modais, wizards, onboarding ou tour guiado), adiando a notificação
 * para momentos calmos da navegação, e persiste a dispensa na sessão.
 */
export function NativeUpdateToast({ bypassUnifiedGuard = false }: NativeUpdateToastProps = {}) {
  const isNative = isNativePlatform();
  const isUnifiedMounted = useSyncExternalStore(
    subscribeUnifiedMount,
    getIsUnifiedToastMounted,
    () => false,
  );
  const suppressedByUnified = !bypassUnifiedGuard && isUnifiedMounted;
  const { hasUpdate, updateInfo, installUpdate, error, status } = useAppUpdate({
    autoCheck: isNative && !suppressedByUnified,
  });
  const { hasBlockingOverlay } = useActiveOverlays();
  const [dismissed, setDismissed] = useState<boolean>(() => isUpdateDismissedForSession());
  const [isInstalling, setIsInstalling] = useState(false);

  if (
    !isNative ||
    suppressedByUnified ||
    dismissed ||
    isUpdateDismissedForSession() ||
    !hasUpdate ||
    hasBlockingOverlay
  ) {
    return null;
  }

  const handleUpdate = async () => {
    setIsInstalling(true);
    try {
      await installUpdate();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    if (!isInstalling) {
      dismissUpdateForSession();
      setDismissed(true);
    }
  };

  const newVersion = updateInfo?.latestVersion || updateInfo?.manifest?.version || "mais recente";

  // Tratamento de falha ou permissão
  const hasError = status === "error" || Boolean(error);
  const isPermissionNotice = error?.toLowerCase().includes("permissão");

  const title = isInstalling
    ? "Baixando atualização..."
    : hasError
      ? isPermissionNotice
        ? "Permissão necessária"
        : "Não foi possível atualizar"
      : "Nova versão disponível";

  const description = isInstalling
    ? "O download do instalador foi iniciado pelo Android."
    : hasError
      ? error || "Ocorreu um erro ao preparar a atualização."
      : `A versão ${newVersion} já está disponível para instalação.`;

  return (
    <Toast
      open={hasUpdate && !dismissed}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
      title={title}
      description={description}
      variant={hasError ? "warning" : "info"}
      duration={Infinity}
      action={
        isInstalling
          ? undefined
          : {
              label: hasError ? "Tentar novamente" : "Atualizar",
              onClick: handleUpdate,
            }
      }
    />
  );
}

