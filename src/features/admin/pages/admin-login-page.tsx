import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  PasswordInput,
  Turnstile,
} from "@/components/ui";
import { BrandLogo, ThemeToggle } from "@/components/layout";
import { signInAdmin, useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { AXIR_APP_VERSION } from "@/services/native/app-links";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUserAccess } from "@/state";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, mfaRequired, mfaVerified } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const portalDeniedReason =
    (location.state as { portalDeniedReason?: string | null } | null)?.portalDeniedReason ?? null;

  if (session?.user && isAdmin && !accessLoading && !portalDeniedReason) {
    const from =
      (location.state as { from?: { pathname?: string } })?.from?.pathname || "/admin/dashboard";
    if (mfaRequired && !mfaVerified) {
      return <Navigate to="/entrar?desafio=totp" replace state={{ from: { pathname: from } }} />;
    }
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || loading) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await signInAdmin(email.trim(), password);
      triggerSensory("success");
      setConsecutiveFailures(0);

      const destination =
        (location.state as { from?: { pathname?: string } })?.from?.pathname || "/admin/dashboard";

      if (result?.mfaRequired) {
        pushToast({
          title: "Verificação em duas etapas",
          description: "Confirme o código do autenticador para acessar o Console Administrativo.",
          variant: "info",
        });
        navigate("/entrar?desafio=totp", {
          replace: true,
          state: { from: { pathname: destination } },
        });
        return;
      }

      pushToast({
        title: "Sessão Administrativa Iniciada",
        description: "Bem-vindo ao Console de Governança do Axir.",
        variant: "success",
      });
      navigate(destination, { replace: true });
    } catch (err) {
      triggerSensory("destructive");
      const nextFailures = consecutiveFailures + 1;
      setConsecutiveFailures(nextFailures);

      if (nextFailures >= 5) {
        setLockoutRemaining(60);
      } else if (nextFailures >= 3) {
        setLockoutRemaining(15);
      }

      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isButtonLocked = lockoutRemaining > 0;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 pt-safe pb-safe">
      <div className="absolute top-4 right-4 pt-safe">
        <ThemeToggle className="rounded-lg border border-border/80 hover:bg-surface-hover" />
      </div>

      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-3">
          <BrandLogo markClassName="size-11 drop-shadow-xs" showWordmark={false} />
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="default" size="sm" className="font-mono uppercase tracking-wider gap-1">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>Console Administrativo</span>
            </Badge>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Axir Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Acesso exclusivo para administradores e operadores da plataforma
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-xs flex flex-col gap-5">
          {errorMessage && (
            <Alert variant="error">
              <span className="text-xs leading-relaxed">{errorMessage}</span>
            </Alert>
          )}

          {!errorMessage && portalDeniedReason && (
            <Alert variant="warning">
              <span className="text-xs leading-relaxed">
                {portalDeniedReason === "timeout" || portalDeniedReason === "rpc_error"
                  ? "Não foi possível validar sua credencial de operador no momento. Faça login novamente ou tente em instantes."
                  : "Sua sessão atual não possui concessão ativa para o portal administrativo. Entre com suas credenciais de operador para continuar."}
              </span>
            </Alert>
          )}

          {isButtonLocked && (
            <Alert variant="warning">
              <span className="text-xs">
                Múltiplas tentativas incorretas. Bloqueio de segurança ativo por{" "}
                <strong>{lockoutRemaining}s</strong>.
              </span>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="E-mail Administrativo" htmlFor="admin-email" required>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@axir.com.br"
                required
                disabled={loading || isButtonLocked}
              />
            </FormField>

            <FormField label="Senha de Acesso" htmlFor="admin-password" required>
              <PasswordInput
                id="admin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha administrativa"
                required
                disabled={loading || isButtonLocked}
              />
            </FormField>

            <div className="my-1 flex justify-center">
              <Turnstile onVerify={setTurnstileToken} />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              sensoryIntent={false}
              loading={loading}
              className="w-full mt-2"
              disabled={
                loading ||
                isButtonLocked ||
                (!turnstileToken &&
                  typeof window !== "undefined" &&
                  window.location.hostname !== "localhost")
              }
            >
              {loading ? (
                "Validando credenciais…"
              ) : isButtonLocked ? (
                `Aguarde ${lockoutRemaining}s`
              ) : (
                <>
                  <KeyRound className="size-4 mr-2" aria-hidden="true" />
                  <span>Entrar no Console</span>
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <Link
              to="/entrar"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar ao aplicativo de clientes</span>
            </Link>
            <span className="font-mono text-[11px] text-muted-foreground">
              Axir v{AXIR_APP_VERSION} Pro
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
