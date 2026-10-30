import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageShell } from "./page-shell";
import { resetNetworkStatusForTesting } from "@/services/network-status";
import { resetDemoSession, resetDemoTourStorage, startDemo } from "@/state/demo-mode";

import { getUserStorageKey } from "@/services/user-storage";

const STORAGE_KEY = getUserStorageKey("sidebar_collapsed");

vi.mock("@/app/theme-provider", () => ({
  useTheme: () => ({ theme: "light", preference: "light", setPreference: vi.fn() }),
  useSafeTheme: () => "light",
}));

vi.mock("@/features/transactions", () => ({
  LaunchWizard: ({
    open,
    initialMode,
    initialValues,
  }: {
    open?: boolean;
    initialMode?: string;
    initialValues?: { paymentMethod?: string };
  }) =>
    open ? (
      <div
        data-testid="launch-wizard-overlay"
        data-initial-mode={initialMode}
        data-payment-method={initialValues?.paymentMethod}
      />
    ) : null,
}));

const mockUseSmartAdvisorInsights = vi.fn().mockReturnValue({
  insight: null,
  insights: [],
  currentIndex: 0,
  totalCount: 0,
  dismiss: vi.fn(),
});

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: () => mockUseSmartAdvisorInsights(),
}));

vi.mock("@/state", () => ({
  useGlobalSearchEntries: () => ({
    entries: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useReminders: () => ({
    totalCount: 0,
    urgentCount: 0,
    items: [],
    isLoading: false,
    error: null,
  }),
  useOnboardingCounts: () => ({
    data: { expenseCategories: 5, incomeCategories: 5, cards: 1, transactions: 1, notificationsEnabled: true },
    isLoading: false,
  }),
  useUserAccess: () => ({
    role: "user",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
  }),
  useUserSubscription: () => ({
    tier: "trial",
    trialDaysRemaining: 30,
    trialEndsAt: "2026-09-30T00:00:00Z",
    currentPeriodEnd: null,
    plan: null,
    cancelAtPeriodEnd: false,
    isFullAccess: true,
    isTrial: true,
    isPro: false,
    isReadOnly: false,
  }),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderShell(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<PageShell />}>
            <Route path="/" element={<div data-testid="page-content">Conteúdo</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** O wrapper de conteúdo é o pai do <header> sticky (div com a margem da sidebar). */
function contentWrapper() {
  const header = screen.getByRole("banner");
  return header.parentElement as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
  resetNetworkStatusForTesting(true);
  resetDemoTourStorage();
  resetDemoSession();
});

describe("PageShell (F7.2/F7.3)", () => {
  it("monta header, sidebar, conteúdo e bottom nav", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toBeInTheDocument(); // <aside> sidebar
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    // Sidebar (desktop) + BottomNav (mobile) compartilham o mesmo label acessível.
    expect(screen.getAllByRole("navigation", { name: "Navegação principal" })).toHaveLength(2);
    expect(document.querySelector('[data-tour="header-privacy-theme"]')).toBeInTheDocument();
  });

  it("margem inicial acompanha a sidebar expandida (lg:pl-64)", () => {
    renderShell();
    expect(contentWrapper().className).toContain("lg:pl-64");
  });

  it("recolher a sidebar ajusta a margem do conteúdo em tempo real (lg:pl-20) e persiste", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));

    expect(contentWrapper().className).toContain("lg:pl-20");
    expect(contentWrapper().className).not.toContain("lg:pl-64");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");

  });

  it("expandir novamente restaura a margem (lg:pl-64)", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Recolher menu lateral" }));
    await user.click(screen.getByRole("button", { name: "Expandir menu lateral" }));

    expect(contentWrapper().className).toContain("lg:pl-64");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("renderiza o LaunchWizard overlay quando ?novo=transacao está presente", async () => {
    renderShell(["/?novo=transacao"]);

    expect(await screen.findByTestId("launch-wizard-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renderiza o LaunchWizard em modo rápido com forma Pix pré-selecionada quando ?novo=pix está presente", async () => {
    renderShell(["/?novo=pix"]);

    const overlay = await screen.findByTestId("launch-wizard-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute("data-initial-mode", "quick");
    expect(overlay).toHaveAttribute("data-payment-method", "pix");
  });

  it("renderiza o LaunchWizard diretamente em modo rápido quando ?modo=rapido está presente", async () => {
    renderShell(["/?modo=rapido"]);

    const overlay = await screen.findByTestId("launch-wizard-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute("data-initial-mode", "quick");
  });

  it("renderiza o botão Voltar ao Topo acessível no shell", () => {
    renderShell();

    const backToTopBtn = screen.getByRole("button", { name: "Voltar ao topo da página" });
    expect(backToTopBtn).toBeInTheDocument();
  });

  it("aplica compensação de safe area inferior e desobstrução da BottomNav no container principal", () => {
    const { container } = renderShell();
    const mainContainer = container.querySelector("#main-content > div");
    expect(mainContainer?.className).toContain("pb-[calc(6.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-bottom,0px)))]");
  });

  it("renderiza o NetworkStatusBanner quando a conexão com a internet é perdida", () => {
    renderShell();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText(/Você está sem conexão com a internet/i),
    ).toBeInTheDocument();
  });

  it("renderiza o botão de notificações quando há insights críticos do Smart Advisor mesmo com 0 lembretes", () => {
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: {
        id: "crit-1",
        themeKey: "dup:netflix",
        priority: 1,
        category: "critical",
        title: "Cobrança duplicada Netflix",
        description: "Detectamos duas cobranças idênticas.",
        iconName: "alert-triangle",
      },
      insights: [
        {
          id: "crit-1",
          themeKey: "dup:netflix",
          priority: 1,
          category: "critical",
          title: "Cobrança duplicada Netflix",
          description: "Detectamos duas cobranças idênticas.",
          iconName: "alert-triangle",
        },
      ],
      currentIndex: 0,
      totalCount: 1,
      dismiss: vi.fn(),
    });

    renderShell();
    expect(screen.getByRole("button", { name: /Notificações: 1 pendências/i })).toBeInTheDocument();
  });

  it("não renderiza DemoTourSpotlight nem indicador no header quando a simulação não está ativa", () => {
    renderShell();
    expect(screen.queryByRole("dialog", { name: /Tour guiado interativo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("header-demo-indicator")).not.toBeInTheDocument();
  });

  it("renderiza DemoTourSpotlight e indicador no header quando a simulação está ativa e permite encerrar imediatamente", async () => {
    startDemo("finances");
    const user = userEvent.setup();

    renderShell();

    expect(screen.getByRole("dialog", { name: /Tour guiado interativo/i })).toBeInTheDocument();
    expect(screen.getByTestId("header-demo-indicator")).toBeInTheDocument();
    expect(screen.getByText("Passo 1 de 4")).toBeInTheDocument();
    expect(screen.getByText("Visão Geral & Fluxo Consolidado")).toBeInTheDocument();

    const exitBtn = screen.getByRole("button", { name: /Encerrar demonstração/i });
    await user.click(exitBtn);

    expect(screen.queryByRole("dialog", { name: /Tour guiado interativo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("header-demo-indicator")).not.toBeInTheDocument();
  });
});

