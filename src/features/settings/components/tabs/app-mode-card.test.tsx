import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppModeCard } from "./app-mode-card";

let mockAppMode = "investor";
let mockIsUpdating = false;
const mockSetAppMode = vi.fn();

vi.mock("@/state", () => ({
  useAppMode: () => ({
    appMode: mockAppMode,
    isInvestorMode: mockAppMode === "investor",
    isEssentialMode: mockAppMode === "essential",
    setAppMode: mockSetAppMode,
    isUpdating: mockIsUpdating,
    isLoading: false,
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("AppModeCard — Seletor de Perfil de Visualização (§Plano 07)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppMode = "investor";
    mockIsUpdating = false;
  });

  it("renderiza os dois modos de visualização com destaque para o modo ativo (Investidor)", () => {
    render(<AppModeCard />);

    expect(screen.getByText("Perfil de Visualização do Aplicativo")).toBeInTheDocument();
    expect(screen.getByText("Modo Investidor Ativo")).toBeInTheDocument();
    expect(screen.getByText("Modo Essencial")).toBeInTheDocument();
    expect(screen.getByText("Modo Investidor")).toBeInTheDocument();
  });

  it("renderiza o badge de Modo Essencial Ativo quando o app está no Modo Essencial", () => {
    mockAppMode = "essential";
    render(<AppModeCard />);

    expect(screen.getByText("Modo Essencial Ativo")).toBeInTheDocument();
  });

  it("ao clicar no Modo Essencial quando no Modo Investidor, dispara setAppMode('essential')", async () => {
    mockAppMode = "investor";
    render(<AppModeCard />);

    const essentialButton = screen.getByRole("button", { name: /Modo Essencial/i });
    fireEvent.click(essentialButton);

    await waitFor(() => {
      expect(mockSetAppMode).toHaveBeenCalledWith("essential");
    });
  });

  it("ao clicar no modo que já está ativo, não dispara nova chamada", async () => {
    mockAppMode = "investor";
    render(<AppModeCard />);

    const investorButton = screen.getByRole("button", { name: /Modo Investidor/i });
    fireEvent.click(investorButton);

    expect(mockSetAppMode).not.toHaveBeenCalled();
  });

  it("desabilita botões quando isUpdating for true", () => {
    mockIsUpdating = true;
    render(<AppModeCard />);

    const essentialButton = screen.getByRole("button", { name: /Modo Essencial/i });
    expect(essentialButton).toBeDisabled();
  });
});
