import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditTripExpenseDialog } from "./edit-trip-expense-dialog";
import type { Category } from "@/types";
import type { TripExpense, TripMember } from "@/types/trips";

const updateTripExpenseMock = vi.fn();
const syncLinkedPersonalExpenseMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Alimentação", type: "expense" },
      { id: "cat-2", name: "Passeios Náuticos", type: "expense" },
    ],
  }),
  useSyncLinkedPersonalExpenseMutation: () => ({
    mutateAsync: syncLinkedPersonalExpenseMock,
    isPending: false,
  }),
}));

vi.mock("@/state/queries/use-trips", () => ({
  useUpdateTripExpenseMutation: () => ({
    mutateAsync: updateTripExpenseMock,
    isPending: false,
  }),
}));

vi.mock("@/features/budgets/components", () => ({
  CategoryFormDialog: ({
    open,
    onOpenChange,
    onSuccess,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (category: Category) => void;
  }) => {
    if (!open) return null;
    return (
      <div data-testid="mock-edit-category-form-dialog">
        <button
          type="button"
          onClick={() => {
            onSuccess?.({
              id: "cat-new",
              user_id: "user-123",
              name: "Mergulho",
              icon: "waves",
              color: "#0284C7",
              type: "expense",
              is_reserved: false,
              is_active: true,
            });
            onOpenChange(false);
          }}
        >
          Criar Categoria Edição
        </button>
      </div>
    );
  },
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

const mockMembers: TripMember[] = [
  {
    id: "m-1",
    trip_id: "trip-1",
    user_id: "user-123",
    name: "Gabriel",
    is_host: true,
    pix_key: null,
    pix_key_type: null,
    joined_date: "2026-02-01",
    created_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "m-2",
    trip_id: "trip-1",
    user_id: "user-456",
    name: "Mariana",
    is_host: false,
    pix_key: null,
    pix_key_type: null,
    joined_date: "2026-02-01",
    created_at: "2026-02-01T00:00:00Z",
  },
];

const mockExpense: TripExpense = {
  id: "exp-1",
  trip_id: "trip-1",
  paid_by_member_id: "m-1",
  amount_cents: 20000,
  description: "Jantar na Praia",
  category_name: "Alimentação",
  expense_date: "2026-02-05",
  split_type: "equal",
  receipt_url: null,
  linked_personal_expense_id: "pers-exp-99",
  created_by_member_id: "m-1",
  created_at: "2026-02-05T00:00:00Z",
  updated_at: "2026-02-05T00:00:00Z",
  splits: [
    { id: "s-1", expense_id: "exp-1", member_id: "m-1", share_cents: 10000 },
    { id: "s-2", expense_id: "exp-1", member_id: "m-2", share_cents: 10000 },
  ],
};

describe("EditTripExpenseDialog — sincronização de peso no extrato pessoal e categorias personalizadas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncLinkedPersonalExpenseMock.mockResolvedValue({});
    updateTripExpenseMock.mockResolvedValue({});
  });

  it("renderiza os campos com os dados existentes da despesa e preserva categorias personalizadas", () => {
    render(
      <EditTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        expense={{ ...mockExpense, category_name: "Categoria Customizada do Grupo" }}
        members={mockMembers}
      />,
    );

    expect(screen.getByDisplayValue("Jantar na Praia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("Editar Despesa da Viagem")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Categoria da despesa" })).toHaveTextContent(
      "Categoria Customizada do Grupo",
    );
  });

  it("ao salvar edição, sincroniza a despesa pessoal vinculada via mutation de @/state", async () => {
    const onOpenChange = vi.fn();
    render(
      <EditTripExpenseDialog
        open={true}
        onOpenChange={onOpenChange}
        tripId="trip-1"
        expense={mockExpense}
        members={mockMembers}
      />,
    );

    const descInput = screen.getByPlaceholderText("Ex.: Almoço no centro, Uber, Combustível");
    fireEvent.change(descInput, { target: { value: "Jantar Especial na Praia" } });

    const form = document.getElementById("edit-trip-expense-form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(syncLinkedPersonalExpenseMock).toHaveBeenCalledWith({
        personalExpenseId: "pers-exp-99",
        amountCents: 20000,
        description: "Jantar Especial na Praia",
        expenseDate: "2026-02-05",
        reportWeight: 0.5,
        tripId: "trip-1",
      });
    });

    expect(updateTripExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expense_id: "exp-1",
        description: "Jantar Especial na Praia",
        amount_cents: 20000,
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ao alterar a data de despesa vinculada, envia nova expenseDate para a mutation de sincronização", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <EditTripExpenseDialog
        open={true}
        onOpenChange={onOpenChange}
        tripId="trip-1"
        expense={mockExpense}
        members={mockMembers}
      />,
    );

    const dateButton = screen.getByRole("button", { name: /Data do Gasto/i });
    await user.click(dateButton);

    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar)
      .getAllByRole("gridcell")
      .find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    const form = document.getElementById("edit-trip-expense-form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(syncLinkedPersonalExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          personalExpenseId: "pers-exp-99",
          expenseDate: "2026-02-15",
          tripId: "trip-1",
        }),
      );
    });

    expect(updateTripExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expense_id: "exp-1",
        expense_date: "2026-02-15",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
