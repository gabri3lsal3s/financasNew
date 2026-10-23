import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Alert, Button, PasswordInput } from "@/components/ui";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { getSupabase } from "@/data/client";
import { updateUserPassword } from "@/data/auth";
import { checkPasswordRequirements } from "@/domain/validation";
import { getErrorMessage } from "@/services/errors";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export function ResetPasswordPage() {
  const navigate = useNavigate();

  const initialUrlError = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.substring(1) : window.location.hash,
    );
    const errorCode = urlParams.get("error_code") || hashParams.get("error_code");
    const errorDesc = urlParams.get("error_description") || hashParams.get("error_description");
    if (errorCode || errorDesc) {
      return (
        errorDesc || "O link de recuperação de senha é inválido ou já expirou. Solicite um novo link."
      );
    }
    return null;
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(() => initialUrlError);
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [isInvalidLink, setIsInvalidLink] = useState(() => Boolean(initialUrlError));

  useEffect(() => {
    if (initialUrlError) {
      return;
    }

    const supabase = getSupabase();

    // Escuta eventos de Auth do Supabase (PASSWORD_RECOVERY ou SIGNED_IN com recovery)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsInvalidLink(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialUrlError]);

  const requirements = useMemo(() => checkPasswordRequirements(newPassword), [newPassword]);
  const isPasswordSufficient =
    requirements.minLength && (requirements.hasUppercase || requirements.hasNumber);
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && !isMatching;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isPasswordSufficient) {
      setError("A nova senha deve atender aos critérios de segurança mínimos.");
      return;
    }
    if (!isMatching) {
      setError("As senhas digitadas não coincidem.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await updateUserPassword(newPassword);
      triggerSensory("success");
      setIsSuccess(true);
      pushToast({
        title: "Senha redefinida com sucesso!",
        description: "Sua nova senha já está em vigor. Você já está conectado.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Redefinir senha"
      subtitle="Crie uma nova senha segura para acessar a sua conta."
    >
      <div className="flex flex-col gap-4">
        {isSuccess ? (
          <div className="rounded-2xl border border-positive/30 bg-surface p-6 shadow-xs flex flex-col items-center text-center space-y-4">
            <div className="size-12 rounded-2xl bg-positive/10 border border-positive/20 flex items-center justify-center text-positive-strong">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">
                Tudo pronto! Senha atualizada
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                Sua credencial de acesso foi alterada com sucesso. Agora você pode prosseguir normalmente.
              </p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => navigate("/", { replace: true })}
              className="w-full text-xs h-9 font-semibold rounded-xl"
            >
              Acessar minha conta
            </Button>
          </div>
        ) : isInvalidLink ? (
          <div className="space-y-4">
            <Alert variant="error">
              {error || "O link de redefinição de senha é inválido ou expirou."}
            </Alert>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/recuperar-senha"
                className="w-full h-9 rounded-xl inline-flex items-center justify-center text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Solicitar novo link de recuperação
              </Link>
              <Link
                to="/entrar"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Voltar para o login</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error ? <Alert variant="error">{error}</Alert> : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-new-password" className="text-xs font-semibold text-foreground">
                Nova senha
              </label>
              <PasswordInput
                id="reset-new-password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="No mínimo 8 caracteres"
                className="h-10 text-sm rounded-xl"
              />
            </div>

            {/* Requisitos visuais de senha */}
            {newPassword.length > 0 && (
              <div className="rounded-xl bg-muted/20 border border-border/80 p-3 space-y-2">
                <span className="text-[11px] font-semibold text-foreground">
                  Requisitos de segurança:
                </span>
                <ul className="text-[11px] space-y-1 text-muted-foreground">
                  <li className={requirements.minLength ? "text-positive-strong font-medium" : ""}>
                    • Pelo menos 8 caracteres
                  </li>
                  <li
                    className={
                      requirements.hasUppercase || requirements.hasNumber
                        ? "text-positive-strong font-medium"
                        : ""
                    }
                  >
                    • Letras maiúsculas ou números
                  </li>
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reset-confirm-password"
                className="text-xs font-semibold text-foreground"
              >
                Confirmar nova senha
              </label>
              <PasswordInput
                id="reset-confirm-password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="h-10 text-sm rounded-xl"
              />
              {showMismatch && (
                <span className="text-[11px] text-critical-strong">
                  As senhas digitadas não coincidem.
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending || !isPasswordSufficient || !isMatching}
              className="h-10 text-sm font-semibold rounded-xl bg-primary-strong hover:bg-primary text-primary-foreground shadow-xs transition-colors mt-1"
            >
              {pending ? "Atualizando senha…" : "Salvar nova senha"}
            </Button>

            <div className="pt-2 flex justify-center">
              <Link
                to="/entrar"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                <span>Cancelar e voltar ao login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
