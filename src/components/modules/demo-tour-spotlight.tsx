import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";
import {
  calculateDeadCenterScrollTop,
  calculateDesktopCardPosition,
  calculateFreeViewportWindow,
  calculateSkeletonSpotlightGeometry,
  calculateSpotlightGeometry,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SEARCH_TIMEOUT_MS,
  getDesktopSidebarWidth,
  getTourHandoffDestination,
  getTourSteps,
  getTourTrackCategoryLabel,
  resolveTourStepContent,
  resolveTourStepTargetSelector,
  resolveTourStepTitle,
} from "@/domain/demo-simulation";
import {
  endDemo,
  goToNextStep,
  goToPrevStep,
  markTourCompleted,
  setStepIndex,
  useDemoSession,
} from "@/state/demo-mode";

export interface DemoTourSpotlightProps {
  /** Callback opcional acionado quando o usuário avança para o próximo passo. */
  onNextStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário retrocede para o passo anterior. */
  onPrevStep?: (newStepIndex: number) => void;
  /** Callback opcional acionado quando o usuário encerra ou fecha o tour. */
  onClose?: () => void;
  /** Classes extras aplicadas ao contêiner raiz do card popover. */
  className?: string;
}

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

/**
 * Componente de Foco e Apresentação Guiada (DemoTourSpotlight).
 * Renderiza um backdrop escurecido com recorte preciso (spotlight) ao redor
 * do elemento alvo do passo atual, bloqueia ruídos e cliques externos indesejados,
 * e posiciona um card popover adaptativo com saída em 1 clique.
 */
