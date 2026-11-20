import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import {
  refreshMfaState,
  unenrollMfaFactor,
  verifyCurrentPassword,
  verifyMfaTotpCode,
} from "@/hooks/use-auth";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import type { MfaFactor } from "./use-mfa-enrollment-flow";

export type MfaConfirmAction = "none" | "deactivate" | "reconfigure";
export type MfaAuthMethod = "totp" | "password";

export interface UseMfaSecurityGateOptions {
  activeFactor: MfaFactor | null;
  setActiveFactor: (factor: MfaFactor | null) => void;
  onDeactivateSuccess: () => void;
  onReconfigureSuccess: () => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
}

export function useMfaSecurityGate({
  activeFactor,
  setActiveFactor,
  onDeactivateSuccess,
  onReconfigureSuccess,
  setErrorMessage,
}: UseMfaSecurityGateOptions) {
  const [confirmAction, setConfirmAction] = useState<MfaConfirmAction>("none");
  const [authMethod, setAuthMethod] = useState<MfaAuthMethod>("totp");
  const [authInputValue, setAuthInputValue] = useState("");
  const [isVerifyingSecurity, setIsVerifyingSecurity] = useState(false);

  const resetSecurityGate = useCallback(() => {
    setConfirmAction("none");
    setAuthInputValue("");
    setIsVerifyingSecurity(false);
  }, []);

  const handleExecuteConfirmedAction = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!activeFactor || isVerifyingSecurity) return;
      setIsVerifyingSecurity(true);
      setErrorMessage(null);

      try {
        if (authMethod === "totp") {
          const cleanCode = authInputValue.trim();
          if (cleanCode.length !== 6) {
            triggerSensory("error");
            setErrorMessage("Informe o código de 6 dígitos gerado pelo aplicativo autenticador.");
            setIsVerifyingSecurity(false);
            return;
          }
          const isValidMfa = await verifyMfaTotpCode(activeFactor.id, cleanCode);
          if (!isValidMfa) {
            triggerSensory("error");
            setErrorMessage("Código de autenticação incorreto ou expirado. Tente novamente.");
            setIsVerifyingSecurity(false);
            return;
          }
        } else {
          if (!authInputValue) {
            triggerSensory("error");
            setErrorMessage("Informe sua senha de acesso para autorizar.");
            setIsVerifyingSecurity(false);
            return;
          }
          const isValidPassword = await verifyCurrentPassword(authInputValue);
          if (!isValidPassword) {
            triggerSensory("error");
            setErrorMessage("Senha incorreta. Não foi possível autorizar a operação.");
            setIsVerifyingSecurity(false);
            return;
          }
        }

        await unenrollMfaFactor(activeFactor.id);

        if (confirmAction === "deactivate") {
          triggerSensory("selection");
          pushToast({
            title: "2FA Desativado",
            description: "A verificação em duas etapas foi desativada com sucesso.",
            variant: "success",
          });
          setActiveFactor(null);
          resetSecurityGate();
          onDeactivateSuccess();
          if (typeof refreshMfaState === "function") void refreshMfaState();
        } else if (confirmAction === "reconfigure") {
          setActiveFactor(null);
          resetSecurityGate();
          await onReconfigureSuccess();
        }
      } catch (err) {
        triggerSensory("destructive");
        setErrorMessage(getErrorMessage(err));
      } finally {
        setIsVerifyingSecurity(false);
      }
    },
    [
      activeFactor,
      authInputValue,
      authMethod,
      confirmAction,
      isVerifyingSecurity,
      onDeactivateSuccess,
      onReconfigureSuccess,
      resetSecurityGate,
      setActiveFactor,
      setErrorMessage,
    ],
  );

  return {
    confirmAction,
    setConfirmAction,
    authMethod,
    setAuthMethod,
    authInputValue,
    setAuthInputValue,
    isVerifyingSecurity,
    resetSecurityGate,
    handleExecuteConfirmedAction,
  };
}
