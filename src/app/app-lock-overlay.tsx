import { useEffect, useState, useSyncExternalStore } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import {
  isAppLocked,
  subscribeAppLock,
  unlockAppWithBiometrics,
} from "@/services/native";
import { triggerSensory } from "@/services/sensory";

/**
 * Escudo de bloqueio do aplicativo (App Lock).
 * Exibido quando o usuário retorna ao aplicativo após o tempo de tolerância
 * em segundo plano, exigindo autenticação biométrica (impressão digital ou rosto)
 * para visualizar dados financeiros confidenciais.
 */
export function AppLockOverlay() {
  const isLocked = useSyncExternalStore(subscribeAppLock, isAppLocked);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleUnlock = async () => {
    setIsAuthenticating(true);
    triggerSensory("action");
    try {
      await unlockAppWithBiometrics();
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Tenta acionar o prompt biométrico automaticamente ao travar
  useEffect(() => {
    if (!isLocked) return;

    const timer = setTimeout(() => {
      void handleUnlock();
    }, 100);

    return () => clearTimeout(timer);
  }, [isLocked]);

  if (!isLocked) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Aplicativo Bloqueado"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary-strong">
          <ShieldCheck className="size-7" aria-hidden="true" />
        </div>

        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Guia Financeiro
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Aplicativo Bloqueado
        </p>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Por motivos de segurança, confirme sua biometria ou senha do dispositivo para acessar seus saldos e lançamentos.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            type="button"
            size="lg"
            aria-label="Desbloquear com Biometria"
            onClick={handleUnlock}
            disabled={isAuthenticating}
            className="w-full gap-2"
          >
            <Lock className="size-4" aria-hidden="true" />
            <span>{isAuthenticating ? "Autenticando..." : "Desbloquear com Biometria"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
