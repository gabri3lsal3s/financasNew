import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router";
import { Alert, Button, Input } from "@/components/ui";
import { signUpWithEmail } from "@/data/auth";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";

export function RegisterPage() {
  const { session, loading, configError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, setPending] = useState(false);

  // Sessão criada no signup (confirmação desativada) → já entra no app.
  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setConfirmationSent(false);
    setPending(true);
    try {
      const result = await signUpWithEmail(email, password, name);
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Comece a organizar suas finanças em minutos.">
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {confirmationSent ? (
          <Alert variant="success">Verifique seu e-mail para confirmar o cadastro antes de entrar.</Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-name" className="text-sm font-medium">
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
            <label htmlFor="register-email" className="text-sm font-medium">
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
            <label htmlFor="register-password" className="text-sm font-medium">
              Senha
            </label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
          </div>
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
          <Link to="/apresentacao" className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            ← Conhecer o Guia Financeiro & Planos
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
