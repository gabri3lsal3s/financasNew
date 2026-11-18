import type { FormEvent } from "react";
import { KeyRound, Lock, Smartphone } from "lucide-react";
import { Button, FormField, Input, PasswordInput } from "@/components/ui";
import type { MfaAuthMethod, MfaConfirmAction } from "./use-mfa-enrollment-flow";

export const MFA_SECURITY_GATE_FORM_ID = "mfa-security-gate-form";

export interface MfaPasswordGateStepProps {
  confirmAction: Exclude<MfaConfirmAction, "none">;
  authMethod: MfaAuthMethod;
  authInputValue: string;
  isVerifyingSecurity: boolean;
  onSelectMethod: (method: MfaAuthMethod) => void;
  onAuthInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

/**
 * Etapa de verificação de identidade (código TOTP ou senha atual) antes de desativar ou reconfigurar o 2FA.
 */
export function MfaPasswordGateStep({
  confirmAction,
  authMethod,
  authInputValue,
  isVerifyingSecurity,
  onSelectMethod,
  onAuthInputChange,
  onSubmit,
}: MfaPasswordGateStepProps) {
  return (
    <form id={MFA_SECURITY_GATE_FORM_ID} onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 space-y-1">
        <span className="text-xs font-semibold text-warning-strong flex items-center gap-1.5">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {confirmAction === "deactivate"
              ? "Confirmar Desativação do 2FA"
              : "Confirmar Reconfiguração do 2FA"}
          </span>
        </span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {confirmAction === "deactivate"
            ? "Para sua segurança, valide sua identidade com o código de 6 dígitos gerado no app ou sua senha atual para desativar o 2FA."
            : "Para gerar um novo QR Code e vincular outro aplicativo autenticador, confirme sua identidade."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={authMethod === "totp" ? "default" : "outline"}
          size="sm"
          sensoryIntent="selection"
          className="text-xs"
          onClick={() => onSelectMethod("totp")}
        >
          <Smartphone className="size-3.5 mr-1" aria-hidden="true" />
          <span>Código do App</span>
        </Button>
        <Button
          type="button"
          variant={authMethod === "password" ? "default" : "outline"}
          size="sm"
          sensoryIntent="selection"
          className="text-xs"
          onClick={() => onSelectMethod("password")}
        >
          <KeyRound className="size-3.5 mr-1" aria-hidden="true" />
          <span>Senha de Acesso</span>
        </Button>
      </div>

      {authMethod === "totp" ? (
        <FormField
          label="Código de 6 dígitos do aplicativo"
          htmlFor="mfa-security-code"
          helperText="Abra seu Google Authenticator, Authy ou 1Password e digite o código atual."
        >
          <Input
            id="mfa-security-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={authInputValue}
            onChange={(e) => onAuthInputChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={isVerifyingSecurity}
            className="text-center font-mono tracking-widest text-base sm:text-sm h-10"
          />
        </FormField>
      ) : (
        <FormField
          label="Sua senha atual"
          htmlFor="mfa-security-password"
          helperText="Digite a senha que você usa para entrar na sua conta."
        >
          <PasswordInput
            id="mfa-security-password"
            autoComplete="current-password"
            placeholder="Digite sua senha de acesso"
            value={authInputValue}
            onChange={(e) => onAuthInputChange(e.target.value)}
            disabled={isVerifyingSecurity}
            className="text-base sm:text-sm h-10"
          />
        </FormField>
      )}
    </form>
  );
}
