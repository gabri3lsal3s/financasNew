import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

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

const NOOP_RELEASE = () => {};

const DEFAULT_PAUSE_CONTEXT: CarouselPauseContextValue = {
  isPaused: false,
  manualPaused: false,
  toggleManualPause: NOOP_RELEASE,
  acquireLock: () => NOOP_RELEASE,
  activeLocksCount: 0,
};

const CarouselPauseContext = createContext<CarouselPauseContextValue>(DEFAULT_PAUSE_CONTEXT);

export function CarouselPauseProvider({ children }: { children: ReactNode }) {
  const locksRef = useRef<Map<symbol, string>>(new Map());
  const [activeLocksCount, setActiveLocksCount] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);

  const acquireLock = useCallback((reason: string) => {
    const token = Symbol(reason);
    locksRef.current.set(token, reason);
    setActiveLocksCount(locksRef.current.size);

    return () => {
      if (locksRef.current.delete(token)) {
        setActiveLocksCount(locksRef.current.size);
      }
    };
  }, []);

  const toggleManualPause = useCallback(() => {
    setManualPaused((prev) => !prev);
  }, []);

  // Pausa automaticamente quando a aba/app entra em background
  useEffect(() => {
    if (typeof document === "undefined") return;
    let releaseHidden: (() => void) | null = null;

    const syncVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (!releaseHidden) {
          releaseHidden = acquireLock("document-hidden");
        }
      } else if (releaseHidden) {
        releaseHidden();
        releaseHidden = null;
      }
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      if (releaseHidden) {
        releaseHidden();
        releaseHidden = null;
      }
    };
  }, [acquireLock]);

  const value = useMemo<CarouselPauseContextValue>(
    () => ({
      isPaused: activeLocksCount > 0 || manualPaused,
      manualPaused,
      toggleManualPause,
      acquireLock,
      activeLocksCount,
    }),
    [activeLocksCount, manualPaused, toggleManualPause, acquireLock],
  );

  return (
    <CarouselPauseContext.Provider value={value}>
      {children}
    </CarouselPauseContext.Provider>
  );
}

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
