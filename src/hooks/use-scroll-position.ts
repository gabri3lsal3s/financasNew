import { useEffect, useState } from "react";

/**
 * Posição de rolagem (F9 — Decisão D): expõe `true` quando `window.scrollY`
 * ultrapassa o limiar. Listener throttled com requestAnimationFrame (sem
 * setState síncrono no effect — o update roda dentro do rAF).
 */
export function useScrollPosition(threshold = 300): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > threshold));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(raf);
    };
  }, [threshold]);

  return scrolled;
}
