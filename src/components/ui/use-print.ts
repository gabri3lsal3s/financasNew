import { useState, useEffect, useCallback } from "react";

/**
 * Hook de impressão seguro com suporte a nomenclatura dinâmica de PDF (F22).
 *
 * Estratégia de captura:
 *  1. `setPrinting(true)` + `document.title` temporário com o nome sugerido para o arquivo PDF;
 *  2. `useEffect` dispara após o commit no DOM;
 *  3. `requestAnimationFrame` aguarda o próximo frame de pintura do browser;
 *  4. `window.print()` abre o diálogo nativo com o nome de arquivo contextual;
 *  5. Restauração automática do `document.title` original e limpeza do portal.
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
  }, [printing, titleToUse]);

  const triggerPrint = useCallback((customTitle?: string) => {
    if (customTitle) {
      setTitleToUse(customTitle);
    } else if (defaultDocumentTitle) {
      setTitleToUse(defaultDocumentTitle);
    }
    setPrinting(true);
  }, [defaultDocumentTitle]);

  return { printing, triggerPrint };
}

