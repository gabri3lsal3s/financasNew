import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  Input,
  Alert,
} from "@/components/ui";
import { setPinLock, removePinLock } from "@/services/native";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  hasExistingPin?: boolean;
  onSuccess?: () => void;
}

export function PinSetupDialog({
  open,
  onOpenChange,
  userId,
  hasExistingPin = false,
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
      onSuccess?.();
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
    triggerSensory("action");
    pushToast({
      title: "PIN removido",
      description: "O bloqueio por PIN foi removido deste dispositivo.",
      variant: "default",
    });
    onSuccess?.();
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
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" className="py-2.5 text-xs">
            {error}
          </Alert>
        )}

        <div className="space-y-1 text-left">
          <label htmlFor="new-pin-input" className="text-xs font-semibold text-foreground">
            {hasExistingPin ? "Novo PIN (4 a 6 dígitos)" : "PIN de Acesso (4 a 6 dígitos)"}
          </label>
          <Input
            id="new-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              if (error) setError(null);
            }}
            className="text-center font-mono tracking-[0.5em] text-lg h-11"
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1 text-left">
          <label htmlFor="confirm-pin-input" className="text-xs font-semibold text-foreground">
            Confirme o PIN
          </label>
          <Input
            id="confirm-pin-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={confirmPin}
            onChange={(e) => {
              setConfirmPin(e.target.value.replace(/\D/g, ""));
              if (error) setError(null);
            }}
            className="text-center font-mono tracking-[0.5em] text-lg h-11"
            disabled={isSubmitting}
          />
        </div>

        <ModalFooter
          borderless
          destructiveAction={
            hasExistingPin ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="text-critical-strong hover:bg-critical/10"
              >
                Remover PIN
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
            disabled={pin.length < 4 || confirmPin.length < 4 || isSubmitting}
            className="gap-2"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{isSubmitting ? "Salvando..." : "Salvar PIN"}</span>
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
