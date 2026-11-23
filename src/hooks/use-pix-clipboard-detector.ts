import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { App } from "@capacitor/app";
import {
  parseClipboardTransactionCandidate,
  resolveMerchantIdentity,
} from "@/domain/notifications";
import { canReadClipboardSilently, readClipboardText } from "@/services/clipboard";
import { useMerchantLearning } from "@/services/merchant-learning";
import { isNativePlatform } from "@/services/native";
import {
  canTriggerNativeClipboardCheck,
  consumeCurrentDetectedPix,
  dismissCurrentDetectedPix,
  getDetectedPixSnapshot,
  isClipboardTextDismissed,
  NATIVE_CLIPBOARD_COOLDOWN_MS,
  recordNativeClipboardCheck,
  setDetectedPixState,
  subscribeDetectedPix,
  type DetectedPixTransaction,
} from "@/services/pix-clipboard-store";

export type { DetectedPixTransaction };

export interface UsePixClipboardDetectorResult {
  detectedPix: DetectedPixTransaction | null;
  dismissDetectedPix: () => void;
  clearDetectedPix: () => void;
}

/**
 * Monitora passivamente a área de transferência para sugerir Pix Copia e Cola (`PIX_BRCODE`
 * com ou sem Tag 54):
 * - Web/PWA: lê somente quando `canReadClipboardSilently()` for true (evita popup de permissão).
 * - Android nativo: usa `App.addListener("appStateChange")` com cooldown mínimo de 10s
 *   (nunca usa `window.focus`, eliminando spam de toast do Android 12+).
 * - Deduplicação persistente síncrona via FNV-1a 32-bit em `user-storage` (24h).
 */
export function usePixClipboardDetector(): UsePixClipboardDetectorResult {
  const merchantLearning = useMerchantLearning();
  const memoryRef = useRef(merchantLearning.memory);
  useEffect(() => {
    memoryRef.current = merchantLearning.memory;
  }, [merchantLearning.memory]);

  const detectedPix = useSyncExternalStore(
    subscribeDetectedPix,
    getDetectedPixSnapshot,
    () => null,
  );

  const checkClipboard = useCallback(async () => {
    try {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      if (isNativePlatform()) {
        if (!canTriggerNativeClipboardCheck(NATIVE_CLIPBOARD_COOLDOWN_MS)) {
          return;
        }
        recordNativeClipboardCheck();
      } else {
        const canRead = await canReadClipboardSilently();
        if (!canRead) {
          return;
        }
      }

      const result = await readClipboardText();
      if (result.status !== "success" || !result.text) {
        return;
      }

      const text = result.text.trim();
      if (!text || isClipboardTextDismissed(text)) {
        return;
      }

      const candidate = parseClipboardTransactionCandidate(text);
      // Detector passivo estrito na Home: aceita EXCLUSIVAMENTE PIX_BRCODE (com ou sem Tag 54)
      if (!candidate || candidate.kind !== "PIX_BRCODE") {
        return;
      }

      const identity = resolveMerchantIdentity({
        merchantOrDescription: candidate.recipientName || candidate.description,
        pixKey: candidate.pixKey,
        taxId: candidate.taxId,
        userMemory: memoryRef.current,
      });

      setDetectedPixState({
        candidate,
        identity,
        rawText: text,
      });
    } catch {
      // Falhas silenciosas em leitura passiva por governança
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkClipboard();
    }, 150);

    if (isNativePlatform()) {
      let cancelled = false;
      const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && !cancelled) {
          void checkClipboard();
        }
      });

      return () => {
        cancelled = true;
        clearTimeout(timer);
        void listenerPromise.then((handle) => handle.remove()).catch(() => undefined);
      };
    }

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
    dismissCurrentDetectedPix();
  }, []);

  const clearDetectedPix = useCallback(() => {
    consumeCurrentDetectedPix();
  }, []);

  return {
    detectedPix,
    dismissDetectedPix,
    clearDetectedPix,
  };
}
