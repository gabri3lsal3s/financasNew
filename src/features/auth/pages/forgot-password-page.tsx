import { useEffect, useState } from "react";
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldown > 0 || pending) return;
    setError(null);
    setSent(false);
    setPending(true);
    try {
      await resetPasswordForEmail(email, captchaToken ?? undefined);
      triggerSensory("success");
      setSent(true);
      setCooldown(60);
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
          <Alert variant="success">
            Se o endereço estiver cadastrado, você receberá um link de redefinição em instantes.
          </Alert>
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
          <Turnstile
            className="my-0.5"
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />

          <Button type="submit" disabled={pending || cooldown > 0}>
            {pending
              ? "Enviando…"
              : cooldown > 0
                ? `Aguarde ${cooldown}s para reenviar`
                : "Enviar link de recuperação"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1.5 text-sm">
          <p className="text-muted-foreground">
            Lembrou a senha?{" "}
            <Link to="/entrar" className="text-primary-strong hover:underline">
              Entrar
            </Link>
          </p>
          <Link
            to="/entrar"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Voltar para o login</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
