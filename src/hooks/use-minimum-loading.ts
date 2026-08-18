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
  // `phase`: "idle" | "loading" | "closing" | "done"
  const [phase, setPhase] = useState<"idle" | "loading" | "closing" | "done">(
    isLoading ? "loading" : "idle",
  );
  const [prevLoading, setPrevLoading] = useState(isLoading);
  const loadingStartRef = useRef<number>(0);

  // Derivação de estado durante o render (padrão oficial React)
  if (isLoading !== prevLoading) {
    setPrevLoading(isLoading);
    if (isLoading) {
      setPhase("loading");
    }
  }

  useEffect(() => {
    if (isLoading) {
      loadingStartRef.current = Date.now();
      return;
    }

    if (loadingStartRef.current === 0) {
      // Nunca chegou a carregar — encerra imediatamente
      const t = setTimeout(() => setPhase("done"), 0);
      return () => clearTimeout(t);
    }

    const elapsed = Date.now() - loadingStartRef.current;
    const remaining = Math.max(0, minDurationMs - elapsed);

    // Fase de fechamento: aguarda o tempo mínimo antes de desmontar
    const closing = setTimeout(() => setPhase("closing"), 0);
    const done = setTimeout(() => {
      setPhase("done");
      loadingStartRef.current = 0;
    }, remaining);

    return () => {
      clearTimeout(closing);
      clearTimeout(done);
    };
  }, [isLoading, minDurationMs]);

  const isShowing = phase === "loading" || phase === "closing";
  const isClosing = phase === "closing";

  return { isShowing, isClosing };
}
