import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, Circle, Eye, EyeOff, Sparkles } from "lucide-react";
import { Alert, Button, Input, Turnstile, buttonVariants } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth, signUpWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { checkPasswordRequirements } from "@/domain/validation";
import { cn } from "@/lib/utils";

export function RegisterPage() {
  const { session, loading, configError } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState(
    searchParams.get("convite") || searchParams.get("invite") || "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, setPending] = useState(false);

  // Parâmetro de plano e método passados pela Landing Page / Vendas (ex.: ?plano=pro-anual&metodo=pix)
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");

  const requirements = useMemo(() => checkPasswordRequirements(password), [password]);
  const metCount = useMemo(
    () => Object.values(requirements).filter(Boolean).length,
    [requirements],
  );

  // Sessão criada no signup (confirmação desativada) → redireciona para checkout se há plano, ou para o app.
  if (!loading && session) {
    if (planoParam) {
      const checkoutQuery = new URLSearchParams();
      checkoutQuery.set("plano", planoParam);
      if (metodoParam) checkoutQuery.set("metodo", metodoParam);
      return <Navigate to={`/assinatura?${checkoutQuery.toString()}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const isPasswordSufficient = requirements.minLength && (requirements.hasUppercase || requirements.hasNumber);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPasswordSufficient) {
      setError("A senha deve atender aos critérios de segurança mínimos (ao menos 8 caracteres com letras e números).");
      return;
    }
    setError(null);
    setConfirmationSent(false);
    setPending(true);
    try {
      const result = await signUpWithEmail(email, password, name, inviteCode);
      triggerSensory("success");
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
      }
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Criar conta"
      subtitle={
        planoParam
          ? "Crie sua conta para concluir a assinatura do Plano Pro."
          : "Comece com 30 dias de acesso Pro gratuito sem cartão de crédito."
      }
    >
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {confirmationSent ? (
          <Alert variant="success">Verifique seu e-mail para confirmar o cadastro antes de entrar.</Alert>
        ) : null}

        {!planoParam && (
          <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-surface to-surface p-3.5 shadow-xs flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                <span>Prefere ir direto para o Plano Pro?</span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-strong bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                30 Dias de Teste
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tenha lançamentos ilimitados, rebalanceamento automático de carteira e relatórios executivos. Comece agora sem cobrança hoje e cancele a qualquer momento.
            </p>
            <Link
              to="/assinatura?plano=pro-anual"
              className={cn(
                buttonVariants({ size: "sm" }),
                "w-full justify-center gap-1.5 text-xs font-semibold shadow-xs",
              )}
            >
              <span>Começar no Plano Pro Agora</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name" className="text-xs font-semibold text-foreground">
              Nome
            </label>
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como você quer ser chamado"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-email" className="text-xs font-semibold text-foreground">
              E-mail
            </label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="register-password" className="text-xs font-semibold text-foreground">
                Senha
              </label>
              {password.length > 0 && (
                <span className={cn(
                  "text-[11px] font-semibold",
                  metCount <= 2 ? "text-critical-strong" : metCount === 3 ? "text-warning-strong" : "text-positive-strong",
                )}>
                  {metCount <= 2 ? "Fraca" : metCount === 3 ? "Média" : "Forte"}
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  setShowPassword((prev) => !prev);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>

            {/* Checklist dinâmico de requisitos de senha */}
            {password.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface/50 p-2.5 text-xs text-muted-foreground animate-in fade-in-50">
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <div className={cn("h-1 rounded-full transition-colors", metCount >= 1 ? (metCount <= 2 ? "bg-critical" : metCount === 3 ? "bg-warning" : "bg-positive") : "bg-border")} />
                  <div className={cn("h-1 rounded-full transition-colors", metCount >= 3 ? (metCount === 3 ? "bg-warning" : "bg-positive") : "bg-border")} />
                  <div className={cn("h-1 rounded-full transition-colors", metCount >= 4 ? "bg-positive" : "bg-border")} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                  <div className={cn("flex items-center gap-1.5", requirements.minLength ? "text-positive-strong font-medium" : "text-muted-foreground")}>
                    {requirements.minLength ? <Check className="size-3 text-positive-strong shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span>Mínimo 8 caracteres</span>
                  </div>
                  <div className={cn("flex items-center gap-1.5", requirements.hasUppercase ? "text-positive-strong font-medium" : "text-muted-foreground")}>
                    {requirements.hasUppercase ? <Check className="size-3 text-positive-strong shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span>Letra maiúscula (A-Z)</span>
                  </div>
                  <div className={cn("flex items-center gap-1.5", requirements.hasNumber ? "text-positive-strong font-medium" : "text-muted-foreground")}>
                    {requirements.hasNumber ? <Check className="size-3 text-positive-strong shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span>Número (0-9)</span>
                  </div>
                  <div className={cn("flex items-center gap-1.5", requirements.hasSpecialChar ? "text-positive-strong font-medium" : "text-muted-foreground")}>
                    {requirements.hasSpecialChar ? <Check className="size-3 text-positive-strong shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span>Símbolo especial (!@#$)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="register-invite" className="text-xs font-semibold text-foreground">
                Código de Convite
              </label>
              <span className="text-[11px] text-muted-foreground">(opcional)</span>
            </div>
            <Input
              id="register-invite"
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Ex: GF-XXXX-XXXX"
              className="font-mono uppercase text-xs"
            />
          </div>
          <Turnstile />

          <Button type="submit" disabled={pending || Boolean(configError)}>
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1.5 text-sm">
          <p className="text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/entrar" className="text-primary-strong hover:underline">
              Entrar
            </Link>
          </p>
          <Link to="/apresentacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o Áxis • Guia Financeiro & Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
