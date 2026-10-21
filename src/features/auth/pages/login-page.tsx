import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CreditCard,
  Lock,
} from "lucide-react";
import { Alert, Button, Input, PasswordInput, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { BrandLogo } from "@/components/layout";
import { useAuth, signInWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";

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
            Bem-vindo de volta.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Continue de onde parou e mantenha suas finanças sempre organizadas.
          </p>
        </div>

        <ul className="flex flex-col gap-3 mt-1">
          {LOGIN_BENEFITS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-slate-200">
              <span className="flex size-7 items-center justify-center rounded-lg bg-teal-500/15 border border-teal-500/25 shrink-0 text-teal-300">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="leading-snug">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4.5 backdrop-blur-xs flex flex-col gap-2 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-500/15 border border-teal-500/20 px-2 py-0.5 rounded-full w-fit">
          Novo por aqui?
        </span>
        <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
          Crie sua conta gratuitamente e tenha 30 dias de acesso Pro completo.
        </p>
        <Link
          to="/cadastro"
          tabIndex={-1}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300 hover:text-teal-200 transition-colors w-fit group"
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
  const { session, loading, configError } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");

  const checkoutQuery = new URLSearchParams();
  if (planoParam) checkoutQuery.set("plano", planoParam);
  if (metodoParam) checkoutQuery.set("metodo", metodoParam);

  const fallbackFrom = planoParam ? `/assinatura?${checkoutQuery.toString()}` : "/";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signInWithEmail(email, password);
      triggerSensory("success");
      // onAuthStateChange atualiza a sessão → o guard/redirect acima conduz.
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta para gerenciar suas finanças."
      sideHero={<LoginSideHero />}
    >
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

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
          <Turnstile className="my-0.5" />

          <Button
            type="submit"
            disabled={pending || Boolean(configError)}
            className="h-10 text-sm font-semibold rounded-xl bg-primary-strong hover:bg-primary text-primary-foreground shadow-xs transition-colors"
          >
            {pending ? "Entrando…" : "Entrar"}
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
            <span>Conhecer o ÁXIS Finance e Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
