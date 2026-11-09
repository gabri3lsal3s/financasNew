import { useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import {
  Modal,
  ModalFooter,
  Button,
  PasswordInput,
  Alert,
} from "@/components/ui";
import { changeUserPassword } from "@/hooks/use-auth";
import { checkPasswordRequirements } from "@/domain/validation";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";

export interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
      setErrorMessage("Informe sua senha atual.");
      return;
    }
    if (!isPasswordSufficient) {
      setErrorMessage("A nova senha deve atender aos critérios de segurança mínimos.");
      return;
    }
    if (!isPasswordMatching) {
      setErrorMessage("As senhas digitadas não coincidem.");
      return;
    }

    setErrorMessage(null);
    setIsUpdating(true);

    try {
      await changeUserPassword(currentPassword, newPassword);
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

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Alterar Senha de Acesso"
      description="Crie uma nova senha segura para proteger sua conta e suas informações financeiras."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="modal-current-password"
              className="text-xs font-semibold text-foreground"
            >
              Senha atual
            </label>
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
              className="h-10 text-sm rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="modal-new-password"
                className="text-xs font-semibold text-foreground"
              >
                Nova senha
              </label>
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
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="modal-confirm-password"
                className="text-xs font-semibold text-foreground"
              >
                Confirmar nova senha
              </label>
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
                className="h-10 text-sm rounded-xl"
              />
              {showPasswordMismatch && (
                <span className="text-[11px] text-critical-strong block">
                  As senhas não coincidem.
                </span>
              )}
            </div>
          </div>
        </div>

        {newPassword.length > 0 && (
          <div className="rounded-xl bg-muted/20 border border-border/80 p-3 space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Critérios de segurança:</span>
            </span>
            <ul className="text-[11px] space-y-1 text-muted-foreground">
              <li className={passwordRequirements.minLength ? "text-positive-strong font-medium" : ""}>
                • Pelo menos 8 caracteres
              </li>
              <li
                className={
                  passwordRequirements.hasUppercase || passwordRequirements.hasNumber
                    ? "text-positive-strong font-medium"
                    : ""
                }
              >
                • Letras maiúsculas ou números
              </li>
            </ul>
          </div>
        )}

        <ModalFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleClose(false)}
            className="rounded-xl cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={
              isUpdating ||
              !isPasswordSufficient ||
              !isPasswordMatching ||
              newPassword.length === 0 ||
              currentPassword.length === 0
            }
            className="gap-2 rounded-xl cursor-pointer"
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
      </form>
    </Modal>
  );
}
