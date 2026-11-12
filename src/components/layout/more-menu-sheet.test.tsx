import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { MoreMenuSheet } from "./more-menu-sheet";

const mockAppMode = "investor";

vi.mock("@/state", () => ({
  useReminders: () => ({ totalCount: 2, urgentCount: 1 }),
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
    expect(screen.getByText("Escolha sua Trilha de Demonstração")).toBeInTheDocument();
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
    expect(screen.getByText("Tour Guiado & Modo Simulação")).toBeInTheDocument();
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

  it("exibe o botão unificado 'Baixar aplicativo' na Web e abre o AppDownloadModal ao clicar", async () => {
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
    expect(screen.getByText("Instale o App Web (PWA) ou baixe o APK Android Pro")).toBeInTheDocument();

    await user.click(downloadBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("heading", { name: "Baixar aplicativo" })).toBeInTheDocument();

    nativeSpy.mockRestore();
    iosSpy.mockRestore();
    standaloneSpy.mockRestore();
  });
});

