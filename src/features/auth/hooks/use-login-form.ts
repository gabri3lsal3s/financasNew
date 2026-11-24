import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  getActiveUserMfaFactor,
  listVerifiedMfaFactors,
  markMfaVerified,
  resendConfirmationEmail,
  signInWithEmail,
  useAuth,
  verifyMfaTotpCode,
} from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { classifyError, getErrorMessage } from "@/services/errors";
import { markPendingExplicitDeviceRegistration } from "@/services/native/device-info";
import { setSharedDeviceSession } from "@/services/session-policy";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { calculateLoginBackoff } from "../utils/login-backoff";
import { resolveLoginRedirect } from "../utils/login-redirect";

async function resolveMfaFactorId(currentId: string | null): Promise<string | null> {
  if (currentId) return currentId;
  const active = await getActiveUserMfaFactor();
  if (active?.id) return active.id;
  const verified = await listVerifiedMfaFactors();
  return verified?.id ?? null;
}

export function useLoginForm() {
  const { session, loading, configError, mfaRequired, mfaVerified } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signOut } = useSignOut();

  const isDesafioTotpParam = searchParams.get("desafio") === "totp";
  const from = resolveLoginRedirect({ searchParams, locationState: location.state });

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [isSharedDevice, setIsSharedDevice] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [pending, setPending] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const [isMfaRequired, setIsMfaRequired] = useState(isDesafioTotpParam);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const isMfaActive = Boolean(
    !mfaVerified && (mfaRequired || isMfaRequired || (session && isDesafioTotpParam)),
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => setLockoutSeconds((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  useEffect(() => {
    if (!session || !isMfaActive) return;
    let cancelled = false;
    void resolveMfaFactorId(null)
      .then((factorId) => {
        if (factorId && !cancelled) {
          setMfaFactorId(factorId);
          setIsMfaRequired(true);
        }
      })
      .catch(() => {
        // Silencia em ambiente sem Supabase configurado
      });
    return () => {
      cancelled = true;
    };
  }, [session, isMfaActive]);

  const clearChallengeParam = () => {
    if (!searchParams.has("desafio")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("desafio");
    setSearchParams(nextParams, { replace: true });
  };

  const handleResendConfirmation = async () => {
    if (!email || cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await resendConfirmationEmail(email.trim());
      triggerSensory("success");
      pushToast({
        title: "Link reenviado!",
        description: `Enviamos um novo link de confirmação para ${email}.`,
        variant: "success",
      });
      setCooldown(60);
    } catch (err) {
      triggerSensory("destructive");
      pushToast({ title: "Erro ao reenviar", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || lockoutSeconds > 0) return;
    setError(null);
    setIsEmailUnconfirmed(false);
    setPending(true);
    try {
      setSharedDeviceSession(isSharedDevice);
      await signInWithEmail(email, password, captchaToken ?? undefined);
      try {
        const verified = await listVerifiedMfaFactors();
        if (verified) {
          setMfaFactorId(verified.id);
          setIsMfaRequired(true);
          triggerSensory("action");
          return;
        }
      } catch {
        // Segue login se MFA não configurado
      }
      markPendingExplicitDeviceRegistration();
      triggerSensory("success");
      setConsecutiveFailures(0);
      setLockoutSeconds(0);
    } catch (err) {
      triggerSensory("destructive");
      const nextFailures = consecutiveFailures + 1;
      setConsecutiveFailures(nextFailures);
      const delay = calculateLoginBackoff(nextFailures);
      if (delay > 0) setLockoutSeconds(delay);
      const classified = classifyError(err);
      if (classified.kind === "email-not-confirmed") setIsEmailUnconfirmed(true);
      else setError(classified.message);
    } finally {
      setPending(false);
    }
  };

  const handleVerifyMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || isVerifyingMfa) return;
    setIsVerifyingMfa(true);
    setMfaError(null);
    try {
      const activeFactorId = await resolveMfaFactorId(mfaFactorId);
      if (!activeFactorId) throw new Error("Dispositivo autenticador não encontrado.");
      const verifyOk = await verifyMfaTotpCode(activeFactorId, cleanCode);
      if (!verifyOk) throw new Error("Código de autenticação incorreto ou expirado.");

      markMfaVerified();
      markPendingExplicitDeviceRegistration();
      triggerSensory("success");
      setIsMfaRequired(false);
      pushToast({ title: "Acesso confirmado", description: "Identidade validada com sucesso.", variant: "success" });
      clearChallengeParam();
      navigate(from, { replace: true });
    } catch {
      triggerSensory("destructive");
      setMfaError("Código de autenticação incorreto ou expirado. Verifique seu aplicativo e tente novamente.");
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleCancelMfa = async () => {
    try {
      await signOut({ scope: "local" });
    } catch {
      // Ignora falha de logout
    }
    setIsMfaRequired(false);
    setTotpCode("");
    setMfaError(null);
    clearChallengeParam();
    triggerSensory("selection");
  };

  return {
    from,
    shouldRedirect: !loading && Boolean(session) && !isMfaActive && !pending,
    isMfaActive,
    configError,
    email,
    setEmail,
    password,
    setPassword,
    isSharedDevice,
    setIsSharedDevice,
    setCaptchaToken,
    error,
    isEmailUnconfirmed,
    cooldown,
    isResending,
    pending,
    consecutiveFailures,
    lockoutSeconds,
    totpCode,
    setTotpCode,
    isVerifyingMfa,
    mfaError,
    handleSubmit,
    handleResendConfirmation,
    handleVerifyMfa,
    handleCancelMfa,
  };
}
