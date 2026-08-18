import { useEffect, useRef, useState } from "react";

/**
 * Garante que estados de carregamento não pisquem rapidamente na tela (anti-flicker).
 * Quando `isLoading` é ativado, mantém a indicação visual de carregamento por um tempo
 * mínimo garantido (`minDurationMs`, padrão: 650ms), evitando micro-flashes e sensação de instabilidade.
 */
export function useMinimumLoading(isLoading: boolean, minDurationMs = 650): boolean {
  const [delayedLoading, setDelayedLoading] = useState(isLoading);
  const [prevLoading, setPrevLoading] = useState(isLoading);
  const mountTimeRef = useRef<number>(0);

  // Ajuste de estado de transição durante o render (padrão oficial React para transições de props/args)
  if (isLoading !== prevLoading) {
    setPrevLoading(isLoading);
    if (isLoading) {
      setDelayedLoading(true);
    }
  }

  useEffect(() => {
    if (isLoading) {
      mountTimeRef.current = Date.now();
      return;
    }

    if (mountTimeRef.current === 0) {
      setDelayedLoading(false);
      return;
    }

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    const timer = setTimeout(() => {
      setDelayedLoading(false);
      mountTimeRef.current = 0;
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoading, minDurationMs]);

  return isLoading || delayedLoading;
}
