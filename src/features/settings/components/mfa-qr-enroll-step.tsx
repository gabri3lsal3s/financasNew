import type { FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { Button, FormField, Input, QrCodeCanvas } from "@/components/ui";
import type { MfaEnrollData } from "./use-mfa-enrollment-flow";

export const MFA_VERIFY_FORM_ID = "mfa-verify-form";

export interface MfaQrEnrollStepProps {
  enrollData: MfaEnrollData;
  verificationCode: string;
  copiedSecret: boolean;
  onVerificationCodeChange: (value: string) => void;
  onCopySecret: () => void;
  onSubmit: (e: FormEvent) => void;
}

/**
 * Etapa de pareamento via QR Code (QrCodeCanvas) e confirmação do código TOTP de 6 dígitos.
 */
export function MfaQrEnrollStep({
  enrollData,
  verificationCode,
  copiedSecret,
  onVerificationCodeChange,
  onCopySecret,
  onSubmit,
}: MfaQrEnrollStepProps) {
  return (
    <form id={MFA_VERIFY_FORM_ID} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2 text-center">
        <span className="text-xs font-semibold text-foreground block">
          1. Escaneie o QR Code no seu aplicativo autenticador:
        </span>
        <div className="flex justify-center">
          <QrCodeCanvas
            text={enrollData.totpUri}
            size={184}
            label="QR Code para configuração de autenticação em duas etapas"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-muted-foreground block text-center">
          Ou insira a chave secreta manualmente se não puder ler o código:
        </span>
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-raised border border-border/80 text-xs font-mono">
          <span className="truncate select-all text-muted-foreground">{enrollData.secret}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            sensoryIntent="selection"
            className="h-8 px-2.5 shrink-0 text-xs"
            onClick={onCopySecret}
          >
            {copiedSecret ? (
              <>
                <Check className="size-3.5 text-positive-strong mr-1" aria-hidden="true" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1" aria-hidden="true" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </div>

      <FormField
        label="2. Digite o código de 6 dígitos gerado no app:"
        htmlFor="mfa-code-input"
      >
        <Input
          id="mfa-code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={verificationCode}
          onChange={(e) => onVerificationCodeChange(e.target.value.replace(/\D/g, ""))}
          className="text-center tracking-widest font-mono text-base sm:text-sm"
        />
      </FormField>
    </form>
  );
}
