import { useState, useSyncExternalStore } from "react";
import {
  applyPWAUpdate,
  consumePWAUpdate,
  getIsPWAUpdating,
  getPWAUpdateAvailable,
  subscribePWAUpdate,
} from "@/app/pwa";
import { Toast } from "@/components/ui/toast";

/**
 * Toast global de atualização PWA (PWA_GUIDELINES §6): quando o Service Worker
 * autoUpdate ativa uma nova versão, avisa sem recarregar a página sozinho —
 * o usuário decide ("Atualizar" executa atualização atômica sincronizada) ou fecha.
 *
 * Durante o processo, exibe estado visual limpo ("Atualizando para a nova versão...").
 */
export function PWAUpdateToast() {
  const available = useSyncExternalStore(subscribePWAUpdate, getPWAUpdateAvailable, () => false);
  const globalUpdating = useSyncExternalStore(subscribePWAUpdate, getIsPWAUpdating, () => false);
  const [localUpdating, setLocalUpdating] = useState(false);

  const updating = globalUpdating || localUpdating;

  const handleUpdate = async () => {
    setLocalUpdating(true);
    await applyPWAUpdate();
  };

  return (
    <Toast
      open={available || updating}
      onOpenChange={(next) => {
        if (!next && !updating) consumePWAUpdate();
      }}
      title={updating ? "Atualizando para a nova versão..." : "Nova versão disponível"}
      description={
        updating
          ? "Sincronizando recursos e finalizando atualização..."
          : "Atualize para usar a versão mais recente do app."
      }
      variant="info"
      duration={Infinity}
      action={updating ? undefined : { label: "Atualizar", onClick: handleUpdate }}
    />
  );
}
