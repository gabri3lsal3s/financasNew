import type { FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import { AuthShell } from "./auth-shell";
import { LoginSideHero } from "./login-side-hero";

export interface MfaChallengeViewProps {
  totpCode: string;
  isVerifyingMfa: boolean;
  mfaError: string | null;
  onCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export function MfaChallengeView({
  totpCode,
  isVerifyingMfa,
  mfaError,
  onCodeChange,
  onSubmit,
  onCancel,
}: MfaChallengeViewProps) {
  return (
    <AuthShell
      title="Verificação em Duas Etapas"
      subtitle="Sua conta está protegida por 2FA. Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador."
      sideHero={<LoginSideHero />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/10 text-primary-strong">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-semibold block text-foreground">
              Código de Autenticação (TOTP)
            </span>
            <span className="text-[11px] text-muted-foreground block">
              Google Authenticator, Microsoft Authenticator, 1Password ou Authy
            </span>
          </div>
        </div>

        {mfaError ? <Alert variant="error">{mfaError}</Alert> : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField label="Código de 6 dígitos" htmlFor="mfa-code">
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={totpCode}
              onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="h-12 text-center text-lg font-mono tracking-widest"
            />
          </FormField>

          <Button
            type="submit"
            variant="solid"
            sensoryIntent={false}
            disabled={isVerifyingMfa || totpCode.trim().length !== 6}
            className="gap-1.5"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            <span>{isVerifyingMfa ? "Validando…" : "Confirmar Acesso"}</span>
          </Button>
        </form>

        <div className="pt-2 border-t border-border/80 flex flex-col items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            sensoryIntent={false}
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar e voltar ao login
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
