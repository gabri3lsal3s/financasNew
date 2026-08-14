import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getVisualCustomization } from "@/hooks/use-visual-customization";

export interface NumberTickerProps {
  /** Valor numérico alvo (centavos, percentuais, …). */
  value: number;
  /** Formata o valor para exibição (default: inteiro). */
  format?: (value: number) => string;
  /** Duração da interpolação em ms (default 300). */
  durationMs?: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * NumberTicker (F8 — Decisão 1): transição animada de valores (KPIs) ao trocar
 * mês/filtro. Interpolação suave (~300ms, ease-out cubic) via
 * requestAnimationFrame, mantendo `.num` (mono + tabular). Com
 * `prefers-reduced-motion` o valor é renderizado diretamente (sem setState
 * síncrono em effect — compatível com o lint React Compiler).
 */
export function NumberTicker({
  value,
  format = (v) => String(v),
  durationMs = 300,
  className,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  // F11: o toggle "Contagem Numérica Animada" (numberTickerEnabled) desliga a
  // interpolação — o valor é renderizado direto, como no prefers-reduced-motion.
  const tickerEnabled = getVisualCustomization().numberTickerEnabled;
  const reduceMotion = prefersReducedMotion() || !tickerEnabled;

  useEffect(() => {
    const from = displayRef.current;
    const to = value;
    // Reduced motion ou valor inalterado: o render já exibe `value`.
    if (reduceMotion || from === to) return;

    let start: number | null = null;
    let raf = 0;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / durationMs);
      // ease-out cúbico — começa rápido, desacelera no fim.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduceMotion]);

  const shown = reduceMotion ? value : display;

  return <span className={cn("num", className)}>{format(shown)}</span>;
}
