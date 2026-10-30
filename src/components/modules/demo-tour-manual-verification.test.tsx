import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoTourSpotlight } from "./demo-tour-spotlight";
import { resetDemoSession, resetDemoTourStorage, startDemo } from "@/state/demo-mode";

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
    track: "finances" | "investments",
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

    // Mock dos elementos no DOM para a trilha
    const selectors = track === "finances"
      ? [
          { selector: "overview-kpis", y: 80, height: 120, route: "/" }, // Upper half (centerY = 140 <= 0.45 * height) -> Base
          { selector: "transactions-feed-card", y: 420, height: 140, route: "/transacoes" }, // Lower half (centerY = 490 > 0.45 * height) -> Topo
          { selector: "cards-content", y: 100, height: 180, route: "/cartoes" }, // Upper half (centerY = 190) -> Base
          { selector: "budgets-content", y: 400, height: 150, route: "/orcamentos" }, // Lower half (centerY = 475) -> Topo
        ]
      : [
          { selector: "investments-summary", y: 90, height: 130, route: "/investments" }, // Upper half -> Base
          { selector: "investments-targets", y: 390, height: 140, route: "/investments?tab=metas" }, // Lower half -> Topo
          { selector: "investments-rebalance", y: 410, height: 160, route: "/investments?tab=aporte" }, // Lower half -> Topo
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
});
