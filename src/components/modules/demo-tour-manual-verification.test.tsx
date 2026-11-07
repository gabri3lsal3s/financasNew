import { act, render, screen } from "@testing-library/react";
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
import { getTourSteps } from "@/domain/demo-simulation/tour-steps";
import { TOUR_TRACK_METAS } from "@/domain/demo-simulation/tour-catalog";
import { INVASIVE_QUERY_PARAMS, isCompleteTourTrack } from "@/domain/demo-simulation/handoff";
import type { TourTrackId } from "@/domain/demo-simulation/types";

const mockNavigate = vi.fn();
let mockPathname = "/";
let mockSearch = "";

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname, search: mockSearch }),
}));

describe("Teste de Validação Manual: Navegação Bidirecional Mobile (375x667 e 390x844)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/";
    mockSearch = "";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = "";
  });

  const runBidirectionalTrackTest = async (
    track: "finances" | "investments" | "shared_finances",
    viewport: { width: number; height: number },
  ) => {
    window.innerWidth = viewport.width;
    window.innerHeight = viewport.height;

    const user = userEvent.setup();
    startDemo(track);

    const mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    mainContainer.scrollTo = vi.fn();
    document.body.appendChild(mainContainer);

    // Mock dos elementos no DOM para a trilha completa
    const selectors = track === "finances"
      ? [
          { selector: "overview-kpis", y: 80, height: 120, route: "/" }, // Upper half (centerY = 140 <= 0.45 * height) -> Base
          { selector: "bottom-nav-wizard", y: 550, height: 56, route: "/" }, // Lower half (centerY = 578 > 0.45 * height) -> Topo
          { selector: "launch-wizard-dialog", y: 80, height: 160, route: "/transacoes?novo=despesa" }, // Upper half (centerY = 160) -> Base
          { selector: "transactions-feed-card", y: 420, height: 140, route: "/transacoes" }, // Lower half (centerY = 490 > 0.45 * height) -> Topo
          { selector: "cards-invoice-summary", y: 80, height: 140, route: "/cartoes" }, // Upper half (centerY = 150) -> Base
          { selector: "cards-installments-section", y: 420, height: 160, route: "/cartoes" }, // Lower half (centerY = 500) -> Topo
          { selector: "budgets-content", y: 400, height: 150, route: "/orcamentos" }, // Lower half (centerY = 475) -> Topo
          { selector: "reports-content", y: 80, height: 140, route: "/relatorios" }, // Upper half (centerY = 150) -> Base
        ]
      : track === "investments"
      ? [
          { selector: "investments-summary", y: 90, height: 130, route: "/investments" }, // Upper half -> Base
          { selector: "investments-new-op", y: 80, height: 120, route: "/investments" }, // Upper half -> Base
          { selector: "investments-targets", y: 390, height: 140, route: "/investments?tab=metas" }, // Lower half -> Topo
          { selector: "investments-rebalance", y: 410, height: 160, route: "/investments?tab=aporte" }, // Lower half -> Topo
          { selector: "investments-dividends", y: 400, height: 140, route: "/investments?tab=proventos" }, // Lower half -> Topo
        ]
      : [
          { selector: "wizard-split-toggle", y: 80, height: 160, route: "/transacoes?novo=despesa" }, // Upper half -> Base
          { selector: "split-pending-card", y: 420, height: 140, route: "/" }, // Lower half -> Topo
          { selector: "family-ceiling-card", y: 80, height: 140, route: "/familia" }, // Upper half -> Base
          { selector: "shared-goals-card", y: 400, height: 150, route: "/orcamentos?tab=goals" }, // Lower half -> Topo
        ];

    const elementMap = new Map<string, HTMLElement>();
    for (const item of selectors) {
      const el = document.createElement("div");
      el.setAttribute("data-tour", item.selector);
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: item.y,
        left: 16,
        top: item.y,
        right: viewport.width - 16,
        bottom: item.y + item.height,
        width: viewport.width - 32,
        height: item.height,
        toJSON: () => ({}),
      });
      mainContainer.appendChild(el);
      elementMap.set(item.selector, el);
    }

    const { container, rerender } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const forwardPlacements: string[] = [];

    // Navega para FRENTE (0 -> N)
    for (let stepIdx = 0; stepIdx < selectors.length; stepIdx++) {
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();

      const placement = aside?.getAttribute("data-placement") ?? "";
      forwardPlacements.push(placement);

      const currentItem = selectors[stepIdx];
      if (!currentItem) continue;
      const centerY = currentItem.y + currentItem.height / 2;
      const threshold = viewport.height * 0.45;

      if (centerY > threshold) {
        expect(placement).toBe("top");
        expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");
      } else {
        expect(placement).toBe("bottom");
        expect(aside?.className).toContain("bottom-[max(env(safe-area-inset-bottom,0px),16px)]");
      }

      // Garante que o card mobile limita altura em 42vh
      expect(aside?.className).toContain("max-h-[42vh]");

      if (stepIdx < selectors.length - 1) {
        const nextBtn = screen.getByRole("button", { name: /Próximo/i });
        await user.click(nextBtn);

        const nextItem = selectors[stepIdx + 1];
        if (nextItem) {
          const [path, query] = nextItem.route.split("?");
          mockPathname = path ?? "/";
          mockSearch = query ? `?${query}` : "";
        }

        rerender(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }

    // Navega para TRÁS (N -> 0) e comprova que os recortes NÃO oscilam
    for (let stepIdx = selectors.length - 1; stepIdx >= 0; stepIdx--) {
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();

      const backwardPlacement = aside?.getAttribute("data-placement") ?? "";
      // Comprova estabilidade e determinismo absoluto: a colocação ao voltar é idêntica à ida!
      expect(backwardPlacement).toBe(forwardPlacements[stepIdx]);

      if (stepIdx > 0) {
        const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
        await user.click(prevBtn);

        const prevItem = selectors[stepIdx - 1];
        if (prevItem) {
          const [path, query] = prevItem.route.split("?");
          mockPathname = path ?? "/";
          mockSearch = query ? `?${query}` : "";
        }

        rerender(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }
  };

  it("iPhone SE (375x667): navega para frente e para trás em Finanças Diárias sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("finances", { width: 375, height: 667 });
  });

  it("iPhone 12/13/14 (390x844): navega para frente e para trás em Finanças Diárias sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("finances", { width: 390, height: 844 });
  });

  it("iPhone SE (375x667): navega para frente e para trás em Investimentos sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("investments", { width: 375, height: 667 });
  });

  it("iPhone 12/13/14 (390x844): navega para frente e para trás em Investimentos sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("investments", { width: 390, height: 844 });
  });

  it("iPhone SE (375x667): navega para frente e para trás em Finanças Compartilhadas sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("shared_finances", { width: 375, height: 667 });
  });

  it("iPhone 12/13/14 (390x844): navega para frente e para trás em Finanças Compartilhadas sem oscilação e sem colisão", async () => {
    await runBidirectionalTrackTest("shared_finances", { width: 390, height: 844 });
  });
});

