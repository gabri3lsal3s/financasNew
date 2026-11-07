import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvestorModePromoView } from "./investor-mode-promo-view";

const mockSetAppMode = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/state", () => ({
  useAppMode: () => ({
    appMode: "essential",
    isInvestorMode: false,
    isEssentialMode: true,
    setAppMode: mockSetAppMode,
    isUpdating: false,
    isLoading: false,
  }),
}));

describe("InvestorModePromoView — Tela de Acolhimento do Modo Essencial (§Plano 07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderView(onActivate?: () => void) {
    return render(
      <MemoryRouter>
        <InvestorModePromoView onActivate={onActivate} />
      </MemoryRouter>,
    );
  }

  it("renderiza o cabeçalho editorial, badges e os 3 pilares do módulo", () => {
    renderView();

    expect(screen.getByText("Gestão Patrimonial & Carteira de Ativos")).toBeInTheDocument();
    expect(screen.getByText("Módulo Opcional & Adaptativo")).toBeInTheDocument();
    expect(screen.getByText("Modo Investidor")).toBeInTheDocument();

    expect(screen.getByText("Metas & Rebalanceamento Inteligente")).toBeInTheDocument();
    expect(screen.getByText("Acompanhamento de Proventos")).toBeInTheDocument();
    expect(screen.getByText("Snapshots Patrimoniais & Reserva")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Ativar Módulo de Investimentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar para o Início" })).toBeInTheDocument();
  });

  it("chama setAppMode('investor') ao clicar no botão primário de ativação", async () => {
    const user = userEvent.setup();
    renderView();

    const activateBtn = screen.getByRole("button", { name: "Ativar Módulo de Investimentos" });
    await user.click(activateBtn);

    expect(mockSetAppMode).toHaveBeenCalledWith("investor");
  });

  it("chama callback customizado onActivate quando fornecido", async () => {
    const user = userEvent.setup();
    const onActivateMock = vi.fn();
    renderView(onActivateMock);

    const activateBtn = screen.getByRole("button", { name: "Ativar Módulo de Investimentos" });
    await user.click(activateBtn);

    expect(onActivateMock).toHaveBeenCalledTimes(1);
    expect(mockSetAppMode).not.toHaveBeenCalled();
  });

  it("navega de volta para o início ao clicar em Voltar para o Início", async () => {
    const user = userEvent.setup();
    renderView();

    const backBtn = screen.getByRole("button", { name: "Voltar para o Início" });
    await user.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
