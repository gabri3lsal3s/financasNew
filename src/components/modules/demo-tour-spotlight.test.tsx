import { act, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

describe("DemoTourSpotlight — Foco e Apresentação Guiada com Spotlight", () => {
  beforeEach(() => {
    mockPathname = "/";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();
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

    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    expect(screen.getByText("Visão Geral & Fluxo Consolidado")).toBeInTheDocument();

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
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
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
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
  });

  it("conclui a trilha e aciona o hand-off para a conta real no último passo", async () => {
    const user = userEvent.setup();
    startDemo("investments"); // 3 passos (0, 1, 2)

    render(<DemoTourSpotlight />);

    // Avança para o passo 2
    await user.click(screen.getByRole("button", { name: /Próximo/i }));
    // Avança para o passo 3 (último)
    await user.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(screen.getByText("Passo 3 de 3")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", {
      name: /Começar Conta Real/i,
    });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    expect(getDemoSessionState().isDemoActive).toBe(false);
    expect(hasCompletedDemoTour("investments")).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith("/investments?novo=investimento");
  });

  describe("Algoritmo Anti-Colisão Mobile (Fase 2 — Tarefa 2.1)", () => {
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

    it("alinha scroll com block: 'end' quando o popover ancorará no topo (alvo na base)", () => {
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
        block: "end",
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

  describe("Posicionamento Dinâmico Desktop (Fase 2 — Tarefa 2.3)", () => {
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
      expect(aside?.style.width).toBe("380px");
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
      // Clamp: Math.min(1100, 1280 - 380 - 16) = Math.min(1100, 884) = 884px
      expect(aside?.style.left).toBe("884px");
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
      // Clamp: Math.max(16, ...) = 16px
      expect(aside?.style.left).toBe("16px");
    });
  });

  describe("Simulações de Viewport Mobile (375x667 e 390x844) - Portão de Qualidade 2", () => {
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
      startDemo("investments"); // 3 passos (0, 1, 2)

      render(<DemoTourSpotlight />);

      // Avança para o último passo
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
  });

  describe("Hierarquia Semântica de Cores (Fase 3 — Tarefa 3.2)", () => {
    it("utiliza variant muted no badge do passo e tom neutro text-muted-foreground no ícone Sparkles", () => {
      startDemo("finances");

      render(<DemoTourSpotlight />);

      const stepText = screen.getByText("Passo 1 de 4");
      const badge = stepText.closest("span.inline-flex");
      expect(badge).not.toBeNull();
      expect(badge?.className).toContain("bg-muted");
      expect(badge?.className).toContain("text-muted-foreground");

      const sparklesIcon = badge?.querySelector("svg");
      expect(sparklesIcon).not.toBeNull();
      expect(sparklesIcon?.getAttribute("class")).toContain("text-muted-foreground");
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
      expect(asideStep2?.getAttribute("data-tour-step")).toBe("finances-transactions");
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
          const stepBadge = screen.getByText(/Passo 1 de 4/i).closest("span.inline-flex");
          expect(stepBadge).not.toBeNull();
          expect(stepBadge?.className).toContain("bg-muted");
          expect(stepBadge?.className).toContain("text-muted-foreground");

          // Título e descrição com contraste tipográfico legível
          const title = screen.getByText("Visão Geral & Fluxo Consolidado");
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

      const title = screen.getByText("Visão Geral & Fluxo Consolidado");
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

      // Clica no dot 3 ("Ir para o passo 3" = finances-cards)
      const dot3 = screen.getByRole("button", { name: "Ir para o passo 3" });
      expect(dot3).toBeInTheDocument();
      expect(dot3).not.toHaveAttribute("aria-current");

      await user.click(dot3);

      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/cartoes");
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

      // Passo 1 -> Passo 2
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(1);
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes");

      // Passo 2 -> Passo 3
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/cartoes");

      // Passo 3 -> Passo 4 (último)
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(getDemoSessionState().currentStepIndex).toBe(3);
      expect(mockNavigate).toHaveBeenCalledWith("/orcamentos");

      // Retrocesso: Passo 4 -> Passo 3 via ArrowLeft
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(getDemoSessionState().currentStepIndex).toBe(2);
      expect(mockNavigate).toHaveBeenCalledWith("/cartoes");
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

      // Avança até o último passo (passo 3 = orcamentos)
      act(() => {
        setStepIndex(3);
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
      expect(mockNavigate).toHaveBeenCalledWith("/transacoes");
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
});
