import { Link, Navigate } from "react-router";
import { ArrowLeft, Mail } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Input,
  PasswordInput,
  Turnstile,
} from "@/components/ui";
import { useDocumentMeta } from "@/hooks/use-document-meta";
import { AuthShell } from "../components/auth-shell";
import { LoginSideHero } from "../components/login-side-hero";
import { MfaChallengeView } from "../components/mfa-challenge-view";
import { useLoginForm } from "../hooks/use-login-form";

export function LoginPage() {
  useDocumentMeta({
    title: "Entrar — Axir | Centro Financeiro Pessoal",
    description:
      "Acesse sua conta no Axir para gerenciar caixa real, cartões, dívidas, finanças compartilhadas e investimentos.",
    canonicalPath: "/entrar",
  });
  const {
    from,
    shouldRedirect,
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
  } = useLoginForm();

  if (shouldRedirect) {
    return <Navigate to={from} replace />;
  }

  if (isMfaActive) {
    return (
      <MfaChallengeView
        totpCode={totpCode}
        isVerifyingMfa={isVerifyingMfa}
        mfaError={mfaError}
        onCodeChange={setTotpCode}
        onSubmit={(e) => {
          void handleVerifyMfa(e);
        }}
        onCancel={() => {
          void handleCancelMfa();
        }}
      />
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
              <div className="space-y-1 min-w-0">
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
                sensoryIntent={false}
                onClick={() => {
                  void handleResendConfirmation();
                }}
                disabled={cooldown > 0 || isResending}
                className="w-full"
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

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4" noValidate>
          <FormField label="E-mail" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
              className="text-base sm:text-sm"
            />
          </FormField>

          <FormField label="Senha" htmlFor="login-password">
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              className="text-base sm:text-sm"
            />
          </FormField>

          <div className="flex items-center gap-2.5">
            <Checkbox
              id="login-shared-device"
              checked={isSharedDevice}
              onCheckedChange={(checked) => setIsSharedDevice(Boolean(checked))}
              disabled={pending}
            />
            <label
              htmlFor="login-shared-device"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              Computador compartilhado (sair após 30 min sem uso)
            </label>
          </div>

          <Turnstile
            className="my-0.5"
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />

          <Button
            type="submit"
            variant="solid"
            sensoryIntent={false}
            disabled={pending || Boolean(configError) || lockoutSeconds > 0}
          >
            {pending
              ? "Entrando…"
              : lockoutSeconds > 0
                ? `Aguarde ${lockoutSeconds}s para tentar novamente`
                : "Entrar"}
          </Button>
        </form>

        <div className="mt-2 pt-4 border-t border-border/80 flex flex-col items-center gap-2 text-xs sm:text-sm">
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
