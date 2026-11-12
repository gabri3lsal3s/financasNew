import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CreditCard,
  Lock,
  Mail,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Alert, Badge, Button, Input, PasswordInput, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { BrandLogo } from "@/components/layout/brand-logo";
import {
  useAuth,
  signInWithEmail,
  resendConfirmationEmail,
  getActiveUserMfaFactor,
  listVerifiedMfaFactors,
  verifyMfaTotpCode,
  markMfaVerified,
} from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { classifyError, getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

// ---------------------------------------------------------------------------
// Cálculo de backoff exponencial contra força bruta
// ---------------------------------------------------------------------------

/**
 * Calcula o atraso de bloqueio temporário (em segundos) contra ataques de força bruta
 * baseado no número de falhas consecutivas de autenticação na sessão ativa.
 *
 * - Menos de 3 falhas consecutivas: sem atraso (0s)
 * - 3 a 4 falhas consecutivas: atraso temporário de 15 segundos
 * - 5 ou mais falhas consecutivas: atraso temporário de 60 segundos
 */
// eslint-disable-next-line react-refresh/only-export-components
export function calculateLoginBackoff(consecutiveFailures: number): number {
  if (consecutiveFailures >= 5) {
    return 60;
  }
  if (consecutiveFailures >= 3) {
    return 15;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Painel lateral de marketing (desktop ≥ lg)
// ---------------------------------------------------------------------------
const LOGIN_BENEFITS = [
  { icon: BarChart3, label: "Visão consolidada de receitas e despesas" },
  { icon: CreditCard, label: "Cartões, parcelas e faturas sob controle" },
  { icon: Lock, label: "Conexão segura com criptografia de ponta a ponta" },
] as const;

function LoginSideHero() {
  return (
    <>
      <div className="flex flex-col gap-6">
        <BrandLogo
          markClassName="size-11 drop-shadow-xs"
          showWordmark
          showSubtitle
        />

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-lg font-semibold tracking-tight text-foreground leading-snug">
            Bem-vindo de volta.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Continue de onde parou e mantenha suas finanças sempre organizadas.
          </p>
        </div>

        <ul className="flex flex-col gap-3 mt-1">
          {LOGIN_BENEFITS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-foreground/90">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0 text-primary-strong">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-surface border border-border/80 p-4.5 shadow-2xs flex flex-col gap-2">
        <Badge size="xs" variant="default" className="w-fit">
          Novo por aqui?
        </Badge>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          Crie sua conta gratuitamente e tenha 30 dias de acesso Pro completo.
        </p>
        <Link
          to="/cadastro"
          tabIndex={-1}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-strong hover:text-primary transition-colors w-fit group"
        >
          <span>Começar agora</span>
          <ArrowRight
            className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Página de login
// ---------------------------------------------------------------------------
export function LoginPage() {
  const { session, loading, configError, mfaRequired, mfaVerified } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");
  const isDesafioTotpParam = searchParams.get("desafio") === "totp";

  const checkoutQuery = new URLSearchParams();
  if (planoParam) checkoutQuery.set("plano", planoParam);
  if (metodoParam) checkoutQuery.set("metodo", metodoParam);

  const redirectParam = searchParams.get("redirect") || searchParams.get("returnUrl");
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : null;

  const fallbackFrom = safeRedirect || (planoParam ? `/assinatura?${checkoutQuery.toString()}` : "/");
  const rawFrom =
    (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
      ? `${(location.state as { from: { pathname?: string; search?: string } }).from.pathname ?? "/"}${(location.state as { from: { pathname?: string; search?: string } }).from.search ?? ""}`
      : fallbackFrom;

  // Sanitização: login nunca deve conduzir para configurações ou telas de auth
  const isSettingsOrAuth =
    rawFrom.startsWith("/configuracoes") ||
    rawFrom.startsWith("/entrar") ||
    rawFrom.startsWith("/cadastro") ||
    rawFrom.startsWith("/criar-conta") ||
    rawFrom.startsWith("/recuperar-senha") ||
    rawFrom === "/mais";

  const from = isSettingsOrAuth ? fallbackFrom : rawFrom;

  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [pending, setPending] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Estados de Verificação em Duas Etapas (2FA / TOTP)
  const [isMfaRequired, setIsMfaRequired] = useState(isDesafioTotpParam);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const { signOut } = useSignOut();

  // Flag unificada de blindagem 2FA: se o usuário precisa elevar para AAL2, fica retido no desafio TOTP
  const isMfaActive = Boolean(
    (mfaRequired && !mfaVerified) ||
    isMfaRequired ||
    (session && isDesafioTotpParam)
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Se a sessão existente exige elevação AAL2, retém a navegação para o desafio e obtém o fator TOTP
  useEffect(() => {
    if (!session) return;
    let isCancelled = false;
    async function loadMfaFactor() {
      try {
        const factor = await getActiveUserMfaFactor();
        if (factor && !isCancelled) {
          setMfaFactorId(factor.id);
          setIsMfaRequired(true);
        } else if (!isCancelled) {
          const verified = await listVerifiedMfaFactors();
          if (verified && !isCancelled) {
            setMfaFactorId(verified.id);
            setIsMfaRequired(true);
          }
        }
      } catch {
        // Silencia erro em ambiente sem Supabase configurado
      }
    }
    if (isMfaActive) {
      void loadMfaFactor();
    }
    return () => {
      isCancelled = true;
    };
  }, [session, isMfaActive]);

  if (!loading && session && !isMfaActive && !pending) {
    return <Navigate to={from} replace />;
  }

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
      pushToast({
        title: "Erro ao reenviar",
        description: getErrorMessage(err),
        variant: "destructive",
      });
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
      await signInWithEmail(email, password, captchaToken ?? undefined);

      // Intercepta contas protegidas por 2FA (AAL2) consultando os fatores verificados
      try {
        const verified = await listVerifiedMfaFactors();
        if (verified) {
          setMfaFactorId(verified.id);
          setIsMfaRequired(true);
          triggerSensory("action");
          setPending(false);
          return;
        }
      } catch {
        // Continua login se MFA não estiver configurado
      }

      triggerSensory("success");
      setConsecutiveFailures(0);
      setLockoutSeconds(0);
      // onAuthStateChange atualiza a sessão → o guard/redirect acima conduz.
    } catch (err) {
      triggerSensory("destructive");
      const nextFailures = consecutiveFailures + 1;
      setConsecutiveFailures(nextFailures);
      const delay = calculateLoginBackoff(nextFailures);
      if (delay > 0) {
        setLockoutSeconds(delay);
      }

      const classified = classifyError(err);
      if (classified.kind === "email-not-confirmed") {
        setIsEmailUnconfirmed(true);
      } else {
        setError(classified.message);
      }
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
      let activeFactorId = mfaFactorId;
      if (!activeFactorId) {
        const factor = await getActiveUserMfaFactor();
        activeFactorId = factor?.id ?? null;
      }
      if (!activeFactorId) {
        const verified = await listVerifiedMfaFactors();
        activeFactorId = verified?.id ?? null;
      }
      if (!activeFactorId) {
        throw new Error("Dispositivo autenticador não encontrado.");
      }

      const verifyOk = await verifyMfaTotpCode(activeFactorId, cleanCode);
      if (!verifyOk) {
        throw new Error("Código de autenticação incorreto ou expirado.");
      }

      markMfaVerified();
      triggerSensory("success");
      setIsMfaRequired(false);
      pushToast({
        title: "Acesso confirmado",
        description: "Identidade validada com sucesso.",
        variant: "success",
      });
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
    triggerSensory("selection");
  };

  if (isMfaActive) {
    return (
      <AuthShell
        title="Verificação em Duas Etapas"
        subtitle="Sua conta está protegida por 2FA. Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador."
        sideHero={<LoginSideHero />}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/20">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold block text-foreground">
                Código de Autenticação (TOTP)
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Google Authenticator, Microsoft Authenticator, 1Password ou Authy
              </span>
            </div>
          </div>

          {mfaError ? <Alert variant="error">{mfaError}</Alert> : null}

          <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mfa-code" className="text-xs font-semibold text-foreground">
                Código de 6 dígitos
              </label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-12 text-center text-lg font-mono tracking-widest rounded-xl text-base sm:text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={isVerifyingMfa || totpCode.trim().length !== 6}
              className="h-10 text-sm font-semibold rounded-xl bg-primary-strong hover:bg-primary text-primary-foreground shadow-xs transition-colors"
            >
              <KeyRound className="size-4 mr-1.5" aria-hidden="true" />
              {isVerifyingMfa ? "Validando…" : "Confirmar Acesso"}
            </Button>
          </form>

          <div className="pt-2 border-t border-border/70 flex flex-col items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelMfa}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar e voltar ao login
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta para gerenciar suas finanças."
      sideHero={<LoginSideHero />}
    >
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}
        {consecutiveFailures >= 5 && lockoutSeconds > 0 ? (
          <Alert variant="warning">
            Proteção ativa contra tentativas excessivas. Por segurança, aguarde {lockoutSeconds}s para tentar novamente.
          </Alert>
        ) : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        {isEmailUnconfirmed ? (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Mail className="size-4 text-warning-strong mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Confirmação de e-mail pendente
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O endereço <span className="font-semibold text-foreground">{email}</span> ainda não foi confirmado. Verifique sua caixa de entrada e pasta de spam.
                </p>
              </div>
            </div>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendConfirmation}
                disabled={cooldown > 0 || isResending}
                className="w-full text-xs h-8 rounded-lg"
              >
                {isResending
                  ? "Reenviando…"
                  : cooldown > 0
                    ? `Aguarde ${cooldown}s para reenviar`
                    : "Reenviar link de confirmação"}
              </Button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-xs font-semibold text-foreground">
              E-mail
            </label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              className="h-10 text-sm rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold text-foreground"
            >
              Senha
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              className="h-10 text-sm rounded-xl"
            />
          </div>
          <Turnstile
            className="my-0.5"
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />

          <Button
            type="submit"
            disabled={pending || Boolean(configError) || lockoutSeconds > 0}
            className="h-10 text-sm font-semibold rounded-xl bg-primary-strong hover:bg-primary text-primary-foreground shadow-xs transition-colors"
          >
            {pending
              ? "Entrando…"
              : lockoutSeconds > 0
                ? `Aguarde ${lockoutSeconds}s para tentar novamente`
                : "Entrar"}
          </Button>
        </form>

        <div className="mt-2 pt-4 border-t border-border/70 flex flex-col items-center gap-2 text-xs sm:text-sm">
          <Link
            to="/recuperar-senha"
            className="text-xs font-medium text-primary-strong hover:text-primary hover:underline transition-colors"
          >
            Esqueci minha senha
          </Link>
          <p className="text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link
              to="/cadastro"
              className="text-primary-strong font-semibold hover:text-primary hover:underline transition-colors"
            >
              Cadastre-se
            </Link>
          </p>
          <Link
            to="/apresentacao"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o Axir e Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
