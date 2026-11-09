import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TripExpenseDeleteDialog } from "./trip-expense-delete-dialog";
import type { TripExpense } from "@/types/trips";

const deleteTripExpenseMock = vi.fn();

let mockIsPending = false;

vi.mock("@/state/queries/use-trips", () => ({
  useDeleteTripExpenseMutation: () => ({
    mutateAsync: deleteTripExpenseMock,
    isPending: mockIsPending,
  }),
}));

const mockUnlinkedExpense: TripExpense = {
  id: "exp-unlinked",
  trip_id: "trip-1",
  paid_by_member_id: "m-1",
  amount_cents: 15000,
  description: "Combustível",
  category_name: "Transporte",
  expense_date: "2026-03-01",
  split_type: "equal",
  receipt_url: null,
  linked_personal_expense_id: null,
  created_by_member_id: "m-1",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

const mockLinkedExpense: TripExpense = {
  id: "exp-linked",
  trip_id: "trip-1",
  paid_by_member_id: "m-1",
  amount_cents: 28000,
  description: "Pousada Beira-Mar",
  category_name: "Hospedagem",
  expense_date: "2026-03-02",
  split_type: "equal",
  receipt_url: null,
  linked_personal_expense_id: "pers-exp-123",
  created_by_member_id: "m-1",
  created_at: "2026-03-02T00:00:00Z",
  updated_at: "2026-03-02T00:00:00Z",
};

describe("TripExpenseDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    deleteTripExpenseMock.mockResolvedValue({
      success: true,
      deleted_trip_expense_id: "exp-1",
      deleted_personal_expense: false,
    });
  });

  it("não renderiza nada se expense for null", () => {
    const { container } = render(
      <TripExpenseDeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        expense={null}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe("despesa não vinculada ao extrato pessoal", () => {
    it("renderiza confirmação padrão de exclusão da viagem", () => {
      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          tripId="trip-1"
          expense={mockUnlinkedExpense}
        />
      );

      expect(screen.getByText("Excluir despesa da viagem?")).toBeInTheDocument();
      expect(screen.getByText("Combustível")).toBeInTheDocument();
      expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
      expect(
        screen.queryByText("Excluir da viagem e do meu extrato pessoal")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Excluir apenas da viagem")
      ).not.toBeInTheDocument();
    });

    it("executa a exclusão com deletePersonal: false ao confirmar", async () => {
      const onOpenChange = vi.fn();
      const onSuccess = vi.fn();

      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          tripId="trip-1"
          expense={mockUnlinkedExpense}
          onSuccess={onSuccess}
        />
      );

      const confirmButton = screen.getByRole("button", { name: "Excluir" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteTripExpenseMock).toHaveBeenCalledWith({
          expenseId: "exp-unlinked",
          deletePersonal: false,
        });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });

    it("fecha o modal sem excluir ao clicar em Cancelar", () => {
      const onOpenChange = vi.fn();

      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          tripId="trip-1"
          expense={mockUnlinkedExpense}
        />
      );

      const cancelButton = screen.getByRole("button", { name: "Cancelar" });
      fireEvent.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(deleteTripExpenseMock).not.toHaveBeenCalled();
    });
  });

  describe("despesa vinculada ao extrato pessoal", () => {
    it("renderiza modal de decisão clara e badge de extrato pessoal", () => {
      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          tripId="trip-1"
          expense={mockLinkedExpense}
        />
      );

      expect(screen.getByText("Excluir despesa vinculada")).toBeInTheDocument();
      expect(screen.getByText("Pousada Beira-Mar")).toBeInTheDocument();
      expect(screen.getByText("R$ 280,00")).toBeInTheDocument();
      expect(screen.getByText("Extrato pessoal")).toBeInTheDocument();
      expect(screen.getByText("Como deseja excluir?")).toBeInTheDocument();

      // Opção A
      expect(
        screen.getByText("Excluir da viagem e do meu extrato pessoal")
      ).toBeInTheDocument();
      // Opção B
      expect(
        screen.getByText("Excluir apenas da viagem")
      ).toBeInTheDocument();
    });

    it("exclui da viagem e do extrato (deletePersonal: true) por padrão na Opção A", async () => {
      const onOpenChange = vi.fn();

      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          tripId="trip-1"
          expense={mockLinkedExpense}
        />
      );

      const confirmButton = screen.getByRole("button", { name: "Excluir" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteTripExpenseMock).toHaveBeenCalledWith({
          expenseId: "exp-linked",
          deletePersonal: true,
        });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("permite selecionar Opção B (apenas viagem) e envia deletePersonal: false", async () => {
      const onOpenChange = vi.fn();

      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          tripId="trip-1"
          expense={mockLinkedExpense}
        />
      );

      // Clica na opção "Excluir apenas da viagem"
      const optionB = screen.getByText("Excluir apenas da viagem");
      fireEvent.click(optionB);

      const confirmButton = screen.getByRole("button", { name: "Excluir" });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteTripExpenseMock).toHaveBeenCalledWith({
          expenseId: "exp-linked",
          deletePersonal: false,
        });
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("estado pendente (loading)", () => {
    it("desabilita botões e mostra texto 'Excluindo...' durante mutação", () => {
      mockIsPending = true;

      render(
        <TripExpenseDeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          tripId="trip-1"
          expense={mockUnlinkedExpense}
        />
      );

      const deleteBtn = screen.getByRole("button", { name: "Excluindo..." });
      const cancelBtn = screen.getByRole("button", { name: "Cancelar" });

      expect(deleteBtn).toBeDisabled();
      expect(cancelBtn).toBeDisabled();
    });
  });
});
