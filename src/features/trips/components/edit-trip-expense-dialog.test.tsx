import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EditTripExpenseDialog } from "./edit-trip-expense-dialog";
import type { TripMember, TripExpense } from "@/types/trips";

const updateTripExpenseMock = vi.fn();
const updateExpenseRepoMock = vi.fn();
const getExpenseMock = vi.fn();
const listCreditCardsMock = vi.fn();

vi.mock("@/state/queries/use-trips", () => ({
  useUpdateTripExpenseMutation: () => ({
    mutateAsync: updateTripExpenseMock,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/data/repositories/expenses", () => ({
  updateExpense: (...args: unknown[]) => updateExpenseRepoMock(...args),
  getExpense: (...args: unknown[]) => getExpenseMock(...args),
}));

vi.mock("@/data/repositories/credit-cards", () => ({
  listCreditCards: (...args: unknown[]) => listCreditCardsMock(...args),
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
  amount_cents: 20000, // R$ 200,00
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

describe("EditTripExpenseDialog — sincronização de peso no extrato pessoal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateExpenseRepoMock.mockResolvedValue({});
    updateTripExpenseMock.mockResolvedValue({});
    getExpenseMock.mockResolvedValue(null);
    listCreditCardsMock.mockResolvedValue([]);
  });

  it("renderiza os campos com os dados existentes da despesa", () => {
    render(
      <EditTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        expense={mockExpense}
        members={mockMembers}
      />,
    );

    expect(screen.getByDisplayValue("Jantar na Praia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("Editar Despesa da Viagem")).toBeInTheDocument();
  });

  it("ao salvar edição, atualiza a despesa pessoal vinculada com o novo report_weight sincronizado", async () => {
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

    // Submete o formulário
    const form = document.getElementById("edit-trip-expense-form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(updateExpenseRepoMock).toHaveBeenCalledWith(
        "pers-exp-99",
        expect.objectContaining({
          value: 200,
          description: "Jantar Especial na Praia",
          date: "2026-02-05",
          report_weight: 0.5, // 10000 / 20000 = 0.5
        }),
      );
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

  it("ao alterar a data de despesa vinculada paga no cartão de crédito, recalcula bill_competence pelo fechamento do cartão", async () => {
    const user = userEvent.setup();
    getExpenseMock.mockResolvedValueOnce({
      id: "pers-exp-99",
      payment_method: "credit_card",
      card_id: "card-visa",
      bill_competence: "2026-02",
    });
    listCreditCardsMock.mockResolvedValueOnce([
      { id: "card-visa", closing_day: 10 },
    ]);

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

    // Abre o calendário clicando no botão da data atual ("05/02/2026")
    const dateButton = screen.getByRole("button", { name: "05/02/2026" });
    await user.click(dateButton);

    // Seleciona o dia 15 no calendário (após dia 10 de fechamento -> fatura 2026-03)
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar)
      .getAllByRole("gridcell")
      .find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    const form = document.getElementById("edit-trip-expense-form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(updateExpenseRepoMock).toHaveBeenCalledWith(
        "pers-exp-99",
        expect.objectContaining({
          value: 200,
          date: "2026-02-15",
          bill_competence: "2026-03",
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
