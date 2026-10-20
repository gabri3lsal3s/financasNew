import { useEffect, useState } from "react";

/**
 * Hook para atrasar a propagação de um valor reativo até que um determinado intervalo
 * (delayMs) tenha decorrido sem alterações subsequentes.
 *
 * @param value Valor a ser debounceado.
 * @param delayMs Tempo de espera em milissegundos (padrão: 500ms).
 */
export function useDebounce<T>(value: T, delayMs: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
