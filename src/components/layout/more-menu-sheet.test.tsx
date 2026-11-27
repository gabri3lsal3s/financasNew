import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MoreMenuSheet } from "./more-menu-sheet";

const mockAppMode = "investor";

vi.mock("@/state/queries/use-user-access", () => ({
  useUserAccess: () => ({
    isAdmin: false,
    hasFeature: () => true,
  }),
}));
vi.mock("@/state/queries/use-family-mode", () => ({
  useFamilyMode: () => ({ isFamilyModeEnabled: false }),
}));
vi.mock("@/state/queries/use-trip-mode", () => ({
  useTripMode: () => ({
    isTripModeEnabled: false,
    isLoading: false,
    toggleTripMode: vi.fn(),
  }),
}));
vi.mock("@/state/queries/use-business-mode", () => ({
  useBusinessMode: () => ({
    isBusinessModeEnabled: false,
    businessProfile: null,
    toggleBusinessMode: vi.fn().mockResolvedValue(true),
    updateBusinessProfile: vi.fn().mockResolvedValue(true),
    isLoading: false,
    isPending: false,
  }),
}));

vi.mock("@/state", () => ({
  useIncomeGoals: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioContributions: () => ({ data: [], isLoading: false, error: null }),
  useAllPortfolioTransactions: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioSnapshots: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioDividends: () => ({ data: [], isLoading: false, error: null }),
  useSavePocketCostMilestoneAtomic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInternalTransferPair: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserFinancialContext: () => ({ context: undefined, isLoading: false }),
  useFamilyConsolidation: () => ({ data: null, isLoading: false, error: null }),
  useSetBudgetLimit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnableWebPushSubscription: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useDisableWebPushSubscription: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useRegisterFcmToken: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useDisableFcmToken: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useUpdateReminderPreferences: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useRealCashBalance: () => ({ cashBalance: { currentBalanceCents: 0 }, safeToSpend: { safeToSpendCents: 0 }, isLoading: false, error: null, refetch: vi.fn() }),
  useEmergencyFundComposition: () => ({ composition: { totalReserveCents: 0, cashInAccountsCents: 0, portfolioReserveCents: 0, breakdown: [], warnings: [], targetMonths: 6, targetMonthsProgressPercent: 0, targetMonthsCents: 0 }, config: { includeCheckingAccounts: true }, isLoading: false }),
  usePortfolioPosition: () => ({ rows: [], totalBRL: 0, cashBRL: 0, monthlySeries: [], monthlyContributionCents: 0, isLoading: false, error: null, refetch: vi.fn() }),
  useFeedbackEntries: () => ({ data: [], isLoading: false, error: null }),
  useDismissBroadcastNotification: () => ({ mutate: vi.fn(), isPending: false }),
  useAllDebts: () => ({ data: [], isLoading: false, error: null }),
  useAllBudgets: () => ({ data: [], isLoading: false, error: null }),
  useAllCardExpenses: () => ({ data: [], isLoading: false, error: null }),
  useAllCardPayments: () => ({ data: [], isLoading: false, error: null }),
  useBudgets: () => ({ data: [], isLoading: false, error: null }),
  useCategories: () => ({ data: [], isLoading: false, error: null }),
  useCorporateDividends: () => ({ data: [], isLoading: false, error: null }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useExpenses: () => ({ data: [], isLoading: false, error: null }),
  useIncomes: () => ({ data: [], isLoading: false, error: null }),
  useDebts: () => ({ data: [], isLoading: false, error: null }),
  useFeedback: () => ({ data: {}, isLoading: false, error: null }),
  useSetFeedback: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useCreateIncome: () => ({ mutateAsync: vi.fn() }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn() }),
  useCreateExpense: () => ({ mutateAsync: vi.fn() }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn() }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useRecurrences: () => ({ data: [], isLoading: false, error: null }),
  useUserTrips: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, error: null }),
  useReminders: () => ({ totalCount: 2, urgentCount: 1 }),
  useReminderStates: () => ({ data: [], isLoading: false }),
  useOnboardingCounts: () => ({ data: null, isLoading: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMyBroadcastNotifications: () => ({ data: [], isLoading: false }),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useUserSubscription: () => ({ isPro: true, isReadOnly: false, canWrite: true }),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkBroadcastAsRead: () => ({ mutate: vi.fn(), isPending: false }),
  useUserAccess: () => ({
    isAdmin: false,
    hasFeature: () => true,
  }),
  useMyFamily: () => ({ data: null }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false }),
  useTripMode: () => ({
    isTripModeEnabled: false,
    isLoading: false,
    toggleTripMode: vi.fn(),
  }),
  useBusinessMode: () => ({
    isBusinessModeEnabled: false,
    businessProfile: null,
    toggleBusinessMode: vi.fn().mockResolvedValue(true),
    updateBusinessProfile: vi.fn().mockResolvedValue(true),
    isLoading: false,
    isPending: false,
  }),
  useViewScope: () => ({
    viewScope: "all" as const,
    effectiveViewScope: "all" as const,
    setViewScope: vi.fn(),
    isBusinessModeEnabled: false,
  }),
  usePermission: () => ({
    canWrite: true,
    canRead: true,
    level: "write",
  }),
  useAppMode: () => ({
    appMode: mockAppMode,
    isInvestorMode: true,
    isEssentialMode: false,
    setAppMode: vi.fn(),
    isUpdating: false,
    isLoading: false,
  }),
  useUserPreferences: () => ({
    data: { custom_settings: {} },
    isLoading: false,
  }),
}));

