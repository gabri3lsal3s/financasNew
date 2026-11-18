import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addCivilMonths, calculateCumulativePrice } from "@/domain/subscription";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { USER_SUBSCRIPTION_KEY, useCumulativeCheckoutMutation } from "@/state";

export interface PixRenewalData {
  qrCodeBase64: string;
  copyPasteKey: string;
  expirationDate: string;
}

export function useCumulativeRenewal(currentPeriodEnd: string | null) {
  const [selectedMonths, setSelectedMonths] = useState<number>(3);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pixData, setPixData] = useState<PixRenewalData | null>(null);

  const queryClient = useQueryClient();
  const checkoutMutation = useCumulativeCheckoutMutation();

  const pricing = useMemo(() => calculateCumulativePrice(selectedMonths), [selectedMonths]);

  const newPeriodEndFormatted = useMemo(() => {
    const base = currentPeriodEnd ? new Date(currentPeriodEnd) : new Date();
    const target = addCivilMonths(base, selectedMonths);
    return target.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [currentPeriodEnd, selectedMonths]);

  const handleSelectMonths = (months: number) => {
    triggerSensory("selection");
    setSelectedMonths(months);
  };

  const handleGeneratePix = async () => {
    try {
      const result = await checkoutMutation.mutateAsync({
        months: selectedMonths,
        method: "pix",
      });

      if ("qrCodeBase64" in result && result.qrCodeBase64) {
        setPixData({
          qrCodeBase64: result.qrCodeBase64,
          copyPasteKey: result.copyPasteKey,
          expirationDate: result.expirationDate,
        });
        setPixModalOpen(true);
      }
    } catch {
      // Erro notificado pela mutation
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.copyPasteKey) return;
    try {
      await navigator.clipboard.writeText(pixData.copyPasteKey);
      setCopiedKey(true);
      triggerSensory("success");
      pushToast({
        title: "Chave Copia e Cola copiada",
        description: "Cole no aplicativo do seu banco para pagar o Pix.",
        variant: "default",
      });
      setTimeout(() => setCopiedKey(false), 3000);
    } catch {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível copiar",
        description: "Copie a chave manualmente pelo campo.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!pixModalOpen || !pixData) return;
    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [pixModalOpen, pixData, queryClient]);

  return {
    selectedMonths,
    pixModalOpen,
    setPixModalOpen,
    copiedKey,
    pixData,
    pricing,
    newPeriodEndFormatted,
    isPending: checkoutMutation.isPending,
    handleSelectMonths,
    handleGeneratePix,
    handleCopyPix,
  };
}
