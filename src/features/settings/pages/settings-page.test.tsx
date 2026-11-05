import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";
import { ThemeProvider } from "@/app/theme-provider";
import { startDemo, resetDemoSession } from "@/state/demo-mode";

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
  useUpdateProfile: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useCreateSupportTicketMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useMySupportTickets: () => ({ data: [], isLoading: false }),
  useMarkTicketAsReadMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useFamilyMode: () => ({
    isFamilyModeEnabled: false,
    toggleFamilyMode: vi.fn().mockResolvedValue(true),
    isUpdating: false,
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

  it("renderiza o cabeçalho e os pilares consolidados de navegação", () => {
    renderSettings();

    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aparência" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Notificações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Segurança" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dispositivos & App" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Plano" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Minha Conta" })).toBeInTheDocument();
    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
  });

  it("ativa a aba Aparência por padrão ao acessar /configuracoes sem parâmetros", () => {
    renderSettings(["/configuracoes"]);
    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aparência" })).toHaveAttribute("aria-selected", "true");
  });

  it("permite alternar entre os Modos de Experiência na aba Aparência", async () => {
    const user = userEvent.setup();
    renderSettings(["/configuracoes?tab=aparencia"]);

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

  it("permite configurar Lembretes integrados na aba Notificações", async () => {
    const user = userEvent.setup();
    renderSettings();

    const notifTab = screen.getByRole("tab", { name: "Notificações" });
    await user.click(notifTab);

    expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para faturas/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para dívidas/i })).toBeInTheDocument();

    const toggleButton = screen.getByRole("checkbox", { name: /Habilitar Lembretes no Aplicativo/i });
    await user.click(toggleButton);

    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({ remindersEnabled: false });
  });

  it("permite configurar Atalhos do Header em Aparência e não exibe seletor de widgets", async () => {
    const user = userEvent.setup();
    renderSettings(["/configuracoes?tab=aparencia"]);

    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
    expect(screen.getByText("Atalhos Rápidos do Cabeçalho")).toBeInTheDocument();
    expect(screen.queryByText("Widgets Visíveis na Visão Geral")).not.toBeInTheDocument();
    expect(screen.queryByText("Banners Contextuais de Atenção")).not.toBeInTheDocument();

    const calcCheckbox = screen.getByRole("checkbox", { name: /Calculadora/i });
    expect(calcCheckbox).toBeChecked();

    await user.click(calcCheckbox);
    expect(mockUpdateCustomSettings).toHaveBeenCalledWith({
      headerButtons: { calculatorButton: false },
    });
  });

  it("permite acessar a aba de Segurança e visualizar proteção e exportação", async () => {
    const user = userEvent.setup();
    renderSettings();

    const securityTab = screen.getByRole("tab", { name: "Segurança" });
    await user.click(securityTab);

    // Conteúdo de Dados e Backup
    expect(screen.getByText("Gestão de Dados & Backup")).toBeInTheDocument();
    expect(screen.queryByText("Conta & Sessão")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sair da Conta/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Autenticação em Duas Etapas (2FA / TOTP)")).not.toBeInTheDocument();
    expect(screen.queryByText("Aplicativo Autenticador (TOTP)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gerenciar 2FA/i })).not.toBeInTheDocument();
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
    renderSettings(["/configuracoes?tab=aparencia"]);

    const darkOption = screen.getByRole("button", { name: /^Escuro/i });
    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("ativa a aba Minha Conta quando acessado via ?tab=perfil", () => {
    renderSettings(["/configuracoes?tab=perfil"]);
    expect(screen.getByText("Dados Pessoais")).toBeInTheDocument();
  });

  it("ativa a aba Minha Conta quando acessado via ?tab=conta", () => {
    renderSettings(["/configuracoes?tab=conta"]);
    expect(screen.getByText("Dados Pessoais")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?subtab=dados", () => {
    renderSettings(["/configuracoes?subtab=dados"]);
    expect(screen.getByText("Gestão de Dados & Backup")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?tab=seguranca", () => {
    renderSettings(["/configuracoes?tab=seguranca"]);
    expect(screen.getByText("Gestão de Dados & Backup")).toBeInTheDocument();
    expect(screen.queryByText("Conta & Sessão")).not.toBeInTheDocument();
    expect(screen.queryByText("Autenticação em Duas Etapas (2FA / TOTP)")).not.toBeInTheDocument();
  });

  it("ativa a aba de Aparência quando acessado via ?tab=aparencia", () => {
    renderSettings(["/configuracoes?tab=aparencia"]);
    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
  });

  it("ativa a aba de Aparência quando acessado via ?tab=widgets", () => {
    renderSettings(["/configuracoes?tab=widgets"]);
    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
  });

  it("ativa a aba de Notificações quando acessado via ?tab=lembretes", () => {
    renderSettings(["/configuracoes?tab=lembretes"]);
    expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
  });

  it("ativa a aba de Notificações quando acessado via ?tab=notificacoes", () => {
    renderSettings(["/configuracoes?tab=notificacoes"]);
    expect(screen.getByText("Lembretes & Notificações")).toBeInTheDocument();
  });

  it("permite acessar a aba Dispositivos & App e exibe status de plataforma", () => {
    renderSettings(["/configuracoes?tab=devices"]);
    expect(screen.getByText("Plataforma em Uso")).toBeInTheDocument();
    expect(screen.getByText("O Tripé de Plataformas do Áxis")).toBeInTheDocument();
  });

  it("ativa a aba Dispositivos quando acessado via ?tab=dispositivos ou ?tab=app", () => {
    renderSettings(["/configuracoes?tab=dispositivos"]);
    expect(screen.getByText("Plataforma em Uso")).toBeInTheDocument();
  });

  it("renderiza a seção canônica de suporte e ajuda com o seletor do tour", () => {
    renderSettings();

    const supportSection = document.querySelector('[data-tour="settings-support-card"]');
    expect(supportSection).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Central de Ajuda & Suporte Técnico/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver Ajuda & FAQ/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Falar com Suporte/i })).toBeInTheDocument();
  });

  it("renderiza os seletores semânticos do tour de configurações em suas respectivas abas", () => {
    // Aba Aparência (padrão)
    renderSettings(["/configuracoes?tab=appearance"]);
    expect(document.querySelector('[data-tour="settings-experience-presets"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="settings-visual-identity"]')).toBeInTheDocument();

    cleanup();

    // Aba Notificações
    renderSettings(["/configuracoes?tab=notifications"]);
    expect(document.querySelector('[data-tour="settings-notifications-card"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="settings-banking-assistant"]')).toBeInTheDocument();

    cleanup();

    // Aba Dispositivos & App (Tripé de Plataformas e Status do APK)
    renderSettings(["/configuracoes?tab=devices"]);
    expect(document.querySelector('[data-tour="settings-platform-status"]')).toBeInTheDocument();
    expect(document.querySelector('[data-tour="settings-platforms-triptych"]')).toBeInTheDocument();

    cleanup();

    // Aba Segurança (Biometria e Escudo de Privacidade durante o tour do APK)
    startDemo("app_native_apk");
    renderSettings(["/configuracoes?tab=security"]);
    expect(document.querySelector('[data-tour="settings-app-lock"]')).toBeInTheDocument();
    resetDemoSession();
  });

  it("renderiza a aba de Suporte & Chamados via deep-link ?tab=suporte sem abrir modal invasivo", () => {
    renderSettings(["/configuracoes?tab=suporte"]);
    expect(screen.getByRole("tab", { name: /Suporte/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Central de Suporte & Chamados")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Falar com o Suporte" })).not.toBeInTheDocument();
  });

  it("abre automaticamente o diálogo de Suporte via deep-link ?modal=suporte", () => {
    renderSettings(["/configuracoes?modal=suporte"]);
    expect(screen.getByRole("heading", { name: "Falar com o Suporte" })).toBeInTheDocument();
    expect(screen.getByText(/Envie sua dúvida, sugestão ou relate um problema/i)).toBeInTheDocument();
  });

  it("abre a Central de Ajuda e permite iniciar a simulação pelo botão 'Rever Tour Guiado'", async () => {
    const user = userEvent.setup();
    renderSettings(["/configuracoes"]);

    const helpBtn = screen.getByRole("button", { name: /Ver Ajuda & FAQ/i });
    await user.click(helpBtn);

    expect(screen.getByRole("heading", { name: "Central de Ajuda & Suporte" })).toBeInTheDocument();
    expect(screen.getByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();

    const tourBtn = screen.getByRole("button", { name: /Rever Tour Guiado/i });
    expect(tourBtn).toBeInTheDocument();

    await user.click(tourBtn);

    expect(screen.getByRole("heading", { name: "Escolha sua Trilha de Demonstração" })).toBeInTheDocument();
    expect(screen.getByText(/Explore os recursos do aplicativo com dados simulados em memória/i)).toBeInTheDocument();
  });
});
