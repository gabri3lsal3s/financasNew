import { useState, useEffect, useCallback } from "react";
import { isNativePlatform, printCurrentWebView } from "@/services/native";
import { pushToast } from "@/services/toast";

/**
 * Hook de impressão seguro com suporte a nomenclatura dinâmica de PDF (F22).
 *
 * Estratégia de captura:
 *  1. `setPrinting(true)` + `document.title` temporário com o nome sugerido para o arquivo PDF;
 *  2. `useEffect` dispara após o commit no DOM;
 *  3. `requestAnimationFrame` aguarda o próximo frame de pintura do browser (dois frames no
 *     Android nativo para garantir a pintura dos `<canvas>` do QR Code antes do adapter);
 *  4. Web/PWA chama `window.print()`; APK Android invoca `PrintManager` via `printCurrentWebView`;
 *  5. Restauração automática do `document.title` original e limpeza do portal ao finalizar.
 */
export function usePrint(defaultDocumentTitle?: string) {
  const [printing, setPrinting] = useState(false);
  const [titleToUse, setTitleToUse] = useState<string | undefined>(defaultDocumentTitle);

  useEffect(() => {
    if (!printing) return;
    const originalTitle = typeof document !== "undefined" ? document.title : "";
    if (titleToUse && typeof document !== "undefined") {
      document.title = titleToUse;
    }

    if (!isNativePlatform()) {
      const rafId = requestAnimationFrame(() => {
        if (typeof window !== "undefined" && typeof window.print === "function") {
          window.print();
        }
        if (typeof document !== "undefined") {
          document.title = originalTitle;
        }
        setPrinting(false);
      });

      return () => {
        cancelAnimationFrame(rafId);
        if (typeof document !== "undefined") {
          document.title = originalTitle;
        }
      };
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
      if (customTitle) {
        setTitleToUse(customTitle);
      } else if (defaultDocumentTitle) {
        setTitleToUse(defaultDocumentTitle);
      }
      setPrinting(true);
    },
    [defaultDocumentTitle],
  );

  return { printing, triggerPrint };
}
