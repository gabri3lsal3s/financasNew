import { useEffect, useState, useRef } from "react";

export interface UseScrollSpyOptions {
  /** Lista ordenada de IDs das seções a monitorar. */
  sectionIds?: string[];
  /** Offset vertical em pixels para considerar a seção ativa (padrão: 140px, cobrindo a altura do header). */
  offset?: number;
  /** Limite de rolagem em pixels para ativar a elevação do header (padrão: 20px). */
  scrolledThreshold?: number;
  /** Limite de rolagem em pixels para exibir o botão Voltar ao Topo (padrão: 600px). */
  backToTopThreshold?: number;
}

export interface UseScrollSpyResult {
  /** ID da seção atualmente ativa ou vazia caso no topo. */
  activeSection: string;
  /** Porcentagem de rolagem da página de 0 a 100. */
  scrollProgress: number;
  /** Verdadeiro se a rolagem passou do limiar do cabeçalho. */
  isScrolled: boolean;
  /** Verdadeiro se a rolagem passou do limiar para exibir o botão de retorno ao topo. */
  showBackToTop: boolean;
  /** Chave de reset incrementada toda vez que o usuário retorna ao topo após navegar pela página. */
  resetKey: number;
}

const DEFAULT_SECTIONS = ["recursos", "investimentos", "simulador", "precos", "faq"];

/**
 * Hook de monitoramento da rolagem com requestAnimationFrame.
 * Calcula a seção ativa para o menu, a porcentagem da barra de leitura,
 * a elevação do cabeçalho, a visibilidade do botão voltar ao topo e
 * a chave de reset inteligente para reativar animações ao retornar ao topo.
 */
export function useScrollSpy({
  sectionIds = DEFAULT_SECTIONS,
  offset = 140,
  scrolledThreshold = 20,
  backToTopThreshold = 600,
}: UseScrollSpyOptions = {}): UseScrollSpyResult {
  const [activeSection, setActiveSection] = useState<string>("");
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [resetKey, setResetKey] = useState<number>(0);

  const rafIdRef = useRef<number | null>(null);
  const hasScrolledDownRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const totalHeight =
          document.documentElement.scrollHeight - document.documentElement.clientHeight;

        // 1. Progresso da rolagem (0 a 100)
        const progress = totalHeight > 0 ? Math.min(100, Math.max(0, (scrollY / totalHeight) * 100)) : 0;
        setScrollProgress(progress);

        // 2. Estado de rolagem do header
        setIsScrolled(scrollY > scrolledThreshold);

        // 3. Estado de exibição do botão Voltar ao Topo
        setShowBackToTop(scrollY > backToTopThreshold);

        // 4. Detecção de retorno inteligente ao topo para reativar efeitos
        if (scrollY > 250) {
          hasScrolledDownRef.current = true;
        } else if (scrollY <= scrolledThreshold && hasScrolledDownRef.current) {
          hasScrolledDownRef.current = false;
          setResetKey((prev) => prev + 1);
        }

        // 5. Detecção da seção ativa
        let currentActive = "";
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (element) {
            const rect = element.getBoundingClientRect();
            // A seção é ativa se o topo dela já entrou na janela menos o offset
            // e o fundo dela ainda não passou totalmente do topo
            if (rect.top <= offset && rect.bottom > offset) {
              currentActive = id;
              break;
            }
          }
        }
        setActiveSection(currentActive);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Executa a primeira checagem para estado inicial
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [sectionIds, offset, scrolledThreshold, backToTopThreshold]);

  return {
    activeSection,
    scrollProgress,
    isScrolled,
    showBackToTop,
    resetKey,
  };
}
