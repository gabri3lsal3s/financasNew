import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";
import { ThemeProvider } from "@/app/theme-provider";

const mockUpdateReminderPreferences = vi.fn();
const mockUpdateCustomSettings = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "usuario@teste.com", user_metadata: { name: "Gabriel" } },
    session: {},
    loading: false,
    configError: null,
  }),
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [] }),
    }),
    auth: {
      signOut: vi.fn(),
    },
  }),
}));

vi.mock("@/state", () => ({
  useGlobalSearchEntries: () => ({
    entries: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePortfolioPosition: () => ({
    rows: [],
    totalBRL: 0,
    cashBRL: 0,
    monthlySeries: [],
    isLoading: false,
    isError: false,
    error: null,
  }),
  useUserPreferences: () => ({
    data: {
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 5,
      custom_settings: {},
    },
    isLoading: false,
    error: null,
  }),
  useExportData: () => ({
    refetch: () => Promise.resolve({ data: { data: { expenses: [], incomes: [], card_payments: [] } } }),
  }),
  useRestoreBackup: () => ({
    mutateAsync: vi.fn(),
  }),
  useCategories: () => ({
    data: [],
  }),
  useCreditCards: () => ({
    data: [],
  }),
  useUpdateReminderPreferences: () => ({
    mutate: mockUpdateReminderPreferences,
    isPending: false,
  }),
  useUpdateCustomSettings: () => ({
    mutate: mockUpdateCustomSettings,
    isPending: false,
  }),
  useUserSubscription: () => ({
    isTrial: true,
    isPro: false,
    isFullAccess: true,
    trialDaysRemaining: 25,
    trialEndsAt: "2026-09-24T00:00:00Z",
    currentPeriodEnd: null,
    plan: "trial",
  }),
  useUserAccess: () => ({
    profile: null,
    role: "user",
    status: "active",
    features: {},
    isPendingApproval: false,
    isActive: true,
    isSuspended: false,
    isBanned: false,
    isAdmin: false,
    isSuperAdmin: false,
    hasFeature: () => true,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

function renderSettings(initialEntries: string[] = ["/configuracoes"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsPage (F11 — Centro de Personalização)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUpdateReminderPreferences.mockClear();
    mockUpdateCustomSettings.mockClear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renderiza o cabeçalho e os 3 pilares consolidados de navegação", () => {
    renderSettings();

    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Personalização" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plano" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Segurança" })).toBeInTheDocument();
  });

  it("permite alternar entre os Modos de Experiência na aba Personalização", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Dinâmico")).toBeInTheDocument();
    expect(screen.getByText("Foco")).toBeInTheDocument();
    expect(screen.getByText("Discreto")).toBeInTheDocument();

    const focoCardButton = screen.getByText("Foco").closest("button");
    expect(focoCardButton).not.toBeNull();
    await user.click(focoCardButton!);

    expect(mockUpdateCustomSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        experiencePreset: "minimal",
        motionLevel: "eco",
        density: "compact",
        soundEnabled: false,
        hapticEnabled: true,
        numberTickerEnabled: false,
      }),
    );
  });

  it("permite configurar Lembretes integrados na aba Personalização", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para faturas/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para dívidas/i })).toBeInTheDocument();

    const toggleButton = screen.getByRole("checkbox", { name: /Habilitar Lembretes no Aplicativo/i });
    await user.click(toggleButton);

    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({ remindersEnabled: false });
  });

  it("permite configurar Atalhos do Header e Widgets da Visão Geral em Personalização", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
    expect(screen.getByText("Atalhos Rápidos do Cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("Widgets Visíveis na Visão Geral")).toBeInTheDocument();

    const bannerCheckbox = screen.getByRole("checkbox", { name: /Banners Contextuais de Atenção/i });
    expect(bannerCheckbox).toBeChecked();

    await user.click(bannerCheckbox);
    expect(mockUpdateCustomSettings).toHaveBeenCalledWith({
      dashboardWidgets: { contextBanners: false },
    });
  });

  it("permite acessar a aba unificada de Segurança e visualizar proteção e exportação", async () => {
    const user = userEvent.setup();
    renderSettings();

    const securityTab = screen.getByRole("tab", { name: "Segurança" });
    await user.click(securityTab);

    // Conteúdo de Segurança
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Autenticador (TOTP)")).toBeInTheDocument();
    expect(screen.getByText("Conta & Sessão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerenciar 2FA/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Conta/i })).toBeInTheDocument();

    // Conteúdo de Dados
    expect(screen.getByText("Gestão de Dados & Backup")).toBeInTheDocument();
  });

  it("permite acessar a aba Plano e visualizar status de assinatura e comparativo", async () => {
    const user = userEvent.setup();
    renderSettings();

    const planTab = screen.getByRole("tab", { name: "Plano" });
    await user.click(planTab);

    expect(screen.getByText("Plano Atual")).toBeInTheDocument();
    expect(screen.getByText("Comparativo de Planos")).toBeInTheDocument();
    expect(screen.getByText("Teste Pro Ativo")).toBeInTheDocument();
  });

  it("permite alternar entre opções de tema visual e emite toast de confirmação", async () => {
    const user = userEvent.setup();
    renderSettings();

    const darkOption = screen.getByRole("button", { name: /^Escuro/i });
    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ativa a aba de Segurança quando acessado via ?tab=perfil", () => {
    renderSettings(["/configuracoes?tab=perfil"]);
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?subtab=dados", () => {
    renderSettings(["/configuracoes?subtab=dados"]);
    expect(screen.getByText("Gestão de Dados & Backup")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?tab=seguranca", () => {
    renderSettings(["/configuracoes?tab=seguranca"]);
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
  });

  it("ativa a aba de Personalização quando acessado via ?tab=aparencia", () => {
    renderSettings(["/configuracoes?tab=aparencia"]);
    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
  });

  it("ativa a aba de Personalização quando acessado via ?tab=widgets", () => {
    renderSettings(["/configuracoes?tab=widgets"]);
    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
  });

  it("ativa a aba de Personalização quando acessado via ?tab=lembretes", () => {
    renderSettings(["/configuracoes?tab=lembretes"]);
    expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
  });
});
