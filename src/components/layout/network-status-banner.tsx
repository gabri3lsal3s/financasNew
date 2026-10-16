import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks";
import { subscribeNetworkStatus } from "@/services/network-status";
import { triggerSensory } from "@/services/sensory";

export interface NetworkStatusBannerProps {
  className?: string;
}

/**
 * Banner global de conectividade (Tarefa 40 / FASE 23).
 *
 * Monitora em tempo real a transição entre estados online e offline via
 * useNetworkStatus (useSyncExternalStore). Exibe aviso suave quando desconectado
 * e notificação temporária com auto-dismiss ao restabelecer a conexão,
 * disparando a invalidação e ressincronização atômica das queries.
 */
export function NetworkStatusBanner({ className }: NetworkStatusBannerProps) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const [showRestored, setShowRestored] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const wasOfflineRef = useRef(!isOnline);

  useEffect(() => {
    let timer: number | undefined;

    const unsubscribe = subscribeNetworkStatus((online) => {
      if (!online) {
        wasOfflineRef.current = true;
        setShowRestored(false);
      } else if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setShowRestored(true);
        triggerSensory("success");

        // Invalidação das queries ativas para atualizar dados pendentes
        void queryClient.invalidateQueries();

        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          setShowRestored(false);
        }, 3500);
      }
    });

    return () => {
      unsubscribe();
      if (timer) window.clearTimeout(timer);
    };
  }, [queryClient]);

  const handleRetry = async () => {
    setIsRetrying(true);
    triggerSensory("action");
    try {
      await queryClient.invalidateQueries();
    } finally {
      // Pequeno delay visual para feedback do spinner no botão
      window.setTimeout(() => {
        setIsRetrying(false);
      }, 600);
    }
  };

  if (!isOnline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-warning-strong/30 bg-warning/15 px-3.5 sm:px-6 py-2 text-xs font-medium text-warning-strong shadow-xs transition-all",
          className,
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Você está sem conexão com a internet. Suas ações serão sincronizadas ao reconectar.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleRetry()}
          disabled={isRetrying}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-warning-strong/30 bg-surface/80 px-2.5 py-1 text-[11px] font-semibold text-warning-strong shadow-2xs hover:bg-surface active:scale-[0.98] transition-all cursor-pointer"
          aria-label="Tentar reconectar e sincronizar"
        >
          <RefreshCw className={cn("size-3", isRetrying && "animate-spin")} aria-hidden="true" />
          <span>Reconectar</span>
        </button>
      </aside>
    );
  }

  if (showRestored) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={cn(
          "sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-positive-strong/30 bg-positive/15 px-3.5 sm:px-6 py-2 text-xs font-medium text-positive-strong shadow-xs transition-all",
          className,
        )}
      >
        <Wifi className="size-3.5 shrink-0" aria-hidden="true" />
        <span>Conexão restabelecida. Seus dados estão sincronizados.</span>
      </aside>
    );
  }

  return null;
}
