import { useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Alert,
  Button,
  Checkbox,
  FormField,
  Modal,
  ModalFooter,
  PasswordInput,
} from "@/components/ui";
import { changeUserPassword } from "@/hooks/use-auth";
import { useSignOut } from "@/hooks/use-sign-out";
import { checkPasswordRequirements } from "@/domain/validation";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import { PasswordRequirementsChecklist } from "@/features/auth/components";

export interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANGE_PASSWORD_FORM_ID = "change-password-form";

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const { signOut } = useSignOut();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setRevokeOtherSessions(false);
    setErrorMessage(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        resetState();
      }
    }
  };

  const passwordRequirements = checkPasswordRequirements(newPassword);
  const isPasswordSufficient =
    passwordRequirements.minLength &&
    (passwordRequirements.hasUppercase || passwordRequirements.hasNumber);
  const isPasswordMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const showPasswordMismatch = confirmPassword.length > 0 && !isPasswordMatching;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      triggerSensory("error");
      setErrorMessage("Informe sua senha atual.");
      return;
    }
    if (!isPasswordSufficient) {
      triggerSensory("error");
      setErrorMessage("A nova senha deve atender aos critérios de segurança mínimos.");
      return;
    }
    if (!isPasswordMatching) {
      triggerSensory("error");
      setErrorMessage("As senhas digitadas não coincidem.");
      return;
    }

    setErrorMessage(null);
    setIsUpdating(true);

    try {
      await changeUserPassword(currentPassword, newPassword);
      if (revokeOtherSessions) {
        try {
          await signOut({ scope: "others" });
        } catch {
          // Falha ao encerrar outras sessões não invalida a troca já efetuada
        }
      }
      triggerSensory("success");
      pushToast({
        title: "Senha atualizada com sucesso",
        description: "Sua senha de acesso foi alterada com segurança.",
        variant: "success",
      });
      handleClose(false);
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsUpdating(false);
    }
  };

  const isSubmitDisabled =
    isUpdating ||
    !isPasswordSufficient ||
    !isPasswordMatching ||
    newPassword.length === 0 ||
    currentPassword.length === 0;

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Alterar Senha de Acesso"
      description="Crie uma nova senha segura para proteger sua conta e suas informações financeiras."
      size="md"
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleClose(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={CHANGE_PASSWORD_FORM_ID}
            sensoryIntent={false}
            disabled={isSubmitDisabled}
            className="gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Atualizando…</span>
              </>
            ) : (
              <>
                <KeyRound className="size-3.5" aria-hidden="true" />
                <span>Atualizar Senha</span>
              </>
            )}
          </Button>
        </ModalFooter>
      }
    >
      <form id={CHANGE_PASSWORD_FORM_ID} onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div className="space-y-3.5">
          <FormField label="Senha atual" htmlFor="modal-current-password" required>
            <PasswordInput
              id="modal-current-password"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField label="Nova senha" htmlFor="modal-new-password" required>
              <PasswordInput
                id="modal-new-password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Mínimo 8 caracteres"
                className="text-base sm:text-sm"
              />
            </FormField>

            <FormField
              label="Confirmar nova senha"
              htmlFor="modal-confirm-password"
              required
              error={showPasswordMismatch ? "As senhas não coincidem." : undefined}
            >
              <PasswordInput
                id="modal-confirm-password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Repita a nova senha"
                className="text-base sm:text-sm"
              />
            </FormField>
          </div>
        </div>

        {newPassword.length > 0 ? <PasswordRequirementsChecklist password={newPassword} /> : null}

        <div className="flex items-start gap-2.5 rounded-xl bg-surface-raised/60 p-3 border border-border/80">
          <Checkbox
            id="modal-revoke-other-sessions"
            checked={revokeOtherSessions}
            onCheckedChange={(checked) => setRevokeOtherSessions(Boolean(checked))}
            disabled={isUpdating}
          />
          <label
            htmlFor="modal-revoke-other-sessions"
            className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
          >
            Encerrar sessão em outros dispositivos após atualizar a senha
          </label>
        </div>
      </form>
    </Modal>
  );
}
