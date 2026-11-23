import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageShell } from "./page-shell";
import { resolveNextShellOnboardingStep } from "./use-shell-onboarding-orchestrator";
import { resetNetworkStatusForTesting } from "@/services/network-status";
import { resetDemoSession, resetDemoTourStorage, startDemo } from "@/state/demo-mode";
import {
  resetVisualCustomization,
  updateVisualCustomization,
} from "@/hooks/use-visual-customization";
import * as nativeModule from "@/services/native";

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

const mockUpdateCustomSettingsMutate = vi.fn();

vi.mock("@/features/overview/hooks", () => ({
  useSmartAdvisorInsights: () => mockUseSmartAdvisorInsights(),
}));

const mockUseReminders = vi.fn().mockReturnValue({
  totalCount: 0,
  urgentCount: 0,
  items: [],
  isLoading: false,
  error: null,
});

vi.mock("@/state", () => ({
  useGlobalSearchEntries: () => ({
    entries: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useReminders: () => mockUseReminders(),
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        notificationCategories: { advisorInsights: true },
      },
    },
    isLoading: false,
  }),
  useOnboardingCounts: () => ({
    data: {
      expenseCategories: 5,
      incomeCategories: 5,
      cashCheckpoints: 1,
      cards: 1,
      transactions: 1,
      notificationsEnabled: true,
    },
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
  useUpdateCustomSettings: () => ({
    mutate: mockUpdateCustomSettingsMutate,
    isPending: false,
  }),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMyBroadcastNotifications: () => ({ data: [], isLoading: false }),
  useMarkBroadcastAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, isLoading: false, toggleFamilyMode: vi.fn() }),
  useTripMode: () => ({ isTripModeEnabled: false, isLoading: false, toggleTripMode: vi.fn() }),
  usePermission: () => ({ canWrite: true, canRead: true, level: "write" }),
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
  resetVisualCustomization(null);
  mockUpdateCustomSettingsMutate.mockClear();
  mockUseReminders.mockReturnValue({
    totalCount: 0,
    urgentCount: 0,
    items: [],
    isLoading: false,
    error: null,
  });
  mockUseSmartAdvisorInsights.mockReturnValue({
    insight: null,
    insights: [],
    currentIndex: 0,
    totalCount: 0,
    dismiss: vi.fn(),
  });
  resetNetworkStatusForTesting(true);
  resetDemoTourStorage();
  resetDemoSession();
  nativeModule.setAppLocked(false);
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
    expect(screen.getByRole("button", { name: /Notificações: 1 pendência/i })).toBeInTheDocument();
  });

  it("respeita máximo de 2 slots no topo e posiciona o sininho sempre no extremo direito substituindo o último botão à direita", () => {
    // 1. Sem notificações e com [Calculadora, Privacidade]: exibe ambos e oculta sininho
    updateVisualCustomization({
      headerButtons: {
        logo: true,
        calculatorButton: true,
        themeToggle: false,
        privacyToggle: true,
        order: ["calculatorButton", "privacyToggle"],
      },
    });

    const { unmount } = renderShell();
    expect(screen.getByRole("button", { name: /Calculadora/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocultar valores/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Notificações/i })).not.toBeInTheDocument();
    unmount();

    // 2. Chega 1 notificação com [Calculadora, Privacidade]: Privacidade (à direita) cede lugar ao sininho no extremo direito
    const criticalAlert = {
      id: "crit-slot-1",
      themeKey: "dup:netflix",
      priority: 1 as const,
      category: "critical" as const,
      title: "Cobrança duplicada",
      description: "Detectamos duas cobranças.",
      iconName: "alert-triangle" as const,
    };
    mockUseSmartAdvisorInsights.mockReturnValue({
      insight: criticalAlert,
      insights: [criticalAlert],
      currentIndex: 0,
      totalCount: 1,
      dismiss: vi.fn(),
    });

    const { unmount: unmount2 } = renderShell();
    const slotContainer = document.querySelector('[data-tour="header-privacy-theme"]');
    const buttonsCaseA = Array.from(slotContainer?.querySelectorAll("button") ?? []);
    expect(buttonsCaseA).toHaveLength(2);
    expect(buttonsCaseA[0]).toHaveAccessibleName(/Calculadora/i);
    expect(buttonsCaseA[1]).toHaveAccessibleName(/Notificações: 1 pendência/i);
    expect(screen.queryByRole("button", { name: /Ocultar valores/i })).not.toBeInTheDocument();
    unmount2();

    // 3. Se a Calculadora estiver por último à direita ([Privacidade, Calculadora]), a Calculadora é substituída pelo sininho
    updateVisualCustomization({
      headerButtons: {
        logo: true,
        calculatorButton: true,
        themeToggle: false,
        privacyToggle: true,
        order: ["privacyToggle", "calculatorButton"],
      },
    });

    renderShell();
    const slotContainerB = document.querySelector('[data-tour="header-privacy-theme"]');
    const buttonsCaseB = Array.from(slotContainerB?.querySelectorAll("button") ?? []);
    expect(buttonsCaseB).toHaveLength(2);
    expect(buttonsCaseB[0]).toHaveAccessibleName(/Ocultar valores/i);
    expect(buttonsCaseB[1]).toHaveAccessibleName(/Notificações: 1 pendência/i);
    expect(screen.queryByRole("button", { name: /Calculadora/i })).not.toBeInTheDocument();
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
    expect(screen.getByText("Passo 1 de 5")).toBeInTheDocument();
    expect(screen.getByText("Dashboard & Saldo Livre Real")).toBeInTheDocument();

    const exitBtn = screen.getByRole("button", { name: /Encerrar demonstração/i });
    await user.click(exitBtn);

    expect(screen.queryByRole("dialog", { name: /Tour guiado interativo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("header-demo-indicator")).not.toBeInTheDocument();
  });

  it("aplica .pt-safe no cabeçalho e dispara cloud sync silencioso ao alternar o ThemeToggle (M7)", async () => {
    const user = userEvent.setup();
    renderShell();

    const header = screen.getByRole("banner");
    expect(header.className).toContain("pt-safe");

    const themeBtn = screen.getByRole("button", { name: /Alternar tema/i });
    await user.click(themeBtn);

    expect(mockUpdateCustomSettingsMutate).toHaveBeenCalledWith({
      themePreference: "dark",
    });
  });

  it("orquestra onboarding em fila única sem modais simultâneos nem propaganda Android fora do Android", () => {
    // 1. Bloqueado por AppLock, Tour ou Wizard nunca exibe onboarding
    expect(
      resolveNextShellOnboardingStep({
        isAppLocked: true,
        isDemoActive: false,
        isWizardOpen: false,
        hasExternalDialogOpen: false,
        isAndroidEligible: true,
        isAndroidNativeRuntime: true,
        hasSeenWelcome: false,
        hasSeenWelcomeFeature: false,
        hasSeenNativeOnboarding: false,
        isVirginAccount: true,
      }),
    ).toBeNull();

    // 2. Fora do Android (iOS/Desktop), pula welcome_feature e native_onboarding
    expect(
      resolveNextShellOnboardingStep({
        isAppLocked: false,
        isDemoActive: false,
        isWizardOpen: false,
        hasExternalDialogOpen: false,
        isAndroidEligible: false,
        isAndroidNativeRuntime: false,
        hasSeenWelcome: true,
        hasSeenWelcomeFeature: false,
        hasSeenNativeOnboarding: false,
        isVirginAccount: true,
      }),
    ).toBeNull();

    // 3. Fila única no Android nativo: welcome -> welcome_feature -> native_onboarding
    expect(
      resolveNextShellOnboardingStep({
        isAppLocked: false,
        isDemoActive: false,
        isWizardOpen: false,
        hasExternalDialogOpen: false,
        isAndroidEligible: true,
        isAndroidNativeRuntime: true,
        hasSeenWelcome: false,
        hasSeenWelcomeFeature: false,
        hasSeenNativeOnboarding: false,
        isVirginAccount: true,
      }),
    ).toBe("welcome");

    expect(
      resolveNextShellOnboardingStep({
        isAppLocked: false,
        isDemoActive: false,
        isWizardOpen: false,
        hasExternalDialogOpen: false,
        isAndroidEligible: true,
        isAndroidNativeRuntime: true,
        hasSeenWelcome: true,
        hasSeenWelcomeFeature: false,
        hasSeenNativeOnboarding: false,
        isVirginAccount: true,
      }),
    ).toBe("welcome_feature");

    expect(
      resolveNextShellOnboardingStep({
        isAppLocked: false,
        isDemoActive: false,
        isWizardOpen: false,
        hasExternalDialogOpen: false,
        isAndroidEligible: true,
        isAndroidNativeRuntime: true,
        hasSeenWelcome: true,
        hasSeenWelcomeFeature: true,
        hasSeenNativeOnboarding: false,
        isVirginAccount: true,
      }),
    ).toBe("native_onboarding");
  });

  it("não abre NativeOnboardingDialog simultaneamente quando LaunchWizard está aberto", () => {
    const isNativeSpy = vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    const isAndroidSpy = vi.spyOn(nativeModule, "isAndroidNative").mockReturnValue(true);

    renderShell(["/?novo=transacao"]);

    expect(screen.queryByRole("heading", { name: "Bem-vindo ao App Nativo Android" })).not.toBeInTheDocument();

    isNativeSpy.mockRestore();
    isAndroidSpy.mockRestore();
  });

  it("silencia disparo automático do NativeOnboardingDialog na entrada do Android nativo (onboarding 100% não-bloqueante)", () => {
    const isNativeSpy = vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    const isAndroidSpy = vi.spyOn(nativeModule, "isAndroidNative").mockReturnValue(true);

    renderShell(["/"]);

    expect(screen.queryByRole("heading", { name: "Bem-vindo ao App Nativo Android" })).not.toBeInTheDocument();

    isNativeSpy.mockRestore();
    isAndroidSpy.mockRestore();
  });
});

