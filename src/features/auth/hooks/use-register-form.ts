import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router";
import { getPendingSimulation } from "@/domain/share";
import { checkPasswordRequirements } from "@/domain/validation";
import { signUpWithEmail, useAuth } from "@/hooks/use-auth";
import { classifyError } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";

export function useRegisterForm() {
  const { session, loading, configError } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState(
    searchParams.get("convite") || searchParams.get("invite") || "",
  );
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, setPending] = useState(false);

  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");
  const isFromSimulator = searchParams.get("from") === "simulador" || Boolean(getPendingSimulation());

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (planoParam) params.set("plano", planoParam);
    if (metodoParam) params.set("metodo", metodoParam);
    const qs = params.toString();
    return qs ? `/entrar?${qs}` : "/entrar";
  }, [email, planoParam, metodoParam]);

  const bottomLoginUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (planoParam) params.set("plano", planoParam);
    if (metodoParam) params.set("metodo", metodoParam);
    const qs = params.toString();
    return qs ? `/entrar?${qs}` : "/entrar";
  }, [planoParam, metodoParam]);

  const redirectPath = useMemo(() => {
    if (loading || !session) return null;
    if (planoParam) {
      const checkoutQuery = new URLSearchParams();
      checkoutQuery.set("plano", planoParam);
      if (metodoParam) checkoutQuery.set("metodo", metodoParam);
      return `/assinatura?${checkoutQuery.toString()}`;
    }
    const redirectParam = searchParams.get("redirect") || searchParams.get("returnUrl");
    if (redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
      return redirectParam;
    }
    return "/";
  }, [loading, metodoParam, planoParam, searchParams, session]);

  const requirements = useMemo(() => checkPasswordRequirements(password), [password]);
  const metCount = useMemo(
    () => Object.values(requirements).filter(Boolean).length,
    [requirements],
  );

  const isPasswordSufficient =
    requirements.minLength && (requirements.hasUppercase || requirements.hasNumber);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!acceptedTerms) {
      setError("É obrigatório concordar com os Termos de Uso e a Política de Privacidade para prosseguir.");
      triggerSensory("destructive");
      return;
    }
    if (!isPasswordSufficient) {
      triggerSensory("error");
      setError(
        "A senha deve atender aos critérios de segurança mínimos (ao menos 8 caracteres com letras e números).",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas digitadas não coincidem.");
      triggerSensory("destructive");
      return;
    }

    setError(null);
    setErrorKind(null);
    setConfirmationSent(false);
    setPending(true);
    try {
      const result = await signUpWithEmail(
        email,
        password,
        name,
        inviteCode,
        captchaToken ?? undefined,
      );
      triggerSensory("success");
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
      }
    } catch (err) {
      triggerSensory("destructive");
      const classified = classifyError(err);
      setError(classified.message);
      setErrorKind(classified.kind);

      const errCode = (err as { code?: string })?.code?.toLowerCase() || "";
      if (
        errCode === "user_already_exists" ||
        errCode === "user-already-exists" ||
        errCode.includes("already")
      ) {
        setErrorKind("user-already-exists");
      }
    } finally {
      setPending(false);
    }
  };

  const isAccountExistsError =
    errorKind === "user-already-exists" ||
    errorKind === "user_already_exists" ||
    error?.toLowerCase().includes("já existe") ||
    error?.toLowerCase().includes("já possui") ||
    error?.toLowerCase().includes("já está cadastrado") ||
    error?.toLowerCase().includes("already registered") ||
    error?.toLowerCase().includes("already exists");

  return {
    redirectPath,
    configError,
    planoParam,
    isFromSimulator,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    setCaptchaToken,
    inviteCode,
    setInviteCode,
    acceptedTerms,
    setAcceptedTerms,
    error,
    isAccountExistsError,
    confirmationSent,
    pending,
    metCount,
    loginUrl,
    bottomLoginUrl,
    handleSubmit,
  };
}
