import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CashGapAlert } from "./cash-gap-alert";
import type { CashGapAnalysisResult } from "@/domain/projection";

const navigateMock = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("CashGapAlert (§F51)", () => {
  const mockResult: CashGapAnalysisResult = {
    isCashGapDetected: true,
    severity: "warning",
    gapDate: "2026-09-05",
    daysUntilGap: 4,
    maxDeficitCents: 150000,
    nextInflowDate: "2026-09-15",
    causingObligations: [],
    recommendationMessage: "Risco de saldo insuficiente a partir de 05/09 antes do recebimento de 15/09.",
    runway: [],
  };

  it("renderiza o alerta quando houver descasamento de caixa detectado", () => {
    render(<CashGapAlert result={mockResult} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Radar de Descasamento de Fluxo")).toBeInTheDocument();
    expect(screen.getByText(/05\/09/)).toBeInTheDocument();
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it("navega para /dividas ao clicar no botão de ação", () => {
    render(<CashGapAlert result={mockResult} />);

    const button = screen.getByRole("button", { name: /Ver Contas e Vencimentos/i });
    fireEvent.click(button);

    expect(navigateMock).toHaveBeenCalledWith("/dividas");
  });

  it("não renderiza nada quando isCashGapDetected é false", () => {
    const { container } = render(
      <CashGapAlert
        result={{
          ...mockResult,
          isCashGapDetected: false,
          severity: "none",
        }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
