import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReopenTripDialog } from "./reopen-trip-dialog";
import type { Trip } from "@/types/trips";

const updateTripMock = vi.fn();
let mockIsPending = false;

vi.mock("@/state/queries/use-trips", () => ({
  useUpdateTripMutation: () => ({
    mutateAsync: updateTripMock,
    isPending: mockIsPending,
  }),
}));

const mockCompletedTrip: Trip = {
  id: "trip-ubatuba",
  host_user_id: "user-host-1",
  title: "Fim de Semana Ubatuba",
  destination: "Ubatuba, SP",
  start_date: "2026-03-15",
  end_date: "2026-03-17",
  status: "completed",
  currency: "BRL",
  public_token: "token-ubatuba-123",
  passcode_hash: null,
  cover_photo_url: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("ReopenTripDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    updateTripMock.mockResolvedValue({
      ...mockCompletedTrip,
      status: "active",
    });
  });

  it("não renderiza nada se trip for null", () => {
    const { container } = render(
      <ReopenTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o modal com informações da viagem", () => {
    render(
      <ReopenTripDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={mockCompletedTrip}
      />
    );

    expect(screen.getByRole("heading", { name: /Reabrir viagem\?/i })).toBeInTheDocument();
    expect(screen.getByText(/A viagem "Fim de Semana Ubatuba" voltará para o status Ativa/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reabrir Viagem/i })).toBeInTheDocument();
  });

  it("chama updateTripMutation.mutateAsync com status active ao confirmar", async () => {
    const onSuccessMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    render(
      <ReopenTripDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockCompletedTrip}
        onSuccess={onSuccessMock}
      />
    );

    const reopenButton = screen.getByRole("button", { name: /Reabrir Viagem/i });
    fireEvent.click(reopenButton);

    await waitFor(() => {
      expect(updateTripMock).toHaveBeenCalledWith({
        tripId: "trip-ubatuba",
        input: { status: "active" },
      });
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  it("fecha o modal ao clicar em Cancelar sem disparar mutação", () => {
    const onOpenChangeMock = vi.fn();

    render(
      <ReopenTripDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockCompletedTrip}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(updateTripMock).not.toHaveBeenCalled();
  });
});
