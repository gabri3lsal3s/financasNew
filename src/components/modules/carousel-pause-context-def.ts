import { createContext, useContext, useEffect } from "react";

export interface CarouselPauseContextValue {
  /** Verdadeiro quando há pelo menos 1 lock ativo ou pausa manual acionada. */
  isPaused: boolean;
  /** Verdadeiro quando o usuário acionou o botão de pausa manual. */
  manualPaused: boolean;
  /** Alterna pausa manual do carrossel. */
  toggleManualPause: () => void;
  /** Adquire um lock identificado por token único; retorna função de liberação idempotente. */
  acquireLock: (reason: string) => () => void;
  /** Contagem de locks ativos (útil para diagnóstico/testes). */
  activeLocksCount: number;
}

export const NOOP_RELEASE = () => {};

export const DEFAULT_PAUSE_CONTEXT: CarouselPauseContextValue = {
  isPaused: false,
  manualPaused: false,
  toggleManualPause: NOOP_RELEASE,
  acquireLock: () => NOOP_RELEASE,
  activeLocksCount: 0,
};

export const CarouselPauseContext = createContext<CarouselPauseContextValue>(DEFAULT_PAUSE_CONTEXT);

export function useCarouselPauseContext(): CarouselPauseContextValue {
  return useContext(CarouselPauseContext);
}

/**
 * Adquire um lock de pausa no `CarouselPauseContext` enquanto `active` for verdadeiro
 * e garante liberação limpa na desmontagem (sem liberar locks de outros controles).
 */
export function useCarouselPauseLock(active: boolean, reason: string): void {
  const { acquireLock } = useCarouselPauseContext();

  useEffect(() => {
    if (!active) return;
    const release = acquireLock(reason);
    return () => {
      release();
    };
  }, [active, reason, acquireLock]);
}
