import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { Alert, Button, Input } from "@/components/ui";
import { resetPasswordForEmail } from "@/data/auth";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { getErrorMessage } from "@/services/errors";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSent(false);
    setPending(true);
    try {
      await resetPasswordForEmail(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link de redefinição para o seu e-mail.">
      <div className="flex flex-col gap-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {sent ? (
          <Alert variant="success">Enviamos um link de recuperação para o seu e-mail. Verifique sua caixa de entrada.</Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="forgot-email" className="text-sm font-medium">
              E-mail
            </label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar link de recuperação"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Lembrou a senha?{" "}
          <Link to="/entrar" className="text-primary-strong hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
