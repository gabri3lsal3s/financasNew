import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";
import { ThemeProvider } from "@/app/theme-provider";

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
}));

function renderSettings() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("SettingsPage (F11 — Centro de Personalização)", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("renderiza o cabeçalho e abas principais", () => {
    renderSettings();

    expect(screen.getByText("Configurações & Personalização")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Aparência/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Movimento/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Sensorial/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Perfil/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Dados/i })).toBeInTheDocument();
  });

  it("permite alternar entre opções de tema visual", async () => {
    const user = userEvent.setup();
    renderSettings();

    const darkOption = screen.getByRole("button", { name: /Escuro/i });
    await user.click(darkOption);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("permite selecionar uma paleta de acento", async () => {
    const user = userEvent.setup();
    renderSettings();

    const emeraldOption = screen.getByRole("button", { name: /Esmeralda Fintech/i });
    await user.click(emeraldOption);
    expect(document.documentElement.getAttribute("data-accent")).toBe("emerald");
  });

  it("navega até a aba Dashboard e exibe opções modulares", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /Dashboard/i }));
    expect(screen.getByText(/Resumo de Saldo & KPIs/i)).toBeInTheDocument();
    expect(screen.getByText(/Ritmo de Gastos Diário/i)).toBeInTheDocument();
  });

  it("navega até a aba Perfil e exibe dados da conta", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("tab", { name: /Perfil/i }));
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    expect(screen.getByText("usuario@teste.com")).toBeInTheDocument();
  });
});