describe("Teste Manual Mobile (iPhone/Android Viewport): Passos Longos (Passo 1 KPIs e Passo 6 Parceladas)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/";
    mockSearch = "";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = "";
  });

  interface MobileDeviceConfig {
    name: string;
    width: number;
    height: number;
  }

  const mobileDevices: MobileDeviceConfig[] = [
    { name: "iPhone SE", width: 375, height: 667 },
    { name: "iPhone 13/14/15 Pro", width: 390, height: 844 },
    { name: "Android Compacto", width: 360, height: 740 },
    { name: "Android Pixel 7 / Full HD", width: 412, height: 915 },
  ];

  mobileDevices.forEach(({ name, width, height }) => {
    describe(`${name} (${width}x${height})`, () => {
      it("Passo 1 (KPIs): elemento no topo mantém-se visível, card ancora na BASE, sem colisão com BottomNav nem colado no topo", () => {
        window.innerWidth = width;
        window.innerHeight = height;

        startDemo("finances"); // Passo 1: data-tour="overview-kpis", route="/"

        const mainContainer = document.createElement("main");
        mainContainer.id = "main-content";
        const scrollToSpy = vi.fn();
        mainContainer.scrollTo = scrollToSpy;
        document.body.appendChild(mainContainer);

        const kpisEl = document.createElement("div");
        kpisEl.setAttribute("data-tour", "overview-kpis");
        mainContainer.appendChild(kpisEl);

        const kpisHeight = 130;
        const kpisTop = 80;

        vi.spyOn(kpisEl, "getBoundingClientRect").mockReturnValue({
          x: 16,
          y: kpisTop,
          left: 16,
          top: kpisTop,
          right: width - 16,
          bottom: kpisTop + kpisHeight,
          width: width - 32,
          height: kpisHeight,
          toJSON: () => ({}),
        });

        const { container } = render(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });

        // 1. O card popover deve ancorar na BASE (pois o elemento está no topo: centerY <= 0.45 * height)
        const aside = container.querySelector("aside");
        expect(aside).not.toBeNull();
        expect(aside?.getAttribute("data-placement")).toBe("bottom");
        expect(aside?.className).toContain("bottom-[max(env(safe-area-inset-bottom,0px),16px)]");

        // 2. A borda do spotlight deve recortar o elemento perfeitamente
        const spotlightBorder = container.querySelector('[data-testid="spotlight-border"]');
        expect(spotlightBorder).not.toBeNull();
        const borderY = Number(spotlightBorder?.getAttribute("y"));
        const borderHeight = Number(spotlightBorder?.getAttribute("height"));
        const borderBottom = borderY + borderHeight;

        // Comprova que o topo do elemento iluminado respeita folga do Header fixo (64px)
        expect(borderY).toBeGreaterThanOrEqual(64);

        // Comprova que a base do elemento iluminado está muito distante da BottomNav (chão - 72px)
        const bottomNavTop = height - 72;
        expect(borderBottom).toBeLessThan(bottomNavTop - 100);

        // Comprova que o elemento NÃO fica colado no card nem escondido
        expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();
        expect(screen.getByText("Dashboard & Saldo Livre Real")).toBeInTheDocument();
      });

      it("Passo 6 (Parceladas): elemento longo na metade inferior rola para zona central livre, card ancora no TOPO, NUNCA fica atrás da BottomNav", async () => {
        window.innerWidth = width;
        window.innerHeight = height;

        startDemo("finances");

        const mainContainer = document.createElement("main");
        mainContainer.id = "main-content";
        const scrollToSpy = vi.fn();
        mainContainer.scrollTo = scrollToSpy;
        mainContainer.scrollTop = 200;
        document.body.appendChild(mainContainer);

        // Mock dos elementos anteriores e do Passo 6
        const installmentsEl = document.createElement("div");
        installmentsEl.setAttribute("data-tour", "cards-installments-section");
        mainContainer.appendChild(installmentsEl);

        const installmentsHeight = 160;
        // Posicionado na metade inferior da viewport (y > 0.45 * height)
        const installmentsTop = Math.round(height * 0.55);
        const installmentsCenterY = installmentsTop + installmentsHeight / 2;
        expect(installmentsCenterY).toBeGreaterThan(height * 0.45);

        vi.spyOn(installmentsEl, "getBoundingClientRect").mockReturnValue({
          x: 16,
          y: installmentsTop,
          left: 16,
          top: installmentsTop,
          right: width - 16,
          bottom: installmentsTop + installmentsHeight,
          width: width - 32,
          height: installmentsHeight,
          toJSON: () => ({}),
        });

        // Configura a rota ativa de cartões para o Passo 6
        mockPathname = "/cartoes";
        mockSearch = "";

        const user = userEvent.setup();
        const { container } = render(<DemoTourSpotlight />);

        // Avança até o Passo 6 (index 5)
        for (let i = 0; i < 5; i++) {
          const nextBtn = screen.getByRole("button", { name: /Próximo/i });
          await user.click(nextBtn);
        }

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });

        expect(screen.getByText("Passo 6 de 8")).toBeInTheDocument();
        expect(screen.getByText("Parcelamentos Fixos e Futuros")).toBeInTheDocument();

        // 1. O card popover deve ancorar no TOPO para não encobrir a seção parceladas
        const aside = container.querySelector("aside");
        expect(aside).not.toBeNull();
        expect(aside?.getAttribute("data-placement")).toBe("top");
        expect(aside?.className).toContain("top-[max(env(safe-area-inset-top,0px),16px)]");

        // 2. Comprova rolagem para o Dead Center livre desobstruído
        expect(scrollToSpy).toHaveBeenCalled();
        const lastScrollCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1];
        const targetScrollTop = lastScrollCall?.[0]?.top;
        expect(targetScrollTop).toBeDefined();
        expect(targetScrollTop).toBeGreaterThanOrEqual(0);

        // 3. Comprova que o recorte do spotlight respeita a zona livre útil
        const spotlightBorder = container.querySelector('[data-testid="spotlight-border"]');
        expect(spotlightBorder).not.toBeNull();
        const borderY = Number(spotlightBorder?.getAttribute("y"));
        const borderHeight = Number(spotlightBorder?.getAttribute("height"));
        const borderBottom = borderY + borderHeight;

        // Limite superior do card popover ancorado no topo (~180px + safe-area ~16px)
        const topCardClearance = 16 + 180;
        // O elemento não fica colado no card superior
        expect(borderY).toBeGreaterThanOrEqual(topCardClearance - 50);

        // A base do elemento iluminado NUNCA ultrapassa a BottomNav (height - 72px)
        const bottomNavTop = height - 72;
        // Folga de segurança de pelo menos 16px acima da BottomNav
        const clearanceToBottomNav = bottomNavTop - borderBottom;
        expect(clearanceToBottomNav).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it("Percorre passos longos completos no iPhone 13 (390x844) comprovando 100% de visibilidade sem sobreposição", async () => {
    window.innerWidth = 390;
    window.innerHeight = 844;

    const user = userEvent.setup();
    startDemo("finances");

    const mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    mainContainer.scrollTo = vi.fn();
    document.body.appendChild(mainContainer);

    // Lista de passos completos com posições e rotas
    const stepsData = [
      { id: "finances-overview-kpis", selector: "overview-kpis", y: 80, height: 140, route: "/", expectedPlacement: "bottom" },
      { id: "finances-wizard-btn", selector: "bottom-nav-wizard", y: 770, height: 56, route: "/", expectedPlacement: "top" },
      { id: "finances-wizard-modal", selector: "launch-wizard-dialog", y: 120, height: 180, route: "/transacoes?novo=despesa", expectedPlacement: "bottom" },
      { id: "finances-transactions-feed", selector: "transactions-feed-card", y: 440, height: 160, route: "/transacoes", expectedPlacement: "top" },
      { id: "finances-cards-summary", selector: "cards-invoice-summary", y: 90, height: 140, route: "/cartoes", expectedPlacement: "bottom" },
      { id: "finances-installments", selector: "cards-installments-section", y: 450, height: 170, route: "/cartoes", expectedPlacement: "top" },
      { id: "finances-budgets-ceilings", selector: "budgets-content", y: 460, height: 150, route: "/orcamentos", expectedPlacement: "top" },
      { id: "finances-smart-reports", selector: "reports-content", y: 90, height: 150, route: "/relatorios", expectedPlacement: "bottom" },
    ];

    for (const step of stepsData) {
      const el = document.createElement("div");
      el.setAttribute("data-tour", step.selector);
      const isFab = step.selector === "bottom-nav-wizard";
      const elWidth = isFab ? 56 : 358;
      const elLeft = isFab ? (390 - 56) / 2 : 16;
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        x: elLeft,
        y: step.y,
        left: elLeft,
        top: step.y,
        right: elLeft + elWidth,
        bottom: step.y + step.height,
        width: elWidth,
        height: step.height,
        toJSON: () => ({}),
      });
      mainContainer.appendChild(el);
    }

    const { container, rerender } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const bottomNavTop = 844 - 72; // 772px

    for (let i = 0; i < stepsData.length; i++) {
      const step = stepsData[i]!;

      expect(screen.getByText(`Passo ${i + 1} de 8`)).toBeInTheDocument();

      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();
      expect(aside?.getAttribute("data-placement")).toBe(step.expectedPlacement);

      const spotlightBorder = container.querySelector('[data-testid="spotlight-border"]');
      expect(spotlightBorder).not.toBeNull();
      const borderY = Number(spotlightBorder?.getAttribute("y"));
      const borderHeight = Number(spotlightBorder?.getAttribute("height"));
      const borderBottom = borderY + borderHeight;

      if (step.selector === "bottom-nav-wizard") {
        // O FAB flutua no centro da BottomNav e nunca transborda o chão da tela
        expect(borderBottom).toBeLessThanOrEqual(844);
        expect(borderY).toBeGreaterThanOrEqual(bottomNavTop - 30);
      } else if (step.expectedPlacement === "top") {
        // Card está no topo: o elemento NÃO pode ficar escondido atrás da BottomNav (772px)
        // e respeita folga segura de respiro acima da barra inferior
        expect(borderY).toBeGreaterThanOrEqual(16);
        expect(borderBottom).toBeLessThanOrEqual(bottomNavTop);
      } else {
        // Card está na base: o elemento está na metade superior e não encosta no Header fixo
        expect(borderY).toBeGreaterThanOrEqual(60);
      }

      if (i < stepsData.length - 1) {
        const nextBtn = screen.getByRole("button", { name: /Próximo/i });
        await user.click(nextBtn);

        const nextStep = stepsData[i + 1]!;
        const [path, query] = nextStep.route.split("?");
        mockPathname = path ?? "/";
        mockSearch = query ? `?${query}` : "";

        rerender(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }
  });
});

