import { useState, useEffect } from "react";

/**
 * Hook de impressão seguro (F22).
 *
 * Substitui o padrão `setPrinting(true) + setTimeout(window.print, 100ms)` que
 * causava PDFs vazios: o timeout disparava antes de o portal `.print-sheet`
 * ser commitado no DOM pelo React.
 *
 * Estratégia correta:
 *  1. `setPrinting(true)` → React agenda re-render com o `<PrintSheet>`
 *  2. `useEffect` dispara **após** o commit no DOM
 *  3. `requestAnimationFrame` aguarda o próximo frame de pintura do browser,
 *     garantindo que o portal está inserido e visível antes da captura
 *  4. `window.print()` → captura real do conteúdo
 *  5. `setPrinting(false)` → desmonta o portal após a impressão
 */
export function usePrint() {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const rafId = requestAnimationFrame(() => {
      if (typeof window !== "undefined" && typeof window.print === "function") {
        window.print();
      }
      setPrinting(false);
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [printing]);

  const triggerPrint = () => {
    setPrinting(true);
  };

  return { printing, triggerPrint };
}
