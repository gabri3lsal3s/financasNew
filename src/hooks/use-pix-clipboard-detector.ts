import { useCallback, useEffect, useRef, useState } from "react";
import { canReadClipboardSilently, readClipboardText } from "@/services/clipboard";
import {
  parseClipboardTransactionCandidate,
  resolveMerchantIdentity,
  type ClipboardParsedCandidate,
  type ResolvedMerchantIdentity,
} from "@/domain/notifications";
import { useMerchantLearning } from "@/services/merchant-learning";

export interface DetectedPixTransaction {
  candidate: ClipboardParsedCandidate;
  identity: ResolvedMerchantIdentity;
  rawText: string;
}

export interface UsePixClipboardDetectorResult {
  detectedPix: DetectedPixTransaction | null;
  dismissDetectedPix: () => void;
  clearDetectedPix: () => void;
}

/**
 * Hook que monitora a área de transferência no foco da janela e retorno da tela (focus / visibilitychange)
 * e detecta exclusivamente códigos e chaves Pix que possuam valor monetário válido (> R$ 0,00).
 *
 * Chaves avulsas sem valor não ativam a sugestão para evitar poluição visual.
 */
export function usePixClipboardDetector(): UsePixClipboardDetectorResult {
  const merchantLearning = useMerchantLearning();
  const [detectedPix, setDetectedPix] = useState<DetectedPixTransaction | null>(null);
  const dismissedTextsRef = useRef<Set<string>>(new Set());

  const checkClipboard = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      // Bloqueio rigoroso contra popup/chip flutuante nativo do Chrome ([ Colar ]):
      // Só realiza leitura passiva/automática de fundo se o navegador possuir permissão explicitamente 'granted'.
      // Se estiver 'prompt' ou 'denied', aborta silenciosamente para não poluir a tela do usuário.
      const canRead = await canReadClipboardSilently();
      if (!canRead) {
        return;
      }

      const result = await readClipboardText();
      if (result.status !== "success" || !result.text) {
        return;
      }

      const text = result.text.trim();
      if (!text || dismissedTextsRef.current.has(text)) {
        return;
      }

      const candidate = parseClipboardTransactionCandidate(text);
      // REQUISITO ESTRITO: Apenas chaves/códigos Pix que contenham VALOR VÁLIDO (> 0 centavos)
      if (!candidate || candidate.valueCents <= 0) {
        return;
      }

      const identity = resolveMerchantIdentity({
        merchantOrDescription: candidate.recipientName || candidate.description,
        pixKey: candidate.pixKey,
        taxId: candidate.taxId,
        userMemory: merchantLearning.memory,
      });

      setDetectedPix({
        candidate,
        identity,
        rawText: text,
      });
    } catch {
      // Falhas de leitura passiva são silenciadas conforme governança
    }
  }, [merchantLearning.memory]);

  useEffect(() => {
    // Verificação passiva agendada no retorno / montagem
    const timer = setTimeout(() => {
      void checkClipboard();
    }, 150);

    const onFocus = () => {
      void checkClipboard();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkClipboard();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkClipboard]);

  const dismissDetectedPix = useCallback(() => {
    if (detectedPix) {
      dismissedTextsRef.current.add(detectedPix.rawText);
    }
    setDetectedPix(null);
  }, [detectedPix]);

  const clearDetectedPix = useCallback(() => {
    setDetectedPix(null);
  }, []);

  return {
    detectedPix,
    dismissDetectedPix,
    clearDetectedPix,
  };
}
