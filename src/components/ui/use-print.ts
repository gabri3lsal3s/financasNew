import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { isNativePlatform, printCurrentWebView } from "@/services/native";
import { pushToast } from "@/services/toast";

/**
 * Hook de impressão seguro com suporte a nomenclatura dinâmica de PDF (F22).
 *
 * Estratégia de captura:
 *  - Web/PWA: `flushSync` monta `.print-sheet` e atualiza `document.title` de forma síncrona
 *    dentro do clique para preservar o user-gesture token do Safari/iOS antes de chamar `window.print()`,
 *    limpando via evento `afterprint` (ou fallback timer).
 *  - Android nativo (Capacitor): mantém `.print-sheet` montado por 2 frames (`requestAnimationFrame`)
 *    para pintura dos gráficos/QR e chama `printCurrentWebView`.
 */
export function usePrint(defaultDocumentTitle?: string) {
  const [printing, setPrinting] = useState(false);
  const [titleToUse, setTitleToUse] = useState<string | undefined>(defaultDocumentTitle);
  const webCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      webCleanupRef.current?.();
      webCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!printing || !isNativePlatform()) return;
    const originalTitle = typeof document !== "undefined" ? document.title : "";
    if (titleToUse && typeof document !== "undefined") {
      document.title = titleToUse;
    }

    // Fluxo Nativo Android (Capacitor): mantém `.print-sheet` montado até `PrintDocumentAdapter.onFinish()`
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const runNativePrint = async () => {
      try {
        const result = await printCurrentWebView(titleToUse);
        if (!result.success && !cancelled) {
          pushToast({
            title: "Não foi possível gerar o PDF",
            description:
              result.error ?? "Verifique se o serviço de impressão do Android está habilitado.",
            variant: "destructive",
          });
        }
      } finally {
        if (typeof document !== "undefined") {
          document.title = originalTitle;
        }
        if (!cancelled) {
          setPrinting(false);
        }
      }
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          void runNativePrint();
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (typeof document !== "undefined") {
        document.title = originalTitle;
      }
    };
  }, [printing, titleToUse]);

  const triggerPrint = useCallback(
    (customTitle?: string) => {
      const resolvedTitle = customTitle ?? defaultDocumentTitle;

      if (!isNativePlatform()) {
        webCleanupRef.current?.();
        webCleanupRef.current = null;

        const originalTitle = typeof document !== "undefined" ? document.title : "";
        if (resolvedTitle && typeof document !== "undefined") {
          document.title = resolvedTitle;
        }

        // Mantém sincronia dentro do evento de clique para Safari/iOS não bloquear window.print()
        flushSync(() => {
          setTitleToUse(resolvedTitle);
          setPrinting(true);
        });

        let cleaned = false;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          if (fallbackTimer !== null) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
          if (typeof window !== "undefined") {
            window.removeEventListener("afterprint", cleanup);
          }
          if (typeof document !== "undefined") {
            document.title = originalTitle;
          }
          setPrinting(false);
          if (webCleanupRef.current === cleanup) {
            webCleanupRef.current = null;
          }
        };

        webCleanupRef.current = cleanup;
        if (typeof window !== "undefined") {
          window.addEventListener("afterprint", cleanup, { once: true });
        }
        fallbackTimer = setTimeout(cleanup, 500);

        try {
          if (typeof window !== "undefined" && typeof window.print === "function") {
            window.print();
          }
        } catch {
          cleanup();
        }
        return;
      }

      if (resolvedTitle) {
        setTitleToUse(resolvedTitle);
      }
      setPrinting(true);
    },
    [defaultDocumentTitle],
  );

  return { printing, triggerPrint };
}
