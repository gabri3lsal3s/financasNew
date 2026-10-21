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
// Painel lateral institucional (desktop ≥ lg)
// ---------------------------------------------------------------------------
const LOGIN_BENEFITS = [
  {
    icon: BarChart3,
    title: "Visão consolidada",
    desc: "Receitas, despesas e faturas organizadas em tempo real",
  },
  {
    icon: CreditCard,
    title: "Cartões e parcelas",
    desc: "Acompanhe limites, vencimentos e projeções futuras",
  },
  {
    icon: Lock,
    title: "Segurança de ponta",
    desc: "Isolamento criptográfico estrito com RLS no banco de dados",
  },
] as const;

function LoginSideHero() {
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
            Bem-vindo de volta
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Acesse seu painel financeiro para manter suas metas e finanças sob total controle.
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {LOGIN_BENEFITS.map(({ icon: Icon, title, desc }) => (
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

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-2 backdrop-blur-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Novo por aqui?
          </p>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Crie sua conta gratuitamente e experimente 30 dias de acesso Pro completo.
        </p>
        <Link
          to="/cadastro"
          tabIndex={-1}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/90 transition-colors"
        >
          <span>Criar conta gratuita</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
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
      subtitle="Acesse sua conta para gerenciar suas finanças com clareza."
      sideHero={<LoginSideHero />}
    >
      <div className="flex flex-col gap-5">
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
            />
          </div>
          <Turnstile />

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold bg-primary text-primary-foreground hover:bg-primary-strong shadow-xs transition-colors"
            disabled={pending || Boolean(configError)}
          >
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 pt-1 text-sm">
          <Link
            to="/recuperar-senha"
            className="text-xs font-medium text-primary-strong hover:underline underline-offset-4"
          >
            Esqueci minha senha
          </Link>
          <p className="text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary-strong hover:underline underline-offset-4">
              Cadastre-se
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
