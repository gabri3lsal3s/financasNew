import { useState } from "react";
import { Toast } from "@/components/ui/toast";
import { dismissUpdateForSession, isUpdateDismissedForSession } from "@/domain/native";
import { useActiveOverlays } from "@/hooks/use-active-overlays";
import { useAppUpdate } from "@/hooks/use-app-update";
import { isNativePlatform } from "@/services/native/platform";

/**
 * Toast global de atualização para plataforma Android Nativa.
 * Realiza verificação remota no manifesto do Cloudflare R2 e exibe
 * notificação de atualização in-app com botão de 1 clique para download e instalação.
 *
 * Fase 4: Suprime a exibição enquanto houver overlays bloqueantes ativos
 * (modais, wizards, onboarding ou tour guiado), adiando a notificação
 * para momentos calmos da navegação, e persiste a dispensa na sessão.
 */
export function NativeUpdateToast() {
  const isNative = isNativePlatform();
  const { hasUpdate, updateInfo, installUpdate } = useAppUpdate({ autoCheck: isNative });
  const { hasBlockingOverlay } = useActiveOverlays();
  const [dismissed, setDismissed] = useState<boolean>(() => isUpdateDismissedForSession());
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isNative || dismissed || !hasUpdate || hasBlockingOverlay) {
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

  return (
    <Toast
      open={hasUpdate && !dismissed}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
      title={isInstalling ? "Baixando atualização..." : "Nova versão disponível"}
      description={
        isInstalling
          ? "O download do instalador foi iniciado pelo Android."
          : `A versão ${newVersion} já está disponível para instalação.`
      }
      variant="info"
      duration={Infinity}
      action={
        isInstalling
          ? undefined
          : {
              label: "Atualizar",
              onClick: handleUpdate,
            }
      }
    />
  );
}
