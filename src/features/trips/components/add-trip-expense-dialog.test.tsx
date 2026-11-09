import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddTripExpenseDialog } from "./add-trip-expense-dialog";
import type { Category } from "@/types";
import type { TripMember } from "@/types/trips";

const createExpenseMock = vi.fn();
const addTripExpenseMock = vi.fn();
const updateCustomSettingsMock = vi.fn().mockResolvedValue({});
let mockPreferredTripCategoryId: string | undefined = undefined;

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-123" } },
  }),
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Alimentação", type: "expense" },
      { id: "cat-2", name: "Restaurantes", type: "expense" },
      { id: "cat-3", name: "Salário", type: "income" },
      { id: "cat-4", name: "Churrascos e Eventos", type: "expense" },
    ],
  }),
  useCreditCards: () => ({
    data: [
      { id: "card-1", name: "Nubank", brand: "Mastercard", closing_day: 10 },
      { id: "card-2", name: "Itaú", brand: "Visa", closing_day: 25 },
    ],
  }),
  useCreateExpense: () => ({
    mutateAsync: createExpenseMock,
    isPending: false,
  }),
  useUserPreferences: () => ({
    data: {
      custom_settings: {
        preferredTripCategoryId: mockPreferredTripCategoryId,
      },
    },
    isLoading: false,
  }),
  useUpdateCustomSettings: () => ({
    mutateAsync: updateCustomSettingsMock,
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
      <div data-testid="mock-category-form-dialog">
        <button
          type="button"
          onClick={() => {
            onSuccess?.({
              id: "cat-custom",
              user_id: "user-123",
              name: "Praia e Passeios",
              icon: "sol",
              color: "#3B82F6",
              type: "expense",
              is_reserved: false,
              is_active: true,
            });
            onOpenChange(false);
          }}
        >
          Confirmar Criar Categoria Mock
        </button>
      </div>
    );
  },
}));

vi.mock("@/state/queries/use-trips", () => ({
  useAddTripExpenseMutation: () => ({
    mutateAsync: addTripExpenseMock,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/data/repositories/expenses", () => ({
  updateExpense: vi.fn().mockResolvedValue({}),
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
    user_id: null,
    name: "Ítalo",
    is_host: false,
    pix_key: null,
    pix_key_type: null,
    joined_date: "2026-02-01",
    created_at: "2026-02-01T00:00:00Z",
  },
];

describe("AddTripExpenseDialog — integração com extrato pessoal e parcelamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferredTripCategoryId = undefined;
    createExpenseMock.mockResolvedValue("expense-123");
    addTripExpenseMock.mockResolvedValue({});
  });

  it("renderiza o modal e exibe o switch de lançar no extrato para o usuário autenticado", () => {
    render(
      <AddTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        members={mockMembers}
      />
    );

    expect(screen.getByText("Adicionar Despesa da Viagem")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Lançar no meu extrato bancário" })).toBeInTheDocument();
  });

  it("permite escolher categoria pessoal, cartão e parcelas e envia credit_card para o banco", async () => {
    const user = userEvent.setup();

    render(
      <AddTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        members={mockMembers}
      />
    );

    // Preenche descrição
    const descInput = screen.getByPlaceholderText(/Ex.: Almoço no centro/i);
    await user.type(descInput, "Jantar comemorativo");

    // Preenche valor: R$ 300,00
    const moneyInput = screen.getByPlaceholderText("R$ 0,00");
    await user.type(moneyInput, "30000");

    // Ativa o switch de lançar no extrato
    const syncSwitch = screen.getByRole("switch", { name: "Lançar no meu extrato bancário" });
    await user.click(syncSwitch);
    expect(syncSwitch).toHaveAttribute("aria-checked", "true");

    // Deve exibir o seletor de categorias do aplicativo
    expect(screen.getByText("Categoria no seu extrato pessoal")).toBeInTheDocument();

    // Seleciona forma de pagamento: Cartão de Crédito
    const allCombos = screen.getAllByRole("combobox");
    const formaPagamentoCombo = allCombos[3] || allCombos[2];
    await user.click(formaPagamentoCombo!);
    const creditCardOption = await screen.findByRole("option", { name: "Cartão de Crédito" });
    await user.click(creditCardOption);

    // Deve exibir Cartão de Crédito e Quantidade de Parcelas
    expect(screen.getAllByText("Cartão de Crédito").length).toBeGreaterThan(0);
    expect(screen.getByText("Quantidade de Parcelas")).toBeInTheDocument();

    // Seleciona 3 parcelas
    const updatedCombos = screen.getAllByRole("combobox");
    const installmentsSelect = updatedCombos[updatedCombos.length - 1]; // Parcelas
    await user.click(installmentsSelect!);
    const threeXOption = await screen.findByRole("option", { name: /3x de/i });
    await user.click(threeXOption);

    // Submete o formulário
    const form = document.getElementById("add-trip-expense-form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      // Verifica que a despesa pessoal foi criada com credit_card (e NÃO 'credit')
      expect(createExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 300,
          paymentMethod: "credit_card",
          cardId: "card-1",
          description: "Jantar comemorativo",
          installments: expect.arrayContaining([
            expect.objectContaining({ value: 100 }),
            expect.objectContaining({ value: 100 }),
            expect.objectContaining({ value: 100 }),
          ]),
        })
      );
    });

    // Verifica que gravou a categoria nas preferências do usuário para aprendizado automático
    expect(updateCustomSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredTripCategoryId: expect.any(String),
      })
    );

    // Verifica que a despesa na viagem foi registrada com o valor integral (R$ 300)
    await waitFor(() => {
      expect(addTripExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount_cents: 30000,
          description: "Jantar comemorativo",
          linked_personal_expense_id: "expense-123",
        })
      );
    });
  });

  it("pré-seleciona a categoria preferida a partir de user_preferences.custom_settings.preferredTripCategoryId", () => {
    mockPreferredTripCategoryId = "cat-2"; // Restaurantes

    render(
      <AddTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        members={mockMembers}
      />
    );

    // O combobox de Categoria da viagem deve estar preenchido com Restaurantes
    const comboboxes = screen.getAllByRole("combobox");
    const categoryCombo = comboboxes[0];
    expect(categoryCombo).toHaveTextContent("Restaurantes");
  });

  it("permite abrir o diálogo inline de criação de categoria e atualiza a seleção para a nova categoria", async () => {
    const user = userEvent.setup();

    render(
      <AddTripExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        members={mockMembers}
      />
    );

    // Clica no botão inline 'Nova Categoria'
    const newCategoryButtons = screen.getAllByRole("button", { name: /nova categoria/i });
    expect(newCategoryButtons.length).toBeGreaterThan(0);
    await user.click(newCategoryButtons[0]!);

    // O modal mock de criação de categoria deve estar visível
    expect(screen.getByTestId("mock-category-form-dialog")).toBeInTheDocument();

    // Clica no botão para confirmar a criação da categoria
    const confirmBtn = screen.getByRole("button", {
      name: "Confirmar Criar Categoria Mock",
      hidden: true,
    });
    fireEvent.click(confirmBtn);

    // O modal deve ser fechado
    expect(screen.queryByTestId("mock-category-form-dialog")).not.toBeInTheDocument();

    // A categoria selecionada no combobox da viagem agora é a criada
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toHaveTextContent("Praia e Passeios");
  });
});
