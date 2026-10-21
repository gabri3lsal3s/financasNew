import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Input, PasswordInput, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth, signInWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";


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

  // Sanitização rigorosa: login nunca deve conduzir para configurações ou telas de autenticação
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
    <AuthShell title="Entrar" subtitle="Acesse sua conta para gerenciar suas finanças.">
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
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
              Senha
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Turnstile />

          <Button type="submit" disabled={pending || Boolean(configError)}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1.5 text-sm">
          <Link to="/recuperar-senha" className="text-primary-strong hover:underline">
            Esqueci minha senha
          </Link>
          <p className="text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="text-primary-strong hover:underline">
              Cadastre-se
            </Link>
          </p>
          <Link to="/apresentacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o ÁXIS Finance & Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
