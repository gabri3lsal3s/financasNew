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
// Painel lateral de marketing (desktop ≥ lg)
// ---------------------------------------------------------------------------
const REGISTER_FEATURES = [
  { icon: Layers, label: "Receitas, despesas e cartões em um só lugar" },
  { icon: PieChart, label: "Orçamentos, metas e rebalanceamento de carteira" },
  { icon: Shield, label: "Dados criptografados e protegidos (RLS)" },
] as const;

function RegisterSideHero({ planoParam }: { planoParam: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-6">
        <BrandLogo
          themeMode="dark"
          variant="white"
          markClassName="size-11 drop-shadow-sm"
          wordmarkClassName="text-white text-xl font-bold tracking-wider"
          subtitleClassName="text-teal-300/90 text-[10px] font-semibold tracking-widest"
          showWordmark
          showSubtitle
        />

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-lg font-semibold tracking-tight text-white leading-snug">
            {planoParam
              ? "Crie sua conta para ativar o Plano Pro."
              : "Controle total das suas finanças em minutos."}
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {planoParam
              ? "Após o cadastro, você será conduzido para concluir a assinatura."
              : "Comece com 30 dias de acesso Pro completo, sem cartão de crédito."}
          </p>
        </div>

        <ul className="flex flex-col gap-3 mt-1">
          {REGISTER_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-slate-200">
              <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 border border-teal-500/25 shrink-0 text-teal-300">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4.5 backdrop-blur-xs flex flex-col gap-1.5 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-500/15 border border-teal-500/20 px-2 py-0.5 rounded-full w-fit">
          Período de Avaliação
        </span>
        <p className="text-sm font-bold text-white mt-0.5">30 dias Pro sem custo</p>
        <p className="text-xs text-slate-300 leading-relaxed">
          Cancele quando quiser. Sem cobranças surpresa e sem cartão.
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
          <div className="flex lg:hidden rounded-xl border border-primary/40 bg-primary/5 p-3.5 items-center gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                className="h-10 text-sm rounded-xl"
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
                className="h-10 text-sm rounded-xl"
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
              className="h-10 text-sm rounded-xl"
            />

            {password.length > 0 && (
              <div className="mt-1 flex flex-col gap-2 rounded-xl border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground animate-in fade-in-50">
                <div className="grid grid-cols-3 gap-1.5 mb-0.5">
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
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
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
              <span className="text-[11px] text-muted-foreground font-normal">(opcional)</span>
            </div>
            <Input
              id="register-invite"
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Ex: GF-XXXX-XXXX"
              className="h-10 text-xs font-mono uppercase rounded-xl"
            />
          </div>

          <Turnstile className="my-0.5" />

          <Button
            type="submit"
            disabled={pending || Boolean(configError)}
            className="h-10 text-sm font-semibold rounded-xl bg-primary-strong hover:bg-primary text-primary-foreground shadow-xs transition-colors"
          >
            {pending ? "Criando conta…" : "Criar conta"}
          </Button>
        </form>

        <div className="mt-2 pt-4 border-t border-border/70 flex flex-col items-center gap-2 text-xs sm:text-sm">
          <p className="text-muted-foreground">
            Já tem conta?{" "}
            <Link
              to="/entrar"
              className="text-primary-strong font-semibold hover:text-primary hover:underline transition-colors"
            >
              Entrar
            </Link>
          </p>
          <Link
            to="/apresentacao"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o ÁXIS Finance e Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
