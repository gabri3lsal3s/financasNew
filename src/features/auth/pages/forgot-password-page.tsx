import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Input, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { resetPasswordForEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";


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
      triggerSensory("success");
      setSent(true);
    } catch (err) {
      triggerSensory("destructive");
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
            <label htmlFor="forgot-email" className="text-xs font-semibold text-foreground">
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
          <Turnstile />

          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar link de recuperação"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1.5 text-sm">
          <p className="text-muted-foreground">
            Lembrou a senha?{" "}
            <Link to="/entrar" className="text-primary-strong hover:underline">
              Entrar
            </Link>
          </p>
          <Link to="/entrar" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Voltar para o login</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
