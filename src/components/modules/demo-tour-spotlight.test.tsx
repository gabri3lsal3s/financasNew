import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTourSpotlight } from "./demo-tour-spotlight";
import {
  getDemoSessionState,
  hasCompletedDemoTour,
  resetDemoSession,
  resetDemoTourStorage,
  setStepIndex,
  startDemo,
} from "@/state/demo-mode";

const mockNavigate = vi.fn();
let mockPathname = "/";
let mockSearch = "";
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname, search: mockSearch }),
}));

describe("DemoTourSpotlight — Foco e Apresentação Guiada com Spotlight", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/";
    mockSearch = "";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("não renderiza nada se a demonstração estiver inativa", () => {
    render(<DemoTourSpotlight />);
    expect(
      screen.queryByRole("dialog", { name: /Tour guiado interativo/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza o spotlight e o card popover quando a demonstração está ativa", () => {
    startDemo("finances");

    render(<DemoTourSpotlight />);

    expect(
      screen.getByRole("dialog", { name: /Tour guiado interativo/i }),
    ).toBeInTheDocument();

    expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    expect(screen.getByText("Dashboard & Saldo Livre Real")).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).toBeDisabled();

    expect(screen.getByRole("button", { name: /Próximo/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Encerrar tour demonstrativo/i }),
    ).toBeInTheDocument();
  });

  it("avança para o próximo passo e navega para a rota correspondente ao clicar em Próximo", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleNext = vi.fn();

    render(<DemoTourSpotlight onNextStep={handleNext} />);

    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);

    expect(getDemoSessionState().currentStepIndex).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handleNext).toHaveBeenCalledWith(1);
  });

  it("retrocede para o passo anterior ao clicar em Anterior", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handlePrev = vi.fn();

    render(<DemoTourSpotlight onPrevStep={handlePrev} />);

    const nextBtn = screen.getByRole("button", { name: /Próximo/i });
    await user.click(nextBtn);
    expect(getDemoSessionState().currentStepIndex).toBe(1);

    const prevBtn = screen.getByRole("button", { name: /Anterior/i });
    expect(prevBtn).not.toBeDisabled();
    await user.click(prevBtn);

    expect(getDemoSessionState().currentStepIndex).toBe(0);
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(handlePrev).toHaveBeenCalledWith(0);
  });

  it("encerra a simulação imediatamente ao clicar no botão [X] de fechar", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleClose = vi.fn();

    render(<DemoTourSpotlight onClose={handleClose} />);

    expect(getDemoSessionState().isDemoActive).toBe(true);

    const closeBtn = screen.getByRole("button", {
      name: /Encerrar tour demonstrativo/i,
    });
    await user.click(closeBtn);

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("encerra a simulação ao pressionar a tecla Escape", async () => {
    const user = userEvent.setup();
    startDemo("finances");
    const handleClose = vi.fn();

    render(<DemoTourSpotlight onClose={handleClose} />);

    expect(getDemoSessionState().isDemoActive).toBe(true);

    await user.keyboard("{Escape}");

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("avança o passo ao pressionar a tecla ArrowRight", async () => {
    const user = userEvent.setup();
    startDemo("finances");

    render(<DemoTourSpotlight />);

    await user.keyboard("{ArrowRight}");

    expect(getDemoSessionState().currentStepIndex).toBe(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("escuta evento de scroll no container #main-content e recalcula o retângulo do spotlight", () => {
    startDemo("finances");

    const mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    document.body.appendChild(mainContainer);

    const targetEl = document.createElement("div");
    targetEl.setAttribute("data-tour", "overview-kpis");
    targetEl.scrollIntoView = vi.fn();
    mainContainer.appendChild(targetEl);

    const rectSpy = vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 100,
      top: 100,
      bottom: 200,
      left: 10,
      right: 310,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });

    render(<DemoTourSpotlight />);

    // Simula evento de scroll no #main-content
    act(() => {
      mainContainer.dispatchEvent(new Event("scroll"));
    });

    expect(rectSpy).toHaveBeenCalled();
  });

  it("conclui a trilha e aciona o hand-off para a conta real no último passo", async () => {
    const user = userEvent.setup();
    startDemo("investments"); // 5 passos (0, 1, 2, 3, 4)

    render(<DemoTourSpotlight />);

    // Avança para os passos subsequentes até o 5 (último)
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", {
      name: /Começar Conta Real/i,
    });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("investments")).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith("/investments?novo=investimento");
  });

  describe("Motor Anti-Colisão Mobile Adaptativo (Fase 2 — Tarefa 2.4)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 375;
      window.innerHeight = 800;
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("ancora o popover no TOPO quando o elemento alvo está na parte inferior da tela (> 45% viewport)", () => {
      startDemo("finances"); // Passo 1: targetSelector = '[data-tour="overview-kpis"]'

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo posicionado na parte inferior: y = 500, height = 100 -> centerY = 550 (550 > 800 * 0.45 = 360)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 500,
        left: 16,
        top: 500,
        right: 359,
        bottom: 600,
        width: 343,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
      expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");
      expect(aside?.className).toContain("max-h-[42vh]");
    });

    it("ancora o popover na BASE quando o elemento alvo está na parte superior da tela (<= 45% viewport)", () => {
      startDemo("finances"); // Passo 1: targetSelector = '[data-tour="overview-kpis"]'

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo posicionado na parte superior: y = 50, height = 80 -> centerY = 90 (90 <= 800 * 0.45 = 360)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 50,
        left: 16,
        top: 50,
        right: 359,
        bottom: 130,
        width: 343,
        height: 80,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("bottom");
      expect(aside?.className).toContain("bottom-[max(env(safe-area-inset-bottom,0px),16px)]");
      expect(aside?.className).toContain("max-h-[42vh]");
    });
  });

  describe("Scroll Suave Contextual e ResizeObserver (Fase 2 — Tarefa 2.2)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;
    let observeSpy: (target: Element, options?: ResizeObserverOptions) => void;
    let disconnectSpy: () => void;
    let originalResizeObserver: typeof ResizeObserver;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 375;
      window.innerHeight = 800;

      observeSpy = vi.fn();
      disconnectSpy = vi.fn();
      originalResizeObserver = window.ResizeObserver;

      class MockResizeObserver implements ResizeObserver {
        observe(target: Element, options?: ResizeObserverOptions): void {
          if (options !== undefined) {
            observeSpy(target, options);
          } else {
            observeSpy(target);
          }
        }
        unobserve(target: Element): void {
          void target;
        }
        disconnect(): void {
          disconnectSpy();
        }
      }
      window.ResizeObserver = MockResizeObserver;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      window.ResizeObserver = originalResizeObserver;
      document.body.innerHTML = "";
    });

    it("alinha scroll com block: 'center' quando o elemento não está no #main-content para não esconder sob a BottomNav (Fase 8 — Tarefa 8.6)", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      const scrollSpy = vi.fn();
      targetEl.scrollIntoView = scrollSpy;

      // y = 500, height = 100 -> centerY = 550 > 360 (ancorará no topo)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 500,
        left: 16,
        top: 500,
        right: 359,
        bottom: 600,
        width: 343,
        height: 100,
        toJSON: () => ({}),
      });

      render(<DemoTourSpotlight />);

      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
      expect(observeSpy).toHaveBeenCalledWith(targetEl);
    });

    it("alinha scroll com block: 'center' quando o popover ancorará na base (alvo no topo)", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      const scrollSpy = vi.fn();
      targetEl.scrollIntoView = scrollSpy;

      // y = 50, height = 50 -> centerY = 75 <= 360 (ancorará na base)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 50,
        left: 16,
        top: 50,
        right: 359,
        bottom: 100,
        width: 343,
        height: 50,
        toJSON: () => ({}),
      });

      render(<DemoTourSpotlight />);

      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "center",
      });
      expect(observeSpy).toHaveBeenCalledWith(targetEl);
    });

    it("rola matematicamente no container #main-content com offset do header e margem de respiro", () => {
      startDemo("finances");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      const scrollToSpy = vi.fn();
      mainContainer.scrollTo = scrollToSpy;
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      Object.defineProperty(targetEl, "offsetTop", { value: 300, configurable: true });
      mainContainer.appendChild(targetEl);

      render(<DemoTourSpotlight />);

      // targetScrollTop = 300 - 64 (header) - 16 (spacing) = 220
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 220,
        behavior: "smooth",
      });
    });

    it("reseta container.scrollTop para 0 ao trocar de rota antes de buscar o novo elemento", async () => {
      const user = userEvent.setup();
      startDemo("finances_overview");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      mainContainer.scrollTop = 450;
      mainContainer.scrollTo = vi.fn();
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      mainContainer.appendChild(targetEl);

      render(<DemoTourSpotlight />);

      const nextBtn = screen.getByRole("button", { name: /Próximo/i });
      await user.click(nextBtn);

      expect(mainContainer.scrollTop).toBe(0);
    });

    it("limita o scroll em 0 quando o offsetTop é menor que a altura do header + margem", () => {
      startDemo("finances");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      const scrollToSpy = vi.fn();
      mainContainer.scrollTo = scrollToSpy;
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      Object.defineProperty(targetEl, "offsetTop", { value: 50, configurable: true });
      mainContainer.appendChild(targetEl);

      render(<DemoTourSpotlight />);

      // targetScrollTop = Math.max(0, 50 - 64 - 16) = 0
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 0,
        behavior: "smooth",
      });
    });

    it("centraliza o elemento no Dead Center da viewport livre mobile sem sobreposição pela BottomNav (Fase 8 — Tarefa 8.6)", () => {
      window.innerWidth = 375;
      window.innerHeight = 800;
      startDemo("finances");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      const scrollToSpy = vi.fn();
      mainContainer.scrollTo = scrollToSpy;
      mainContainer.scrollTop = 100;
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      mainContainer.appendChild(targetEl);

      // Elemento na parte inferior: y = 600, height = 80 -> centerY = 640 (> 360 -> card ancorará no topo)
      // Janela livre calculada: top = 64 + 180 + 16 = 260, bottom = 800 - 72 - 16 = 712, centerY = 486
      // targetScrollTop = 100 + (640 - 486) = 254
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 600,
        left: 16,
        top: 600,
        right: 359,
        bottom: 680,
        width: 343,
        height: 80,
        toJSON: () => ({}),
      });

      render(<DemoTourSpotlight />);

      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 254,
        behavior: "smooth",
      });
    });

    it("não rola o container quando o elemento alvo possui posição fixa ou está na BottomNav (Fase 8 — Tarefa 8.6)", () => {
      window.innerWidth = 375;
      window.innerHeight = 800;
      startDemo("finances_wizard");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      const scrollToSpy = vi.fn();
      mainContainer.scrollTo = scrollToSpy;
      document.body.appendChild(mainContainer);

      const navEl = document.createElement("nav");
      navEl.className = "fixed bottom-0";
      document.body.appendChild(navEl);

      const wizardBtn = document.createElement("span");
      wizardBtn.setAttribute("data-tour", "bottom-nav-wizard");
      navEl.appendChild(wizardBtn);

      render(<DemoTourSpotlight />);

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("desconecta o ResizeObserver na desmontagem do componente", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);
      targetEl.scrollIntoView = vi.fn();

      const { unmount } = render(<DemoTourSpotlight />);

      expect(observeSpy).toHaveBeenCalledWith(targetEl);

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe("Sincronização Precisa pós-Estabilização (Fim Real da Rolagem) (Fase 2 — Tarefa 2.3)", () => {
    it("sincroniza medição do spotlight via evento 'scrollend' no container #main-content", () => {
      startDemo("finances");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      mainContainer.scrollTo = vi.fn();
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      mainContainer.appendChild(targetEl);

      const rectSpy = vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 10,
        y: 100,
        left: 10,
        top: 100,
        right: 300,
        bottom: 250,
        width: 290,
        height: 150,
        toJSON: () => ({}),
      });

      render(<DemoTourSpotlight />);

      rectSpy.mockClear();

      // Dispara o evento de scrollend no #main-content
      act(() => {
        mainContainer.dispatchEvent(new Event("scrollend"));
      });

      // Confirma que a medição foi realizada imediatamente com a estabilização via scrollend
      expect(rectSpy).toHaveBeenCalled();
    });

    it("sincroniza medição do spotlight via fallback de estabilização por 2 frames de requestAnimationFrame", () => {
      startDemo("finances");

      const mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      mainContainer.scrollTop = 100;
      mainContainer.scrollTo = vi.fn();
      document.body.appendChild(mainContainer);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      mainContainer.appendChild(targetEl);

      let rafCallback: ((time: number) => void) | undefined;
      const originalRaf = window.requestAnimationFrame;
      window.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
        rafCallback = cb;
        return 123;
      });

      const rectSpy = vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 10,
        y: 100,
        left: 10,
        top: 100,
        right: 300,
        bottom: 250,
        width: 290,
        height: 150,
        toJSON: () => ({}),
      });

      try {
        render(<DemoTourSpotlight />);
        rectSpy.mockClear();

        // Frame 1: scrollTop não variou (estável 1x)
        act(() => {
          if (rafCallback) rafCallback(16);
        });

        // Frame 2: scrollTop continuou estável (estável 2x -> sincroniza medição)
        act(() => {
          if (rafCallback) rafCallback(32);
        });

        expect(rectSpy).toHaveBeenCalled();
      } finally {
        window.requestAnimationFrame = originalRaf;
      }
    });

    it("recalcula medição quando ResizeObserver detecta mutação no elemento-alvo", () => {
      startDemo("finances");

      let resizeCallback: (() => void) | undefined;
      const mockObserver = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      };
      const originalResizeObserver = window.ResizeObserver;
      class MockResizeObserver {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe = mockObserver.observe;
        disconnect = mockObserver.disconnect;
        unobserve = mockObserver.unobserve;
      }
      window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      targetEl.scrollIntoView = vi.fn();
      document.body.appendChild(targetEl);

      const rectSpy = vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 10,
        y: 100,
        left: 10,
        top: 100,
        right: 300,
        bottom: 250,
        width: 290,
        height: 150,
        toJSON: () => ({}),
      });

      try {
        render(<DemoTourSpotlight />);
        rectSpy.mockClear();

        // Simula ResizeObserver disparado por expansão tardia do elemento
        act(() => {
          if (resizeCallback) resizeCallback();
        });

        expect(rectSpy).toHaveBeenCalled();
      } finally {
        window.ResizeObserver = originalResizeObserver;
      }
    });
  });

  describe("Posicionamento Dinâmico Desktop com Altura Real (Fase 2 — Tarefa 2.5)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 1280;
      window.innerHeight = 900;
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("utiliza a medição real de offsetHeight do card para o cálculo de posicionamento e inversão", () => {
      startDemo("finances");

      const callbacks: Array<(entries: ResizeObserverEntry[]) => void> = [];
      const originalResizeObserver = window.ResizeObserver;
      class MockResizeObserver {
        constructor(cb: (entries: ResizeObserverEntry[]) => void) {
          callbacks.push(cb);
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
      window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo posicionado com spaceBelow = 900 - 620 = 280px
      // Se a altura do card for 280px (+ 20px margem = 300px), spaceBelow (280) < 300 -> inverte para "top"
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 100,
        y: 520,
        left: 100,
        top: 520,
        right: 500,
        bottom: 620,
        width: 400,
        height: 100,
        toJSON: () => ({}),
      });

      try {
        const { container } = render(<DemoTourSpotlight />);

        act(() => {
          for (const cb of callbacks) {
            cb([
              {
                contentRect: { height: 280 } as unknown as DOMRectReadOnly,
                borderBoxSize: [{ blockSize: 280 } as unknown as ResizeObserverSize],
              } as unknown as ResizeObserverEntry,
            ]);
          }
          window.dispatchEvent(new Event("resize"));
        });

        const aside = container.querySelector("aside");
        expect(aside?.getAttribute("data-placement")).toBe("top");
      } finally {
        window.ResizeObserver = originalResizeObserver;
      }
    });

    it("posiciona o card abaixo do elemento quando há espaço inferior suficiente", () => {
      startDemo("finances"); // Passo 1: targetSelector = '[data-tour="overview-kpis"]'

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo posicionado no topo: y = 100, height = 150 -> spaceBelow = 900 - 250 = 650 (espaço amplo)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 100,
        y: 100,
        left: 100,
        top: 100,
        right: 500,
        bottom: 250,
        width: 400,
        height: 150,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("bottom");
      expect(aside?.style.top).toBeDefined();
      expect(aside?.style.width).toBe("420px");
    });

    it("inverte dinamicamente para o topo quando o espaço inferior é insuficiente", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo posicionado bem próximo ao rodapé: y = 750, height = 100 -> spaceBelow = 900 - 850 = 50 (< 240)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 100,
        y: 750,
        left: 100,
        top: 750,
        right: 500,
        bottom: 850,
        width: 400,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
    });

    it("aplica clamp horizontal estrito impedindo que o card ultrapasse a borda direita", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo próximo à borda direita: x = 1100, width = 150 em viewport de 1280
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 1100,
        y: 200,
        left: 1100,
        top: 200,
        right: 1250,
        bottom: 300,
        width: 150,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      // Clamp: Math.min(1100, 1280 - 420 - 16) = Math.min(1100, 844) = 844px posicionado via GPU translate3d
      expect(aside?.style.transform).toContain("translate3d(844px");
    });

    it("aplica clamp horizontal estrito impedindo que o card ultrapasse a borda esquerda", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo com x negativo ou colado à esquerda: x = -10
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: -10,
        y: 200,
        left: -10,
        top: 200,
        right: 150,
        bottom: 300,
        width: 160,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      // Clamp: Math.max(16, ...) = 16px posicionado via GPU translate3d
      expect(aside?.style.transform).toContain("translate3d(16px");
    });

    it("respeita a sidebar desktop no clamp horizontal evitando sobreposição (Fase 8 — Tarefa 8.10)", () => {
      startDemo("finances");

      // Monta sidebar desktop mockada de 256px
      const sidebarEl = document.createElement("aside");
      sidebarEl.className = "fixed inset-y-0 left-0 z-sidebar hidden lg:flex";
      vi.spyOn(sidebarEl, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 256,
        bottom: 800,
        width: 256,
        height: 800,
        toJSON: () => ({}),
      });
      document.body.appendChild(sidebarEl);

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo com x = 50 (dentro da zona da sidebar)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 50,
        y: 200,
        left: 50,
        top: 200,
        right: 200,
        bottom: 300,
        width: 150,
        height: 100,
        toJSON: () => ({}),
      });

      const originalInnerWidth = window.innerWidth;
      window.innerWidth = 1280;

      try {
        const { container } = render(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });

        const aside = container.querySelector<HTMLElement>("aside[data-tour-spotlight-card='true']");
        expect(aside).not.toBeNull();
        // Clamp com sidebar: left >= sidebarWidth + 16 = 256 + 16 = 272px
        expect(aside?.style.transform).toContain("translate3d(272px");
      } finally {
        window.innerWidth = originalInnerWidth;
      }
    });
  });

  describe("Testes Unitários de Posicionamento e Anti-Colisão (Fase 2 — Tarefa 2.6)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("cenário iPhone SE (375x667): anti-colisão posiciona no topo para alvo inferior e na base para alvo superior", () => {
      window.innerWidth = 375;
      window.innerHeight = 667;
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo inferior (y = 450, height = 100 -> centerY = 500 > 667 * 0.45 = 300)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 450,
        left: 16,
        top: 450,
        right: 359,
        bottom: 550,
        width: 343,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
      expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");
      expect(aside?.className).toContain("max-h-[42vh]");
    });

    it("cenário iPhone 12/13/14 (390x844): anti-colisão posiciona na base para alvo superior sem encobrimento", () => {
      window.innerWidth = 390;
      window.innerHeight = 844;
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo superior (y = 120, height = 80 -> centerY = 160 <= 844 * 0.45 = 379.8)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 120,
        left: 16,
        top: 120,
        right: 374,
        bottom: 200,
        width: 358,
        height: 80,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("bottom");
      expect(aside?.className).toContain("bottom-[max(env(safe-area-inset-bottom,0px),16px)]");
      expect(aside?.className).toContain("max-h-[42vh]");
    });

    it("cenário Samsung Galaxy S20 / Android (360x800): anti-colisão posiciona no topo para alvo inferior (> 45% viewport)", () => {
      window.innerWidth = 360;
      window.innerHeight = 800;
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Alvo inferior (y = 480, height = 80 -> centerY = 520 > 800 * 0.45 = 360)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 12,
        y: 480,
        left: 12,
        top: 480,
        right: 348,
        bottom: 560,
        width: 336,
        height: 80,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
      expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");
      expect(aside?.className).toContain("max-h-[42vh]");
    });

    it("cenário Google Pixel 7 (412x915): ancora deterministicamente na base quando alvo está no limiar de 45%", () => {
      window.innerWidth = 412;
      window.innerHeight = 915;
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      // Limiar exato: 915 * 0.45 = 411.75 -> centerY = 400 (<= 411.75 -> base)
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 350,
        left: 16,
        top: 350,
        right: 396,
        bottom: 450,
        width: 380,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("bottom");
      expect(aside?.className).toContain("bottom-[max(env(safe-area-inset-bottom,0px),16px)]");
    });
  });

  describe("Rodapé Adaptativo para Telas Pequenas < 400px (Fase 3 — Tarefa 3.1)", () => {
    it("exibe botão Anterior com classe de texto oculta em telas pequenas (hidden sm:inline)", () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
      expect(prevBtn).toBeInTheDocument();

      const spanText = prevBtn.querySelector("span");
      expect(spanText).not.toBeNull();
      expect(spanText?.className).toContain("hidden sm:inline");
      expect(spanText?.textContent).toBe("Anterior");
    });

    it("renderiza rótulo adaptativo no botão de conclusão (sm:hidden: 'Começar', hidden sm:inline: 'Começar Conta Real')", async () => {
      const user = userEvent.setup();
      startDemo("investments"); // 5 passos (0, 1, 2, 3, 4)

      render(<DemoTourSpotlight />);

      // Avança para o último passo (passo 5)
      await user.click(screen.getByRole("button", { name: /Próximo/i }));
      await user.click(screen.getByRole("button", { name: /Próximo/i }));
      await user.click(screen.getByRole("button", { name: /Próximo/i }));
      await user.click(screen.getByRole("button", { name: /Próximo/i }));

      const finishBtn = screen.getByRole("button", { name: /Começar Conta Real/i });
      expect(finishBtn).toBeInTheDocument();

      const compactSpan = finishBtn.querySelector("span.sm\\:hidden");
      expect(compactSpan).not.toBeNull();
      expect(compactSpan?.textContent).toBe("Começar");

      const fullSpan = finishBtn.querySelector("span.hidden");
      expect(fullSpan).not.toBeNull();
      expect(fullSpan?.className).toContain("sm:inline");
      expect(fullSpan?.textContent).toBe("Começar Conta Real");
    });

    it("renderiza dots de progresso como pílulas discretas e espaçamento seguro", () => {
      startDemo("finances"); // 8 passos

      render(<DemoTourSpotlight />);

      const tablist = screen.getByRole("tablist", { name: "Progresso do tour demonstrativo" });
      expect(tablist).toBeInTheDocument();
      expect(tablist.className).toContain("gap-1.5");

      const dots = tablist.querySelectorAll("button");
      expect(dots).toHaveLength(8);

      // Dot ativo: pílula expandida w-3.5
      expect(dots[0]?.className).toContain("h-1.5");
      expect(dots[0]?.className).toContain("rounded-full");
      expect(dots[0]?.className).toContain("bg-primary");
      expect(dots[0]?.className).toContain("w-3.5");

      // Dots inativos: w-1.5
      expect(dots[1]?.className).toContain("w-1.5");
      expect(dots[1]?.className).toContain("bg-muted-foreground/30");
    });
  });

  describe("Hierarquia Semântica de Cores (Fase 3 — Tarefa 3.2)", () => {
    it("utiliza variant muted no badge do passo e tom neutro text-muted-foreground no ícone Sparkles", () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const stepText = screen.getByText("Passo 1 de 8");
      const badge = stepText.closest("span.inline-flex");
      expect(badge).not.toBeNull();
      expect(badge?.className).toContain("bg-muted");
      expect(badge?.className).toContain("text-muted-foreground");

      const sparklesIcon = badge?.querySelector("svg");
      expect(sparklesIcon).not.toBeNull();
      expect(sparklesIcon?.getAttribute("class")).toContain("text-muted-foreground");

      // Badge de trilha em tom neutro muted
      const trackBadge = screen.getByText("Finanças Diárias").closest("span.inline-flex");
      expect(trackBadge).not.toBeNull();
      expect(trackBadge?.className).toContain("bg-muted");
      expect(trackBadge?.className).toContain("text-muted-foreground");

      // Acento primário reservado estritamente para o botão de ação CTA (Próximo)
      const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
      expect(nextBtn.className).toContain("bg-primary");
      expect(nextBtn.className).toContain("text-primary-strong");

      // Botão Anterior usa variant outline e botão fechar usa variant ghost
      const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
      expect(prevBtn.className).toContain("border");
      const closeBtn = screen.getByRole("button", { name: /Encerrar tour demonstrativo/i });
      expect(closeBtn.className).toContain("text-muted-foreground");
    });
  });

  describe("Refinamento Estético do Backdrop SVG e Borda do Spotlight (Fase 3 — Tarefa 3.3)", () => {
    it("aplica opacidade suave no backdrop (rgba(0, 0, 0, 0.60)) para evitar blecaute pesado", () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const backdrop = screen.getByTestId("spotlight-backdrop");
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveAttribute("fill", "rgba(0, 0, 0, 0.60)");
    });

    it("configura cantos suaves rx=16 e ry=16 (rounded-2xl) na máscara e borda pontilhada", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 20,
        y: 40,
        left: 20,
        top: 40,
        right: 360,
        bottom: 140,
        width: 340,
        height: 100,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      expect(border).toHaveAttribute("rx", "16");
      expect(border).toHaveAttribute("ry", "16");
      expect(border).toHaveAttribute("stroke-dasharray", "4 2");

      const maskCutout = container.querySelector("mask#demo-tour-spotlight-mask rect[fill='black']");
      expect(maskCutout).not.toBeNull();
      expect(maskCutout).toHaveAttribute("rx", "16");
      expect(maskCutout).toHaveAttribute("ry", "16");

      document.body.removeChild(targetEl);
    });

    it("cessa suavemente a animação animate-pulse da borda após 3 segundos", () => {
      vi.useFakeTimers();
      try {
        startDemo("finances");

        const targetEl = document.createElement("div");
        targetEl.setAttribute("data-tour", "overview-kpis");
        document.body.appendChild(targetEl);

        vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
          x: 20,
          y: 40,
          left: 20,
          top: 40,
          right: 360,
          bottom: 140,
          width: 340,
          height: 100,
          toJSON: () => ({}),
        });

        render(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });

        const border = screen.getByTestId("spotlight-border");
        expect(border).toBeInTheDocument();
        // Inicialmente, animate-pulse está ativo
        expect(border.getAttribute("class")).toContain("animate-pulse");

        // Avança 3 segundos (3000ms)
        act(() => {
          vi.advanceTimersByTime(3000);
        });

        // Após 3 segundos, animate-pulse foi removido
        expect(border.getAttribute("class")).not.toContain("animate-pulse");
        expect(border.getAttribute("class")).toContain("opacity-75");

        document.body.removeChild(targetEl);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("Transições de Passo Fluidas (Fase 3 — Tarefa 3.4)", () => {
    it("aplica classe animate-fade-in e atualiza o atributo data-tour-step na troca de etapa", async () => {
      startDemo("finances");
      const user = userEvent.setup();

      render(<DemoTourSpotlight />);

      const asideStep1 = document.querySelector("aside");
      expect(asideStep1).toBeInTheDocument();
      expect(asideStep1?.className).toContain("animate-fade-in");
      expect(asideStep1?.getAttribute("data-tour-step")).toBe("finances-overview");

      // Avança para o próximo passo
      const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
      await user.click(nextBtn);

      const asideStep2 = document.querySelector("aside");
      expect(asideStep2).toBeInTheDocument();
      expect(asideStep2?.className).toContain("animate-fade-in");
      expect(asideStep2?.getAttribute("data-tour-step")).toBe("finances-wizard-btn");
    });
  });

  describe("Verificação de Legibilidade e Alinhamento em Temas Claro/Escuro em Telas de 360px a 412px (Portão 3)", () => {
    const viewports = [360, 375, 390, 412];
    const themes = ["light", "dark"] as const;

    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerHeight = 800;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.documentElement.removeAttribute("data-theme");
      document.body.innerHTML = "";
    });

    viewports.forEach((width) => {
      themes.forEach((theme) => {
        it(`mantém legibilidade, padding seguro e alinhamento em viewport ${width}px no tema ${theme}`, () => {
          window.innerWidth = width;
          document.documentElement.setAttribute("data-theme", theme);

          startDemo("finances");

          const { container } = render(<DemoTourSpotlight />);

          act(() => {
            window.dispatchEvent(new Event("resize"));
          });

          const aside = container.querySelector("aside");
          expect(aside).toBeInTheDocument();

          // Contêiner com espaçamento lateral seguro (inset-x-3 = 12px de cada lado) e cantos rounded-2xl
          expect(aside?.className).toContain("fixed inset-x-3 rounded-2xl p-4 max-h-[42vh]");
          expect(aside?.className).toContain("bg-surface");
          expect(aside?.className).toContain("border-border/80");

          // Hierarquia semântica de cores com tokens adaptativos ao tema
          const stepBadge = screen.getByText(/Passo 1 de 8/i).closest("span.inline-flex");
          expect(stepBadge).not.toBeNull();
          expect(stepBadge?.className).toContain("bg-muted");
          expect(stepBadge?.className).toContain("text-muted-foreground");

          // Título e descrição com contraste tipográfico legível
          const title = screen.getByText("Dashboard & Saldo Livre Real");
          expect(title.className).toContain("text-foreground");
          const desc = screen.getByText(/Monitore seu saldo livre real/i);
          expect(desc.className).toContain("text-muted-foreground");

          // Rodapé sem quebra ou colisão: botão Anterior omite texto no mobile
          const prevBtn = screen.getByRole("button", { name: /Passo anterior/i });
          const prevLabel = prevBtn.querySelector("span.hidden");
          expect(prevLabel).not.toBeNull();
          expect(prevLabel?.className).toContain("sm:inline");

          // Dots centralizados com classe shrink-0
          const dotsContainer = container.querySelector("div.shrink-0");
          expect(dotsContainer).not.toBeNull();

          // Botão Próximo com tamanho contido
          const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
          expect(nextBtn).toBeInTheDocument();
          expect(nextBtn.className).toContain("shrink-0");
        });
      });
    });
  });

  describe("Gerenciamento de Foco e Focus Trap (Fase 4 — Tarefa 4.1)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 1024;
      window.innerHeight = 800;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("foca automaticamente o primeiro botão interativo ao montar o passo", () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const closeBtn = screen.getByRole("button", {
        name: /Encerrar tour demonstrativo/i,
      });
      expect(document.activeElement).toBe(closeBtn);
    });

    it("captura o document.activeElement inicial e restaura o foco ao sair do tour pelo botão [X]", async () => {
      const user = userEvent.setup();
      const triggerBtn = document.createElement("button");
      triggerBtn.textContent = "Botão Abrir Tour";
      document.body.appendChild(triggerBtn);
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      startDemo("finances");
      render(<DemoTourSpotlight />);

      const closeBtn = screen.getByRole("button", {
        name: /Encerrar tour demonstrativo/i,
      });
      expect(document.activeElement).toBe(closeBtn);

      await user.click(closeBtn);

      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(document.activeElement).toBe(triggerBtn);
    });

    it("restaura o foco para o elemento original ao sair via tecla Escape", () => {
      const triggerBtn = document.createElement("button");
      triggerBtn.textContent = "Gatilho Demo";
      document.body.appendChild(triggerBtn);
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      startDemo("finances");
      render(<DemoTourSpotlight />);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(document.activeElement).toBe(triggerBtn);
    });

    it("aprisiona o foco com Tab e Shift+Tab confinado no card", () => {
      startDemo("finances");
      render(<DemoTourSpotlight />);

      const closeBtn = screen.getByRole("button", {
        name: /Encerrar tour demonstrativo/i,
      });
      const nextBtn = screen.getByRole("button", {
        name: /Próximo passo/i,
      });

      // Inicialmente focado no primeiro botão (Fechar [X])
      expect(document.activeElement).toBe(closeBtn);

      // Foca no último botão interativo (Próximo)
      nextBtn.focus();
      expect(document.activeElement).toBe(nextBtn);

      // Pressionar Tab no último botão deve circular para o primeiro (Fechar [X])
      fireEvent.keyDown(window, { key: "Tab" });
      expect(document.activeElement).toBe(closeBtn);

      // Pressionar Shift+Tab no primeiro botão deve circular para o último (Próximo)
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(nextBtn);
    });
  });

  describe("Acessibilidade ARIA e Navegação por Dots (Fase 4 — Tarefa 4.2)", () => {
    it("atribui role='presentation' e aria-hidden='true' na camada de máscara SVG", () => {
      startDemo("finances");
      const { container } = render(<DemoTourSpotlight />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("role", "presentation");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("adiciona aria-live='polite' e aria-atomic='true' no contêiner explicativo", () => {
      startDemo("finances");
      render(<DemoTourSpotlight />);

      const title = screen.getByText("Dashboard & Saldo Livre Real");
      const liveContainer = title.parentElement;
      expect(liveContainer).not.toBeNull();
      expect(liveContainer).toHaveAttribute("aria-live", "polite");
      expect(liveContainer).toHaveAttribute("aria-atomic", "true");
    });

    it("renderiza dots interativos com role='button' e navega diretamente ao passo clicado", async () => {
      const user = userEvent.setup();
      startDemo("finances");
      const handleNext = vi.fn();

      render(<DemoTourSpotlight onNextStep={handleNext} />);

      // Verifica dot 1 ativo
      const dot1 = screen.getByRole("button", { name: "Ir para o passo 1" });
      expect(dot1).toBeInTheDocument();
      expect(dot1).toHaveAttribute("aria-current", "step");

      // Clica no dot 3 ("Ir para o passo 3" = finances-wizard-dialog)
      const dot3 = screen.getByRole("button", { name: "Ir para o passo 3" });
      expect(dot3).toBeInTheDocument();
      expect(dot3).not.toHaveAttribute("aria-current");

      await user.click(dot3);

      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes?novo=despesa");
      expect(handleNext).toHaveBeenCalledWith(2);

      // Após o re-render do card com nova key, consulta os novos nós DOM
      const activeDot3 = screen.getByRole("button", { name: "Ir para o passo 3" });
      expect(activeDot3).toHaveAttribute("aria-current", "step");

      const inactiveDot1 = screen.getByRole("button", { name: "Ir para o passo 1" });
      expect(inactiveDot1).not.toHaveAttribute("aria-current");
    });
  });

  describe("Navegação e Conclusão Exclusiva via Teclado (Portão de Qualidade 4 — WCAG 2.1)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 1024;
      window.innerHeight = 800;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("navega do primeiro ao último passo e retrocede utilizando exclusivamente ArrowRight e ArrowLeft", () => {
      startDemo("finances");
      render(<DemoTourSpotlight />);

      expect(getDemoSessionState().currentStepIndex).toBe(0);

      // Passo 1 -> Passo 2 (/)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(1);
      expect(mockNavigate).toHaveBeenCalledWith("/");

      // Passo 2 -> Passo 3 (/transacoes?novo=despesa)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes?novo=despesa");

      // Passo 3 -> Passo 4 (/transacoes)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(3);
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes");

      // Passo 4 -> Passo 5 (/cartoes)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(4);
      expect(mockNavigate).toHaveBeenCalledWith("/cartoes");

      // Passo 5 -> Passo 6 (/cartoes)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(5);
      expect(mockNavigate).toHaveBeenCalledWith("/cartoes");

      // Passo 6 -> Passo 7 (/orcamentos)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(6);
      expect(mockNavigate).toHaveBeenCalledWith("/orcamentos");

      // Passo 7 -> Passo 8 (/relatorios - último)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(7);
      expect(mockNavigate).toHaveBeenCalledWith("/relatorios");

      // Retrocesso: Passo 8 -> Passo 7 via ArrowLeft
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(getDemoSessionState().currentStepIndex).toBe(6);
      expect(mockNavigate).toHaveBeenCalledWith("/orcamentos");
    });

    it("navega por Tab, aciona botões com Enter e conclui o tour no último passo", async () => {
      const user = userEvent.setup();
      startDemo("finances");
      render(<DemoTourSpotlight />);

      // Inicialmente focado no primeiro botão ([X] Fechar)
      const closeBtn = screen.getByRole("button", { name: /Encerrar tour demonstrativo/i });
      expect(document.activeElement).toBe(closeBtn);

      // Pressiona Tab para mover o foco para os próximos elementos
      await user.tab();
      // O próximo elemento focável é o botão Anterior (que está desabilitado no passo 0) ou os dots
      // Encontra o botão "Próximo passo" e foca nele via navegação por teclado
      const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
      nextBtn.focus();
      expect(document.activeElement).toBe(nextBtn);

      // Aciona o botão Próximo com Enter
      await user.keyboard("{Enter}");
      expect(getDemoSessionState().currentStepIndex).toBe(1);

      // Avança até o último passo (passo 8 = relatorios, idx 7)
      act(() => {
        setStepIndex(7);
      });

      // No último passo, o botão de conclusão é exibido
      const finishBtn = screen.getByRole("button", { name: /Começar Conta Real/i });
      finishBtn.focus();
      expect(document.activeElement).toBe(finishBtn);

      // Conclui o tour acionando Enter no botão final
      await user.keyboard("{Enter}");
      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith("/?novo=despesa");
    });

    it("aciona dot interativo através da barra de Espaço", async () => {
      const user = userEvent.setup();
      startDemo("finances");
      render(<DemoTourSpotlight />);

      const dot2 = screen.getByRole("button", { name: "Ir para o passo 2" });
      dot2.focus();
      expect(document.activeElement).toBe(dot2);

      // Pressiona Espaço no botão do dot
      await user.keyboard(" ");

      expect(getDemoSessionState().currentStepIndex).toBe(1);
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("cancela e encerra o tour a qualquer momento via tecla Escape preservando o foco", () => {
      const triggerBtn = document.createElement("button");
      triggerBtn.textContent = "Gatilho de Abertura";
      document.body.appendChild(triggerBtn);
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      startDemo("finances");
      render(<DemoTourSpotlight />);

      expect(getDemoSessionState().isDemoActive).toBe(true);

      fireEvent.keyDown(window, { key: "Escape" });

      expect(getDemoSessionState().isDemoActive).toBe(false);
      expect(document.activeElement).toBe(triggerBtn);
    });
  });

  describe("Micro-Tour do Wizard (+) — Foco Preciso no Botão Central e Anti-Colisão Mobile (Portão 3)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
    });

    it("inicia o micro-tour finances_wizard e foca com precisão no botão central [data-tour='bottom-nav-wizard'] sem colisão", () => {
      window.innerWidth = 375;
      window.innerHeight = 812;

      const wizardButton = document.createElement("a");
      wizardButton.setAttribute("data-tour", "bottom-nav-wizard");
      wizardButton.setAttribute("href", "/");
      document.body.appendChild(wizardButton);

      // Botão central do FAB posicionado no fundo da tela (ex: bottom navigation)
      vi.spyOn(wizardButton, "getBoundingClientRect").mockReturnValue({
        x: 160,
        y: 730,
        left: 160,
        top: 730,
        right: 216,
        bottom: 786,
        width: 56,
        height: 56,
        toJSON: () => ({}),
      });

      startDemo("finances_wizard");

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Card do passo 1 do micro-tour
      expect(screen.getByText("Passo 1 de 3")).toBeInTheDocument();
      expect(
        screen.getByText("Acesso Rápido com o Botão Central (+)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/O botão de destaque central na barra inferior/i),
      ).toBeInTheDocument();

      // Card posicionado no topo para não encobrir o botão inferior
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
      expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");

      // Spotlight border e máscara posicionados com precisão circular (borderRadius 9999) ao redor do botão
      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      expect(border.getAttribute("x")).toBe("150");
      expect(border.getAttribute("y")).toBe("720");
      expect(border.getAttribute("width")).toBe("76");
      expect(border.getAttribute("height")).toBe("76");
      expect(border.getAttribute("rx")).toBe("9999");
      expect(border.getAttribute("ry")).toBe("9999");
    });
  });

  describe("Navegação 100% via Teclado em Temas Claro e Escuro (Portão de Qualidade 5 — A11y & WCAG 2.1)", () => {
    const themes = ["light", "dark"] as const;

    themes.forEach((theme) => {
      describe(`Tema: ${theme}`, () => {
        beforeEach(() => {
          document.documentElement.setAttribute("data-theme", theme);
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        });

        afterEach(() => {
          document.documentElement.removeAttribute("data-theme");
          document.documentElement.classList.remove("dark");
          document.body.innerHTML = "";
        });

        it("navega fluidamente por setas (ArrowRight/ArrowLeft), avança com Enter, salta com Espaço nos dots e encerra com Esc", async () => {
          const user = userEvent.setup();
          const triggerBtn = document.createElement("button");
          triggerBtn.textContent = "Disparador do Tour";
          document.body.appendChild(triggerBtn);
          triggerBtn.focus();
          expect(document.activeElement).toBe(triggerBtn);

          startDemo("finances");
          render(<DemoTourSpotlight />);

          // 1. Início: foco no primeiro elemento interativo ([X] Fechar)
          const closeBtn = screen.getByRole("button", { name: /Encerrar tour demonstrativo/i });
          expect(document.activeElement).toBe(closeBtn);

          // 2. Setas: avança passo 0 -> 1 -> 2
          fireEvent.keyDown(window, { key: "ArrowRight" });
          expect(getDemoSessionState().currentStepIndex).toBe(1);

          fireEvent.keyDown(window, { key: "ArrowRight" });
          expect(getDemoSessionState().currentStepIndex).toBe(2);

          // Setas: retrocede passo 2 -> 1
          fireEvent.keyDown(window, { key: "ArrowLeft" });
          expect(getDemoSessionState().currentStepIndex).toBe(1);

          // 3. Tab e Espaço nos dots: salta para o passo 8 (último)
          const dot8 = screen.getByRole("button", { name: "Ir para o passo 8" });
          dot8.focus();
          expect(document.activeElement).toBe(dot8);
          await user.keyboard(" ");
          expect(getDemoSessionState().currentStepIndex).toBe(7);

          // 4. Tab e Enter no botão CTA final ("Começar Conta Real"): conclui tour
          const finishBtn = screen.getByRole("button", { name: /Começar Conta Real/i });
          finishBtn.focus();
          expect(document.activeElement).toBe(finishBtn);
          await user.keyboard("{Enter}");
          expect(getDemoSessionState().isDemoActive).toBe(false);
          expect(mockNavigate).toHaveBeenCalledWith("/?novo=despesa");
        });

        it("preserva restauração de foco ao fechar via Esc após navegação por teclado", () => {
          const triggerBtn = document.createElement("button");
          triggerBtn.textContent = "Disparador Inicial";
          document.body.appendChild(triggerBtn);
          triggerBtn.focus();
          expect(document.activeElement).toBe(triggerBtn);

          startDemo("finances");
          render(<DemoTourSpotlight />);

          // Navega um passo
          fireEvent.keyDown(window, { key: "ArrowRight" });
          expect(getDemoSessionState().currentStepIndex).toBe(1);

          // Fecha via Esc
          fireEvent.keyDown(window, { key: "Escape" });
          expect(getDemoSessionState().isDemoActive).toBe(false);
          expect(document.activeElement).toBe(triggerBtn);
        });
      });
    });
  });

  describe("Eliminação de Flicks e Otimização da Movimentação do Card Popover (Fase 8 — Tarefa 8.1)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      window.innerWidth = 1280;
      window.innerHeight = 900;
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      document.body.innerHTML = "";
    });

    it("preserva o nó DOM do card aside sem unmount/mount destrutivo ao trocar de passo", async () => {
      const user = userEvent.setup();
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const aside1 = document.querySelector("aside");
      expect(aside1).not.toBeNull();
      expect(aside1?.getAttribute("data-tour-step")).toBe("finances-overview");

      // Avança para o próximo passo
      const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
      await user.click(nextBtn);

      const aside2 = document.querySelector("aside");
      expect(aside2).not.toBeNull();
      // O mesmo elemento no DOM foi preservado sem recriação (zero flick)
      expect(aside1).toBe(aside2);
      expect(aside2?.getAttribute("data-tour-step")).toBe("finances-wizard-btn");
    });

    it("utiliza aceleração por hardware GPU translate3d e transição posicional suave no desktop", () => {
      startDemo("finances");

      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(targetEl);

      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 200,
        y: 100,
        left: 200,
        top: 100,
        right: 600,
        bottom: 250,
        width: 400,
        height: 150,
        toJSON: () => ({}),
      });

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      // Transição suave exclusiva de transform e opacity
      expect(aside?.style.transition).toBe(
        "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
      );
      // Movimentação posicional via translate3d
      expect(aside?.style.transform).toContain("translate3d(");
      expect(aside?.style.top).toBe("0px");
      expect(aside?.style.left).toBe("0px");
      expect(aside?.style.opacity).toBe("1");
    });

    it("aplica classe animate-fade-in no bloco textual interno garantindo cross-fade suave", () => {
      startDemo("finances");

      const { container } = render(<DemoTourSpotlight />);

      const textContainer = container.querySelector('div[aria-live="polite"]');
      expect(textContainer).not.toBeNull();
      expect(textContainer?.className).toContain("animate-fade-in");

      const stepBadgeText = container.querySelector("span.animate-fade-in");
      expect(stepBadgeText).not.toBeNull();
      expect(stepBadgeText?.textContent).toContain("Passo 1 de 8");
    });
  });

  describe("Correção Canônica da Taxonomia e Rótulos Semânticos nos Badges (Fase 8 — Tarefa 8.2)", () => {
    it("exibe 'Finanças Diárias' nos micro-tours de cartões, orçamentos, wizard, visão geral e insights, nunca 'Investimentos'", () => {
      const financeTracks: Array<"finances_cards" | "finances_budgets" | "finances_wizard" | "finances_overview" | "finances_insights"> = [
        "finances_cards",
        "finances_budgets",
        "finances_wizard",
        "finances_overview",
        "finances_insights",
      ];

      financeTracks.forEach((track) => {
        cleanup();
        startDemo(track);

        render(<DemoTourSpotlight />);

        // O badge deve exibir estritamente "Finanças Diárias"
        expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
        // Não deve exibir de forma alguma "Investimentos"
        expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
      });
    });

    it("exibe 'Investimentos' nas trilhas e micro-tours de investimentos", () => {
      const investmentTracks: Array<"investments" | "investments_overview" | "investments_assets" | "investments_targets" | "investments_aporte"> = [
        "investments",
        "investments_overview",
        "investments_assets",
        "investments_targets",
        "investments_aporte",
      ];

      investmentTracks.forEach((track) => {
        cleanup();
        startDemo(track);

        render(<DemoTourSpotlight />);

        expect(screen.getByText("Investimentos")).toBeInTheDocument();
        expect(screen.queryByText("Finanças Diárias")).not.toBeInTheDocument();
      });
    });

    it("exibe 'Configurações' no micro-tour de configurações e suporte", () => {
      cleanup();
      startDemo("settings_support");

      render(<DemoTourSpotlight />);

      expect(screen.getByText("Configurações")).toBeInTheDocument();
      expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
      expect(screen.queryByText("Finanças Diárias")).not.toBeInTheDocument();
    });

    it("exibe 'App Nativo' no micro-tour de recursos nativos do APK Android", () => {
      cleanup();
      startDemo("app_native_apk");

      render(<DemoTourSpotlight />);

      expect(screen.getByText("App Nativo")).toBeInTheDocument();
      expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
      expect(screen.queryByText("Finanças Diárias")).not.toBeInTheDocument();
    });
  });

  describe("Didática Real de Lançamento de Transações — Foco no Modal LaunchWizard (Fase 8 — Tarefa 8.3)", () => {
    it("foca no modal LaunchWizard no passo 2 de finances_wizard com didática completa e seletor launch-wizard-dialog", () => {
      window.innerWidth = 1024;
      window.innerHeight = 768;

      const wizardDialog = document.createElement("div");
      wizardDialog.setAttribute("data-tour", "launch-wizard-dialog");
      wizardDialog.setAttribute("role", "dialog");
      document.body.appendChild(wizardDialog);

      vi.spyOn(wizardDialog, "getBoundingClientRect").mockReturnValue({
        x: 200,
        y: 120,
        left: 200,
        top: 120,
        right: 824,
        bottom: 600,
        width: 624,
        height: 480,
        toJSON: () => ({}),
      });

      startDemo("finances_wizard");
      setStepIndex(1); // Passo 2: wizard-flow-selection

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(screen.getByText("Passo 2 de 3")).toBeInTheDocument();
      expect(screen.getByText("Lançamento de Despesa, Receita e Pix")).toBeInTheDocument();
      expect(
        screen.getByText(/Alterne com facilidade entre Despesa, Receita e Pix/i),
      ).toBeInTheDocument();

      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      // padding de 6px configurado para o modal
      expect(border.getAttribute("x")).toBe("194");
      expect(border.getAttribute("y")).toBe("114");

      const aside = container.querySelector("aside");
      expect(aside?.getAttribute("data-tour-step")).toBe("wizard-flow-selection");
    });

    it("limpa parâmetros de URL novo= ao fechar o tour enquanto no modal assistido", async () => {
      const user = userEvent.setup();
      startDemo("finances_wizard");
      setStepIndex(1);

      mockPathname = "/transacoes";
      mockSearch = "?novo=despesa";

      render(<DemoTourSpotlight />);

      const closeButton = screen.getByLabelText("Encerrar tour demonstrativo");
      await user.click(closeButton);

      expect(mockNavigate).toHaveBeenCalledWith("/transacoes", { replace: true });
    });
  });

  describe("Diagnóstico do Passo 5 de Configurações Invisível / Órfão (Fase 8 — Tarefa 8.5)", () => {
    let mainContainer: HTMLElement;

    beforeEach(() => {
      mainContainer = document.createElement("main");
      mainContainer.id = "main-content";
      Object.defineProperty(mainContainer, "scrollHeight", { configurable: true, value: 2400 });
      Object.defineProperty(mainContainer, "clientHeight", { configurable: true, value: 800 });
      mainContainer.scrollTop = 0;
      const scrollToSpy = vi.fn();
      mainContainer.scrollTo = scrollToSpy;
      document.body.appendChild(mainContainer);
    });

    afterEach(() => {
      mainContainer.remove();
      document.body.innerHTML = "";
    });

    it("dispara rolagem garantida até o fim do #main-content (container.scrollHeight) no passo 5 de configurações", () => {
      const supportCard = document.createElement("section");
      supportCard.setAttribute("data-tour", "settings-support-card");
      mainContainer.appendChild(supportCard);

      vi.spyOn(supportCard, "getBoundingClientRect").mockReturnValue({
        x: 32,
        y: 600,
        left: 32,
        top: 600,
        right: 992,
        bottom: 740,
        width: 960,
        height: 140,
        toJSON: () => ({}),
      });

      startDemo("settings_support");
      setStepIndex(4); // Passo 5 de 5: settings-support-channel

      render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(mainContainer.scrollTo).toHaveBeenCalledWith({
        top: 2400,
        behavior: "smooth",
      });
      expect(screen.getByText("Central de Ajuda & Suporte Direto")).toBeInTheDocument();
      expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    });

    it("ancora o card popover no topo com preferredPlacement: 'top' e mantém coordenadas visíveis", () => {
      window.innerWidth = 375;
      window.innerHeight = 812;

      const supportCard = document.createElement("section");
      supportCard.setAttribute("data-tour", "settings-support-card");
      mainContainer.appendChild(supportCard);

      // Elemento no rodapé da página móvel
      vi.spyOn(supportCard, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 620,
        left: 16,
        top: 620,
        right: 359,
        bottom: 760,
        width: 343,
        height: 140,
        toJSON: () => ({}),
      });

      startDemo("settings_support");
      setStepIndex(4);

      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe("top");
      expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");
      expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    });

    it("ao avançar do Passo 4 para o Passo 5 navega para /configuracoes sem resetar scroll para zero", async () => {
      const user = userEvent.setup();

      startDemo("settings_support");
      setStepIndex(3); // Passo 4: settings-notifications (/configuracoes?tab=notifications)

      const notificationsCard = document.createElement("div");
      notificationsCard.setAttribute("data-tour", "settings-notifications-card");
      mainContainer.appendChild(notificationsCard);

      render(<DemoTourSpotlight />);

      const nextButton = screen.getByRole("button", { name: "Próximo passo" });
      await user.click(nextButton);

      expect(mockNavigate).toHaveBeenCalledWith("/configuracoes");
    });
  });

  describe("Resiliência de Carregamento e Foco de Elementos com Montagem Tardia (Fase 8 — Tarefa 8.7)", () => {
    it("exibe esqueleto discreto de foco com pulso suave enquanto o elemento assíncrono não foi montado no DOM", () => {
      startDemo("finances"); // Passo 1: targetSelector = '[data-tour="overview-kpis"]'

      render(<DemoTourSpotlight />);

      // Elemento ainda não foi montado: esqueleto de loading deve estar presente com pulso suave
      const skeleton = screen.getByTestId("spotlight-loading-skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute("stroke-dasharray", "4 4");
      expect(skeleton.getAttribute("class")).toContain("animate-pulse");

      // Borda do elemento real NÃO deve existir enquanto estiver carregando
      expect(screen.queryByTestId("spotlight-border")).not.toBeInTheDocument();
    });

    it("detecta montagem tardia de elemento via MutationObserver, remove o esqueleto e ativa o spotlight real", async () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      expect(screen.getByTestId("spotlight-loading-skeleton")).toBeInTheDocument();

      // Monta o elemento assincronamente no DOM após a renderização inicial
      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", "overview-kpis");
      targetEl.scrollIntoView = vi.fn();
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 120,
        left: 16,
        top: 120,
        right: 356,
        bottom: 240,
        width: 340,
        height: 120,
        toJSON: () => ({}),
      });

      // Dispara a mutação no DOM (inserção de nó filho capturada pelo MutationObserver)
      act(() => {
        document.body.appendChild(targetEl);
      });

      // MutationObserver detecta a inserção, remove o esqueleto e exibe a borda real do spotlight
      await waitFor(() => {
        expect(screen.queryByTestId("spotlight-loading-skeleton")).not.toBeInTheDocument();
        expect(screen.getByTestId("spotlight-border")).toBeInTheDocument();
      });
    });

    it("detecta elemento presente no DOM que ganha dimensões assíncronas via polling adaptativo", () => {
      vi.useFakeTimers();
      try {
        startDemo("finances");

        const targetEl = document.createElement("div");
        targetEl.setAttribute("data-tour", "overview-kpis");
        targetEl.scrollIntoView = vi.fn();
        document.body.appendChild(targetEl);

        let hasDimensions = false;
        vi.spyOn(targetEl, "getBoundingClientRect").mockImplementation(() => {
          if (!hasDimensions) {
            return {
              x: 0,
              y: 0,
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              width: 0,
              height: 0,
              toJSON: () => ({}),
            };
          }
          return {
            x: 16,
            y: 80,
            left: 16,
            top: 80,
            right: 356,
            bottom: 200,
            width: 340,
            height: 120,
            toJSON: () => ({}),
          };
        });

        render(<DemoTourSpotlight />);

        // Inicialmente com dimensões 0, o esqueleto de carregamento continua ativo
        expect(screen.getByTestId("spotlight-loading-skeleton")).toBeInTheDocument();
        expect(screen.queryByTestId("spotlight-border")).not.toBeInTheDocument();

        // Dados assíncronos chegam e o elemento ganha dimensões reais
        hasDimensions = true;

        // Avança 1 ciclo do polling adaptativo (100ms)
        act(() => {
          vi.advanceTimersByTime(120);
        });

        // Polling adaptativo detectou dimensões válidas: remove esqueleto e ativa borda real
        expect(screen.queryByTestId("spotlight-loading-skeleton")).not.toBeInTheDocument();
        expect(screen.getByTestId("spotlight-border")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("aciona fallback gracioso após timeout de 2.5s sem travar o card nem congelar a tela", () => {
      vi.useFakeTimers();
      try {
        startDemo("finances");

        render(<DemoTourSpotlight />);

        // Inicialmente buscando: esqueleto de loading visível
        expect(screen.getByTestId("spotlight-loading-skeleton")).toBeInTheDocument();

        // Avança o timeout de 2.5s (2500ms)
        act(() => {
          vi.advanceTimersByTime(2500);
        });

        // Fallback gracioso acionado: esqueleto removido, rect nulo, card funcional no centro
        expect(screen.queryByTestId("spotlight-loading-skeleton")).not.toBeInTheDocument();
        expect(screen.queryByTestId("spotlight-border")).not.toBeInTheDocument();

        const card = screen.getByRole("dialog");
        expect(card).toBeInTheDocument();
        expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Próximo passo" })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it("limpa imediatamente o recorte antigo ao trocar de passo evitando 'recorte preto congelado'", async () => {
      const user = userEvent.setup();
      startDemo("finances");

      // Passo 1 com elemento presente
      const step1El = document.createElement("div");
      step1El.setAttribute("data-tour", "overview-kpis");
      step1El.scrollIntoView = vi.fn();
      document.body.appendChild(step1El);

      vi.spyOn(step1El, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 80,
        left: 16,
        top: 80,
        right: 356,
        bottom: 200,
        width: 340,
        height: 120,
        toJSON: () => ({}),
      });

      render(<DemoTourSpotlight />);

      // Passo 1 está iluminado com borda ativa
      expect(screen.getByTestId("spotlight-border")).toBeInTheDocument();

      // Avança para o Passo 2 (que procura o botão wizard na BottomNav, que ainda não foi montado)
      const nextBtn = screen.getByRole("button", { name: "Próximo passo" });
      await user.click(nextBtn);

      // Ao trocar de passo, o recorte antigo DEVE ser limpo imediatamente (zero recorte congelado)
      expect(screen.queryByTestId("spotlight-border")).not.toBeInTheDocument();
      // E o esqueleto de carregamento assume o lugar enquanto o nó do passo 2 é aguardado
      expect(screen.getByTestId("spotlight-loading-skeleton")).toBeInTheDocument();
    });
  });

  describe("Adaptação Responsiva Desktop vs Mobile — Tratamento para Ausência de FAB (Fase 8 — Tarefa 8.8)", () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    beforeEach(() => {
      resetDemoSession();
      document.body.innerHTML = "";
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      resetDemoSession();
      document.body.innerHTML = "";
    });

    it("no Desktop (window.innerWidth >= 768), foca em [data-tour='desktop-new-transaction'] e exibe atalho Ctrl+K", () => {
      window.innerWidth = 1024;
      window.innerHeight = 768;

      // Elemento desktop de nova transação (botão de busca/comando no header)
      const desktopBtn = document.createElement("button");
      desktopBtn.setAttribute("data-tour", "desktop-new-transaction");
      document.body.appendChild(desktopBtn);

      vi.spyOn(desktopBtn, "getBoundingClientRect").mockReturnValue({
        x: 200,
        y: 12,
        left: 200,
        top: 12,
        right: 600,
        bottom: 52,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      });

      startDemo("finances_wizard");
      const { container } = render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Título e conteúdo adaptativos para desktop
      expect(
        screen.getByText("Comandos Rápidos & Atalho (Ctrl+K)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/utilize a barra de busca e comandos ou pressione Ctrl\+K/i),
      ).toBeInTheDocument();

      // Spotlight border recortando o botão desktop com raio retangular
      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      expect(border.getAttribute("width")).toBe("420"); // 400 + 20
      expect(border.getAttribute("height")).toBe("60"); // 40 + 20
      expect(border.getAttribute("rx")).toBe("8");

      // No desktop com elemento no topo da tela, o popover ancora em "bottom"
      const aside = container.querySelector("aside");
      expect(aside?.getAttribute("data-placement")).toBe("bottom");
    });

    it("no Mobile (window.innerWidth < 768), foca em [data-tour='bottom-nav-wizard'] e exibe textos da barra inferior", () => {
      window.innerWidth = 375;
      window.innerHeight = 812;

      // Elemento FAB central da BottomNav
      const fabBtn = document.createElement("span");
      fabBtn.setAttribute("data-tour", "bottom-nav-wizard");
      document.body.appendChild(fabBtn);

      vi.spyOn(fabBtn, "getBoundingClientRect").mockReturnValue({
        x: 160,
        y: 730,
        left: 160,
        top: 730,
        right: 216,
        bottom: 786,
        width: 56,
        height: 56,
        toJSON: () => ({}),
      });

      startDemo("finances_wizard");
      render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Título e conteúdo voltados para o mobile
      expect(
        screen.getByText("Acesso Rápido com o Botão Central (+)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/O botão de destaque central na barra inferior permite registrar/i),
      ).toBeInTheDocument();

      // Spotlight circular (rx=9999) ao redor do botão FAB
      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      expect(border.getAttribute("rx")).toBe("9999");
      expect(border.getAttribute("ry")).toBe("9999");
    });

    it("na trilha finances completa (Passo 2), prioriza [data-tour='desktop-new-transaction'] no desktop", async () => {
      window.innerWidth = 1200;
      window.innerHeight = 800;

      const user = userEvent.setup();

      // Elementos do passo 1 e passo 2
      const step1El = document.createElement("div");
      step1El.setAttribute("data-tour", "overview-kpis");
      document.body.appendChild(step1El);

      const desktopBtn = document.createElement("button");
      desktopBtn.setAttribute("data-tour", "desktop-new-transaction");
      document.body.appendChild(desktopBtn);

      vi.spyOn(step1El, "getBoundingClientRect").mockReturnValue({
        x: 40,
        y: 80,
        left: 40,
        top: 80,
        right: 800,
        bottom: 240,
        width: 760,
        height: 160,
        toJSON: () => ({}),
      });

      vi.spyOn(desktopBtn, "getBoundingClientRect").mockReturnValue({
        x: 300,
        y: 12,
        left: 300,
        top: 12,
        right: 700,
        bottom: 52,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      });

      startDemo("finances");
      render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Avança para o Passo 2
      const nextBtn = screen.getByRole("button", { name: "Próximo passo" });
      await user.click(nextBtn);

      expect(screen.getByText("Passo 2 de 8")).toBeInTheDocument();
      expect(
        screen.getByText("Comandos Rápidos & Atalho (Ctrl+K)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No desktop, acione a barra de comandos ou utilize o atalho Ctrl\+K/i),
      ).toBeInTheDocument();

      const border = screen.getByTestId("spotlight-border");
      expect(border).toBeInTheDocument();
      expect(border.getAttribute("width")).toBe("420");
    });

    it("adapta dinamicamente o alvo e textos ao redimensionar a tela entre desktop e mobile", () => {
      // Inicia em Mobile
      window.innerWidth = 375;
      window.innerHeight = 812;

      const fabBtn = document.createElement("span");
      fabBtn.setAttribute("data-tour", "bottom-nav-wizard");
      document.body.appendChild(fabBtn);

      const desktopBtn = document.createElement("button");
      desktopBtn.setAttribute("data-tour", "desktop-new-transaction");
      document.body.appendChild(desktopBtn);

      vi.spyOn(fabBtn, "getBoundingClientRect").mockReturnValue({
        x: 160,
        y: 730,
        left: 160,
        top: 730,
        right: 216,
        bottom: 786,
        width: 56,
        height: 56,
        toJSON: () => ({}),
      });

      vi.spyOn(desktopBtn, "getBoundingClientRect").mockReturnValue({
        x: 200,
        y: 12,
        left: 200,
        top: 12,
        right: 600,
        bottom: 52,
        width: 400,
        height: 40,
        toJSON: () => ({}),
      });

      startDemo("finances_wizard");
      render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Inicialmente em mobile
      expect(screen.getByText("Acesso Rápido com o Botão Central (+)")).toBeInTheDocument();
      let border = screen.getByTestId("spotlight-border");
      expect(border.getAttribute("rx")).toBe("9999");

      // Redimensiona para Desktop
      act(() => {
        window.innerWidth = 1024;
        window.dispatchEvent(new Event("resize"));
      });

      // Adapta imediatamente para os textos e recorte desktop
      expect(screen.getByText("Comandos Rápidos & Atalho (Ctrl+K)")).toBeInTheDocument();
      border = screen.getByTestId("spotlight-border");
      expect(border.getAttribute("width")).toBe("420");
      expect(border.getAttribute("rx")).toBe("8");
    });
  });

  describe("Validação Integrada da Fase 8 (Fase 8 — Tarefa 8.11)", () => {
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      resetDemoSession();
      document.body.innerHTML = "";
    });

    afterEach(() => {
      window.innerWidth = originalInnerWidth;
      window.innerHeight = originalInnerHeight;
      resetDemoSession();
      document.body.innerHTML = "";
    });

    describe("Persistência Estrita do Nó DOM do Card Popover e Ausência de Flicks", () => {
      it("preserva a MESMA instância do nó aside através de 5 transições consecutivas (avançar, retroceder e salto por dots)", async () => {
        const user = userEvent.setup();
        window.innerWidth = 1280;
        window.innerHeight = 900;

        startDemo("finances");
        const { container } = render(<DemoTourSpotlight />);

        const asideInitial = container.querySelector("aside");
        expect(asideInitial).not.toBeNull();
        expect(asideInitial?.getAttribute("data-tour-step")).toBe("finances-overview");

        // Passo 1 -> Passo 2
        const nextBtn = screen.getByRole("button", { name: "Próximo passo" });
        await user.click(nextBtn);
        const asideStep2 = container.querySelector("aside");
        expect(asideStep2).toBe(asideInitial);
        expect(asideStep2?.getAttribute("data-tour-step")).toBe("finances-wizard-btn");

        // Passo 2 -> Passo 3
        await user.click(screen.getByRole("button", { name: "Próximo passo" }));
        const asideStep3 = container.querySelector("aside");
        expect(asideStep3).toBe(asideInitial);
        expect(asideStep3?.getAttribute("data-tour-step")).toBe("finances-wizard-dialog");

        // Passo 3 -> Passo 2 (Retroceder)
        const prevBtn = screen.getByRole("button", { name: "Passo anterior" });
        await user.click(prevBtn);
        const asideStep2Back = container.querySelector("aside");
        expect(asideStep2Back).toBe(asideInitial);
        expect(asideStep2Back?.getAttribute("data-tour-step")).toBe("finances-wizard-btn");

        // Salto direto para o Passo 5 através dos dots de navegação
        const dot5 = screen.getByRole("button", { name: "Ir para o passo 5" });
        await user.click(dot5);
        const asideStep5 = container.querySelector("aside");
        expect(asideStep5).toBe(asideInitial);
        expect(asideStep5?.getAttribute("data-tour-step")).toBe("finances-cards");

        // Confirma estilização acelerada por GPU e transição suave no container persistido
        expect(asideInitial?.style.transition).toContain("transform 300ms");
        expect(asideInitial?.style.transform).toContain("translate3d(");
      });

      it("garante que o container textual interno atualiza o conteúdo com aria-live sem recriar o envelope do card", async () => {
        const user = userEvent.setup();
        window.innerWidth = 1024;
        window.innerHeight = 768;

        startDemo("settings_support");
        const { container } = render(<DemoTourSpotlight />);

        const aside = container.querySelector("aside");
        const liveRegion = aside?.querySelector('div[aria-live="polite"]');
        expect(liveRegion).not.toBeNull();

        // Inicialmente no passo 1
        expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
        expect(screen.getByText("Atalhos Rápidos de Cabeçalho")).toBeInTheDocument();

        // Avança para o passo 2
        await user.click(screen.getByRole("button", { name: "Próximo passo" }));

        // O nó do card aside é preservado
        expect(container.querySelector("aside")).toBe(aside);
        // O conteúdo textual interno transicionou suavemente com fade-in
        expect(screen.getByText("Passo 2 de 5")).toBeInTheDocument();
        expect(screen.getByText("Modos de Experiência & Sensorial")).toBeInTheDocument();
        expect(liveRegion?.className).toContain("animate-fade-in");
      });
    });

    describe("Resiliência com MutationObserver em Montagens Tardias Profundas", () => {
      it("detecta montagem tardia de elemento aninhado profundamente em container assíncrono", async () => {
        window.innerWidth = 375;
        window.innerHeight = 812;

        startDemo("finances"); // Passo 1 procura [data-tour="overview-kpis"]

        const mainContainer = document.createElement("main");
        mainContainer.id = "main-content";
        document.body.appendChild(mainContainer);

        render(<DemoTourSpotlight />);

        // Inicialmente em estado de busca com esqueleto de pulso ativo
        expect(screen.getByTestId("spotlight-loading-skeleton")).toBeInTheDocument();
        expect(screen.queryByTestId("spotlight-border")).not.toBeInTheDocument();

        // Cria estrutura aninhada com atraso assíncrono (simulando montagem de tabela/card após query)
        const wrapper = document.createElement("div");
        wrapper.className = "dashboard-grid";

        const cardSection = document.createElement("section");
        cardSection.className = "kpi-section";

        const targetEl = document.createElement("div");
        targetEl.setAttribute("data-tour", "overview-kpis");
        targetEl.scrollIntoView = vi.fn();
        vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
          x: 16,
          y: 90,
          left: 16,
          top: 90,
          right: 359,
          bottom: 230,
          width: 343,
          height: 140,
          toJSON: () => ({}),
        });

        cardSection.appendChild(targetEl);
        wrapper.appendChild(cardSection);

        // Insere a árvore profunda no #main-content
        act(() => {
          mainContainer.appendChild(wrapper);
        });

        // MutationObserver com subtree: true intercepta a inserção e ativa o spotlight real
        await waitFor(() => {
          expect(screen.queryByTestId("spotlight-loading-skeleton")).not.toBeInTheDocument();
          expect(screen.getByTestId("spotlight-border")).toBeInTheDocument();
        });
      });

      it("desconecta o MutationObserver e limpa timers sem disparar callbacks após unmount", () => {
        const disconnectSpy = vi.fn();
        const originalMO = window.MutationObserver;

        class TrackedMutationObserver extends originalMO {
          override disconnect(): void {
            disconnectSpy();
            super.disconnect();
          }
        }
        window.MutationObserver = TrackedMutationObserver;

        try {
          startDemo("finances");
          const { unmount } = render(<DemoTourSpotlight />);

          unmount();
          expect(disconnectSpy).toHaveBeenCalled();
        } finally {
          window.MutationObserver = originalMO;
        }
      });
    });

    describe("Cálculo da Janela Livre Útil Mobile e Ausência de Sobreposição por BottomNav", () => {
      it("rola o container #main-content para o Dead Center livre garantindo ausência de sobreposição pela BottomNav", () => {
        window.innerWidth = 375;
        window.innerHeight = 812;

        const mainContainer = document.createElement("main");
        mainContainer.id = "main-content";
        const scrollToSpy = vi.fn();
        mainContainer.scrollTo = scrollToSpy;
        Object.defineProperty(mainContainer, "scrollTop", { value: 200, configurable: true });
        Object.defineProperty(mainContainer, "scrollHeight", { value: 1600, configurable: true });
        Object.defineProperty(mainContainer, "clientHeight", { value: 740, configurable: true });
        document.body.appendChild(mainContainer);

        // Elemento posicionado na parte inferior da tela (y = 650, height = 80 -> centerY = 690)
        // Sem o cálculo do Dead Center livre, ficaria colado ou encoberto pela BottomNav (740..812)
        const targetEl = document.createElement("div");
        targetEl.setAttribute("data-tour", "overview-kpis");
        mainContainer.appendChild(targetEl);

        vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
          x: 16,
          y: 650,
          left: 16,
          top: 650,
          right: 359,
          bottom: 730,
          width: 343,
          height: 80,
          toJSON: () => ({}),
        });

        startDemo("finances");
        render(<DemoTourSpotlight />);

        // O alvo está em centerY = 690 (> 812 * 0.45 = 365), portanto o card ancorará no TOPO
        // freeWindow: top = 64 + 180 + 16 = 260, bottom = 812 - 72 - 16 = 724
        // freeWindow.centerY = 260 + (724 - 260) / 2 = 492
        // targetScrollTop = containerScrollTop (200) + (elementCenterY 690 - freeWindowCenterY 492) = 200 + 198 = 398
        expect(scrollToSpy).toHaveBeenCalledWith({
          top: 398,
          behavior: "smooth",
        });
      });
    });

    describe("Teste Manual Desktop e Mobile — Percurso dos Tours de Finanças e Orçamentos (Portão de Qualidade 8)", () => {
      it("no Desktop (1024x768), percorre todos os 8 passos do tour de Finanças e confirma que todos os badges exibem 'Finanças Diárias' e nunca 'Investimentos'", async () => {
        const user = userEvent.setup();
        window.innerWidth = 1024;
        window.innerHeight = 768;

        startDemo("finances");
        render(<DemoTourSpotlight />);

        // Percorre para frente: passos 1 a 8
        for (let step = 1; step <= 8; step++) {
          expect(screen.getByText(`Passo ${step} de 8`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();

          if (step < 8) {
            const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
            await user.click(nextBtn);
          }
        }

        // Percorre para trás: passos 7 a 1
        for (let step = 7; step >= 1; step--) {
          const prevBtn = screen.getByRole("button", { name: /Passo anterior/i });
          await user.click(prevBtn);

          expect(screen.getByText(`Passo ${step} de 8`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
        }
      });

      it("no Desktop (1024x768), percorre todos os 3 passos do micro-tour de Orçamentos e confirma que os badges exibem 'Finanças Diárias'", async () => {
        const user = userEvent.setup();
        window.innerWidth = 1024;
        window.innerHeight = 768;

        startDemo("finances_budgets");
        render(<DemoTourSpotlight />);

        // Percorre para frente: passos 1 a 3
        for (let step = 1; step <= 3; step++) {
          expect(screen.getByText(`Passo ${step} de 3`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();

          if (step < 3) {
            const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
            await user.click(nextBtn);
          }
        }

        // Percorre para trás: passos 2 a 1
        for (let step = 2; step >= 1; step--) {
          const prevBtn = screen.getByRole("button", { name: /Passo anterior/i });
          await user.click(prevBtn);

          expect(screen.getByText(`Passo ${step} de 3`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
        }
      });

      it("no Mobile (375x667), percorre todos os 8 passos do tour de Finanças e confirma que todos os badges exibem 'Finanças Diárias' e layout mobile", async () => {
        const user = userEvent.setup();
        window.innerWidth = 375;
        window.innerHeight = 667;

        startDemo("finances");
        const { container } = render(<DemoTourSpotlight />);

        const aside = container.querySelector("aside[data-tour-spotlight-card='true']");
        expect(aside?.className).toContain("inset-x-3");

        // Percorre para frente: passos 1 a 8
        for (let step = 1; step <= 8; step++) {
          expect(screen.getByText(`Passo ${step} de 8`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();

          if (step < 8) {
            const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
            await user.click(nextBtn);
          }
        }

        // Percorre para trás: passos 7 a 1
        for (let step = 7; step >= 1; step--) {
          const prevBtn = screen.getByRole("button", { name: /Passo anterior/i });
          await user.click(prevBtn);

          expect(screen.getByText(`Passo ${step} de 8`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
        }
      });

      it("no Mobile (375x667), percorre todos os 3 passos do micro-tour de Orçamentos e confirma que os badges exibem 'Finanças Diárias'", async () => {
        const user = userEvent.setup();
        window.innerWidth = 375;
        window.innerHeight = 667;

        startDemo("finances_budgets");
        render(<DemoTourSpotlight />);

        // Percorre para frente: passos 1 a 3
        for (let step = 1; step <= 3; step++) {
          expect(screen.getByText(`Passo ${step} de 3`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();

          if (step < 3) {
            const nextBtn = screen.getByRole("button", { name: /Próximo passo/i });
            await user.click(nextBtn);
          }
        }

        // Percorre para trás: passos 2 a 1
        for (let step = 2; step >= 1; step--) {
          const prevBtn = screen.getByRole("button", { name: /Passo anterior/i });
          await user.click(prevBtn);

          expect(screen.getByText(`Passo ${step} de 3`)).toBeInTheDocument();
          expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
          expect(screen.queryByText("Investimentos")).not.toBeInTheDocument();
        }
      });
    });
  });
});
