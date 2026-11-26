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
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element) => element !== null);
    const aliases = sectionIds === DEFAULT_SECTIONS ? SECTION_NAV_ALIAS : {};
    const activationLine = () => offset ?? (
      window.innerHeight > 400 ? Math.max(160, Math.min(340, Math.round(window.innerHeight * 0.35))) : 140
    );
    const setActive = (element?: HTMLElement) => {
      const id = element?.id ?? "";
      setActiveSection(aliases[id] ?? id);
    };

    let observer: IntersectionObserver | undefined;
    const observeSections = () => {
      if (typeof IntersectionObserver === "undefined") return;

      observer?.disconnect();
      const visible = new Set<Element>();
      const top = Math.max(0, Math.min(activationLine(), window.innerHeight - 1));
      const bottom = window.innerHeight - top - 1;

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setActive(sections.find((section) => visible.has(section)));
      }, { rootMargin: `-${top}px 0px -${bottom}px 0px` });
      sections.forEach((section) => observer?.observe(section));
    };

    const documentRoot = document.documentElement;
    const getScrollRange = () => documentRoot.scrollHeight - documentRoot.clientHeight;
    let scrollRange = getScrollRange();
    const handleScroll = () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const scrollY = window.scrollY || documentRoot.scrollTop || 0;
        const range = resizeObserver ? scrollRange : getScrollRange();
        setScrollProgress(range > 0 ? Math.min(100, Math.max(0, Math.round(scrollY / range * 100))) : 0);
        setIsScrolled(scrollY > scrolledThreshold);
        setShowBackToTop(scrollY > backToTopThreshold);

        if (scrollY > 250) {
          hasScrolledDownRef.current = true;
        } else if (scrollY <= scrolledThreshold && hasScrolledDownRef.current) {
          hasScrolledDownRef.current = false;
          setResetKey((prev) => prev + 1);
        }

        if (!observer) {
          const line = activationLine();
          setActive(sections.find((section) => {
            const { top, bottom } = section.getBoundingClientRect();
            return top <= line && bottom > line;
          }));
        }
      });
    };

    const refreshProgress = () => {
      scrollRange = getScrollRange();
      handleScroll();
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(refreshProgress);
    resizeObserver?.observe(document.body);

    const handleResize = () => {
      observeSections();
      refreshProgress();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
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
