import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalFooter,
  PasswordInput,
} from "@/components/ui";
import { requestUserEmailChange } from "@/hooks/use-auth";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";

const CHANGE_EMAIL_FORM_ID = "change-email-form";

export interface ChangeEmailModalProps {
  open: boolean;
  currentEmail?: string;
  onOpenChange: (open: boolean) => void;
}

export function ChangeEmailModal({
  open,
  currentEmail,
  onOpenChange,
}: ChangeEmailModalProps) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setNewEmail("");
    setCurrentPassword("");
    setErrorMessage(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUpdating) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedEmail = newEmail.trim();

    if (!trimmedEmail) {
      triggerSensory("error");
      setErrorMessage("Informe o novo endereço de e-mail.");
      return;
    }

    if (currentEmail && trimmedEmail.toLowerCase() === currentEmail.toLowerCase()) {
      triggerSensory("error");
      setErrorMessage("O novo e-mail deve ser diferente do e-mail atual.");
      return;
    }

    if (!currentPassword) {
      triggerSensory("error");
      setErrorMessage("Informe sua senha atual.");
      return;
    }

    setErrorMessage(null);
    setIsUpdating(true);

    try {
      await requestUserEmailChange(currentPassword, trimmedEmail);
      triggerSensory("success");
      onOpenChange(false);
      resetForm();
      pushToast({
        title: "Confirmação enviada",
        description:
          "Enviamos um link de confirmação para o novo e-mail. Verifique sua caixa de entrada.",
        variant: "success",
      });
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title="Alterar E-mail de Acesso"
      description="Atualize seu endereço de e-mail. Um link de confirmação será enviado para validação."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={CHANGE_EMAIL_FORM_ID}
            variant="default"
            sensoryIntent={false}
            disabled={isUpdating || !newEmail.trim() || !currentPassword.trim()}
            className="gap-1.5 shadow-xs"
          >
            {isUpdating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Enviando…</span>
              </>
            ) : (
              <span>Confirmar</span>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form id={CHANGE_EMAIL_FORM_ID} onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div className="rounded-xl bg-surface-raised/60 p-3.5 space-y-1.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Confirmação de Segurança</span>
          </span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Por motivos de segurança, enviaremos links de confirmação para validar a alteração. O novo e-mail só será efetivado após a confirmação.
          </p>
        </div>

        <div className="space-y-3.5">
          <FormField label="Novo endereço de e-mail" htmlFor="modal-new-email">
            <Input
              id="modal-new-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="novo@exemplo.com"
              className="text-base sm:text-sm"
            />
          </FormField>

          <FormField
            label="Senha atual"
            htmlFor="modal-email-current-password"
            helperText="Necessária para confirmar sua identidade antes da alteração."
          >
            <PasswordInput
              id="modal-email-current-password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Digite sua senha atual"
              className="text-base sm:text-sm"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
