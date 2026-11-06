import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HouseholdAlertBanner } from "./household-alert-banner";

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("HouseholdAlertBanner", () => {
  it("renderiza modo teto estourado com valores e navegação para /familia", () => {
    render(
      <HouseholdAlertBanner
        variant="ceiling_exceeded"
        totalSpentCents={550000}
        ceilingCents={500000}
        spentPercentage={110}
        daysRemaining={12}
      />,
    );

    expect(screen.getByText("Teto Familiar Estourado")).toBeInTheDocument();
    expect(screen.getByText("110% do teto")).toBeInTheDocument();
    expect(screen.getByText(/A casa gastou/i)).toBeInTheDocument();
    expect(screen.getByText(/restam 12 dias/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /ver família/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/familia");
  });

  it("renderiza modo acerto Pix pendente quando usuário é recebedor", () => {
    render(
      <HouseholdAlertBanner
        variant="settlement_pending"
        settlementAmountCents={35000}
        settlementPayerName="Mariana"
        isCurrentUserReceiver={true}
      />,
    );

    expect(screen.getByText("Acerto Familiar Pendente")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText(/Você tem/i)).toBeInTheDocument();
    expect(screen.getByText(/a receber de Mariana/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /fazer acerto/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/familia");
  });

  it("renderiza modo acerto Pix pendente quando usuário é pagador", () => {
    render(
      <HouseholdAlertBanner
        variant="settlement_pending"
        settlementAmountCents={42000}
        settlementReceiverName="Gabriel"
        isCurrentUserPayer={true}
      />,
    );

    expect(screen.getByText("Acerto Familiar Pendente")).toBeInTheDocument();
    expect(screen.getByText(/Você deve compensar/i)).toBeInTheDocument();
    expect(screen.getByText(/para Gabriel/i)).toBeInTheDocument();
  });
});
