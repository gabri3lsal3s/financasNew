import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Input, Turnstile } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { useAuth, signUpWithEmail } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";


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

  // Parâmetro de plano e método passados pela Landing Page / Vendas (ex.: ?plano=pro-anual&metodo=pix)
  const planoParam = searchParams.get("plano");
  const metodoParam = searchParams.get("metodo");

  // Sessão criada no signup (confirmação desativada) → redireciona para checkout se há plano, ou para o app.
  if (!loading && session) {
    if (planoParam) {
      const checkoutQuery = new URLSearchParams();
      checkoutQuery.set("plano", planoParam);
      if (metodoParam) checkoutQuery.set("metodo", metodoParam);
      return <Navigate to={`/assinatura?${checkoutQuery.toString()}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  return (
    <AuthShell
      title="Criar conta"
      subtitle={
        planoParam
          ? "Crie sua conta para concluir a assinatura do Plano Pro."
          : "Comece com 30 dias de acesso Pro gratuito sem cartão de crédito."
      }
    >
      <div className="flex flex-col gap-4">
        {configError ? <Alert variant="error">{configError}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {confirmationSent ? (
          <Alert variant="success">Verifique seu e-mail para confirmar o cadastro antes de entrar.</Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
              placeholder="Como você quer ser chamado"
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor="register-password" className="text-xs font-semibold text-foreground">
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="register-invite" className="text-xs font-semibold text-foreground">
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
          <Link to="/apresentacao" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Conhecer o Áxis • Guia Financeiro & Planos</span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
