import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceTab } from "./appearance-tab";
import * as nativeServices from "@/services/native";
import { ThemeProvider } from "@/app/theme-provider";

const mockMutate = vi.fn();

vi.mock("@/state", () => ({
  useUpdateCustomSettings: () => ({ mutate: mockMutate, isPending: false }),
  useUserAccess: () => ({
    role: "admin",
    hasFeature: () => true,
  }),
  useFamilyMode: () => ({
    isFamilyModeEnabled: false,
    toggleFamilyMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useTripMode: () => ({
    isTripModeEnabled: false,
    toggleTripMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useMyPublicShares: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAppMode: () => ({
    appMode: "investor",
    isInvestorMode: true,
    isEssentialMode: false,
    setAppMode: vi.fn(),
    isUpdating: false,
    isLoading: false,
  }),
}));

vi.mock("@/services/native", async () => {
  const actual = await vi.importActual<typeof nativeServices>("@/services/native");
  return {
    ...actual,
    isNativePlatform: vi.fn().mockReturnValue(false),
  };
});

function renderAppearanceTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppearanceTab />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("AppearanceTab - Aparência & Identidade Visual (Fase 1 — Tarefa 1.3)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMutate.mockClear();
    vi.clearAllMocks();
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
  });

  it("renderiza os cards de Modo de Experiência, Identidade Visual e Interface, e não renderiza estilo de superfície", () => {
    renderAppearanceTab();

    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Aparência & Identidade Visual")).toBeInTheDocument();
    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
    expect(screen.getByText("Restaurar Padrões de Personalização")).toBeInTheDocument();
    expect(screen.queryByText(/Estilo de Superfícies/i)).not.toBeInTheDocument();
  });

  it("permite selecionar presets de experiência", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const focoBtn = screen.getByText("Foco").closest("button");
    expect(focoBtn).not.toBeNull();
    await user.click(focoBtn!);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        experiencePreset: "minimal",
        motionLevel: "eco",
        density: "compact",
      }),
    );
  });

  it("permite alternar opções de tema visual", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const darkOptions = screen.getAllByRole("button", { name: /Escuro/i });
    // O primeiro botão é a opção de tema na grade principal
    await user.click(darkOptions[0]!);

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("permite selecionar preferência de tema escuro (Escuro vs OLED)", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const oledVariantBtn = screen.getByRole("button", { name: /OLED \(True Black\)/i });
    await user.click(oledVariantBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        darkThemeVariant: "oled",
      }),
    );
  });

  it("permite selecionar o modo Por Horário e exibe as janelas de horário", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const scheduleBtn = screen.getByRole("button", { name: /Por Horário/i });
    await user.click(scheduleBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        themePreference: "schedule",
      }),
    );

    expect(screen.getByText("Janelas de Horário do Dia")).toBeInTheDocument();
    expect(screen.getByText("Início do Dia (Tema Claro)")).toBeInTheDocument();
  });

  it("permite alternar cores de destaque oficiais", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const goldBtn = screen.getByRole("button", { name: /^Ouro Âmbar/i });
    await user.click(goldBtn);

    expect(document.documentElement.dataset.accent).toBe("gold");
  });

  it("permite configurar atalhos do cabeçalho", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const calcCheckbox = screen.getByRole("checkbox", { name: /Calculadora/i });
    expect(calcCheckbox).toBeChecked();

    await user.click(calcCheckbox);
    expect(mockMutate).toHaveBeenCalledWith({
      headerButtons: { calculatorButton: false },
    });
  });


  it("permite redefinir padrões de fábrica para visual e interface", async () => {
    const user = userEvent.setup();
    renderAppearanceTab();

    const resetBtn = screen.getByRole("button", { name: /Restaurar Padrões/i });
    await user.click(resetBtn);

    const confirmBtn = screen.getByRole("button", { name: /Confirmar Restauração/i });
    await user.click(confirmBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        headerButtons: {
          logo: true,
          calculatorButton: true,
          themeToggle: false,
          privacyToggle: false,
        },
      }),
    );
  });

  it("renderiza a aba de aparência sem bifurcação de modos (§Plano 11)", () => {
    renderAppearanceTab();

    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
    expect(screen.queryByText("Perfil de Visualização do Aplicativo")).not.toBeInTheDocument();
  });
});
