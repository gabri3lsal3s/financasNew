import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { Alert, Button, Input, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth, signInWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";


export function LoginPage() {
  const { session, loading, configError } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

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
      // onAuthStateChange atualiza a sessão → o guard/redirect acima conduz.
    } catch (err) {
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
            <label htmlFor="login-email" className="text-sm font-medium">
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
            <label htmlFor="login-password" className="text-sm font-medium">
              Senha
            </label>
            <Input
              id="login-password"
              type="password"
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
          <Link to="/apresentacao" className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            ← Conhecer o Guia Financeiro & Planos
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
