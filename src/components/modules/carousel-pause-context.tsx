import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CarouselPauseContext,
  type CarouselPauseContextValue,
} from "./carousel-pause-context-def";

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
