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

describe("AppearanceTab - Aparência & Identidade Visual (Fase 1 — Tarefa 1.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMutate.mockClear();
    vi.clearAllMocks();
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
  });

  it("renderiza os cards de Modo de Experiência, Identidade Visual e Interface", () => {
    renderAppearanceTab();

    expect(screen.getByText("Modo de Experiência do Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Aparência & Identidade Visual")).toBeInTheDocument();
    expect(screen.getByText("Interface & Composição")).toBeInTheDocument();
    expect(screen.getByText("Restaurar Padrões de Personalização")).toBeInTheDocument();
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

    const darkOption = screen.getByRole("button", { name: /^Escuro/i });
    await user.click(darkOption);

    expect(document.documentElement.dataset.theme).toBe("dark");
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

    const resetBtn = screen.getByRole("button", { name: /Redefinir/i });
    await user.click(resetBtn);

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

  it("renderiza o card de instalação PWA quando em ambiente web e recebe o evento", async () => {
    vi.mocked(nativeServices.isNativePlatform).mockReturnValue(false);
    const { registerPWA } = await import("@/app/pwa");
    registerPWA();

    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.dispatchEvent(event);

    renderAppearanceTab();

    expect(await screen.findByText("Aplicativo Web Instalável (PWA)")).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instalar app" })).toBeInTheDocument();
  });
});
