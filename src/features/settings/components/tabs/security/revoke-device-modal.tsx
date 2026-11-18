import type { FormEvent } from "react";
import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
  PasswordInput,
  Skeleton,
} from "@/components/ui";
import type { UserDevice } from "@/types";

const REVOKE_DEVICE_FORM_ID = "revoke-device-form";

export interface RevokeDeviceModalProps {
  open: boolean;
  targetDevice: UserDevice | null;
  hasMfa: boolean | null;
  isCheckingMfa: boolean;
  isVerifying: boolean;
  challengeValue: string;
  modalError: string | null;
  onClose: () => void;
  onChallengeChange: (value: string) => void;
  onConfirm: () => Promise<void>;
}

export function RevokeDeviceModal({
  open,
  targetDevice,
  hasMfa,
  isCheckingMfa,
  isVerifying,
  challengeValue,
  modalError,
  onClose,
  onChallengeChange,
  onConfirm,
}: RevokeDeviceModalProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onConfirm();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isVerifying) {
          onClose();
        }
      }}
      title="Revogar Dispositivo Remoto"
      description="Encerrar a sessão ativa no aparelho selecionado."
      size="sm"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isVerifying}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={REVOKE_DEVICE_FORM_ID}
            variant="destructive"
            sensoryIntent={false}
            disabled={isVerifying || isCheckingMfa || !challengeValue.trim()}
            className="gap-1.5"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Validando...</span>
              </>
            ) : (
              <>
                <LogOut className="size-3.5" aria-hidden="true" />
                <span>Revogar Sessão</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form id={REVOKE_DEVICE_FORM_ID} onSubmit={handleSubmit} className="space-y-4 pt-1">
        {modalError ? <Alert variant="error">{modalError}</Alert> : null}

        <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 space-y-1">
          <span className="text-xs font-semibold text-warning-strong flex items-center gap-1.5">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Desconexão Imediata</span>
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A sessão em <strong className="text-foreground">{targetDevice?.device_name}</strong> será encerrada. O aparelho perderá o acesso imediatamente.
          </p>
        </div>

        {isCheckingMfa ? (
          <div role="status" aria-busy="true" className="space-y-2 p-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-10 w-full rounded-md" />
            <span className="sr-only">Verificando requisitos de segurança...</span>
          </div>
        ) : hasMfa ? (
          <FormField
            label="Código de Autenticação em Duas Etapas (2FA)"
            htmlFor="device-revoke-totp-input"
            helperText="Abra seu app autenticador e digite o código de 6 dígitos gerado."
          >
            <Input
              id="device-revoke-totp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={challengeValue}
              onChange={(e) => onChallengeChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={isVerifying}
              autoComplete="one-time-code"
              className="text-base sm:text-sm font-mono tracking-widest text-center"
            />
          </FormField>
        ) : (
          <FormField
            label="Confirme sua Senha Atual"
            htmlFor="device-revoke-password-input"
            helperText="Para sua segurança, confirme sua senha para autorizar a revogação."
          >
            <PasswordInput
              id="device-revoke-password-input"
              placeholder="Digite sua senha de acesso"
              value={challengeValue}
              onChange={(e) => onChallengeChange(e.target.value)}
              disabled={isVerifying}
              autoComplete="current-password"
              className="text-base sm:text-sm"
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
