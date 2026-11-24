import { useState, type FormEvent } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
} from "@/components/ui";
import { removePinLock, setPinLock } from "@/services/native";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  hasExistingPin?: boolean;
  onPinSaved?: () => void;
  onPinRemoved?: () => void;
  /** @deprecated Preferir `onPinSaved` e `onPinRemoved` separados. */
  onSuccess?: () => void;
}

const PIN_SETUP_FORM_ID = "pin-setup-form";

export function PinSetupDialog({
  open,
  onOpenChange,
  userId,
  hasExistingPin = false,
  onPinSaved,
  onPinRemoved,
  onSuccess,
}: PinSetupDialogProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPin("");
    setConfirmPin("");
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{4,6}$/.test(cleanPin)) {
      setError("O PIN deve conter de 4 a 6 dígitos numéricos.");
      triggerSensory("error");
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError("A confirmação do PIN não confere.");
      triggerSensory("error");
      return;
    }

    setIsSubmitting(true);
    try {
      await setPinLock(cleanPin, userId);
      triggerSensory("success");
      pushToast({
        title: hasExistingPin ? "PIN atualizado com sucesso" : "PIN configurado com sucesso",
        description: "Seu código de acesso rápido foi armazenado com segurança neste dispositivo.",
        variant: "success",
      });
      if (onPinSaved) {
        onPinSaved();
      } else {
        onSuccess?.();
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o PIN.");
      triggerSensory("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = () => {
    removePinLock(userId);
    pushToast({
      title: "PIN removido",
      description: "O bloqueio por PIN foi removido deste dispositivo.",
      variant: "default",
    });
    onPinRemoved?.();
    handleClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
      size="sm"
      title={hasExistingPin ? "Alterar PIN de Acesso" : "Definir PIN de Acesso"}
      description="Configure um código numérico de 4 a 6 dígitos para proteger seus dados financeiros neste navegador."
      footer={
        <ModalFooter
          borderless
          destructiveAction={
            hasExistingPin ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span>Remover PIN</span>
              </Button>
            ) : undefined
          }
        >
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={PIN_SETUP_FORM_ID}
            sensoryIntent={false}
            disabled={pin.length < 4 || confirmPin.length < 4 || isSubmitting}
            className="gap-2"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{isSubmitting ? "Salvando..." : "Salvar PIN"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <form id={PIN_SETUP_FORM_ID} onSubmit={handleSubmit} className="space-y-4 py-1">
        {error ? (
          <Alert variant="error" className="py-2.5 text-xs">
            {error}
          </Alert>
        ) : null}

        <FormField
          label={hasExistingPin ? "Novo PIN (4 a 6 dígitos)" : "PIN de Acesso (4 a 6 dígitos)"}
          htmlFor="new-pin-input"
          required
        >
          <Input
            id="new-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="000000"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              if (error) setError(null);
            }}
            className="text-center font-mono tracking-[0.5em] text-lg h-11"
            disabled={isSubmitting}
          />
        </FormField>

        <FormField label="Confirme o PIN" htmlFor="confirm-pin-input" required>
          <Input
            id="confirm-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="000000"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, ""));
              if (error) setError(null);
            }}
            className="text-center font-mono tracking-[0.5em] text-lg h-11"
            disabled={isSubmitting}
          />
        </FormField>
      </form>
    </Modal>
  );
}
