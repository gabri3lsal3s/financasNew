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
});
