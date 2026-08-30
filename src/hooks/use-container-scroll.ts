import { useEffect, useState, useRef } from "react";

export interface UseContainerScrollOptions {
  /** ID do contêiner de rolagem a monitorar (padrão: "main-content"). */
  containerId?: string;
  /** Limiar de rolagem em pixels para considerar a página rolada (padrão: 15px). */
  scrolledThreshold?: number;
  /** Limiar de rolagem em pixels para exibir o botão Voltar ao Topo (padrão: 400px). */
  backToTopThreshold?: number;
}

export interface UseContainerScrollResult {
  /** Verdadeiro se a rolagem passou do limiar do cabeçalho. */
  isScrolled: boolean;
  /** Verdadeiro se a rolagem passou do limiar para exibir o botão de retorno ao topo. */
  showBackToTop: boolean;
}

/**
 * Hook cirúrgico de monitoramento de rolagem para contêineres internos (como o #main-content do PageShell).
 * Utiliza requestAnimationFrame e SÓ dispara atualizações de estado quando os limiares booleanos
 * (isScrolled ou showBackToTop) realmente mudam de valor, garantindo zero re-renderizações durante
 * o fluxo contínuo de rolagem (120fps nativo da GPU).
 */
export function useContainerScroll({
  containerId = "main-content",
  scrolledThreshold = 15,
  backToTopThreshold = 400,
}: UseContainerScrollOptions = {}): UseContainerScrollResult {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  const isScrolledRef = useRef<boolean>(false);
  const showBackToTopRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const checkScroll = () => {
      const scrollTop = container.scrollTop;

      const nextIsScrolled = scrollTop > scrolledThreshold;
      const nextShowBackToTop = scrollTop > backToTopThreshold;

      if (nextIsScrolled !== isScrolledRef.current) {
        isScrolledRef.current = nextIsScrolled;
        setIsScrolled(nextIsScrolled);
      }

      if (nextShowBackToTop !== showBackToTopRef.current) {
        showBackToTopRef.current = nextShowBackToTop;
        setShowBackToTop(nextShowBackToTop);
      }
    };

    const handleScroll = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(checkScroll);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    // Verificação inicial
    checkScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [containerId, scrolledThreshold, backToTopThreshold]);

  return {
    isScrolled,
    showBackToTop,
  };
}
