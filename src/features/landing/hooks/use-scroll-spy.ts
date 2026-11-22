import { useEffect, useState, useRef } from "react";

export interface UseScrollSpyOptions {
  /** Lista ordenada de IDs das seções a monitorar. */
  sectionIds?: string[];
  /** Offset vertical em pixels para considerar a seção ativa (quando omitido, adapta-se à altura da janela). */
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

const DEFAULT_SECTIONS = [
  "ecossistema",
  "dores",
  "profundidade",
  "simulador",
  "ferramentas",
  "precos",
  "plataformas",
  "faq",
];

/**
 * Mapeia seções complementares para o item correspondente na barra de navegação principal,
 * eliminando zonas mortas entre Simulador (#simulador + #ferramentas) e Planos (#precos + #plataformas).
 */
const SECTION_NAV_ALIAS: Record<string, string> = {
  ferramentas: "simulador",
  plataformas: "precos",
};

/**
 * Hook de monitoramento da rolagem com requestAnimationFrame.
 * Calcula a seção ativa para o menu, a porcentagem da barra de leitura,
 * a elevação do cabeçalho, a visibilidade do botão voltar ao topo e
 * a chave de reset inteligente para reativar animações ao retornar ao topo.
 */
export function useScrollSpy({
  sectionIds = DEFAULT_SECTIONS,
  offset,
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

    const isDefaultSections = sectionIds === DEFAULT_SECTIONS;

    const handleScroll = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const totalHeight =
          document.documentElement.scrollHeight - document.documentElement.clientHeight;

        // 1. Progresso da rolagem em porcentagem inteira (0 a 100)
        const progress =
          totalHeight > 0
            ? Math.min(100, Math.max(0, Math.round((scrollY / totalHeight) * 100)))
            : 0;
        setScrollProgress((prev) => (prev === progress ? prev : progress));

        // 2. Estado de rolagem do header
        const nextIsScrolled = scrollY > scrolledThreshold;
        setIsScrolled((prev) => (prev === nextIsScrolled ? prev : nextIsScrolled));

        // 3. Estado de exibição do botão Voltar ao Topo
        const nextShowBackToTop = scrollY > backToTopThreshold;
        setShowBackToTop((prev) => (prev === nextShowBackToTop ? prev : nextShowBackToTop));

        // 4. Detecção de retorno inteligente ao topo para reativar efeitos
        if (scrollY > 250) {
          hasScrolledDownRef.current = true;
        } else if (scrollY <= scrolledThreshold && hasScrolledDownRef.current) {
          hasScrolledDownRef.current = false;
          setResetKey((prev) => prev + 1);
        }

        // 5. Detecção da seção ativa com linha de ativação confortável ( ~35% da viewport quando padrão )
        const effectiveOffset =
          offset !== undefined
            ? offset
            : window.innerHeight > 400
              ? Math.max(160, Math.min(340, Math.round(window.innerHeight * 0.35)))
              : 140;

        let currentActive = "";
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= effectiveOffset && rect.bottom > effectiveOffset) {
              currentActive = isDefaultSections ? (SECTION_NAV_ALIAS[id] ?? id) : id;
              break;
            }
          }
        }
        setActiveSection((prev) => (prev === currentActive ? prev : currentActive));
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
