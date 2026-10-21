import { useState } from "react";
import { Toast } from "@/components/ui/toast";
import { useAppUpdate } from "@/hooks/use-app-update";
import { isNativePlatform } from "@/services/native/platform";

/**
 * Toast global de atualização para plataforma Android Nativa.
 * Realiza verificação remota no manifesto do Cloudflare R2 e exibe
 * notificação de atualização in-app com botão de 1 clique para download e instalação.
 */
export function NativeUpdateToast() {
  const isNative = isNativePlatform();
  const { hasUpdate, updateInfo, installUpdate } = useAppUpdate({ autoCheck: isNative });
  const [dismissed, setDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isNative || dismissed || !hasUpdate) {
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

  const newVersion = updateInfo?.latestVersion || updateInfo?.manifest?.version || "mais recente";

  return (
    <Toast
      open={hasUpdate && !dismissed}
      onOpenChange={(open) => {
        if (!open && !isInstalling) setDismissed(true);
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
