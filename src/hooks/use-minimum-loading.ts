import { useEffect, useRef, useState } from "react";

export interface UseMinimumLoadingResult {
  /** Se deve continuar exibindo o loading (inclui o período mínimo anti-flicker). */
  isShowing: boolean;
  /** `true` durante o período de espera mínima após o loading real terminar — use para correr ao 100%. */
  isClosing: boolean;
}

/**
 * Garante que estados de carregamento não pisquem rapidamente na tela (anti-flicker).
 * Quando `isLoading` é ativado, mantém a indicação visual de carregamento por um tempo
 * mínimo garantido (`minDurationMs`, padrão: 650ms), evitando micro-flashes e sensação de instabilidade.
 *
 * Retorna `isShowing` (equivalente ao booleano anterior) e `isClosing` que é `true` durante
 * a janela de espera residual — permita que a UI anime até 100% antes de desmontar.
 */
export function useMinimumLoading(
  isLoading: boolean,
  minDurationMs = 650,
): UseMinimumLoadingResult {
  const [delayedLoading, setDelayedLoading] = useState(isLoading);
  const [isClosing, setIsClosing] = useState(false);
  const [prevLoading, setPrevLoading] = useState(isLoading);
  const mountTimeRef = useRef<number>(0);

  // Ajuste de estado de transição durante o render (padrão oficial React para transições de props/args)
  if (isLoading !== prevLoading) {
    setPrevLoading(isLoading);
    if (isLoading) {
      setDelayedLoading(true);
      setIsClosing(false);
    }
  }

  useEffect(() => {
    if (isLoading) {
      mountTimeRef.current = Date.now();
      setIsClosing(false);
      return;
    }

    if (mountTimeRef.current === 0) {
      setDelayedLoading(false);
      setIsClosing(false);
      return;
    }

    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    // Sinaliza fase de fechamento imediatamente quando o loading real termina
    setIsClosing(true);

    const timer = setTimeout(() => {
      setDelayedLoading(false);
      setIsClosing(false);
      mountTimeRef.current = 0;
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoading, minDurationMs]);

  const isShowing = isLoading || delayedLoading;

  return { isShowing, isClosing: isShowing && isClosing };
}
