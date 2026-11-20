import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  enrollMfaTotp,
  listVerifiedMfaFactors,
  verifyMfaEnrollment,
} from "@/hooks/use-auth";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";
import { getErrorMessage } from "@/services/errors";
import { useMfaSecurityGate } from "./use-mfa-security-gate";

export type { MfaAuthMethod, MfaConfirmAction } from "./use-mfa-security-gate";

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

  const handleModalOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setIsEnrolling(false);
        setEnrollData(null);
        setVerificationCode("");
        setErrorMessage(null);
      }
    },
    [onOpenChange],
  );

  const securityGate = useMfaSecurityGate({
    activeFactor,
    setActiveFactor,
    onDeactivateSuccess: () => handleModalOpenChange(false),
    onReconfigureSuccess: handleStartEnrollment,
    setErrorMessage,
  });

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
    confirmAction: securityGate.confirmAction,
    setConfirmAction: securityGate.setConfirmAction,
    authMethod: securityGate.authMethod,
    setAuthMethod: securityGate.setAuthMethod,
    authInputValue: securityGate.authInputValue,
    setAuthInputValue: securityGate.setAuthInputValue,
    isVerifyingSecurity: securityGate.isVerifyingSecurity,
    handleModalOpenChange: (nextOpen: boolean) => {
      handleModalOpenChange(nextOpen);
      if (!nextOpen) securityGate.resetSecurityGate();
    },
    handleStartEnrollment,
    handleVerifyEnrollment,
    handleExecuteConfirmedAction: securityGate.handleExecuteConfirmedAction,
    handleCopySecret,
    cancelEnrollment: () => {
      setIsEnrolling(false);
      setEnrollData(null);
      setErrorMessage(null);
    },
  };
}
