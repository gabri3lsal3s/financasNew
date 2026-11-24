import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { INVOICES_KEY, USER_SUBSCRIPTION_KEY, type PixCheckoutResult } from "@/state";
import type { SubscriptionPlan, SubscriptionTier } from "@/types";

export interface CheckoutPixSubscriptionSnapshot {
  isPro: boolean;
  tier: SubscriptionTier;
  currentPeriodEnd: string | null;
}

/**
 * Compara o estado inicial da assinatura no momento em que o QR Code PIX foi gerado
 * com o estado atual retornado pelo polling, garantindo detecção correta tanto para
 * novas ativações quanto para upgrades Mensal -> Anual (A-02).
 */
export function hasPixUpgradeConfirmed(
  baseline: CheckoutPixSubscriptionSnapshot | null,
  current: CheckoutPixSubscriptionSnapshot,
  targetPlan: SubscriptionPlan,
): boolean {
  if (!baseline) return false;
  if (!baseline.isPro && current.isPro) return true;
  if (targetPlan === "annual" && baseline.tier !== "pro_annual" && current.tier === "pro_annual") {
    return true;
  }
  if (current.currentPeriodEnd) {
    const currentMs = Date.parse(current.currentPeriodEnd);
    if (!Number.isNaN(currentMs)) {
      if (!baseline.currentPeriodEnd) return true;
      const baselineMs = Date.parse(baseline.currentPeriodEnd);
      if (!Number.isNaN(baselineMs) && currentMs > baselineMs) return true;
    }
  }
  return false;
}

export function useCheckoutPixFlow(
  plan: SubscriptionPlan,
  subscription: CheckoutPixSubscriptionSnapshot,
) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pixResult, setPixResultState] = useState<PixCheckoutResult | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] =
    useState<CheckoutPixSubscriptionSnapshot | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);

  const hasConfirmedRef = useRef(false);
  const latestSubscriptionRef = useRef(subscription);

  useEffect(() => {
    latestSubscriptionRef.current = subscription;
  }, [subscription]);

  const setPixResult = useCallback((next: PixCheckoutResult | null) => {
    if (next) {
      setBaselineSnapshot({ ...latestSubscriptionRef.current });
      hasConfirmedRef.current = false;
    } else {
      setBaselineSnapshot(null);
      hasConfirmedRef.current = false;
    }
    setPixResultState(next);
  }, []);

  const isConfirmed = useMemo(
    () => (pixResult ? hasPixUpgradeConfirmed(baselineSnapshot, subscription, plan) : false),
    [pixResult, baselineSnapshot, subscription, plan],
  );

  useEffect(() => {
    if (!pixResult || isConfirmed) return;
    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 3500);
    return () => clearInterval(intervalId);
  }, [pixResult, isConfirmed, queryClient]);

  useEffect(() => {
    if (!pixResult || !isConfirmed || hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
    triggerSensory("success");
    pushToast({
      title: "Pagamento PIX confirmado!",
      description: "Seu plano Pro foi ativado com sucesso. Bem-vindo!",
      variant: "default",
    });
    void navigate(`/assinatura/sucesso?plano=${plan}&metodo=pix`);
  }, [pixResult, isConfirmed, navigate, plan, queryClient]);

  const handleCopyPix = async () => {
    if (!pixResult) return;
    try {
      await navigator.clipboard.writeText(pixResult.copyPasteKey);
      setCopiedPix(true);
      triggerSensory("success");
      pushToast({
        title: "Chave Copia e Cola copiada",
        description: "Cole no aplicativo do seu banco para concluir o pagamento.",
        variant: "default",
      });
      setTimeout(() => setCopiedPix(false), 3000);
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Erro ao copiar",
        description: "Selecione o código manualmente para copiar.",
        variant: "destructive",
      });
    }
  };

  const handleManualVerify = async () => {
    setIsVerifyingManual(true);
    triggerSensory("selection");
    try {
      await queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      await queryClient.refetchQueries({ queryKey: USER_SUBSCRIPTION_KEY });
      pushToast({
        title: "Verificando liquidação",
        description: "Consultando confirmação instantânea do PIX junto ao Banco Central...",
        variant: "default",
      });
    } finally {
      setTimeout(() => setIsVerifyingManual(false), 1200);
    }
  };

  const handleSimulatePixConfirmation = () => {
    pushToast({
      title: "Pagamento PIX confirmado!",
      description: "Ambiente de validação visual: assinatura Pro ativada com sucesso.",
      variant: "default",
    });
    void navigate(`/assinatura/sucesso?plano=${plan}&metodo=pix`);
  };

  return {
    pixResult,
    setPixResult,
    copiedPix,
    isVerifyingManual,
    handleCopyPix,
    handleManualVerify,
    handleSimulatePixConfirmation,
  };
}
