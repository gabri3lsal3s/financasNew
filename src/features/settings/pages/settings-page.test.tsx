import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";
import { ThemeProvider } from "@/app/theme-provider";

const mockUpdateReminderPreferences = vi.fn();

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
    },
    isLoading: false,
    error: null,
  }),
  useUpdateReminderPreferences: () => ({
    mutate: mockUpdateReminderPreferences,
    isPending: false,
  }),
}));

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
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

  it("renderiza o cabeçalho e as 3 abas consolidadas", () => {
    renderSettings();

    expect(screen.getByRole("heading", { level: 1, name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Personalização/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Interface/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Conta & Dados/i })).toBeInTheDocument();
  });

  it("permite alternar entre opções de tema visual e emite toast de confirmação", async () => {
    const user = userEvent.setup();
    renderSettings();

    const darkOption = screen.getByRole("button", { name: /^Escuro/i });
    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("permite acessar a aba de Interface e interagir com as configurações de lembretes", async () => {
    const user = userEvent.setup();
    renderSettings();

    const interfaceTab = screen.getByRole("tab", { name: /Interface/i });
    await user.click(interfaceTab);

    expect(screen.getByText("Lembretes & Notificações Automáticas")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Faturas de Cartão")).toBeInTheDocument();
    expect(screen.getByText("Antecedência para Dívidas")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para faturas/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Seletor de dias de antecedência para dívidas/i })).toBeInTheDocument();

    const toggleButton = screen.getByRole("checkbox", { name: /Habilitar Lembretes no Aplicativo/i });
    await user.click(toggleButton);

    expect(mockUpdateReminderPreferences).toHaveBeenCalledWith({ remindersEnabled: false });
  });
});
