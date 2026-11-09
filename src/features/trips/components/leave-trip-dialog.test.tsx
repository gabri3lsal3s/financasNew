import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeaveTripDialog } from "./leave-trip-dialog";
import type { Trip, TripMember, TripMemberBalance } from "@/types/trips";

const unlinkTripMemberMock = vi.fn();
let mockIsPending = false;

vi.mock("@/state/queries/use-trips", () => ({
  useUnlinkTripMemberMutation: () => ({
    mutateAsync: unlinkTripMemberMock,
    isPending: mockIsPending,
  }),
}));

const mockTrip: Trip = {
  id: "trip-ubatuba",
  title: "Fim de Semana Ubatuba",
  destination: "Ubatuba, SP",
  start_date: "2026-03-15",
  end_date: "2026-03-17",
  currency: "BRL",
  status: "active",
  public_token: "token-ubatuba-123",
  passcode_hash: null,
  cover_photo_url: null,
  host_user_id: "user-host-1",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

const mockMember: TripMember = {
  id: "member-mariana",
  trip_id: "trip-ubatuba",
  user_id: "user-mariana-123",
  name: "Mariana Costa",
  pix_key: "mariana@pix.com",
  pix_key_type: "email",
  is_host: false,
  joined_date: "2026-03-15",
  created_at: "2026-03-15T00:00:00Z",
};

describe("LeaveTripDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    unlinkTripMemberMock.mockResolvedValue({
      success: true,
      trip_id: "trip-ubatuba",
      member_id: "member-mariana",
      message: "Conta desvinculada",
    });
  });

  it("não renderiza nada se trip ou myMember forem null", () => {
    const { container } = render(
      <LeaveTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={null}
        myMember={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o modal informando que a conta será desvinculada", () => {
    render(
      <LeaveTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={mockTrip}
        myMember={mockMember}
      />
    );

    expect(screen.getByRole("heading", { name: /Sair da viagem\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza de que deseja sair de "Fim de Semana Ubatuba"\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair da Viagem/i })).toBeInTheDocument();
  });

  it("exibe aviso de saldo devedor quando o participante tem saldo negativo", () => {
    const debtorBalance: TripMemberBalance = {
      memberId: "member-mariana",
      name: "Mariana Costa",
      totalPaidCents: 5000,
      totalOwedCents: 15000,
      netBalanceCents: -10000,
    };

    render(
      <LeaveTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={mockTrip}
        myMember={mockMember}
        myBalance={debtorBalance}
      />
    );

    expect(screen.getByText(/Pendência financeira em aberto/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo devedor de/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 100,00/i)).toBeInTheDocument();
  });

  it("exibe aviso de saldo credor quando o participante tem saldo positivo", () => {
    const creditorBalance: TripMemberBalance = {
      memberId: "member-mariana",
      name: "Mariana Costa",
      totalPaidCents: 20000,
      totalOwedCents: 5000,
      netBalanceCents: 15000,
    };

    render(
      <LeaveTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={mockTrip}
        myMember={mockMember}
        myBalance={creditorBalance}
      />
    );

    expect(screen.getByText(/Saldo a receber pendente/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 150,00/i)).toBeInTheDocument();
  });

  it("chama unlinkMutation.mutateAsync com memberId e onSuccess ao confirmar", async () => {
    const onSuccessMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    render(
      <LeaveTripDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockTrip}
        myMember={mockMember}
        onSuccess={onSuccessMock}
      />
    );

    const leaveButton = screen.getByRole("button", { name: /Sair da Viagem/i });
    fireEvent.click(leaveButton);

    await waitFor(() => {
      expect(unlinkTripMemberMock).toHaveBeenCalledWith("member-mariana");
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  it("fecha o modal ao clicar em Cancelar sem disparar mutação", () => {
    const onOpenChangeMock = vi.fn();

    render(
      <LeaveTripDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockTrip}
        myMember={mockMember}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(unlinkTripMemberMock).not.toHaveBeenCalled();
  });
});
