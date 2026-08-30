import { useEffect, useState, useRef, type RefObject } from "react";

export interface UseInViewOptions {
  /** Percentual do elemento que deve estar visível para disparar (padrão: 0.15). */
  threshold?: number | number[];
  /** Margem ao redor do root/viewport para antecipar ou atrasar o disparo (padrão: "0px 0px -40px 0px"). */
  rootMargin?: string;
  /** Se verdadeiro, mantém o estado como visível após o primeiro disparo e desconecta o observer (padrão: true). */
  triggerOnce?: boolean;
  /** Chave de reset para reiniciar a observação (ex.: ao retornar ao topo da página). */
  resetKey?: number;
}

function checkReducedMotionOrNoObserver(): boolean {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
    return true;
  }
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Hook utilitário baseado em IntersectionObserver nativo.
 * Retorna uma ref para anexar ao elemento e um booleano `isInView`.
 * Suporta `resetKey` para reiniciar a detecção de visibilidade quando o usuário retorna ao topo.
 * Se `prefers-reduced-motion` estiver ativo ou se o navegador não suportar IntersectionObserver,
 * o estado inicial é imediatamente `true` para garantir exibição sem atrasos nem re-renderizações em cascata.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {},
): [RefObject<T | null>, boolean] {
  const {
    threshold = 0.15,
    rootMargin = "0px 0px -40px 0px",
    triggerOnce = true,
    resetKey,
  } = options;
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(checkReducedMotionOrNoObserver);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (
    resetKey !== undefined &&
    resetKey !== prevResetKey &&
    !checkReducedMotionOrNoObserver()
  ) {
    setPrevResetKey(resetKey);
    setIsInView(false);
  }

  useEffect(() => {
    if (checkReducedMotionOrNoObserver()) {
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setIsInView(true);
          if (triggerOnce) {
            if (obs) {
              obs.unobserve(element);
              obs.disconnect();
            } else {
              observer.unobserve(element);
              observer.disconnect();
            }
          }
        } else {
          // Se o elemento não está no viewport e o resetKey foi fornecido (ou triggerOnce=false),
          // garante que o estado volte para false para reanimar na próxima descida.
          if (!triggerOnce || resetKey !== undefined) {
            setIsInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, resetKey]);

  return [ref, isInView];
}