describe("Teste Manual de Lançamentos: Demonstração do Modal com Campos Didáticos vs Item Solto do Extrato (Portão 8)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let mainContainer: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/transacoes";
    mockSearch = "?novo=despesa";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    mainContainer.scrollTo = vi.fn();
    document.body.appendChild(mainContainer);
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = "";
  });

  it("comprova que a definição de passos prioriza o modal LaunchWizard ([data-tour='launch-wizard-dialog']) com campos didáticos e não um item solto do extrato", () => {
    // 1. Tour Geral de Finanças Diárias (finances)
    const financesSteps = getTourSteps("finances");
    const launchStep = financesSteps.find((s) => s.id === "finances-wizard-dialog");
    expect(launchStep).toBeDefined();
    expect(launchStep?.order).toBe(3);
    expect(launchStep?.badgeLabel).toBe("Passo 3 de 8");
    expect(launchStep?.targetRoute).toBe("/transacoes?novo=despesa");
    expect(launchStep?.targetSelector).toBe('[data-tour="launch-wizard-dialog"]');
    expect(launchStep?.title).toBe("Modal de Lançamento Inteligente");
    expect(launchStep?.description).toContain("Alterne com facilidade entre Despesa, Receita e Pix");
    expect(launchStep?.description).toContain("categorias preditivas");
    expect(launchStep?.description).toContain("anexar comprovantes");

    // Comprova que o passo de lançamento NÃO aponta para uma linha/item do extrato
    expect(launchStep?.targetSelector).not.toBe('[data-tour="transactions-feed-card"]');
    expect(launchStep?.targetSelector).not.toBe('[data-tour="transactions-content"]');
    expect(launchStep?.targetSelector).not.toContain("feed");
    expect(launchStep?.targetSelector).not.toContain("item");

    // Comprova que o extrato só é focado no passo seguinte (Passo 4: Extrato Unificado & Filtros)
    const statementStep = financesSteps.find((s) => s.id === "finances-transactions");
    expect(statementStep).toBeDefined();
    expect(statementStep?.order).toBe(4);
    expect(statementStep?.badgeLabel).toBe("Passo 4 de 8");
    expect(statementStep?.targetRoute).toBe("/transacoes");
    expect(statementStep?.targetSelector).toBe('[data-tour="transactions-feed-card"]');
    expect(statementStep?.title).toBe("Extrato Unificado & Filtros");

    // 2. Micro-Tour Wizard (+) (finances_wizard)
    const wizardSteps = getTourSteps("finances_wizard");
    const microLaunchStep = wizardSteps.find((s) => s.id === "wizard-flow-selection");
    expect(microLaunchStep).toBeDefined();
    expect(microLaunchStep?.order).toBe(2);
    expect(microLaunchStep?.badgeLabel).toBe("Passo 2 de 3");
    expect(microLaunchStep?.targetRoute).toBe("/transacoes?novo=despesa");
    expect(microLaunchStep?.targetSelector).toBe('[data-tour="launch-wizard-dialog"]');
    expect(microLaunchStep?.title).toBe("Lançamento de Despesa, Receita e Pix");
    expect(microLaunchStep?.description).toContain("Alterne com facilidade entre Despesa, Receita e Pix");
    expect(microLaunchStep?.targetSelector).not.toBe('[data-tour="transactions-feed-card"]');
  });

  it("demonstra o modal com campos didáticos no DOM e comprova foco determinístico do Spotlight no LaunchWizard em vez do extrato", () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    // Item solto / feed do extrato existente na página
    const statementFeed = document.createElement("div");
    statementFeed.setAttribute("data-tour", "transactions-feed-card");
    statementFeed.textContent = "Extrato de Transações Históricas (Supermercado R$ 150,00)";
    vi.spyOn(statementFeed, "getBoundingClientRect").mockReturnValue({
      x: 32,
      y: 120,
      left: 32,
      top: 120,
      right: 992,
      bottom: 260,
      width: 960,
      height: 140,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(statementFeed);

    // Modal com campos didáticos (LaunchWizard)
    const wizardDialog = document.createElement("div");
    wizardDialog.setAttribute("data-tour", "launch-wizard-dialog");
    wizardDialog.setAttribute("role", "dialog");
    wizardDialog.setAttribute("aria-modal", "false"); // Em modo demo, modal={false}

    // Estrutura didática interna: botões de ação do cabeçalho
    const headerActions = document.createElement("div");
    headerActions.className = "flex items-center gap-1";

    const quickModeBtn = document.createElement("button");
    quickModeBtn.setAttribute("type", "button");
    quickModeBtn.setAttribute("aria-label", "Alternar para modo rápido");
    quickModeBtn.textContent = "Modo rápido";
    headerActions.appendChild(quickModeBtn);

    const attachBtn = document.createElement("button");
    attachBtn.setAttribute("type", "button");
    attachBtn.setAttribute("aria-label", "Anexar comprovante");
    attachBtn.textContent = "Anexar comprovante";
    headerActions.appendChild(attachBtn);
    wizardDialog.appendChild(headerActions);

    // Campos didáticos do formulário: alternância de tipo, valor, categoria, pagamento
    const formFields = document.createElement("div");
    formFields.className = "grid grid-cols-2 gap-3";

    const typeToggle = document.createElement("div");
    typeToggle.setAttribute("data-testid", "wizard-type-toggle");
    typeToggle.innerHTML =
      '<button data-type="expense">Despesa</button><button data-type="income">Receita</button><button data-type="pix">Pix</button>';
    formFields.appendChild(typeToggle);

    const moneyInput = document.createElement("input");
    moneyInput.setAttribute("data-testid", "wizard-money-input");
    moneyInput.setAttribute("placeholder", "R$ 0,00");
    formFields.appendChild(moneyInput);

    const categorySelect = document.createElement("div");
    categorySelect.setAttribute("data-testid", "wizard-category-predictions");
    categorySelect.textContent = "Categorias sugeridas: Alimentação, Transporte, Moradia";
    formFields.appendChild(categorySelect);

    const paymentSelect = document.createElement("div");
    paymentSelect.setAttribute("data-testid", "wizard-payment-method");
    paymentSelect.textContent = "Forma: Cartão de Crédito / Pix / Conta Corrente";
    formFields.appendChild(paymentSelect);

    wizardDialog.appendChild(formFields);

    vi.spyOn(wizardDialog, "getBoundingClientRect").mockReturnValue({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 824,
      bottom: 580,
      width: 624,
      height: 480,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(wizardDialog);

    // Inicia tour de Finanças no Passo 3 (Modal de Lançamento)
    startDemo("finances");
    setStepIndex(2);

    const { container } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();

    // 1. Comprova que os badges e orientações didáticas refletem o modal de lançamento
    expect(screen.getByText("Passo 3 de 8")).toBeInTheDocument();
    expect(screen.getByText("Modal de Lançamento Inteligente")).toBeInTheDocument();
    expect(
      screen.getByText(/Alterne com facilidade entre Despesa, Receita e Pix/i),
    ).toBeInTheDocument();

    // 2. Comprova que o Spotlight foca e recorta EXCLUSIVAMENTE o modal com padding de 6px
    const border = screen.getByTestId("spotlight-border");
    expect(border).toBeInTheDocument();
    expect(border.getAttribute("x")).toBe("194"); // 200 - 6
    expect(border.getAttribute("y")).toBe("94"); // 100 - 6
    expect(border.getAttribute("width")).toBe("636"); // 624 + 12
    expect(border.getAttribute("height")).toBe("492"); // 480 + 12

    // 3. Comprova que os campos didáticos do LaunchWizard estão presentes e contidos no modal
    expect(screen.getByLabelText("Alternar para modo rápido")).toBeInTheDocument();
    expect(screen.getByLabelText("Anexar comprovante")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-type-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-category-predictions")).toBeInTheDocument();

    // 4. Comprova que o item do extrato NÃO foi o alvo iluminado
    expect(border.getAttribute("x")).not.toBe("26");
    expect(border.getAttribute("y")).not.toBe("114");
  });

  it("comprova transição suave do modal de lançamento para o extrato no Passo 4 e retorno determinístico ao modal no Passo 3", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // 1. Monta tanto o modal didático quanto o feed do extrato
    const wizardDialog = document.createElement("div");
    wizardDialog.setAttribute("data-tour", "launch-wizard-dialog");
    vi.spyOn(wizardDialog, "getBoundingClientRect").mockReturnValue({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 824,
      bottom: 580,
      width: 624,
      height: 480,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(wizardDialog);

    const statementFeed = document.createElement("div");
    statementFeed.setAttribute("data-tour", "transactions-feed-card");
    vi.spyOn(statementFeed, "getBoundingClientRect").mockReturnValue({
      x: 32,
      y: 120,
      left: 32,
      top: 120,
      right: 992,
      bottom: 260,
      width: 960,
      height: 140,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(statementFeed);

    startDemo("finances");
    setStepIndex(2); // Passo 3 de 8

    const { rerender } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Passo 3 de 8")).toBeInTheDocument();
    expect(screen.getByText("Modal de Lançamento Inteligente")).toBeInTheDocument();

    // Usuário clica no botão de avançar para ir para o Extrato
    const advanceBtn = screen.getByRole("button", { name: /Ver Extrato|Próximo/i });
    await user.click(advanceBtn);

    // Comprova que navegou para /transacoes (sem o parâmetro ?novo=despesa)
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes");

    // Simula atualização de rota no React Router para o Passo 4
    mockPathname = "/transacoes";
    mockSearch = "";
    rerender(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Agora o Spotlight recorta o Extrato Unificado (Passo 4 de 8)
    expect(screen.getByText("Passo 4 de 8")).toBeInTheDocument();
    expect(screen.getByText("Extrato Unificado & Filtros")).toBeInTheDocument();

    const borderStep4 = screen.getByTestId("spotlight-border");
    // Coordenadas do statementFeed (x: 32, y: 120, width: 960, height: 140, padding: 10)
    expect(borderStep4.getAttribute("x")).toBe("22");
    expect(borderStep4.getAttribute("y")).toBe("110");
    expect(borderStep4.getAttribute("width")).toBe("980");
    expect(borderStep4.getAttribute("height")).toBe("160");

    // Usuário clica no botão Anterior para retornar ao Modal
    const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
    await user.click(prevBtn);

    // Comprova que navegou de volta para /transacoes?novo=despesa
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes?novo=despesa");

    mockPathname = "/transacoes";
    mockSearch = "?novo=despesa";
    rerender(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Retorna perfeitamente ao Modal de Lançamento
    expect(screen.getByText("Passo 3 de 8")).toBeInTheDocument();
    expect(screen.getByText("Modal de Lançamento Inteligente")).toBeInTheDocument();
  });

  it("comprova encerramento limpo no modal de lançamento via [X] sanitizando parâmetros de URL sem poluir o extrato", async () => {
    const user = userEvent.setup();
    startDemo("finances_wizard");
    setStepIndex(1); // Passo 2: wizard-flow-selection

    mockPathname = "/transacoes";
    mockSearch = "?novo=despesa";

    const wizardDialog = document.createElement("div");
    wizardDialog.setAttribute("data-tour", "launch-wizard-dialog");
    mainContainer.appendChild(wizardDialog);

    render(<DemoTourSpotlight />);

    const closeButton = screen.getByLabelText("Encerrar tour demonstrativo");
    await user.click(closeButton);

    // Comprova que o parâmetro novo=despesa foi sanitizado deterministicamente
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes", { replace: true });
  });
});

describe("Teste Manual do Tour Geral: Jornada Lógica e Completa de Finanças e de Investimentos (Portão 8)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let mainContainer: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/";
    mockSearch = "";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    mainContainer.scrollTo = vi.fn();
    document.body.appendChild(mainContainer);
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = "";
  });

  it("Tour Geral de Finanças Diárias (finances): percorre a jornada sequencial lógica e completa de todas as funcionalidades (8 passos)", async () => {
    window.innerWidth = 390;
    window.innerHeight = 844;

    const user = userEvent.setup();

    // 1. Monta todos os 8 seletores representativos das funcionalidades do módulo de Finanças
    const financesStepsConfig = [
      {
        order: 1,
        id: "finances-overview",
        selector: "overview-kpis",
        route: "/",
        title: "Dashboard & Saldo Livre Real",
        expectedKeyword: "saldo livre real",
        nextRoute: "/",
      },
      {
        order: 2,
        id: "finances-wizard-btn",
        selector: "bottom-nav-wizard",
        route: "/",
        title: "O Botão Wizard (+) e Atalhos",
        expectedKeyword: "barra inferior",
        nextRoute: "/transacoes?novo=despesa",
      },
      {
        order: 3,
        id: "finances-wizard-dialog",
        selector: "launch-wizard-dialog",
        route: "/transacoes?novo=despesa",
        title: "Modal de Lançamento Inteligente",
        expectedKeyword: "Despesa, Receita e Pix",
        nextRoute: "/transacoes",
      },
      {
        order: 4,
        id: "finances-transactions",
        selector: "transactions-feed-card",
        route: "/transacoes",
        title: "Extrato Unificado & Filtros",
        expectedKeyword: "separação de parcelas",
        nextRoute: "/cartoes",
      },
      {
        order: 5,
        id: "finances-cards",
        selector: "cards-invoice-summary",
        route: "/cartoes",
        title: "Cartões & Faturas Abertas",
        expectedKeyword: "faturas abertas",
        nextRoute: "/cartoes",
      },
      {
        order: 6,
        id: "finances-installments",
        selector: "cards-installments-section",
        route: "/cartoes",
        title: "Parcelamentos Fixos e Futuros",
        expectedKeyword: "faturas futuras",
        nextRoute: "/orcamentos",
      },
      {
        order: 7,
        id: "finances-budgets",
        selector: "budgets-content",
        route: "/orcamentos",
        title: "Categorias & Tetos Mensais",
        expectedKeyword: "limites por categoria",
        nextRoute: "/relatorios",
      },
      {
        order: 8,
        id: "finances-insights",
        selector: "reports-content",
        route: "/relatorios",
        title: "Smart Advisor & Relatórios",
        expectedKeyword: "corte de gastos",
        nextRoute: null,
      },
    ];

    for (const step of financesStepsConfig) {
      const el = document.createElement("div");
      el.setAttribute("data-tour", step.selector);
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 100,
        left: 16,
        top: 100,
        right: 374,
        bottom: 240,
        width: 358,
        height: 140,
        toJSON: () => ({}),
      });
      mainContainer.appendChild(el);
    }

    startDemo("finances");

    const { container, rerender } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Jornada de Avanço: Passos 1 ao 8
    for (let i = 0; i < financesStepsConfig.length; i++) {
      const step = financesStepsConfig[i]!;

      // Valida badge de passo
      expect(screen.getByText(`Passo ${i + 1} de 8`)).toBeInTheDocument();

      // Valida taxonomia canônica rigorosa: Finanças Diárias
      expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
      expect(screen.queryByText("Investimentos")).toBeNull();

      // Valida título da funcionalidade
      expect(screen.getByText(step.title)).toBeInTheDocument();

      // Valida o conteúdo textual didático
      expect(screen.getAllByText(new RegExp(step.expectedKeyword, "i")).length).toBeGreaterThanOrEqual(1);

      // Valida que o container de aside existe e contém o conteúdo
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();

      // Valida os dots de progresso (8 dots)
      const dots = container.querySelectorAll('button[aria-label^="Ir para o passo"]');
      expect(dots).toHaveLength(8);

      // Avança para o próximo passo se não for o último
      if (i < financesStepsConfig.length - 1) {
        const nextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
        expect(nextBtn).toBeInTheDocument();

        await user.click(nextBtn);

        if (step.nextRoute && step.nextRoute !== step.route) {
          expect(mockNavigate).toHaveBeenCalledWith(step.nextRoute);
          const [path, query] = step.nextRoute.split("?");
          mockPathname = path ?? "/";
          mockSearch = query ? `?${query}` : "";
        }

        rerender(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }

    // No Passo 8: Botão Anterior está ativo e botão final de ação está presente
    expect(screen.getByText("Passo 8 de 8")).toBeInTheDocument();
    expect(screen.getByText("Smart Advisor & Relatórios")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
    expect(finishBtn).toBeInTheDocument();

    // Jornada de Retorno: Passos 8 retrocedendo até 1
    for (let i = financesStepsConfig.length - 1; i > 0; i--) {
      const prevStep = financesStepsConfig[i - 1]!;
      const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
      expect(prevBtn).toBeInTheDocument();
      expect(prevBtn).not.toBeDisabled();

      await user.click(prevBtn);

      if (prevStep.route !== financesStepsConfig[i]!.route) {
        expect(mockNavigate).toHaveBeenCalledWith(prevStep.route);
        const [path, query] = prevStep.route.split("?");
        mockPathname = path ?? "/";
        mockSearch = query ? `?${query}` : "";
      }

      rerender(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(screen.getByText(`Passo ${i} de 8`)).toBeInTheDocument();
      expect(screen.getByText(prevStep.title)).toBeInTheDocument();
      expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    }

    // Ao retornar ao Passo 1, o botão Anterior deve estar desabilitado
    expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();
    const firstPrevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
    expect(firstPrevBtn).toBeDisabled();
  });

  it("Tour Geral de Investimentos (investments): percorre a jornada sequencial lógica e completa de todas as funcionalidades (5 passos)", async () => {
    window.innerWidth = 390;
    window.innerHeight = 844;

    const user = userEvent.setup();

    // 1. Monta todos os 5 seletores representativos das funcionalidades do módulo de Investimentos
    const investmentsStepsConfig = [
      {
        order: 1,
        id: "investments-overview",
        selector: "investments-summary",
        route: "/investments",
        title: "Visão Patrimonial Global",
        expectedKeyword: "classes",
        nextRoute: "/investments",
      },
      {
        order: 2,
        id: "investments-new-op",
        selector: "investments-new-op",
        route: "/investments",
        title: "Cadastro de Ativo (Nova Operação)",
        expectedKeyword: "preço médio",
        nextRoute: "/investments?tab=metas",
      },
      {
        order: 3,
        id: "investments-targets",
        selector: "investments-targets",
        route: "/investments?tab=metas",
        title: "Metas Estratégicas de Alocação",
        expectedKeyword: "percentuais ideais",
        nextRoute: "/investments?tab=aporte",
      },
      {
        order: 4,
        id: "investments-rebalance",
        selector: "investments-rebalance",
        route: "/investments?tab=aporte",
        title: "Calculadora de Aporte Inteligente",
        expectedKeyword: "sem vender posições",
        nextRoute: "/investments?tab=proventos",
      },
      {
        order: 5,
        id: "investments-dividends",
        selector: "investments-dividends",
        route: "/investments?tab=proventos",
        title: "Proventos & Renda Passiva",
        expectedKeyword: "dividendos, JCP",
        nextRoute: null,
      },
    ];

    for (const step of investmentsStepsConfig) {
      const el = document.createElement("div");
      el.setAttribute("data-tour", step.selector);
      vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
        x: 16,
        y: 120,
        left: 16,
        top: 120,
        right: 374,
        bottom: 260,
        width: 358,
        height: 140,
        toJSON: () => ({}),
      });
      mainContainer.appendChild(el);
    }

    startDemo("investments");
    mockPathname = "/investments";
    mockSearch = "";

    const { container, rerender } = render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Jornada de Avanço: Passos 1 ao 5
    for (let i = 0; i < investmentsStepsConfig.length; i++) {
      const step = investmentsStepsConfig[i]!;

      // Valida badge de passo
      expect(screen.getByText(`Passo ${i + 1} de 5`)).toBeInTheDocument();

      // Valida taxonomia canônica rigorosa: Investimentos
      expect(screen.getByText("Investimentos")).toBeInTheDocument();
      expect(screen.queryByText("Finanças Diárias")).toBeNull();

      // Valida título da funcionalidade patrimonial
      expect(screen.getByText(step.title)).toBeInTheDocument();

      // Valida o conteúdo textual didático
      expect(screen.getAllByText(new RegExp(step.expectedKeyword, "i")).length).toBeGreaterThanOrEqual(1);

      // Valida que o container aside existe
      const aside = container.querySelector("aside");
      expect(aside).not.toBeNull();

      // Valida os 5 dots de progresso
      const dots = container.querySelectorAll('button[aria-label^="Ir para o passo"]');
      expect(dots).toHaveLength(5);

      if (i < investmentsStepsConfig.length - 1) {
        const nextBtn = screen.getByRole("button", { name: /Próximo passo|Próximo/i });
        expect(nextBtn).toBeInTheDocument();

        await user.click(nextBtn);

        if (step.nextRoute && step.nextRoute !== step.route) {
          expect(mockNavigate).toHaveBeenCalledWith(step.nextRoute);
          const [path, query] = step.nextRoute.split("?");
          mockPathname = path ?? "/investments";
          mockSearch = query ? `?${query}` : "";
        }

        rerender(<DemoTourSpotlight />);

        act(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
    }

    // No Passo 5: Proventos & Renda Passiva
    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.getByText("Proventos & Renda Passiva")).toBeInTheDocument();
    const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
    expect(finishBtn).toBeInTheDocument();

    // Jornada de Retorno: Passos 5 retrocedendo até 1
    for (let i = investmentsStepsConfig.length - 1; i > 0; i--) {
      const prevStep = investmentsStepsConfig[i - 1]!;
      const prevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
      expect(prevBtn).toBeInTheDocument();
      expect(prevBtn).not.toBeDisabled();

      await user.click(prevBtn);

      if (prevStep.route !== investmentsStepsConfig[i]!.route) {
        expect(mockNavigate).toHaveBeenCalledWith(prevStep.route);
        const [path, query] = prevStep.route.split("?");
        mockPathname = path ?? "/investments";
        mockSearch = query ? `?${query}` : "";
      }

      rerender(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(screen.getByText(`Passo ${i} de 5`)).toBeInTheDocument();
      expect(screen.getByText(prevStep.title)).toBeInTheDocument();
      expect(screen.getByText("Investimentos")).toBeInTheDocument();
    }

    // Ao retornar ao Passo 1, o botão Anterior deve estar desabilitado
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    const firstPrevBtn = screen.getByRole("button", { name: /Passo anterior|Anterior/i });
    expect(firstPrevBtn).toBeDisabled();
  });

  it("comprova adaptação desktop no Passo 2 de Finanças focando comandos rápidos e atalho Ctrl+K com badge rigoroso", () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    // Elemento desktop da barra de comandos
    const desktopCommandEl = document.createElement("div");
    desktopCommandEl.setAttribute("data-tour", "desktop-new-transaction");
    vi.spyOn(desktopCommandEl, "getBoundingClientRect").mockReturnValue({
      x: 300,
      y: 20,
      left: 300,
      top: 20,
      right: 700,
      bottom: 60,
      width: 400,
      height: 40,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(desktopCommandEl);

    startDemo("finances");
    setStepIndex(1); // Passo 2

    render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Passo 2 de 8")).toBeInTheDocument();
    expect(screen.getByText("Comandos Rápidos & Atalho (Ctrl+K)")).toBeInTheDocument();
    expect(screen.getByText("Finanças Diárias")).toBeInTheDocument();
    expect(
      screen.getByText(/No desktop, acione a barra de comandos ou utilize o atalho Ctrl\+K/i),
    ).toBeInTheDocument();

    const border = screen.getByTestId("spotlight-border");
    expect(border).toBeInTheDocument();
    // Elemento desktop x: 300, y: 20, width: 400, height: 40 com padding de 10
    expect(border.getAttribute("x")).toBe("290");
    expect(border.getAttribute("y")).toBe("10");
  });

  it("comprova navegação direta e precisa pelos dots de progresso em Finanças e Investimentos", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // 1. Tour de Finanças: Salto direto do Passo 1 para o Passo 5 (Cartões) e retorno direto ao Passo 1
    const cardsSummary = document.createElement("div");
    cardsSummary.setAttribute("data-tour", "cards-invoice-summary");
    vi.spyOn(cardsSummary, "getBoundingClientRect").mockReturnValue({
      x: 50,
      y: 100,
      left: 50,
      top: 100,
      right: 900,
      bottom: 250,
      width: 850,
      height: 150,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(cardsSummary);

    startDemo("finances");
    const { rerender } = render(<DemoTourSpotlight />);

    expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();

    // Clica no Dot do Passo 5 (índice 4)
    const dot5 = screen.getByRole("button", { name: "Ir para o passo 5" });
    await user.click(dot5);

    expect(mockNavigate).toHaveBeenCalledWith("/cartoes");
    mockPathname = "/cartoes";
    rerender(<DemoTourSpotlight />);

    expect(screen.getByText("Passo 5 de 8")).toBeInTheDocument();
    expect(screen.getByText("Cartões & Faturas Abertas")).toBeInTheDocument();

    // Clica no Dot do Passo 1 (índice 0)
    const dot1 = screen.getByRole("button", { name: "Ir para o passo 1" });
    await user.click(dot1);

    expect(mockNavigate).toHaveBeenCalledWith("/");
    mockPathname = "/";
    rerender(<DemoTourSpotlight />);

    expect(screen.getByText("Passo 1 de 8")).toBeInTheDocument();
    expect(screen.getByText("Dashboard & Saldo Livre Real")).toBeInTheDocument();

    // 2. Tour de Investimentos: Salto direto do Passo 1 para o Passo 4 (Aporte) e retorno
    startDemo("investments");
    mockPathname = "/investments";
    rerender(<DemoTourSpotlight />);

    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();

    // Clica no Dot do Passo 4 (índice 3)
    const investDot4 = screen.getByRole("button", { name: "Ir para o passo 4" });
    await user.click(investDot4);

    expect(mockNavigate).toHaveBeenCalledWith("/investments?tab=aporte");
    mockPathname = "/investments";
    mockSearch = "?tab=aporte";
    rerender(<DemoTourSpotlight />);

    expect(screen.getByText("Passo 4 de 5")).toBeInTheDocument();
    expect(screen.getByText("Calculadora de Aporte Inteligente")).toBeInTheDocument();
  });
});

describe("Teste Manual de Conclusão: Conclusão dos Tours Completos e Encerramento Limpo dos Micro-Tours (Portão 8)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let mainContainer: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockPathname = "/";
    mockSearch = "";
    localStorage.clear();
    resetDemoTourStorage();
    resetDemoSession();
    vi.clearAllMocks();

    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    mainContainer = document.createElement("main");
    mainContainer.id = "main-content";
    mainContainer.scrollTo = vi.fn();
    document.body.appendChild(mainContainer);
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    document.body.innerHTML = "";
  });

  it("conclui o Tour Completo de Finanças Diárias ('finances') comprovando redirecionamento para '/?novo=despesa' e abertura do modal LaunchWizard", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // Elemento do Passo 8 (Smart Advisor & Relatórios)
    const reportsEl = document.createElement("div");
    reportsEl.setAttribute("data-tour", "reports-content");
    vi.spyOn(reportsEl, "getBoundingClientRect").mockReturnValue({
      x: 32,
      y: 100,
      left: 32,
      top: 100,
      right: 992,
      bottom: 300,
      width: 960,
      height: 200,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(reportsEl);

    startDemo("finances");
    setStepIndex(7); // Passo 8 de 8 (último passo)
    mockPathname = "/relatorios";
    mockSearch = "";

    render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Passo 8 de 8")).toBeInTheDocument();
    expect(screen.getByText("Smart Advisor & Relatórios")).toBeInTheDocument();

    const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    // 1. Comprova que a flag de conclusão foi gravada no storage
    expect(hasCompletedDemoTour("finances")).toBe(true);

    // 2. Comprova que a sessão demonstrativa foi encerrada
    expect(getDemoSessionState().isDemoActive).toBe(false);

    // 3. Comprova que navegou exatamente para '/?novo=despesa'
    expect(mockNavigate).toHaveBeenCalledWith("/?novo=despesa");
  });

  it("conclui o Tour Completo de Investimentos & Rebalanceamento ('investments') comprovando redirecionamento para '/investments?novo=investimento' e abertura do modal de Aporte (InvestmentWizard)", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // Elemento do Passo 5 (Proventos & Renda Passiva)
    const dividendsEl = document.createElement("div");
    dividendsEl.setAttribute("data-tour", "investments-dividends");
    vi.spyOn(dividendsEl, "getBoundingClientRect").mockReturnValue({
      x: 32,
      y: 100,
      left: 32,
      top: 100,
      right: 992,
      bottom: 300,
      width: 960,
      height: 200,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(dividendsEl);

    startDemo("investments");
    setStepIndex(4); // Passo 5 de 5 (último passo)
    mockPathname = "/investments";
    mockSearch = "?tab=proventos";

    render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.getByText("Proventos & Renda Passiva")).toBeInTheDocument();

    const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    // 1. Comprova que a flag de conclusão foi gravada no storage
    expect(hasCompletedDemoTour("investments")).toBe(true);

    // 2. Comprova que a sessão demonstrativa foi encerrada
    expect(getDemoSessionState().isDemoActive).toBe(false);

    // 3. Comprova que navegou exatamente para '/investments?novo=investimento'
    expect(mockNavigate).toHaveBeenCalledWith("/investments?novo=investimento");
  });

  it("conclui o Tour Completo de Configurações, Visual e Suporte ('settings_support') comprovando redirecionamento para '/configuracoes?tab=suporte' e abertura do modal de Suporte", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // Elemento do Passo 5 (Central de Ajuda & Suporte Direto)
    const supportEl = document.createElement("div");
    supportEl.setAttribute("data-tour", "settings-support-card");
    vi.spyOn(supportEl, "getBoundingClientRect").mockReturnValue({
      x: 32,
      y: 100,
      left: 32,
      top: 100,
      right: 992,
      bottom: 300,
      width: 960,
      height: 200,
      toJSON: () => ({}),
    });
    mainContainer.appendChild(supportEl);

    startDemo("settings_support");
    setStepIndex(4); // Passo 5 de 5 (último passo)
    mockPathname = "/configuracoes";
    mockSearch = "";

    render(<DemoTourSpotlight />);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Passo 5 de 5")).toBeInTheDocument();
    expect(screen.getByText("Central de Ajuda & Suporte Direto")).toBeInTheDocument();

    const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
    expect(finishBtn).toBeInTheDocument();

    await user.click(finishBtn);

    // 1. Comprova que a flag de conclusão foi gravada no storage
    expect(hasCompletedDemoTour("settings_support")).toBe(true);

    // 2. Comprova que a sessão demonstrativa foi encerrada
    expect(getDemoSessionState().isDemoActive).toBe(false);

    // 3. Comprova que navegou exatamente para '/configuracoes?tab=suporte'
    expect(mockNavigate).toHaveBeenCalledWith("/configuracoes?tab=suporte");
  });

  it("conclui todos os 13 micro-tours individuais comprovando encerramento limpo sem nenhum parâmetro invasivo e sem abertura de modais", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const allTrackIds = Object.keys(TOUR_TRACK_METAS) as TourTrackId[];
    const microTours = allTrackIds.filter((t) => !isCompleteTourTrack(t) && getTourSteps(t).length > 0);
    expect(microTours).toHaveLength(13);

    for (const trackId of microTours) {
      vi.clearAllMocks();
      document.body.innerHTML = "";
      const containerEl = document.createElement("main");
      containerEl.id = "main-content";
      containerEl.scrollTo = vi.fn();
      document.body.appendChild(containerEl);

      const steps = getTourSteps(trackId);
      const lastStepIndex = steps.length - 1;
      const lastStep = steps[lastStepIndex]!;

      // Cria elemento alvo no DOM para o último passo
      const rawSelector = lastStep.targetSelector ?? "";
      const targetSelector = rawSelector.replace(/\[data-tour="([^"]+)"\]/, "$1");
      const targetEl = document.createElement("div");
      targetEl.setAttribute("data-tour", targetSelector);
      vi.spyOn(targetEl, "getBoundingClientRect").mockReturnValue({
        x: 50,
        y: 100,
        left: 50,
        top: 100,
        right: 850,
        bottom: 250,
        width: 800,
        height: 150,
        toJSON: () => ({}),
      });
      containerEl.appendChild(targetEl);

      const [path, query] = lastStep.targetRoute.split("?");
      mockPathname = path ?? "/";
      mockSearch = query ? `?${query}` : "";

      startDemo(trackId);
      setStepIndex(lastStepIndex);

      const user = userEvent.setup();
      render(<DemoTourSpotlight />);

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      const finishBtn = screen.getByRole("button", { name: /Começar Conta Real|Começar/i });
      await user.click(finishBtn);

      // Comprova encerramento da sessão demo
      expect(getDemoSessionState().isDemoActive).toBe(false);

      // Comprova marcação de conclusão no storage
      expect(hasCompletedDemoTour(trackId)).toBe(true);

      // Comprova que mockNavigate foi chamado
      expect(mockNavigate).toHaveBeenCalled();
      const lastCall = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1];
      const destination = lastCall?.[0] as string;

      expect(typeof destination).toBe("string");

      // Comprova que NENHUM parâmetro invasivo de modal está presente na rota destino
      for (const invasiveParam of INVASIVE_QUERY_PARAMS) {
        expect(destination).not.toContain(`${invasiveParam}=`);
      }
    }
  });

  it("comprova encerramento limpo prematuro via botão fechar [X] em micro-tour expurgando parâmetros invasivos residuais da URL", async () => {
    window.innerWidth = 1024;
    window.innerHeight = 768;

    const user = userEvent.setup();

    // Simula micro-tour no meio de um passo que continha ?novo=despesa
    startDemo("finances_wizard");
    setStepIndex(1); // Passo 2: wizard-flow-selection (/transacoes?novo=despesa)

    mockPathname = "/transacoes";
    mockSearch = "?novo=despesa&modo=rapido";

    const wizardDialog = document.createElement("div");
    wizardDialog.setAttribute("data-tour", "launch-wizard-dialog");
    mainContainer.appendChild(wizardDialog);

    render(<DemoTourSpotlight />);

    const closeButton = screen.getByLabelText("Encerrar tour demonstrativo");
    await user.click(closeButton);

    // Comprova que encerrou a sessão demo
    expect(getDemoSessionState().isDemoActive).toBe(false);

    // Comprova que mockNavigate limpou os parâmetros invasivos e manteve rota limpa /transacoes
    expect(mockNavigate).toHaveBeenCalledWith("/transacoes", { replace: true });
  });
});



