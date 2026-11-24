import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  Alert,
  Button,
  FormField,
  PasswordInput,
  buttonVariants,
} from "@/components/ui";
import { checkPasswordRequirements } from "@/domain/validation";
import { subscribeAuthStateChange, updateUserPassword } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import { markPendingExplicitDeviceRegistration } from "@/services/native/device-info";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { AuthShell } from "../components/auth-shell";
import { PasswordRequirementsChecklist } from "../components/password-requirements-checklist";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { signOut } = useSignOut();

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
    if (initialUrlError) return;

    const cleanUrlTokens = () => {
      if (typeof window !== "undefined" && (window.location.hash || window.location.search)) {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname || "/redefinir-senha",
        );
      }
    };

    const hasRecoveryParams =
      typeof window !== "undefined" &&
      (window.location.hash.includes("type=recovery") ||
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("refresh_token") ||
        window.location.search.includes("type=recovery") ||
        window.location.search.includes("code="));

    if (hasRecoveryParams) {
      cleanUrlTokens();
    }

    const unsubscribe = subscribeAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsInvalidLink(false);
        cleanUrlTokens();
      }
    });

    return () => {
      unsubscribe();
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
      triggerSensory("error");
      setError("A nova senha deve atender aos critérios de segurança mínimos.");
      return;
    }
    if (!isMatching) {
      triggerSensory("error");
      setError("As senhas digitadas não coincidem.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await updateUserPassword(newPassword);

      try {
        await signOut({ scope: "others" });
      } catch {
        // fail-safe
      }

      markPendingExplicitDeviceRegistration();
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
              <h2 className="text-base font-semibold text-foreground">
                Tudo pronto! Senha atualizada
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                Sua credencial de acesso foi alterada com sucesso. Agora você pode prosseguir normalmente.
              </p>
            </div>
            <Button
              type="button"
              variant="solid"
              onClick={() => navigate("/", { replace: true })}
              className="w-full"
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
                className={cn(buttonVariants({ variant: "solid" }), "w-full")}
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
          <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4" noValidate>
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField label="Nova senha" htmlFor="reset-new-password">
              <PasswordInput
                id="reset-new-password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="No mínimo 8 caracteres"
                className="text-base sm:text-sm"
              />
            </FormField>

            {newPassword.length > 0 ? (
              <PasswordRequirementsChecklist password={newPassword} mode="basic" />
            ) : null}

            <FormField
              label="Confirmar nova senha"
              htmlFor="reset-confirm-password"
              error={showMismatch ? "As senhas digitadas não coincidem." : undefined}
            >
              <PasswordInput
                id="reset-confirm-password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className="text-base sm:text-sm"
              />
            </FormField>

            <Button
              type="submit"
              variant="solid"
              sensoryIntent={false}
              disabled={pending || !isPasswordSufficient || !isMatching}
              className="mt-1"
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
