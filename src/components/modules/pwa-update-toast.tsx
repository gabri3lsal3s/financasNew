import { useState, useSyncExternalStore } from "react";
import {
  applyPWAUpdate,
  consumePWAUpdate,
  getIsPWAUpdating,
  getPWAUpdateAvailable,
  subscribePWAUpdate,
} from "@/app/pwa";
import { Toast } from "@/components/ui/toast";
import { dismissUpdateForSession, isUpdateDismissedForSession } from "@/domain/native";
import { useActiveOverlays } from "@/hooks/use-active-overlays";
import { isNativePlatform } from "@/services/native/platform";

export interface PWAUpdateToastProps {
  /**
   * Quando true (usado pelo `AppUpdateToast`), persiste o fechamento na janela de
   * supressão de 12 horas e sessão (`dismissUpdateForSession`).
   * Padrão `false` para preservar reanúncio imediato nos testes unitários isolados.
   */
  persistDismissal?: boolean;
}

/**
 * Toast global de atualização PWA (PWA_GUIDELINES §6): quando o Service Worker
 * autoUpdate ativa uma nova versão, avisa sem recarregar a página sozinho —
 * o usuário decide ("Atualizar" executa atualização atômica sincronizada) ou fecha.
 *
 * Guarda de plataforma e UX:
 * - Nunca renderiza em plataforma nativa (`isNativePlatform()`);
 * - Suprime enquanto houver overlays bloqueantes ativos (`useActiveOverlays()`).
 */
export function PWAUpdateToast({ persistDismissal = false }: PWAUpdateToastProps = {}) {
  const isNative = isNativePlatform();
  const available = useSyncExternalStore(subscribePWAUpdate, getPWAUpdateAvailable, () => false);
  const globalUpdating = useSyncExternalStore(subscribePWAUpdate, getIsPWAUpdating, () => false);
  const { hasBlockingOverlay } = useActiveOverlays();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    persistDismissal ? isUpdateDismissedForSession() : false,
  );
  const [localUpdating, setLocalUpdating] = useState(false);

  const updating = globalUpdating || localUpdating;
  const isSuppressedByWindow =
    persistDismissal && (dismissed || isUpdateDismissedForSession());

  if (isNative) {
    return null;
  }

  if (!updating && (!available || hasBlockingOverlay || isSuppressedByWindow)) {
    return null;
  }

  const handleUpdate = async () => {
    setLocalUpdating(true);
    await applyPWAUpdate();
  };

  const handleDismiss = () => {
    if (!updating) {
      consumePWAUpdate();
      if (persistDismissal) {
        dismissUpdateForSession();
        setDismissed(true);
      }
    }
  };

  return (
    <Toast
      open={updating || (available && !hasBlockingOverlay && !isSuppressedByWindow)}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
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
