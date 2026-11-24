import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BillRolloverDialog } from "./bill-rollover-dialog";

const mutateAsyncMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-encargos", name: "Tarifas e Encargos", type: "expense", is_reserved: true },
      { id: "cat-outros", name: "Outros", type: "expense", is_reserved: false },
    ],
    isLoading: false,
  }),
  useRolloverCardBill: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("BillRolloverDialog", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ rollover_id: "r1" });
  });

  it("renderiza saldo a transferir e permite confirmar rolagem sem encargos (R$ 0,00)", async () => {
    const onOpenChange = vi.fn();
    render(
      <BillRolloverDialog
        cardId="card-1"
        cardName="Nubank"
        competenceMonth="2026-10"
        openBalanceCents={45000}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText("Rolar saldo para a próxima fatura")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*450,00/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar rolagem" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: "card-1",
        fromCompetenceMonth: "2026-10",
        toCompetenceMonth: "2026-11",
        principalAmount: 450,
        charges: [],
        note: null,
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
