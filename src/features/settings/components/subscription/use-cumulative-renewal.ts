import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addCivilMonths, calculateCumulativePrice } from "@/domain/subscription";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { INVOICES_KEY, USER_SUBSCRIPTION_KEY, useCumulativeCheckoutMutation } from "@/state";

export interface PixRenewalData {
  qrCodeBase64: string;
  copyPasteKey: string;
  expirationDate: string;
}

/**
 * Verifica se o `currentPeriodEnd` da assinatura avançou após a geração do PIX
 * acumulativo, sinalizando liquidação confirmada pelo webhook (A-09).
 */
export function hasPeriodEndAdvanced(baseline: string | null, current: string | null): boolean {
  if (!current) return false;
  const currentMs = Date.parse(current);
  if (Number.isNaN(currentMs)) return false;
  if (!baseline) return true;
  const baselineMs = Date.parse(baseline);
  if (Number.isNaN(baselineMs)) return true;
  return currentMs > baselineMs;
}

export function computeMaxAnticipationMonths(currentPeriodEnd: string | null, now = new Date()): number {
  const currentEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : now;
  const base = currentEnd > now ? currentEnd : now;
  const maxAllowedFuture = addCivilMonths(now, 11);

  let maxMonths = 0;
  for (let m = 2; m <= 11; m++) {
    if (addCivilMonths(base, m) <= maxAllowedFuture) {
      maxMonths = m;
    }
  }
  return maxMonths;
}

export function useCumulativeRenewal(currentPeriodEnd: string | null) {
  const maxAllowedMonths = useMemo(
    () => computeMaxAnticipationMonths(currentPeriodEnd),
    [currentPeriodEnd],
  );
  const [rawSelectedMonths, setSelectedMonths] = useState<number>(3);
  const selectedMonths =
    maxAllowedMonths >= 2 ? Math.min(rawSelectedMonths, maxAllowedMonths) : 2;
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pixData, setPixData] = useState<PixRenewalData | null>(null);
  const [baselinePeriodEnd, setBaselinePeriodEnd] = useState<string | null>(null);

  const hasConfirmedRef = useRef(false);
  const queryClient = useQueryClient();
  const checkoutMutation = useCumulativeCheckoutMutation();

  const pricing = useMemo(() => calculateCumulativePrice(selectedMonths), [selectedMonths]);

  const newPeriodEndFormatted = useMemo(() => {
    const base = currentPeriodEnd ? new Date(currentPeriodEnd) : new Date();
    const target = addCivilMonths(base, selectedMonths);
    return target.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [currentPeriodEnd, selectedMonths]);

  const isConfirmed = useMemo(
    () => Boolean(pixModalOpen && pixData && hasPeriodEndAdvanced(baselinePeriodEnd, currentPeriodEnd)),
    [pixModalOpen, pixData, baselinePeriodEnd, currentPeriodEnd],
  );

  const effectiveModalOpen = pixModalOpen && !isConfirmed;
  const effectivePixData = isConfirmed ? null : pixData;

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

      if ("copyPasteKey" in result && result.copyPasteKey) {
        setBaselinePeriodEnd(currentPeriodEnd);
        hasConfirmedRef.current = false;
        setPixData({
          qrCodeBase64: result.qrCodeBase64 ?? "",
          copyPasteKey: result.copyPasteKey,
          expirationDate: result.expirationDate,
        });
        setPixModalOpen(true);
      }
    } catch (err) {
      triggerSensory("error");
      pushToast({
        title: "Não foi possível gerar o Pix",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleCopyPix = async () => {
    if (!effectivePixData?.copyPasteKey) return;
    try {
      await navigator.clipboard.writeText(effectivePixData.copyPasteKey);
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
    if (!effectiveModalOpen || !effectivePixData) return;
    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: USER_SUBSCRIPTION_KEY });
    }, 4000);
    return () => clearInterval(intervalId);
  }, [effectiveModalOpen, effectivePixData, queryClient]);

  useEffect(() => {
    if (!isConfirmed || hasConfirmedRef.current) return;

    hasConfirmedRef.current = true;
    void queryClient.invalidateQueries({ queryKey: INVOICES_KEY });
    triggerSensory("success");
    pushToast({
      title: "Antecipação confirmada!",
      description: "Seu pagamento via Pix foi confirmado e o vencimento do seu plano Pro foi estendido.",
      variant: "success",
    });
  }, [isConfirmed, queryClient]);

  const handleModalOpenChange = (open: boolean) => {
    setPixModalOpen(open);
    if (!open) {
      setPixData(null);
      setBaselinePeriodEnd(null);
    }
  };

  return {
    selectedMonths,
    maxAllowedMonths,
    pixModalOpen: effectiveModalOpen,
    setPixModalOpen: handleModalOpenChange,
    copiedKey,
    pixData: effectivePixData,
    pricing,
    newPeriodEndFormatted,
    isPending: checkoutMutation.isPending,
    handleSelectMonths,
    handleGeneratePix,
    handleCopyPix,
  };
}
