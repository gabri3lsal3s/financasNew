import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import {
  ArrowLeft,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { Alert, Badge, Button, Input, PasswordInput, Turnstile } from "@/components/ui";
import { BrandLogo } from "@/components/layout";
import { useAuth, signInWithEmail } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { getSupabase } from "@/data/client";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { useUserAccess } from "@/state";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { signOut } = useSignOut();
  const { isAdmin, isLoading: accessLoading } = useUserAccess(session?.user?.id);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Proteção anti-bot e throttling
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Cronômetro regressivo do bloqueio temporário
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Se já está logado como administrador, redireciona diretamente para o console
  if (session?.user && isAdmin && !accessLoading) {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/admin/dashboard";
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0 || loading) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      // 1. Autenticação no Supabase Auth
      await signInWithEmail(email.trim(), password);
      const supabase = getSupabase();
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        throw new Error("Credenciais inválidas.");
      }

      // 2. Validação atômica de privilégio administrativo (Fail-Closed)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await signOut();
        throw new Error("Falha ao validar credencial administrativa.");
      }

      const isPermitted =
        (profile.role === "admin" || profile.role === "superadmin") &&
        profile.status === "active";

      if (!isPermitted) {
        await signOut();
        triggerSensory("destructive");
        setConsecutiveFailures((prev) => prev + 1);
        setErrorMessage(
          "Acesso restrito: Esta conta não possui privilégios de operador administrativo para acessar o Console da Plataforma.",
        );
        setLoading(false);
        return;
      }

      // 3. Sucesso: operador autenticado e autorizado
      triggerSensory("success");
      setConsecutiveFailures(0);
      pushToast({
        title: "Sessão Administrativa Iniciada",
        description: "Bem-vindo ao Console de Governança do Áxis.",
        variant: "success",
      });

      const destination =
        (location.state as { from?: { pathname?: string } })?.from?.pathname ||
        "/admin/dashboard";
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Cabeçalho de Identificação */}
        <div className="flex flex-col items-center text-center gap-3">
          <BrandLogo markClassName="size-11 drop-shadow-xs" showWordmark={false} />
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="muted" size="sm" className="font-mono uppercase tracking-wider text-primary-strong border border-primary/30">
              <ShieldCheck className="size-3.5 mr-1" aria-hidden="true" />
              Console Administrativo
            </Badge>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Áxis Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Acesso exclusivo para administradores e operadores da plataforma
            </p>
          </div>
        </div>

        {/* Card do Formulário de Acesso */}
        <div className="rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-xs flex flex-col gap-5">
          {errorMessage && (
            <Alert variant="error">
              <span className="text-xs leading-relaxed">{errorMessage}</span>
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-email" className="text-xs font-semibold text-foreground">
                E-mail Administrativo
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@axisfinance.app"
                required
                disabled={loading || isButtonLocked}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-password" className="text-xs font-semibold text-foreground">
                Senha de Acesso
              </label>
              <PasswordInput
                id="admin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                disabled={loading || isButtonLocked}
              />
            </div>

            {/* Cloudflare Turnstile Anti-Bot */}
            <div className="my-1 flex justify-center">
              <Turnstile onVerify={setTurnstileToken} />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full mt-2"
              disabled={loading || isButtonLocked || (!turnstileToken && typeof window !== "undefined" && window.location.hostname !== "localhost")}
            >
              {loading ? (
                "Validando credenciais…"
              ) : isButtonLocked ? (
                `Aguarde ${lockoutRemaining}s`
              ) : (
                <>
                  <KeyRound className="size-4 mr-2" aria-hidden="true" />
                  Entrar no Console
                </>
              )}
            </Button>
          </form>

          {/* Rodapé de Segurança e Navegação Reversa */}
          <div className="pt-4 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <Link
              to="/entrar"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Voltar ao aplicativo de clientes</span>
            </Link>
            <span className="font-mono text-[11px] text-muted-foreground/80">Áxis v3.0 Pro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