describe("MoreMenuSheet", () => {
  it("renderiza a folha de mais opções com grupos quando aberto", () => {
    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={vi.fn()} />
      </BrowserRouter>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Mais opções")).toBeInTheDocument();
  });

  it("fecha a folha ao clicar em um link de navegação", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={onOpenChange} />
      </BrowserRouter>,
    );

    const firstLink = screen.getAllByRole("link")[0];
    if (firstLink) {
      await user.click(firstLink);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    }
  });

  it("abre o modal de seleção de trilha ao clicar em Rever Tour Guiado", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={onOpenChange} />
      </BrowserRouter>,
    );

    const tourBtn = screen.getByRole("button", { name: /Rever Tour Guiado/i });
    expect(tourBtn).toBeInTheDocument();

    await user.click(tourBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Não abre o segundo modal no mesmo tick síncrono (evita colisão de dois Radix Dialogs)
    expect(screen.queryByText("Escolha sua Trilha de Demonstração")).not.toBeInTheDocument();
    expect(await screen.findByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
  });

  it("abre a central de ajuda ao clicar em Central de Ajuda & Suporte", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={onOpenChange} />
      </BrowserRouter>,
    );

    const helpBtn = screen.getByRole("button", { name: /Central de Ajuda & Suporte/i });
    expect(helpBtn).toBeInTheDocument();

    await user.click(helpBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Tour Guiado & Modo Simulação")).not.toBeInTheDocument();
    expect(await screen.findByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();
  });

  it("mantém Investimentos acessível no menu Mais para todos os usuários (§Plano 11)", () => {
    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={vi.fn()} />
      </BrowserRouter>,
    );

    expect(screen.getByRole("link", { name: "Investimentos" })).toBeInTheDocument();
  });

  it("não exibe o botão de baixar aplicativo quando executando em plataforma nativa (APK)", async () => {
    const platformModule = await import("@/services/native/platform");
    const spy = vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={vi.fn()} />
      </BrowserRouter>,
    );

    expect(screen.queryByRole("button", { name: /Baixar aplicativo/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Baixar aplicativo")).not.toBeInTheDocument();
    expect(screen.queryByText("Baixar App Android Pro (APK)")).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it("não exibe o botão de baixar aplicativo em iOS quando já estiver no PWA", async () => {
    const platformModule = await import("@/services/native/platform");
    const nativeSpy = vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const iosSpy = vi.spyOn(platformModule, "isIOSDevice").mockReturnValue(true);
    const standaloneSpy = vi.spyOn(platformModule, "isStandaloneDisplay").mockReturnValue(true);

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={vi.fn()} />
      </BrowserRouter>,
    );

    expect(screen.queryByRole("button", { name: /Baixar aplicativo/i })).not.toBeInTheDocument();

    nativeSpy.mockRestore();
    iosSpy.mockRestore();
    standaloneSpy.mockRestore();
  });

  it("exibe o botão de instalação PWA na Web Desktop sem promover APK Android (M10)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const platformModule = await import("@/services/native/platform");
    const nativeSpy = vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const iosSpy = vi.spyOn(platformModule, "isIOSDevice").mockReturnValue(false);
    const standaloneSpy = vi.spyOn(platformModule, "isStandaloneDisplay").mockReturnValue(false);

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={onOpenChange} />
      </BrowserRouter>,
    );

    const downloadBtn = screen.getByRole("button", { name: /Baixar aplicativo/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(
      screen.getByText("Instale o App Web (PWA) no seu dispositivo sem ocupar espaço"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/APK Android/i)).not.toBeInTheDocument();

    await user.click(downloadBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("heading", { name: "Baixar aplicativo" })).toBeInTheDocument();

    nativeSpy.mockRestore();
    iosSpy.mockRestore();
    standaloneSpy.mockRestore();
  });

  it("exibe opção de APK Android quando o dispositivo for navegador Android Web", async () => {
    const platformModule = await import("@/services/native/platform");
    const nativeSpy = vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
    const standaloneSpy = vi.spyOn(platformModule, "isStandaloneDisplay").mockReturnValue(false);
    const originalUa = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36",
      configurable: true,
    });

    try {
      render(
        <BrowserRouter>
          <MoreMenuSheet open={true} onOpenChange={vi.fn()} />
        </BrowserRouter>,
      );

      expect(screen.getByRole("button", { name: /Baixar aplicativo/i })).toBeInTheDocument();
      expect(
        screen.getByText("Instale o App Web (PWA) ou baixe o APK Android Pro"),
      ).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "userAgent", {
        value: originalUa,
        configurable: true,
      });
      nativeSpy.mockRestore();
      standaloneSpy.mockRestore();
    }
  });

  it("exibe o card de atualização disponível no lugar de baixar aplicativo quando houver nova versão", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const pwaModule = await import("@/app/pwa");
    const applySpy = vi.spyOn(pwaModule, "applyPWAUpdate").mockResolvedValue(undefined);
    const updateAvailableSpy = vi.spyOn(pwaModule, "getPWAUpdateAvailable").mockReturnValue(true);

    render(
      <BrowserRouter>
        <MoreMenuSheet open={true} onOpenChange={onOpenChange} />
      </BrowserRouter>,
    );

    const updateBtn = screen.getByRole("button", { name: /Atualização disponível/i });
    expect(updateBtn).toBeInTheDocument();
    expect(screen.getByText("Nova versão")).toBeInTheDocument();

    await user.click(updateBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(applySpy).toHaveBeenCalledTimes(1);

    applySpy.mockRestore();
    updateAvailableSpy.mockRestore();
  });
});

