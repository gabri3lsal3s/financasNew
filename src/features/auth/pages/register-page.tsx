import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Layers, PieChart, Shield } from "lucide-react";
import { Alert, Button, Input, PasswordInput, Turnstile, buttonVariants } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth, signUpWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { checkPasswordRequirements } from "@/domain/validation";
import { BrandLogo } from "@/components/layout";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Painel lateral institucional (desktop ≥ lg)
// ---------------------------------------------------------------------------
const REGISTER_FEATURES = [
  {
    icon: Layers,
    title: "Organização centralizada",
    desc: "Receitas, despesas e cartões em um fluxo unificado",
  },
  {
    icon: PieChart,
    title: "Orçamentos e Metas",
    desc: "Limites inteligentes por categoria e rebalanceamento",
  },
  {
    icon: Shield,
    title: "Privacidade estrita",
    desc: "Isolamento criptográfico com RLS e dados protegidos",
  },
] as const;

function RegisterSideHero({ planoParam }: { planoParam: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-8">
        <BrandLogo
          markClassName="size-9"
          wordmarkClassName="text-white font-display text-xl tracking-wider"
          subtitleClassName="text-slate-300 text-[10px] tracking-widest uppercase font-medium"
          showWordmark
          showSubtitle
        />

        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-bold text-white tracking-tight leading-snug">
            {planoParam ? "Ative o Plano Pro" : "Comece gratuitamente"}
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {planoParam
              ? "Crie sua conta para concluir a assinatura do Plano Pro."
              : "Tenha clareza, previsibilidade e tranquilidade financeira a partir de hoje."}
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {REGISTER_FEATURES.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3.5">
              <div className="size-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-primary mt-0.5 shadow-xs">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-white">{title}</span>
                <span className="text-xs text-slate-300/80 leading-relaxed">{desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-1.5 backdrop-blur-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Período de Avaliação
          </p>
        </div>
        <p className="text-sm font-bold text-white">30 dias Pro sem custo</p>
        <p className="text-xs text-slate-300 leading-relaxed">
          Sem cartão de crédito no cadastro. Cancele quando quiser.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Página de cadastro
// ---------------------------------------------------------------------------
export function RegisterPage() {
  const { session, loading, configError } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(
    searchParams.get("convite") || searchParams.get("invite") || "",
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, setPending] = useState(false);

  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");

  const requirements = useMemo(() => checkPasswordRequirements(password), [password]);
  const metCount = useMemo(
    () => Object.values(requirements).filter(Boolean).length,
    [requirements],
  );

  if (!loading && session) {
    if (planoParam) {
      const checkoutQuery = new URLSearchParams();
      checkoutQuery.set("plano", planoParam);
      if (metodoParam) checkoutQuery.set("metodo", metodoParam);
      return <Navigate to={`/assinatura?${checkoutQuery.toString()}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const isPasswordSufficient =
    requirements.minLength && (requirements.hasUppercase || requirements.hasNumber);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPasswordSufficient) {
      setError(
        "A senha deve atender aos critérios de segurança mínimos (ao menos 8 caracteres com letras e números).",
      );
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

  const isAccountExistsError =
    error?.toLowerCase().includes("já existe uma conta") ||
    error?.toLowerCase().includes("já possui uma conta");

  return (
    <AuthShell
      title="Criar conta"
      subtitle={
        planoParam
          ? "Crie sua conta para concluir a assinatura do Plano Pro."
          : "Comece com 30 dias de acesso Pro gratuito sem cartão de crédito."
      }
      sideHero={<RegisterSideHero planoParam={planoParam} />}
    >
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}

        {error ? (
          <Alert variant="error">
            <p>{error}</p>
            {isAccountExistsError && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <Link to="/entrar" className="font-semibold underline underline-offset-2">
                  Fazer login
                  <ArrowRight className="inline ml-1 size-3" aria-hidden="true" />
                </Link>
                <Link
                  to="/recuperar-senha"
                  className="font-semibold underline underline-offset-2"
                >
                  Recuperar senha
                  <ArrowRight className="inline ml-1 size-3" aria-hidden="true" />
                </Link>
              </div>
            )}
          </Alert>
        ) : null}

        {confirmationSent ? (
          <Alert variant="success">
            Verifique seu e-mail para confirmar o cadastro antes de entrar.
          </Alert>
        ) : null}

        {/* Banner Pro — apenas mobile (lg+ vê o painel lateral) */}
        {!planoParam && (
          <div className="flex lg:hidden rounded-xl border border-primary/40 bg-primary/5 p-3 items-center gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-xs font-semibold text-foreground">30 dias Pro grátis</p>
              <p className="text-[11px] text-muted-foreground">Sem cartão de crédito</p>
            </div>
            <Link
              to="/assinatura?plano=pro-anual"
              className={cn(
                buttonVariants({ size: "sm" }),
                "shrink-0 text-xs gap-1 ml-auto",
              )}
            >
              Ver Plano Pro
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {/* Nome + E-mail em grid responsivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                placeholder="Como quer ser chamado"
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
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="register-password"
                className="text-xs font-semibold text-foreground"
              >
                Senha
              </label>
              {password.length > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    metCount <= 2
                      ? "text-critical-strong"
                      : metCount === 3
                        ? "text-warning-strong"
                        : "text-positive-strong",
                  )}
                >
                  {metCount <= 2 ? "Fraca" : metCount === 3 ? "Média" : "Forte"}
                </span>
              )}
            </div>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 8 caracteres"
            />

            {password.length > 0 && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface/50 p-2.5 text-xs text-muted-foreground animate-in fade-in-50">
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      metCount >= 1
                        ? metCount <= 2
                          ? "bg-critical"
                          : metCount === 3
                            ? "bg-warning"
                            : "bg-positive"
                        : "bg-border",
                    )}
                  />
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      metCount >= 3
                        ? metCount === 3
                          ? "bg-warning"
                          : "bg-positive"
                        : "bg-border",
                    )}
                  />
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      metCount >= 4 ? "bg-positive" : "bg-border",
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {[
                    { met: requirements.minLength, label: "Mínimo 8 caracteres" },
                    { met: requirements.hasUppercase, label: "Letra maiúscula (A-Z)" },
                    { met: requirements.hasNumber, label: "Número (0-9)" },
                    { met: requirements.hasSpecialChar, label: "Símbolo especial (!@#$)" },
                  ].map(({ met, label }) => (
                    <div
                      key={label}
                      className={cn(
                        "flex items-center gap-1.5",
                        met ? "text-positive-strong font-medium" : "text-muted-foreground",
                      )}
                    >
                      <CheckCircle2
                        className={cn(
                          "size-3 shrink-0",
                          met ? "text-positive-strong" : "text-border",
                        )}
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="register-invite"
                className="text-xs font-semibold text-foreground"
              >
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

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold bg-primary text-primary-foreground hover:bg-primary-strong shadow-xs transition-colors"
            disabled={pending || Boolean(configError)}
          >
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 pt-1 text-sm">
          <p className="text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/entrar" className="font-semibold text-primary-strong hover:underline underline-offset-4">
              Entrar
            </Link>
          </p>
          <Link
            to="/apresentacao"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o ÁXIS Finance e Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