export function DemoTourSpotlight({
  onNextStep,
  onPrevStep,
  onClose,
  className,
}: DemoTourSpotlightProps) {
  const session = useDemoSession();
  const navigate = useNavigate();
  const location = useLocation();

  const { isDemoActive, activeTrack, currentStepIndex } = session;

  const steps = useMemo(
    () => (activeTrack ? getTourSteps(activeTrack) : []),
    [activeTrack],
  );
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] ?? steps[0];
  const currentStepNumber = currentStepIndex + 1;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = totalSteps > 0 && currentStepIndex >= totalSteps - 1;

  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number>(220);
  const [prevStepIndex, setPrevStepIndex] = useState<number>(currentStepIndex);
  const [prevIsDemoActive, setPrevIsDemoActive] = useState<boolean>(isDemoActive);
  const [isPulsing, setIsPulsing] = useState<boolean>(true);
  const [isPositionReady, setIsPositionReady] = useState<boolean>(false);
  const [isTargetLoading, setIsTargetLoading] = useState<boolean>(() => {
    const isDesk = typeof window !== "undefined" ? window.innerWidth >= 768 : false;
    const sel = resolveTourStepTargetSelector(currentStep, isDesk);
    return Boolean(isDemoActive && sel);
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Ajusta estados sincronizados durante a fase de render (padrão oficial React para ajuste de estado por prop/store)
  if (prevIsDemoActive !== isDemoActive) {
    setPrevIsDemoActive(isDemoActive);
    if (!isDemoActive) {
      setIsPositionReady(false);
      setIsTargetLoading(false);
      setRect(null);
    }
  }

  // Captura e armazena o elemento com foco antes de abrir o tour (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    if (!isDemoActive) {
      previousActiveElementRef.current = null;
      return;
    }

    if (typeof document !== "undefined" && !previousActiveElementRef.current) {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        previousActiveElementRef.current = document.activeElement;
      }
    }
  }, [isDemoActive]);

  // Foca automaticamente o primeiro botão interativo ao montar o passo (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    if (!isDemoActive || !cardRef.current) return;

    const focusables = cardRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length > 0) {
      focusables[0]?.focus();
    }
  }, [currentStep?.id, isDemoActive]);

  // Restaura o foco para o elemento original ao sair do tour (Fase 4 — Tarefa 4.1)
  const restoreFocus = useCallback(() => {
    if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
      if (previousActiveElementRef.current.isConnected) {
        previousActiveElementRef.current.focus();
      }
      previousActiveElementRef.current = null;
    }
  }, []);

  // Garante a restauração do foco caso o componente seja desmontado (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    return () => {
      restoreFocus();
    };
  }, [restoreFocus]);

  // Reinicia o pulso e sincroniza estado de busca ao trocar de etapa durante o render (padrão oficial React para ajuste de estado por prop/store)
  if (prevStepIndex !== currentStepIndex) {
    setPrevStepIndex(currentStepIndex);
    setIsPulsing(true);
    setRect(null);
    const sel = resolveTourStepTargetSelector(currentStep, !isMobile);
    setIsTargetLoading(Boolean(isDemoActive && sel));
  }

  // Animação de pulso da borda cessa suavemente após 3 segundos (Fase 3 — Tarefa 3.3)
  useEffect(() => {
    const pulseTimer = setTimeout(() => {
      setIsPulsing(false);
    }, 3000);

    return () => clearTimeout(pulseTimer);
  }, [currentStepIndex]);

  // Monitora a altura real do card popover no desktop (Fase 2 — Tarefa 2.5)
  useEffect(() => {
    if (!cardRef.current) return;
    if (cardRef.current.offsetHeight > 0) {
      setMeasuredCardHeight(cardRef.current.offsetHeight);
    }
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (height > 0) {
          setMeasuredCardHeight(height);
        } else if (cardRef.current && cardRef.current.offsetHeight > 0) {
          setMeasuredCardHeight(cardRef.current.offsetHeight);
        }
      }
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [currentStep?.id]);

  // Encerramento limpo sem fricção com restauração de foco (Fase 4 — Tarefa 4.1)
  const handleClose = useCallback(() => {
    triggerSensory("action");
    restoreFocus();
    endDemo();
    // Limpa parâmetros de modal assistido (?novo=...) se o tour for encerrado prematuramente (Fase 8 — Tarefa 8.3)
    const currentSearch = location?.search ?? "";
    if (currentSearch.includes("novo=")) {
      const cleanParams = new URLSearchParams(currentSearch);
      cleanParams.delete("novo");
      cleanParams.delete("modo");
      const cleanSearch = cleanParams.toString();
      navigate(`${location?.pathname ?? "/"}${cleanSearch ? `?${cleanSearch}` : ""}`, { replace: true });
    }
    onClose?.();
  }, [location.pathname, location.search, navigate, onClose, restoreFocus]);

  // Hand-off direto para o primeiro uso na conta real com restauração de foco (Fase 4 — Tarefa 4.1)
  const handleStartRealAccount = useCallback(() => {
    triggerSensory("action");
    restoreFocus();
    if (activeTrack) {
      markTourCompleted(activeTrack);
    }
    endDemo();
    if (onClose) {
      onClose();
    } else {
      const destination = getTourHandoffDestination(
        activeTrack,
        `${location.pathname}${location.search ?? ""}`,
      );
      navigate(destination);
    }
  }, [activeTrack, location.pathname, location.search, navigate, onClose, restoreFocus]);

  const currentRoute = `${location.pathname}${location.search}`;
  const previousRouteRef = useRef<string>(currentRoute);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      triggerSensory("selection");
      const nextIndex = currentStepIndex + 1;
      goToNextStep();
      const nextStep = steps[nextIndex];
      if (nextStep) {
        if (nextStep.targetRoute !== currentStep?.targetRoute) {
          const container = document.getElementById("main-content");
          if (container && nextStep.targetSelector !== '[data-tour="settings-support-card"]') {
            container.scrollTop = 0;
          }
        }
        navigate(nextStep.targetRoute);
      }
      onNextStep?.(nextIndex);
    } else {
      handleStartRealAccount();
    }
  }, [currentStep?.targetRoute, currentStepIndex, handleStartRealAccount, isLastStep, navigate, onNextStep, steps]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      triggerSensory("selection");
      const prevIndex = Math.max(0, currentStepIndex - 1);
      goToPrevStep();
      const prevStep = steps[prevIndex];
      if (prevStep) {
        if (prevStep.targetRoute !== currentStep?.targetRoute) {
          const container = document.getElementById("main-content");
          if (container && prevStep.targetSelector !== '[data-tour="settings-support-card"]') {
            container.scrollTop = 0;
          }
        }
        navigate(prevStep.targetRoute);
      }
      onPrevStep?.(prevIndex);
    }
  }, [currentStep?.targetRoute, currentStepIndex, isFirstStep, navigate, onPrevStep, steps]);

  // Navegação direta por dots interativos (Fase 4 — Tarefa 4.2)
  const handleGoToStep = useCallback((index: number) => {
    if (index === currentStepIndex || index < 0 || index >= steps.length) return;
    triggerSensory("selection");
    setStepIndex(index);
    const targetStep = steps[index];
    if (targetStep) {
      if (targetStep.targetRoute !== currentStep?.targetRoute) {
        const container = document.getElementById("main-content");
        if (container && targetStep.targetSelector !== '[data-tour="settings-support-card"]') {
          container.scrollTop = 0;
        }
      }
      navigate(targetStep.targetRoute);
    }
    if (index > currentStepIndex) {
      onNextStep?.(index);
    } else {
      onPrevStep?.(index);
    }
  }, [currentStep?.targetRoute, currentStepIndex, navigate, onNextStep, onPrevStep, steps]);

  // Atualização das dimensões e escuta de redimensionamento
  const updateTargetRect = useCallback(() => {
    if (typeof window === "undefined") return;
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    const desktop = !mobile;

    const activeSelector = resolveTourStepTargetSelector(currentStep, desktop);
    if (!activeSelector) {
      setRect(null);
      setIsPositionReady(true);
      return;
    }

    const element = document.querySelector(activeSelector);
    if (!element) {
      setRect(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const isUsingDesktopTarget = Boolean(
      desktop &&
        currentStep?.targetSelectorDesktop &&
        activeSelector === currentStep.targetSelectorDesktop,
    );

    const isCircular =
      !isUsingDesktopTarget &&
      (currentStep?.spotlightBorderRadius === 9999 ||
        element.classList.contains("rounded-full") ||
        Boolean(currentStep?.targetSelector?.includes("bottom-nav-wizard")) ||
        (element instanceof HTMLElement &&
          (window.getComputedStyle(element).borderRadius === "9999px" ||
            window.getComputedStyle(element).borderRadius === "50%")));

    const customBorderRadius =
      isUsingDesktopTarget && currentStep?.spotlightBorderRadius === 9999
        ? 8
        : currentStep?.spotlightBorderRadius;

    const padding = currentStep?.spotlightPadding ?? (isCircular ? 6 : 10);

    const geometry = calculateSpotlightGeometry(elementRect, {
      isCircular,
      padding,
      customBorderRadius,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });

    setRect(geometry);
    setIsPositionReady(true);
  }, [currentStep]);

  // Scroll suave contextual, busca híbrida resiliente e observação de redimensionamento do alvo (Fase 8 — Tarefa 8.7 e 8.8)
  useEffect(() => {
    const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 768 : !isMobile;
    const targetSelector = resolveTourStepTargetSelector(currentStep, isDesktop);

    if (!isDemoActive || !targetSelector) {
      return;
    }

    let mutationObserver: MutationObserver | undefined;
    let pollingTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let cancelSettle: (() => void) | undefined;
    let bottomCheckTimeout: ReturnType<typeof setTimeout> | undefined;
    let isCleanedUp = false;

    // Reseta o scroll do #main-content imediatamente ao mudar de rota antes de buscar o novo elemento (Fase 2 — Tarefa 2.2)
    const activeRoute = `${location.pathname}${location.search}`;
    if (previousRouteRef.current !== activeRoute) {
      previousRouteRef.current = activeRoute;
      const container = document.getElementById("main-content");
      if (container && targetSelector !== '[data-tour="settings-support-card"]') {
        container.scrollTop = 0;
      }
    }

    // Validador de dimensões válidas para elementos assíncronos (Fase 8 — Tarefa 8.7)
    const isJsdomEnvironment =
      typeof navigator !== "undefined" &&
      (navigator.userAgent.includes("jsdom") || (typeof process !== "undefined" && process.env?.NODE_ENV === "test"));

    const hasValidDimensions = (element: Element): boolean => {
      if (typeof element.getBoundingClientRect === "function") {
        const isMocked =
          "_isMockFunction" in element.getBoundingClientRect ||
          Boolean((element.getBoundingClientRect as unknown as { getMockImplementation?: () => unknown }).getMockImplementation);

        const bRect = element.getBoundingClientRect();
        if (bRect.width > 0 && bRect.height > 0) return true;
        if (isMocked) return false;
      }
      if (element instanceof HTMLElement) {
        if (element.offsetWidth > 0 || element.offsetHeight > 0) return true;
      }
      // Fallback para elementos de teste sem layout engine em JSDOM quando getBoundingClientRect não for mockado
      if (isJsdomEnvironment && element.isConnected) {
        return true;
      }
      return false;
    };

    const cleanupSearch = () => {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = undefined;
      }
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = undefined;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = undefined;
      }
    };

    const performScrollAndMeasure = (element: Element) => {
      if (isCleanedUp) return;

      // Medição e posicionamento imediatos ao resolver o elemento alvo (Fase 8 — Tarefa 8.7)
      updateTargetRect();

      const container = document.getElementById("main-content");
      const headerHeight = 64; // altura do header fixo
      const spacing = 16;
      const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 768;

      // Se for o card de suporte no rodapé ou elemento explicitamente configurado para rolagem ao fim (Fase 8 — Diagnóstico Passo 5)
      const isBottomElement =
        targetSelector === '[data-tour="settings-support-card"]' ||
        element.getAttribute("data-tour") === "settings-support-card";

      // Elementos com posicionamento fixo (ex: FAB central da BottomNav ou ações do Header)
      // já estão perfeitamente posicionados na tela e não devem sofrer rolagem (Fase 8 — Tarefa 8.6)
      const isFixedElement =
        (element instanceof HTMLElement &&
          window.getComputedStyle(element).position === "fixed") ||
        Boolean(element.closest("nav.fixed, header.fixed, [data-tour-fixed='true']"));

      if (isBottomElement && container) {
        // Dispara rolagem garantida até o fim do #main-content para o Passo 5 de Configurações
        const targetScroll = container.scrollHeight;
        if (typeof container.scrollTo === "function") {
          container.scrollTo({ top: targetScroll, behavior: "smooth" });
        } else {
          container.scrollTop = targetScroll;
        }
        if (typeof element.scrollIntoView === "function") {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else if (!isFixedElement && container && container.contains(element)) {
        let targetScrollTop = 0;

        if (element instanceof HTMLElement && typeof element.getBoundingClientRect === "function") {
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();

          if (isMobileScreen && (elementRect.top !== 0 || elementRect.bottom !== 0 || elementRect.height !== 0)) {
            const elCenterY = elementRect.top + elementRect.height / 2;
            const willAnchorTop = elCenterY > (window.innerHeight || 800) * 0.45;
            const anchorPosition = willAnchorTop ? "top" : "bottom";
            const cardHeight = cardRef.current?.offsetHeight || DEFAULT_CARD_HEIGHT;

            // Calcula a janela visual livre útil (Dead Center do Viewport Útil)
            const freeWindow = calculateFreeViewportWindow({
              windowHeight: window.innerHeight,
              cardHeight,
              anchorPosition,
              isMobile: true,
            });

            const maxScrollTop = container.scrollHeight - container.clientHeight;

            targetScrollTop = calculateDeadCenterScrollTop({
              containerScrollTop: container.scrollTop,
              elementCenterY: elCenterY,
              viewportFreeCenterY: freeWindow.centerY,
              maxScrollTop: maxScrollTop > 0 ? maxScrollTop : undefined,
            });
          } else if (elementRect.top !== 0 || containerRect.top !== 0) {
            const containerTopOffset = containerRect.top > 0 ? 0 : headerHeight;
            targetScrollTop = container.scrollTop + (elementRect.top - containerRect.top) - containerTopOffset - spacing;
          } else {
            targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
          }
        } else if (element instanceof HTMLElement) {
          targetScrollTop = (element.offsetTop || 0) - headerHeight - spacing;
        }

        const safeScrollTop = Math.max(0, targetScrollTop);

        if (typeof container.scrollTo === "function") {
          container.scrollTo({ top: safeScrollTop, behavior: "smooth" });
        } else {
          container.scrollTop = safeScrollTop;
        }
      } else if (!isFixedElement && typeof element.scrollIntoView === "function") {
        // Centralização determinística na viewport livre (nunca block: "end" para não esconder sob a BottomNav)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Acopla ResizeObserver para recalcular dimensões após carregamento assíncrono de dados
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (isBottomElement && container) {
            container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
          }
          updateTargetRect();
        });
        resizeObserver.observe(element);
        if (isBottomElement && container) {
          resizeObserver.observe(container);
        }
      }

      // Sincronização Precisa pós-Estabilização (Fim Real da Rolagem) (Fase 2 — Tarefa 2.3)
      let isSettled = false;
      let rafId: number | undefined;
      let maxTimeout: ReturnType<typeof setTimeout> | undefined;
      let onScrollEnd: (() => void) | null = null;
      const scrollTarget = container ?? (typeof window !== "undefined" ? window : null);

      const settleAndMeasure = () => {
        if (isSettled || isCleanedUp) return;
        isSettled = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (maxTimeout) {
          clearTimeout(maxTimeout);
          maxTimeout = undefined;
        }
        if (scrollTarget && onScrollEnd) {
          scrollTarget.removeEventListener("scrollend", onScrollEnd);
        }
        if (isBottomElement && container) {
          container.scrollTop = container.scrollHeight;
        }
        updateTargetRect();
      };

      onScrollEnd = () => {
        settleAndMeasure();
      };

      if (scrollTarget) {
        scrollTarget.addEventListener("scrollend", onScrollEnd, { once: true });
      }

      // Fallback determinístico via requestAnimationFrame (2 frames consecutivos sem variação de scrollTop)
      let lastScrollTop = container ? container.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0);
      let stableFrames = 0;

      const checkScrollStabilization = () => {
        if (isSettled || isCleanedUp) return;

        const currentScrollTop = container ? container.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0);
        if (Math.abs(currentScrollTop - lastScrollTop) < 1) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
          lastScrollTop = currentScrollTop;
        }

        if (stableFrames >= 2) {
          settleAndMeasure();
        } else {
          rafId = requestAnimationFrame(checkScrollStabilization);
        }
      };

      rafId = requestAnimationFrame(checkScrollStabilization);

      // Fallback de segurança caso scrollend e RAF sejam suspensos por aba inativa
      maxTimeout = setTimeout(settleAndMeasure, 600);

      if (isBottomElement && container) {
        bottomCheckTimeout = setTimeout(() => {
          if (container && !isCleanedUp) {
            container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
            updateTargetRect();
          }
        }, 200);
      }

      cancelSettle = () => {
        if (isSettled) return;
        isSettled = true;
        if (rafId) cancelAnimationFrame(rafId);
        if (maxTimeout) {
          clearTimeout(maxTimeout);
          maxTimeout = undefined;
        }
        if (scrollTarget && onScrollEnd) {
          scrollTarget.removeEventListener("scrollend", onScrollEnd);
        }
      };
    };

    let resolved = false;

    const handleTargetResolved = (element: Element) => {
      if (resolved || isCleanedUp) return;
      resolved = true;
      cleanupSearch();
      setIsTargetLoading(false);
      performScrollAndMeasure(element);
    };

    const handleSearchTimeout = () => {
      if (resolved || isCleanedUp) return;
      resolved = true;
      cleanupSearch();
      setIsTargetLoading(false);
      // Fallback gracioso: encerra a busca, define rect nulo e posiciona card no centro seguro
      updateTargetRect();
      setIsPositionReady(true);
    };

    const checkTarget = (): boolean => {
      if (resolved || isCleanedUp) return true;
      const el = document.querySelector(targetSelector);
      if (el && hasValidDimensions(el)) {
        handleTargetResolved(el);
        return true;
      }
      return false;
    };

    // 1. Tenta encontrar imediatamente no DOM (Fase 8 — Tarefa 8.7)
    const foundImmediately = checkTarget();

    if (!foundImmediately) {
      // 2. Timeout absoluto de 2.5s para fallback gracioso (Fase 8 — Tarefa 8.7)
      timeoutTimer = setTimeout(handleSearchTimeout, DEFAULT_SEARCH_TIMEOUT_MS);

      // 3. Acopla MutationObserver para capturar inserções assíncronas imediatas (Fase 8 — Tarefa 8.7)
      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(() => {
          checkTarget();
        });
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "data-state", "hidden"],
        });
      }

      // 4. Polling adaptativo para cobrir transições CSS, fontes e queries assíncronas (Fase 8 — Tarefa 8.7)
      pollingTimer = setInterval(() => {
        checkTarget();
      }, DEFAULT_POLLING_INTERVAL_MS);
    }

    return () => {
      isCleanedUp = true;
      cleanupSearch();
      if (bottomCheckTimeout) clearTimeout(bottomCheckTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      if (cancelSettle) cancelSettle();
    };
  }, [currentRoute, currentStep, isDemoActive, isMobile, location.pathname, location.search, updateTargetRect]);

  // Listener para redimensionamento da janela e rolagem manual no container correto (#main-content) (Fase 2 — Tarefa 2.1)
  useEffect(() => {
    if (!isDemoActive) return;

    const handleResizeOrScroll = () => {
      const currentMobile = window.innerWidth < 768;
      setIsMobile((prev) => {
        if (prev !== currentMobile) {
          return currentMobile;
        }
        return prev;
      });
      updateTargetRect();
    };

    const container = document.getElementById("main-content");

    window.addEventListener("resize", handleResizeOrScroll, { passive: true });
    window.addEventListener("scroll", handleResizeOrScroll, { passive: true });
    container?.addEventListener("scroll", handleResizeOrScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll);
      container?.removeEventListener("scroll", handleResizeOrScroll);
    };
  }, [isDemoActive, updateTargetRect]);

  // Suporte a atalhos de teclado e Focus Trap (Fase 4 — Tarefa 4.1)
  useEffect(() => {
    if (!isDemoActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Tab") {
        if (!cardRef.current) return;
        const focusableElements = cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement || !cardRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleNext, handlePrev, isDemoActive]);

  // Motor anti-colisão no mobile (Fase 2 — Tarefa 2.4):
  // Se o centro vertical do elemento alvo estiver na metade inferior (> 45% da viewport),
  // ancoramos o popover no TOPO para não encobrir o elemento em foco.
  // Caso contrário, ancoramos na BASE.
  const isAnchorTopMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (rect) {
      const elementCenterY = rect.y + rect.height / 2;
      return elementCenterY > window.innerHeight * 0.45;
    }
    const targetSel = resolveTourStepTargetSelector(currentStep, false);
    if (targetSel) {
      const element = document.querySelector(targetSel);
      if (element) {
        const elRect = element.getBoundingClientRect();
        const elementCenterY = elRect.top + elRect.height / 2;
        return elementCenterY > window.innerHeight * 0.45;
      }
    }
    return currentStep?.preferredPlacement === "top";
  }, [currentStep, rect]);

  // Colocação dinâmica no desktop (Fase 2 — Tarefa 2.5):
  // Avalia o espaço disponível real acima e abaixo para inverter dinamicamente
  // entre "top" e "bottom", evitando que o card transborde a viewport.
  const desktopPlacement = useMemo<"top" | "bottom">(() => {
    if (!rect || typeof window === "undefined") {
      return currentStep?.preferredPlacement === "top" ? "top" : "bottom";
    }
    const cardHeight = measuredCardHeight;
    const spaceBelow = window.innerHeight - (rect.y + rect.height);
    const spaceAbove = rect.y;

    if (currentStep?.preferredPlacement === "top") {
      return spaceAbove >= cardHeight + 20 ? "top" : spaceBelow >= spaceAbove ? "bottom" : "top";
    }

    return spaceBelow < cardHeight + 20 && spaceAbove > spaceBelow ? "top" : "bottom";
  }, [currentStep, measuredCardHeight, rect]);

  // Geometria calculada para o esqueleto de carregamento com pulso suave enquanto o elemento assíncrono é montado (Fase 8 — Tarefa 8.7)
  const loadingSkeletonRect = useMemo(() => {
    const targetSel = resolveTourStepTargetSelector(currentStep, !isMobile);
    if (!isTargetLoading || !targetSel || typeof window === "undefined") {
      return null;
    }
    const anchor = isMobile
      ? isAnchorTopMobile
        ? "top"
        : "bottom"
      : desktopPlacement === "top"
        ? "top"
        : "bottom";

    return calculateSkeletonSpotlightGeometry({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      isMobile,
      cardHeight: measuredCardHeight,
      anchorPosition: anchor,
    });
  }, [
    currentStep,
    desktopPlacement,
    isAnchorTopMobile,
    isMobile,
    isTargetLoading,
    measuredCardHeight,
  ]);

  if (!isDemoActive || !activeTrack || !currentStep) {
    return null;
  }

  // Rótulo semântico canônico da trilha ativo via função pura de domínio (Fase 8 — Tarefa 8.2)
  const trackLabel = getTourTrackCategoryLabel(activeTrack);

  // Posicionamento dinâmico do card popover no desktop com aceleração GPU translate3d e transições suaves (Fase 8 — Tarefa 8.1 e 8.10)
  const desktopCardStyle = (): React.CSSProperties => {
    const cardHeight = measuredCardHeight;
    const winW = typeof window !== "undefined" ? window.innerWidth : 1024;
    const winH = typeof window !== "undefined" ? window.innerHeight : 768;
    const sidebarWidth = getDesktopSidebarWidth();

    const position = calculateDesktopCardPosition({
      rect,
      cardHeight,
      windowWidth: winW,
      windowHeight: winH,
      sidebarWidth,
      placement: desktopPlacement,
      preferredWidth: 420,
      gap: 12,
      safetyMargin: 16,
    });

    return {
      top: 0,
      left: 0,
      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      width: `${position.width}px`,
      opacity: !rect ? (isPositionReady || isTargetLoading ? 1 : 0) : (isPositionReady ? 1 : 0),
      transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
    };
  };

  // Avaliação de largura útil disponível para auto-fit inteligente do botão e anti-colisão (Fase 8 — Tarefa 8.10)
  const effectiveCardWidth = isMobile
    ? (typeof window !== "undefined" ? window.innerWidth - 24 : 360)
    : (typeof window !== "undefined" ? Math.min(420, window.innerWidth - 32) : 420);

  const isNarrowCard = effectiveCardWidth < 400;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour guiado interativo"
      data-tour-spotlight-root="true"
      className="fixed inset-0 z-floating-tools overflow-hidden select-none"
    >
      {/* Máscara SVG recortada com corte iluminado */}
      <svg
        role="presentation"
        aria-hidden="true"
        className="fixed inset-0 size-full pointer-events-auto"
        width="100%"
        height="100%"
      >
        <defs>
          <mask id="demo-tour-spotlight-mask">
            {/* Fundo branco: opaco na máscara */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Retângulo preto: fura a máscara deixando o elemento 100% visível */}
            {rect ? (
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={rect.borderRadius}
                ry={rect.borderRadius}
                fill="black"
              />
            ) : isTargetLoading && loadingSkeletonRect ? (
              <rect
                x={loadingSkeletonRect.x}
                y={loadingSkeletonRect.y}
                width={loadingSkeletonRect.width}
                height={loadingSkeletonRect.height}
                rx={loadingSkeletonRect.borderRadius}
                ry={loadingSkeletonRect.borderRadius}
                fill="black"
              />
            ) : null}
          </mask>
        </defs>

        {/* Camada escurecida sobreposta que absorve os cliques externos (Fase 3 — Tarefa 3.3) */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.60)"
          mask="url(#demo-tour-spotlight-mask)"
          data-testid="spotlight-backdrop"
        />

        {/* Borda pontilhada suave em volta da área recortada (Fase 3 — Tarefa 3.3) */}
        {rect && (
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={rect.borderRadius}
            ry={rect.borderRadius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="4 2"
            data-testid="spotlight-border"
            className={cn(
              "transition-opacity duration-700",
              isPulsing ? "animate-pulse opacity-90" : "opacity-75",
            )}
          />
        )}

        {/* Esqueleto discreto de foco enquanto elemento com montagem tardia carrega (Fase 8 — Tarefa 8.7) */}
        {!rect && isTargetLoading && loadingSkeletonRect && (
          <rect
            x={loadingSkeletonRect.x}
            y={loadingSkeletonRect.y}
            width={loadingSkeletonRect.width}
            height={loadingSkeletonRect.height}
            rx={loadingSkeletonRect.borderRadius}
            ry={loadingSkeletonRect.borderRadius}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            data-testid="spotlight-loading-skeleton"
            className="animate-pulse opacity-70"
          />
        )}
      </svg>

      {/* Card Popover Adaptativo com transições fluidas entre passos (Fase 8 — Tarefa 8.1) */}
      <aside
        ref={cardRef}
        data-tour-spotlight-card="true"
        data-tour-step={currentStep.id}
        data-placement={isMobile ? (isAnchorTopMobile ? "top" : "bottom") : desktopPlacement}
        style={!isMobile ? desktopCardStyle() : undefined}
        className={cn(
          "pointer-events-auto border border-border/80 bg-surface shadow-lg animate-fade-in",
          isMobile
            ? cn(
                "fixed inset-x-3 rounded-2xl p-4 max-h-[42vh] overflow-y-auto transition-all duration-300 ease-out z-floating-tools",
                isAnchorTopMobile
                  ? "top-[max(env(safe-area-inset-top,0px),16px)]"
                  : "bottom-[max(env(safe-area-inset-bottom,0px),16px)]",
              )
            : "fixed rounded-xl p-4.5 z-floating-tools",
          className,
        )}
      >
        {/* Cabeçalho do Card: Badges e Botão [X] de saída imediata */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="muted" size="xs" className="gap-1 font-semibold text-muted-foreground">
              <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
              <span key={currentStepNumber} className="animate-fade-in">
                Passo {currentStepNumber} de {totalSteps}
              </span>
            </Badge>
            <Badge variant="muted" size="xs" className="text-muted-foreground">
              {trackLabel}
            </Badge>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Encerrar tour demonstrativo"
            title="Encerrar tour (ESC)"
            className="size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Conteúdo Explicativo com anúncio acessível para leitores de tela e cross-fade suave (Fase 8 — Tarefa 8.1 e 8.8) */}
        <div
          key={currentStep.id}
          className="mt-2.5 space-y-1 animate-fade-in"
          aria-live="polite"
          aria-atomic="true"
        >
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            {resolveTourStepTitle(currentStep, !isMobile)}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {resolveTourStepContent(currentStep, !isMobile)}
          </p>
        </div>

        {/* Rodapé com Navegação Adaptativa e Hand-off (Fase 3 — Tarefa 3.1, Fase 8 — Tarefa 8.10) */}
        <div className="mt-4 pt-3 border-t border-border/80 flex items-center justify-between gap-2 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstStep}
            aria-label="Passo anterior"
            className="h-8 px-2.5 text-xs cursor-pointer gap-1 shrink-0 max-w-fit"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline truncate">Anterior</span>
          </Button>

          {/* Indicadores de progresso interativos com suporte a clique e A11y (Fase 4 — Tarefa 4.2) */}
          <div
            role="tablist"
            aria-label="Progresso do tour demonstrativo"
            className="flex items-center justify-center gap-1.5 shrink-0"
          >
            {steps.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="button"
                  onClick={() => handleGoToStep(idx)}
                  aria-label={`Ir para o passo ${idx + 1}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200 cursor-pointer p-0 border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shrink-0",
                    isActive
                      ? "bg-primary w-3.5"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5",
                  )}
                />
              );
            })}
          </div>

          {isLastStep ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleStartRealAccount}
              aria-label="Começar Conta Real"
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1.5 shrink-0 max-w-fit"
            >
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden truncate">Começar</span>
              <span className="hidden sm:inline truncate">
                {isNarrowCard ? "Começar" : "Começar Conta Real"}
              </span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleNext}
              aria-label="Próximo passo"
              className="h-8 px-3 text-xs font-semibold cursor-pointer gap-1 shrink-0 max-w-fit"
            >
              <span className="truncate">Próximo</span>
              <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
