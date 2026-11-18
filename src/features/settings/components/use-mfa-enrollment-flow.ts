import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  enrollMfaTotp,
  listVerifiedMfaFactors,
  refreshMfaState,
  unenrollMfaFactor,
  verifyCurrentPassword,
  verifyMfaEnrollment,
  verifyMfaTotpCode,
} from "@/hooks/use-auth";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";

export interface MfaFactor {
  id: string;
  status: "verified" | "unverified";
  friendly_name?: string;
  factor_type: string;
}

export interface MfaEnrollData {
  factorId: string;
  secret: string;
  totpUri: string;
}

export type MfaConfirmAction = "none" | "deactivate" | "reconfigure";
export type MfaAuthMethod = "totp" | "password";

export function useMfaEnrollmentFlow(
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const [isLoading, setIsLoading] = useState(true);
  const [activeFactor, setActiveFactor] = useState<MfaFactor | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<MfaEnrollData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [confirmAction, setConfirmAction] = useState<MfaConfirmAction>("none");
  const [authMethod, setAuthMethod] = useState<MfaAuthMethod>("totp");
  const [authInputValue, setAuthInputValue] = useState("");
  const [isVerifyingSecurity, setIsVerifyingSecurity] = useState(false);

  const refreshFactors = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const verified = await listVerifiedMfaFactors();
      setActiveFactor(
        verified
          ? {
              id: verified.id,
              status: verified.status as "verified" | "unverified",
              friendly_name: verified.friendly_name,
              factor_type: verified.factor_type,
            }
          : null,
      );
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let isCancelled = false;

    async function loadFactors() {
      try {
        const verified = await listVerifiedMfaFactors();
        if (!isCancelled) {
          setActiveFactor(
            verified
              ? {
                  id: verified.id,
                  status: verified.status as "verified" | "unverified",
                  friendly_name: verified.friendly_name,
                  factor_type: verified.factor_type,
                }
              : null,
          );
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMessage(getErrorMessage(err));
          setIsLoading(false);
        }
      }
    }

    void loadFactors();
    return () => {
      isCancelled = true;
    };
  }, [open]);

  const handleModalOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setIsEnrolling(false);
        setEnrollData(null);
        setVerificationCode("");
        setErrorMessage(null);
        setConfirmAction("none");
        setAuthInputValue("");
        setIsVerifyingSecurity(false);
      }
    },
    [onOpenChange],
  );

  const handleStartEnrollment = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await enrollMfaTotp("Axir");
      setEnrollData({
        factorId: data.factorId,
        secret: data.secret,
        totpUri: data.totpUri,
      });
      setIsEnrolling(true);
      triggerSensory("action");
    } catch (err) {
      triggerSensory("destructive");
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleVerifyEnrollment = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!enrollData) return;
      const cleanCode = verificationCode.replace(/\D/g, "");
      if (cleanCode.length !== 6) {
        triggerSensory("error");
        setErrorMessage("O código de verificação deve conter exatamente 6 dígitos.");
        return;
      }

      setIsVerifying(true);
      setErrorMessage(null);
      try {
        await verifyMfaEnrollment(enrollData.factorId, cleanCode);
        triggerSensory("success");
        pushToast({
          title: "2FA Ativado com Sucesso",
          description: "Sua conta agora está protegida por aplicativo autenticador.",
          variant: "success",
        });
        await refreshFactors();
        setIsEnrolling(false);
        setEnrollData(null);
      } catch (err) {
        triggerSensory("destructive");
        setErrorMessage(getErrorMessage(err));
      } finally {
        setIsVerifying(false);
      }
    },
    [enrollData, refreshFactors, verificationCode],
  );

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
          setConfirmAction("none");
          setAuthInputValue("");
          handleModalOpenChange(false);
          if (typeof refreshMfaState === "function") void refreshMfaState();
        } else if (confirmAction === "reconfigure") {
          setActiveFactor(null);
          setConfirmAction("none");
          setAuthInputValue("");
          await handleStartEnrollment();
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
      handleModalOpenChange,
      handleStartEnrollment,
      isVerifyingSecurity,
    ],
  );

  const handleCopySecret = useCallback(async () => {
    if (!enrollData?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      // Ignora falha de clipboard
    }
  }, [enrollData]);

  return {
    isLoading,
    activeFactor,
    isEnrolling,
    enrollData,
    verificationCode,
    setVerificationCode,
    isVerifying,
    errorMessage,
    setErrorMessage,
    copiedSecret,
    confirmAction,
    setConfirmAction,
    authMethod,
    setAuthMethod,
    authInputValue,
    setAuthInputValue,
    isVerifyingSecurity,
    handleModalOpenChange,
    handleStartEnrollment,
    handleVerifyEnrollment,
    handleExecuteConfirmedAction,
    handleCopySecret,
    cancelEnrollment: () => {
      setIsEnrolling(false);
      setEnrollData(null);
      setErrorMessage(null);
    },
  };
}
