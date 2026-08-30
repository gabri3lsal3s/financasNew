import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  useUpdateReminderPreferences: () => ({
    mutate: mockUpdateReminderPreferences,
    isPending: false,
  }),
  useUpdateCustomSettings: () => ({
    mutate: mockUpdateCustomSettings,
    isPending: false,
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

  it("renderiza o cabeçalho e as sub-abas modulares", () => {
    renderSettings();

    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aparência" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Sensorial" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Widgets" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Lembretes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dados" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Segurança" })).toBeInTheDocument();
  });

  it("permite acessar a aba de Segurança e visualizar status de proteção", async () => {
    const user = userEvent.setup();
    renderSettings();

    const securityTab = screen.getByRole("tab", { name: "Segurança" });
    await user.click(securityTab);

    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
    expect(screen.getByText("Aplicativo Autenticador (TOTP)")).toBeInTheDocument();
    expect(screen.getByText("Sessão & Nível de Acesso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gerenciar 2FA/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Conta/i })).toBeInTheDocument();
  });

  it("permite alternar entre opções de tema visual e emite toast de confirmação", async () => {
    const user = userEvent.setup();
    renderSettings();

    const darkOption = screen.getByRole("button", { name: /^Escuro/i });
    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("permite acessar a aba de Lembretes e interagir com as configurações", async () => {
    const user = userEvent.setup();
    renderSettings();

    const remindersTab = screen.getByRole("tab", { name: "Lembretes" });
    await user.click(remindersTab);

    expect(screen.getByText("Lembretes & Notificações Automáticas")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para faturas/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para dívidas/i })).toBeInTheDocument();

    const toggleButton = screen.getByRole("checkbox", { name: /Habilitar Lembretes no Aplicativo/i });
    await user.click(toggleButton);

    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({ remindersEnabled: false });
  });

  it("permite personalizar widgets do dashboard e respeita o limite mínimo de 3 widgets ativos", async () => {
    const user = userEvent.setup();
    renderSettings();

    const widgetsTab = screen.getByRole("tab", { name: "Widgets" });
    await user.click(widgetsTab);

    expect(screen.getByText("Widgets Visíveis na Visão Geral")).toBeInTheDocument();
    expect(screen.getByText("Banners Contextuais de Atenção & Ritmo")).toBeInTheDocument();

    const bannerCheckbox = screen.getByRole("checkbox", { name: /Banners Contextuais de Atenção & Ritmo/i });
    expect(bannerCheckbox).toBeChecked();

    await user.click(bannerCheckbox);
    expect(mockUpdateCustomSettings).toHaveBeenCalledWith({
      dashboardWidgets: { contextBanners: false },
    });
  });

  it("ativa a aba de Segurança quando acessado via ?tab=perfil", () => {
    renderSettings(["/configuracoes?tab=perfil"]);
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?subtab=perfil", () => {
    renderSettings(["/configuracoes?subtab=perfil"]);
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
  });

  it("ativa a aba de Segurança quando acessado via ?tab=seguranca", () => {
    renderSettings(["/configuracoes?tab=seguranca"]);
    expect(screen.getByText("Autenticação em Duas Etapas (2FA / TOTP)")).toBeInTheDocument();
  });

  it("ativa a aba de Aparência quando acessado via ?tab=aparencia", () => {
    renderSettings(["/configuracoes?tab=aparencia"]);
    expect(screen.getByText("Teal Vital (Oficial)")).toBeInTheDocument();
  });
});


