import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Lock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import { checkBiometricsAvailability } from "@/services/native/biometrics";
import { getPinLockoutState, isPinLockConfigured, unlockAppWithPin } from "@/services/native/pin-lock";
import { isAppLocked, subscribeAppLock, unlockAppWithBiometrics } from "@/services/native/app-lock";
import { isNativePlatform } from "@/services/native/platform";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]):not([disabled])';

/**
 * Escudo de bloqueio do aplicativo (App Lock).
 * Exibido quando o usuário retorna ao aplicativo ou permanece inativo além da tolerância,
 * exigindo autenticação biométrica ou PIN numérico local de 4 a 6 dígitos quando configurado.
 */
export function AppLockOverlay() {
  const isLocked = useSyncExternalStore(subscribeAppLock, isAppLocked);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { signOut } = useSignOut();

  const hasPinConfigured = userId ? isPinLockConfigured(userId) : isPinLockConfigured();
  const isNative = isNativePlatform();

  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(isNative);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPinMode, setIsPinMode] = useState(
    () => !isNativePlatform() && (userId ? isPinLockConfigured(userId) : isPinLockConfigured()),
  );
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [, setLockoutRevision] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const lockoutState = isLocked ? getPinLockoutState(userId) : { failedAttempts: 0, lockedUntilMs: null };
  const canUseBiometrics = isNative || biometricsAvailable;
  const effectivePinMode = isPinMode && hasPinConfigured;

  const lockoutRemainingSeconds =
    lockoutState.lockedUntilMs && lockoutState.lockedUntilMs > nowMs
      ? Math.ceil((lockoutState.lockedUntilMs - nowMs) / 1000)
      : 0;
  const isPinTemporarilyLocked = lockoutRemainingSeconds > 0;
  const shouldHighlightEmergencySignOut = lockoutState.failedAttempts >= 10;

  const isAuthenticatingRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLocked || isNative) return;

    let cancelled = false;
    void checkBiometricsAvailability()
      .then((res) => {
        if (!cancelled) {
          setBiometricsAvailable(res.isAvailable);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBiometricsAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLocked, isNative]);

  useEffect(() => {
    if (!isLocked || !lockoutState.lockedUntilMs) return;
    if (lockoutState.lockedUntilMs <= Date.now()) return;

    const syncNow = () => setNowMs(Date.now());
    const intervalId = setInterval(syncNow, 500);
    const handleVisibilityOrFocus = () => syncNow();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleVisibilityOrFocus);
    }

    return () => {
      clearInterval(intervalId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
      }
    };
  }, [isLocked, lockoutState.lockedUntilMs]);

  const handleUnlock = useCallback(async () => {
    if (isAuthenticatingRef.current || isSigningOut) return;
    isAuthenticatingRef.current = true;
    setIsAuthenticating(true);
    try {
      const success = await unlockAppWithBiometrics();
      if (!success && hasPinConfigured) {
        setIsPinMode(true);
      }
    } catch {
      if (hasPinConfigured) {
        setIsPinMode(true);
      }
    } finally {
      isAuthenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  }, [hasPinConfigured, isSigningOut]);

  const handleUnlockPin = useCallback(async () => {
    if (pinValue.length < 4 || isAuthenticating || isSigningOut || isPinTemporarilyLocked) return;
    setIsAuthenticating(true);
    setPinError(null);
    try {
      const isValid = userId
        ? await unlockAppWithPin(pinValue, userId)
        : await unlockAppWithPin(pinValue);
      if (isValid) {
        setPinValue("");
        setLockoutRevision((r) => r + 1);
      } else {
        setLockoutRevision((r) => r + 1);
        setNowMs(Date.now());
        setPinError("PIN incorreto. Tente novamente.");
      }
    } catch (err) {
      setLockoutRevision((r) => r + 1);
      setNowMs(Date.now());
      setPinError(err instanceof Error ? err.message : "Erro ao validar PIN.");
    } finally {
      setIsAuthenticating(false);
    }
  }, [pinValue, isAuthenticating, isSigningOut, isPinTemporarilyLocked, userId]);

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
    if (!isLocked || effectivePinMode) return;

    const timer = setTimeout(() => {
      void handleUnlock();
    }, 150);

    return () => clearTimeout(timer);
  }, [isLocked, effectivePinMode, handleUnlock]);

  // Aplica inert no #root e portais externos, implementa focus trap e restaura foco ao desbloquear
  useEffect(() => {
    if (!isLocked || typeof document === "undefined") return;

    const previousFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const inertTargets: HTMLElement[] = [];
    const rootEl = document.getElementById("root");
    if (rootEl && !rootEl.hasAttribute("inert")) {
      rootEl.inert = true;
      rootEl.setAttribute("inert", "");
      inertTargets.push(rootEl);
    }

    const portalEls = document.querySelectorAll<HTMLElement>("[data-radix-portal]");
    portalEls.forEach((el) => {
      if (!el.hasAttribute("inert")) {
        el.inert = true;
        el.setAttribute("inert", "");
        inertTargets.push(el);
      }
    });

    // Move foco para o contêiner do overlay (sem autoFocus no input para evitar teclado intrusivo no mobile)
    overlayRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key !== "Tab") return;

      const container = overlayRef.current;
      if (!container) return;

      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (!active || !container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      for (const el of inertTargets) {
        el.inert = false;
        el.removeAttribute("inert");
      }
      if (
        previousFocused &&
        previousFocused !== document.body &&
        previousFocused.isConnected
      ) {
        previousFocused.focus();
      }
    };
  }, [isLocked]);

  if (!isLocked) return null;

  const content = (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="alertdialog"
      data-lock-overlay="true"
      aria-modal="true"
      aria-label="Aplicativo Bloqueado"
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md pt-safe pb-safe outline-none animate-in fade-in duration-200"
    >
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary-strong">
            <ShieldCheck className="size-7" aria-hidden="true" />
          </div>

          <h2 className="text-lg font-bold tracking-tight text-foreground">Axir</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">Aplicativo Bloqueado</p>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {effectivePinMode
              ? "Digite seu PIN local de 4 a 6 dígitos para desbloquear."
              : "Por motivos de segurança, confirme sua biometria ou senha do dispositivo para acessar seus saldos e lançamentos."}
          </p>

          {effectivePinMode ? (
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
                  disabled={isAuthenticating || isSigningOut || isPinTemporarilyLocked}
                />
                {isPinTemporarilyLocked ? (
                  <p role="alert" className="text-xs text-critical-strong text-center font-medium mt-1 tabular-nums">
                    Muitas tentativas incorretas. Aguarde {lockoutRemainingSeconds}s para tentar novamente.
                  </p>
                ) : pinError ? (
                  <p role="alert" className="text-xs text-critical-strong text-center font-medium mt-1">
                    {pinError}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                size="lg"
                aria-label="Desbloquear com PIN"
                disabled={pinValue.length < 4 || isAuthenticating || isSigningOut || isPinTemporarilyLocked}
                className="w-full gap-2"
              >
                <KeyRound className="size-4" aria-hidden="true" />
                <span>{isAuthenticating ? "Verificando..." : "Desbloquear com PIN"}</span>
              </Button>

              {canUseBiometrics ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent="selection"
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
              ) : null}
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

              {hasPinConfigured && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent="selection"
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
              )}
            </div>
          )}

          <div className="mt-3">
            <Button
              type="button"
              variant={shouldHighlightEmergencySignOut ? "outline" : "ghost"}
              size="sm"
              sensoryIntent="destructive"
              aria-label="Sair da conta e entrar com senha"
              onClick={handleEmergencySignOut}
              disabled={isAuthenticating || isSigningOut}
              className={cn(
                "w-full gap-2 text-xs",
                shouldHighlightEmergencySignOut
                  ? "border-critical/40 text-critical-strong hover:bg-critical/10"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              <span>{isSigningOut ? "Saindo..." : "Sair da conta e entrar com senha"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
