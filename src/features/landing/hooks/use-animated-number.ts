import { useEffect, useState, useRef } from "react";

export interface UseAnimatedNumberOptions {
  /** Duração da transição em milissegundos (padrão: 350ms). */
  duration?: number;
  /** Casas decimais a manter (padrão: 0). */
  decimals?: number;
}

/**
 * Hook que interpola suavemente um número de um valor anterior até um novo alvo usando requestAnimationFrame.
 * Respeita as configurações do sistema para `prefers-reduced-motion`.
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {},
): number {
  const { duration = 350, decimals = 0 } = options;
  const [displayValue, setDisplayValue] = useState(targetValue);
  const startValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion || duration <= 0) {
      startValueRef.current = targetValue;
      return;
    }

    const startVal = startValueRef.current;
    const diff = targetValue - startVal;

    if (Math.abs(diff) < 0.0001) {
      return;
    }

    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);

      // Curva de aceleração cúbica ease-out: 1 - pow(1 - progress, 3)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startVal + diff * easeOut;

      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(current * factor) / factor);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        startValueRef.current = targetValue;
        setDisplayValue(targetValue);
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [targetValue, duration, decimals, prefersReducedMotion]);

  if (prefersReducedMotion || duration <= 0) {
    return targetValue;
  }

  return displayValue;
}
