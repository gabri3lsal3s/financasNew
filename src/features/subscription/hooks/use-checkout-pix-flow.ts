import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { USER_SUBSCRIPTION_KEY, type PixCheckoutResult } from "@/state";
import type { SubscriptionPlan } from "@/types";

export function useCheckoutPixFlow(plan: SubscriptionPlan, isPro: boolean) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pixResult, setPixResult] = useState<PixCheckoutResult | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  useEffect(() => {
    if (!pixResult || isPro) return;
    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 3500);
    return () => clearInterval(intervalId);
  }, [pixResult, isPro, queryClient]);

  useEffect(() => {
    if (!pixResult || !isPro) return;
    triggerSensory("success");
    pushToast({
      title: "Pagamento PIX confirmado!",
      description: "Seu plano Pro foi ativado com sucesso. Bem-vindo!",
      variant: "default",
    });
    void navigate(`/assinatura/sucesso?plano=${plan}&metodo=pix`);
  }, [pixResult, isPro, navigate, plan]);

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
    handleCopyPix,
    handleSimulatePixConfirmation,
  };
}
