import { useEffect } from "react";
import { useSearchParams } from "react-router";

/** Tempo de destaque visual antes de limpar o parâmetro (ms). */
export const HIGHLIGHT_DURATION_MS = 2600;

/**
 * Destaque de registro vindo de deep-link (busca global §3.9): o id
 * destacado é DERIVADO do parâmetro (`q` por padrão) — sem estado local.
 * O parâmetro é removido da URL após `HIGHLIGHT_DURATION_MS` (replace, sem
 * sujar o histórico); ao sumir, o destaque desaparece automaticamente.
 */
export function useHighlightTarget(param = "q"): {
  highlightId: string | null;
  isHighlighted: (id: string) => boolean;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get(param);

  useEffect(() => {
    if (!highlightId) return undefined;
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(param);
          return next;
        },
        { replace: true },
      );
    }, HIGHLIGHT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId, param, setSearchParams]);

  return { highlightId, isHighlighted: (id: string) => id === highlightId };
}
