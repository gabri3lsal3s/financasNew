import { useSyncExternalStore } from "react";
import {
  consumePWAUpdate,
  getPWAUpdateAvailable,
  subscribePWAUpdate,
} from "@/app/pwa";
import { Toast } from "@/components/ui/toast";

/**
 * Toast global de atualização PWA (PWA_GUIDELINES §6): quando o Service Worker
 * autoUpdate ativa uma nova versão, avisa sem recarregar a página sozinho —
 * o usuário decide ("Atualizar" recarrega) ou fecha.
 *
 * `open` deriva direto da store externa: fechar consome o anúncio (flag → false)
 * e um novo anúncio reabre o toast — sem estado local que o bloqueie.
 */
export function PWAUpdateToast() {
  const available = useSyncExternalStore(subscribePWAUpdate, getPWAUpdateAvailable, () => false);

  return (
    <Toast
      open={available}
      onOpenChange={(next) => {
        if (!next) consumePWAUpdate();
      }}
      title="Nova versão disponível"
      description="Atualize para usar a versão mais recente do app."
      variant="info"
      duration={Infinity}
      action={{ label: "Atualizar", onClick: () => window.location.reload() }}
    />
  );
}
