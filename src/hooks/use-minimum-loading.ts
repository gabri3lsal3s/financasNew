import { useEffect, useRef, useState } from "react";

/**
 * Garante que estados de carregamento não pisquem rapidamente na tela (anti-flicker).
 * Quando `isLoading` é ativado, mantém a indicação visual de carregamento por um tempo
 * mínimo garantido (`minDurationMs`, padrão: 650ms), evitando micro-flashes e sensação de instabilidade.
 */
export function useMinimumLoading(isLoading: boolean, minDurationMs = 650): boolean {
  const [shouldShow, setShouldShow] = useState(isLoading);
  const mountTimeRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    if (isLoading) {
      setShouldShow(true);
      mountTimeRef.current = Date.now();
    } else {
      if (mountTimeRef.current === 0) {
        setShouldShow(false);
        return;
      }

      const elapsed = Date.now() - mountTimeRef.current;
      const remaining = Math.max(0, minDurationMs - elapsed);

      if (remaining === 0) {
        setShouldShow(false);
      } else {
        const timer = setTimeout(() => {
          setShouldShow(false);
        }, remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, minDurationMs]);

  return shouldShow;
}
