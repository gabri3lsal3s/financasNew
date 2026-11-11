import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import {
  isAppLocked,
  isNativePlatform,
  isPinLockConfigured,
  subscribeAppLock,
  unlockAppWithBiometrics,
  unlockAppWithPin,
} from "@/services/native";

/**
 * Escudo de bloqueio do aplicativo (App Lock).
 * Exibido quando o usuário retorna ao aplicativo após o tempo de tolerância
 * em segundo plano, exigindo autenticação biométrica (impressão digital ou rosto)
 * ou PIN numérico local de 4 a 6 dígitos como fallback quando a biometria falhar
 * ou não estiver disponível no hardware.
 */
export function AppLockOverlay() {
  const isLocked = useSyncExternalStore(subscribeAppLock, isAppLocked);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { signOut } = useSignOut();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPinMode, setIsPinMode] = useState(() => !isNativePlatform() && (userId ? isPinLockConfigured(userId) : isPinLockConfigured()));
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const isAuthenticatingRef = useRef(false);

  const handleUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current || isSigningOut) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      const success = await unlockAppWithBiometrics();
      if (!success) {
        setIsPinMode(true);
      }
    } catch {
      setIsPinMode(true);
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, [isSigningOut]);

  const handleUnlockPin = useCallback(async () => {
    if (pinValue.length < 4 || isAuthenticating || isSigningOut) return;
    setIsAuthenticating(true);
    setPinError(null);
    try {
      const isValid = userId
        ? await unlockAppWithPin(pinValue, userId)
        : await unlockAppWithPin(pinValue);
      if (isValid) {
        setPinValue("");
      } else {
        setPinError("PIN incorreto. Tente novamente.");
      }
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Erro ao validar PIN.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [pinValue, isAuthenticating, isSigningOut, userId]);

  const handleEmergencySignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  // Tenta acionar o prompt biométrico automaticamente ao travar
  useEffect(() => {
    if (!isLocked || isPinMode) return;

    const timer = setTimeout(() => {
      void handleUnlock();
    }, 150);

    return () => clearTimeout(timer);
  }, [isLocked, isPinMode, handleUnlock]);

  if (!isLocked) return null;

  return (
    <div
      role="alertdialog"
      data-lock-overlay="true"
      aria-modal="true"
      aria-label="Aplicativo Bloqueado"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary-strong">
          <ShieldCheck className="size-7" aria-hidden="true" />
        </div>

        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Axir
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Aplicativo Bloqueado
        </p>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {isPinMode
            ? "Digite seu PIN local de 4 a 6 dígitos para desbloquear."
            : "Por motivos de segurança, confirme sua biometria ou senha do dispositivo para acessar seus saldos e lançamentos."}
        </p>

        {isPinMode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleUnlockPin();
            }}
            className="mt-6 space-y-3"
          >
            <div className="space-y-1 text-left">
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pinValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setPinValue(val);
                  setPinError(null);
                }}
                placeholder="PIN (4 a 6 dígitos)"
                aria-label="PIN de Acesso"
                className="text-center font-mono tracking-widest text-lg h-12"
                disabled={isAuthenticating || isSigningOut}
              />
              {pinError && (
                <p role="alert" className="text-xs text-destructive text-center font-medium mt-1">
                  {pinError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              aria-label="Desbloquear com PIN"
              disabled={pinValue.length < 4 || isAuthenticating || isSigningOut}
              className="w-full gap-2"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              <span>{isAuthenticating ? "Verificando..." : "Desbloquear com PIN"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Usar Biometria"
              onClick={() => {
                setIsPinMode(false);
                setPinError(null);
              }}
              disabled={isAuthenticating || isSigningOut}
              className="w-full gap-2 text-xs"
            >
              <Lock className="size-3.5" aria-hidden="true" />
              <span>Usar Biometria</span>
            </Button>
          </form>
        ) : (
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              type="button"
              size="lg"
              aria-label="Desbloquear com Biometria"
              onClick={handleUnlock}
              disabled={isAuthenticating || isSigningOut}
              className="w-full gap-2"
            >
              <Lock className="size-4" aria-hidden="true" />
              <span>{isAuthenticating ? "Autenticando..." : "Desbloquear com Biometria"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Usar PIN"
              onClick={() => {
                setIsPinMode(true);
                setPinError(null);
              }}
              disabled={isAuthenticating || isSigningOut}
              className="w-full gap-2 text-xs"
            >
              <KeyRound className="size-3.5" aria-hidden="true" />
              <span>Usar PIN</span>
            </Button>
          </div>
        )}

        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Sair da conta e entrar com senha"
            onClick={handleEmergencySignOut}
            disabled={isAuthenticating || isSigningOut}
            className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>{isSigningOut ? "Saindo..." : "Sair da conta e entrar com senha"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
