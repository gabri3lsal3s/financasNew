import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TripDeleteDialog } from "./trip-delete-dialog";
import type { Trip } from "@/types/trips";

const deleteTripMock = vi.fn();
let mockIsPending = false;

vi.mock("@/state/queries/use-trips", () => ({
  useDeleteTripMutation: () => ({
    mutateAsync: deleteTripMock,
    isPending: mockIsPending,
  }),
}));

const mockTrip: Trip = {
  id: "trip-ubatuba",
  host_user_id: "user-host-1",
  title: "Fim de Semana Ubatuba",
  destination: "Ubatuba, SP",
  start_date: "2026-03-15",
  end_date: "2026-03-17",
  status: "active",
  currency: "BRL",
  public_token: "token-ubatuba-123",
  passcode_hash: null,
  cover_photo_url: null,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("TripDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    deleteTripMock.mockResolvedValue(true);
  });

  it("não renderiza nada se trip for null", () => {
    const { container } = render(
      <TripDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={null}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza o modal com título e descrição da viagem quando aberto", () => {
    render(
      <TripDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        trip={mockTrip}
      />
    );

    expect(screen.getByRole("heading", { name: /Excluir viagem\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza de que deseja excluir "Fim de Semana Ubatuba"\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir Viagem/i })).toBeInTheDocument();
  });

  it("chama deleteTripMutation.mutateAsync e onSuccess ao confirmar exclusão", async () => {
    const onSuccessMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    render(
      <TripDeleteDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockTrip}
        onSuccess={onSuccessMock}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /Excluir Viagem/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteTripMock).toHaveBeenCalledWith("trip-ubatuba");
      expect(onOpenChangeMock).toHaveBeenCalledWith(false);
      expect(onSuccessMock).toHaveBeenCalled();
    });
  });

  it("fecha o modal ao clicar em Cancelar", () => {
    const onOpenChangeMock = vi.fn();

    render(
      <TripDeleteDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        trip={mockTrip}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(deleteTripMock).not.toHaveBeenCalled();
  });
});
