import { useEffect, useState } from "react";

/**
 * Posição de rolagem (F9 — Decisão D): expõe `true` quando `window.scrollY`
 * ultrapassa o limiar. Listener throttled com requestAnimationFrame (sem
 * setState síncrono no effect — o update roda dentro do rAF).
 */
export function useScrollPosition(threshold = 300): boolean {
  const [scrolled, setScrolled] = useState(() => {
    if (typeof window === "undefined") return false;
    const main = typeof document !== "undefined" ? document.querySelector("main") : null;
    const top = window.scrollY || (main ? main.scrollTop : 0);
    return top > threshold;
  });

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const main = document.querySelector("main");
        const top = window.scrollY || (main ? main.scrollTop : 0);
        setScrolled(top > threshold);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      cancelAnimationFrame(raf);
    };
  }, [threshold]);

  return scrolled;
}
