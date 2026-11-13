import { render as originalRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExpenseDetailDialog } from "./expense-detail-dialog";
import type { Expense } from "@/types";
import * as toastService from "@/services/toast";

const updateExpenseMock = vi.fn();
const deleteExpenseMock = vi.fn();
const createExpenseMock = vi.fn();
const navigateMock = vi.fn();
const deleteTripExpenseLinkedMock = vi.fn();
const updateTripExpenseLinkedMock = vi.fn();

let currentTestQueryClient: QueryClient;

const render = (ui: React.ReactElement, options?: Parameters<typeof originalRender>[1]) => {
  currentTestQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={currentTestQueryClient}>{children}</QueryClientProvider>
  );
  return originalRender(ui, { wrapper: Wrapper, ...options });
};

const tripDetailsMock = {
  trip: { id: "trip-123", title: "Viagem de Férias" },
  expenses: [
    {
      id: "trip-exp-1",
      trip_id: "trip-123",
      linked_personal_expense_id: "e1",
      amount_cents: 12050,
      description: "Despesa teste",
    },
  ],
};

vi.mock("@/state/queries/use-trips", () => ({
  useTripDetails: (tripId: string | null) => ({
    data: tripId === "trip-123" ? tripDetailsMock : null,
    isLoading: false,
  }),
  useDeleteTripExpenseLinkedMutation: () => ({
    mutateAsync: deleteTripExpenseLinkedMock,
    isPending: false,
  }),
  useUpdateTripExpenseLinkedMutation: () => ({
    mutateAsync: updateTripExpenseLinkedMock,
    isPending: false,
  }),
  TRIP_QUERY_KEYS: {
    all: ["trips"] as const,
    detail: (id: string) => ["trips", "detail", id],
  },
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Cartões variáveis por teste (para validar o caso sem cartão cadastrado).
const stateMocks = vi.hoisted(() => ({
  cards: [
    {
      id: "card1",
      name: "Nubank",
      brand: "Mastercard",
      credit_limit: 5000,
      color: "#8B5CF6",
      closing_day: 10,
      due_day: 15,
      is_active: true,
    },
  ] as unknown[],
  isReadOnly: false,
  isFamilyModeEnabled: true,
  myFamily: null as unknown,
}));

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: !stateMocks.isReadOnly,
    isReadOnly: stateMocks.isReadOnly,
    tier: stateMocks.isReadOnly ? "read_only" : "pro_annual",
  }),
  usePermission: () => ({
    canWrite: !stateMocks.isReadOnly,
    canRead: true,
    level: stateMocks.isReadOnly ? "read" : "write",
  }),
  useCategories: () => ({
    data: [
      { id: "cat1", name: "Alimentação", icon: "Utensils", color: "#EF4444" },
      { id: "cat2", name: "Transporte", icon: "Car", color: "#3B82F6" },
    ],
  }),
  useCreditCards: () => ({ data: stateMocks.cards }),
  useUpdateExpense: () => ({ mutateAsync: updateExpenseMock, isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: deleteExpenseMock, isPending: false }),
  useCreateExpense: () => ({ mutateAsync: createExpenseMock, isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFamilyMode: () => ({ isFamilyModeEnabled: stateMocks.isFamilyModeEnabled }),
  useMyFamily: () => ({ data: stateMocks.myFamily ?? null, isLoading: false }),
  useExpenses: () => ({ data: [], isLoading: false }),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useDebts: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/components/modules/split-expense-dialog", () => ({
  SplitExpenseDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="split-expense-dialog">Diálogo de Racha</div> : null,
}));

const baseExpense: Expense = {
  id: "e1",
  user_id: "u1",
  value: 120.5,
  date: "2026-08-04",
  category_id: "cat1",
  payment_method: "credit_card",
  card_id: "card1",
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: "2026-08",
  report_weight: 1,
  base_amount: 120.5,
  description: null,
  created_at: "2026-08-04T10:00:00Z",
};

describe("ExpenseDetailDialog", () => {
  it("repete o lançamento no mês atual com data ajustada (F21)", async () => {
    createExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog open={true} onOpenChange={vi.fn()} expense={baseExpense} />);

    await user.click(screen.getByRole("button", { name: /Repetir no mês atual/ }));

    expect(createExpenseMock).toHaveBeenCalledTimes(1);
    const input = createExpenseMock.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      value: 120.5,
      categoryId: "cat1",
      paymentMethod: "credit_card",
      cardId: "card1",
      description: null,
      reportWeight: 1,
    });
    // Data ajustada para hoje (não a original).
    expect(input.date).not.toBe("2026-08-04");
  });

  it("exibe o nome da categoria quando a despesa não tiver descrição", () => {
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    // Não deve conter "Despesa sem descrição" ou "Sem descrição"
    expect(screen.queryByText(/sem descrição/i)).not.toBeInTheDocument();
    // Deve exibir o nome da categoria "Alimentação" como título
    expect(screen.getAllByText("Alimentação").length).toBeGreaterThan(0);
  });

  it("oferece compartilhamento via Web Share (F22)", async () => {
    const user = userEvent.setup();
    render(<ExpenseDetailDialog open={true} onOpenChange={vi.fn()} expense={baseExpense} />);

    const shareButton = screen.getByRole("button", { name: /compartilhar/i });
    await user.click(shareButton);

    // Web Share/clipboard indisponíveis no jsdom — não deve lançar erro.
    expect(screen.getByRole("button", { name: /compartilhar/i })).toBeInTheDocument();
  });

  it("permite editar despesa e alterar a fatura (bill_competence) para transitar entre meses", async () => {
    updateExpenseMock.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByRole("heading", { name: "Editar despesa" })).toBeInTheDocument();
    const compInput = screen.getByLabelText("Competência da fatura");
    expect(compInput).toHaveValue("2026-08");

    // Altera a fatura para 2026-09
    await user.clear(compInput);
    await user.type(compInput, "2026-09");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    expect(updateExpenseMock).toHaveBeenCalledWith({
      id: "e1",
      input: expect.objectContaining({
        bill_competence: "2026-09",
      }),
    });
    // Edição otimista (F30): o cache atualiza em onMutate; o modal fecha após
    // a confirmação do servidor.
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("exclusão otimista (F30): confirma e fecha os diálogos na hora, disparando a mutação", async () => {
    deleteExpenseMock.mockResolvedValue(1);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

    expect(deleteExpenseMock).toHaveBeenCalledWith({ expenseId: "e1", mode: "single" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permite alterar o peso no relatório por preset dentro do modal de edição", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    // Abre o seletor de pesos (dentro do modal) e escolhe o preset 75%
    await user.click(screen.getByRole("combobox", { name: /Sua Participação \/ Rateio|Peso no relatório/i }));
    await user.click(screen.getByRole("option", { name: "75%" }));

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { report_weight: number } };
    expect(payload.input.report_weight).toBe(0.75);
  });

  it("mudar a data recalcula a competência pelo fechamento do cartão (sem override manual)", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    // Abre o DatePicker e escolhe o dia 15 (fechamento do cartão = dia 10 →
    // competência 2026-09). A competência NÃO foi editada manualmente.
    await user.click(screen.getByRole("button", { name: "Data da despesa" }));
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { bill_competence: string } };
    expect(payload.input.bill_competence).toBe("2026-09");
  });

  it("competência editada manualmente NÃO é sobrescrita ao mudar a data", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const compInput = screen.getByLabelText("Competência da fatura");
    await user.clear(compInput);
    await user.type(compInput, "2026-11");

    // Muda a data para o dia 15 — a competência manual deve ser preservada.
    await user.click(screen.getByRole("button", { name: "Data da despesa" }));
    const calendar = await screen.findByRole("grid");
    const day15 = within(calendar).getAllByRole("gridcell").find((cell) => cell.textContent?.trim() === "15");
    if (!day15) throw new Error("Dia 15 não encontrado no calendário");
    await user.click(within(day15).getByRole("button"));

    expect(compInput).toHaveValue("2026-11");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { bill_competence: string } };
    expect(payload.input.bill_competence).toBe("2026-11");
  });

  it("competência com formato inválido bloqueia o salvamento com mensagem clara", async () => {
    updateExpenseMock.mockClear();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const compInput = screen.getByLabelText("Competência da fatura");
    await user.clear(compInput);
    await user.type(compInput, "2026-8");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Competência da fatura inválida/)).toBeInTheDocument();
  });

  it("permite peso personalizado no relatório no modal de edição e persiste a fração resolvida", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    await user.click(screen.getByRole("combobox", { name: /Sua Participação \/ Rateio|Peso no relatório/i }));
    await user.click(screen.getByRole("option", { name: /personalizado/i }));

    // baseExpense.value = 120,50 → R$ 45,00 = 4500 centavos
    const customInput = screen.getByRole("textbox", { name: /Sua cota considerada no relatório|Valor considerado no relatório/i });
    await user.clear(customInput);
    await user.type(customInput, "4500");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { report_weight: number } };
    // fração resolvida: 4500 / 12050 = 0.3734 (4 casas, invariante do schema)
    expect(payload.input.report_weight).toBe(Number((4500 / 12050).toFixed(4)));
  });


  it("bloqueia despesa no crédito quando não há cartão cadastrado", async () => {
    updateExpenseMock.mockClear();
    stateMocks.cards = [];
    try {
      const user = userEvent.setup();
      render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: /editar/i }));
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      expect(updateExpenseMock).not.toHaveBeenCalled();
      expect(screen.getByText(/Nenhum cartão de crédito cadastrado/)).toBeInTheDocument();
    } finally {
      stateMocks.cards = [
        {
          id: "card1",
          name: "Nubank",
          brand: "Mastercard",
          credit_limit: 5000,
          color: "#8B5CF6",
          closing_day: 10,
          due_day: 15,
          is_active: true,
        },
      ];
    }
  });

  it("falha ao salvar mantém o modal aberto com o erro e os dados preservados", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockRejectedValue(new Error("Falha ao salvar"));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    // Erro visível e modal continua aberto — nada se perdeu.
    expect(await screen.findByText("Falha ao salvar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar despesa" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("intercepta o clique em Editar com UpgradeDialog quando a conta estiver em modo somente-leitura", async () => {
    stateMocks.isReadOnly = true;
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    // O modal de upgrade deve abrir
    expect(await screen.findByRole("dialog", { name: /Editar Despesa/i })).toBeInTheDocument();
    stateMocks.isReadOnly = false;
  });

  it("abre o diálogo de divisão de despesa (SplitExpenseDialog) ao clicar em Rachar Despesa", async () => {
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    const splitBtn = screen.getByRole("button", { name: /Rachar/i });
    expect(splitBtn).toBeInTheDocument();
    await user.click(splitBtn);

    expect(screen.getByTestId("split-expense-dialog")).toBeInTheDocument();
  });

  it("exibe badge 'Familiar' para despesa da casa e 'Individual' para despesa pessoal", () => {
    const { rerender } = render(
      <ExpenseDetailDialog expense={{ ...baseExpense, is_family: true }} open={true} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Familiar")).toBeInTheDocument();

    rerender(
      <ExpenseDetailDialog expense={{ ...baseExpense, is_family: false }} open={true} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Individual")).toBeInTheDocument();
  });

  it("permite alternar switch de despesa familiar na edição e envia is_family", async () => {
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();
    render(<ExpenseDetailDialog expense={{ ...baseExpense, is_family: false }} open={true} onOpenChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /editar/i }));

    const familySwitch = screen.getByRole("switch", { name: "Despesa da Casa / Familiar" });
    expect(familySwitch).toHaveAttribute("aria-checked", "false");
    await user.click(familySwitch);
    expect(familySwitch).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { is_family: boolean } };
    expect(payload.input.is_family).toBe(true);
  });

  it("oculta metadados e switch familiares quando modo familiar está desabilitado, preservando is_family na edição", async () => {
    stateMocks.isFamilyModeEnabled = false;
    updateExpenseMock.mockClear();
    updateExpenseMock.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ExpenseDetailDialog expense={{ ...baseExpense, is_family: true }} open={true} onOpenChange={vi.fn()} />);

    // Na visualização: não exibe a linha/badge de Orçamento Familiar
    expect(screen.queryByText("Orçamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Familiar")).not.toBeInTheDocument();

    // Na edição: não exibe o switch
    await user.click(screen.getByRole("button", { name: /editar/i }));
    expect(screen.queryByRole("switch", { name: "Despesa da Casa / Familiar" })).not.toBeInTheDocument();

    // Ao salvar: preserva o valor is_family: true original
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(updateExpenseMock).toHaveBeenCalledTimes(1);
    const payload = updateExpenseMock.mock.calls[0]?.[0] as { input: { is_family: boolean } };
    expect(payload.input.is_family).toBe(true);
  });

  it("exibe botão 'Na Viagem' e oculta 'Rachar' quando a despesa pertence a uma viagem", async () => {
    navigateMock.mockClear();
    const user = userEvent.setup();
    const tripExpense: Expense = {
      ...baseExpense,
      trip_id: "trip-123",
    };

    render(<ExpenseDetailDialog expense={tripExpense} open={true} onOpenChange={vi.fn()} />);

    // Deve exibir o badge de Modo Viagem
    expect(screen.getByText("Modo Viagem")).toBeInTheDocument();

    // Deve exibir o botão 'Na Viagem'
    const tripButton = screen.getByRole("button", { name: /na viagem/i });
    expect(tripButton).toBeInTheDocument();

    // NÃO deve exibir o botão 'Rachar'
    expect(screen.queryByRole("button", { name: /rachar/i })).not.toBeInTheDocument();

    // Ao clicar em 'Na Viagem', navega para a página da viagem
    await user.click(tripButton);
    expect(navigateMock).toHaveBeenCalledWith("/viagens/trip-123");
  });

  it("exibe botão 'Rachar' e oculta 'Na Viagem' quando a despesa não pertence a uma viagem", () => {
    render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /rachar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /na viagem/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Modo Viagem")).not.toBeInTheDocument();
  });

  describe("Exclusão Coordenada a partir do Extrato (Modo Viagem)", () => {
    const tripExpense: Expense = {
      ...baseExpense,
      trip_id: "trip-123",
    };

    it("alerta sobre vínculo com Modo Viagem e exibe opções de exclusão no ConfirmDialog", async () => {
      const user = userEvent.setup();
      render(<ExpenseDetailDialog expense={tripExpense} open={true} onOpenChange={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Excluir" }));

      // Título e alerta do ConfirmDialog
      expect(screen.getByText("Excluir despesa vinculada?")).toBeInTheDocument();
      expect(screen.getByText(/Esta despesa está vinculada ao Modo Viagem \(Viagem de Férias\)/)).toBeInTheDocument();

      // Opções no RadioGroup
      expect(screen.getByText("Excluir do extrato e da viagem")).toBeInTheDocument();
      expect(screen.getByText("Excluir apenas do extrato pessoal")).toBeInTheDocument();
    });

    it("exclui coordenadamente do extrato e da viagem com a opção padrão 'both'", async () => {
      deleteTripExpenseLinkedMock.mockClear();
      deleteTripExpenseLinkedMock.mockResolvedValueOnce({
        success: true,
        deleted_trip_expense_id: "trip-exp-1",
        deleted_personal_expense: true,
      });
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      render(<ExpenseDetailDialog expense={tripExpense} open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole("button", { name: "Excluir" }));
      await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

      expect(deleteTripExpenseLinkedMock).toHaveBeenCalledTimes(1);
      expect(deleteTripExpenseLinkedMock).toHaveBeenCalledWith({
        personalExpenseId: "e1",
        deletePersonal: true,
      });
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa excluída do extrato e da viagem",
          variant: "success",
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("exclui apenas do extrato pessoal e invalida a query da viagem ao selecionar 'personal_only'", async () => {
      deleteTripExpenseLinkedMock.mockClear();
      deleteExpenseMock.mockClear();
      deleteExpenseMock.mockResolvedValueOnce(1);
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      render(<ExpenseDetailDialog expense={tripExpense} open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole("button", { name: "Excluir" }));

      // Seleciona a opção de excluir apenas do extrato pessoal
      await user.click(screen.getByText("Excluir apenas do extrato pessoal"));

      // Confirma exclusão
      await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

      // Não deve chamar a exclusão da viagem
      expect(deleteTripExpenseLinkedMock).not.toHaveBeenCalled();

      // Deve chamar a exclusão comum de despesa do extrato
      expect(deleteExpenseMock).toHaveBeenCalledTimes(1);
      expect(deleteExpenseMock).toHaveBeenCalledWith({
        expenseId: "e1",
        mode: "single",
      });

      // Feedback específico de manutenção na viagem
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa excluída do extrato pessoal",
          description: "O lançamento foi mantido na viagem.",
          variant: "success",
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("aciona fallback para exclusão pessoal se a despesa de viagem já tiver sido removida", async () => {
      deleteTripExpenseLinkedMock.mockClear();
      deleteExpenseMock.mockClear();
      deleteTripExpenseLinkedMock.mockResolvedValueOnce(null);
      deleteExpenseMock.mockResolvedValueOnce(1);
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      render(<ExpenseDetailDialog expense={tripExpense} open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole("button", { name: "Excluir" }));
      await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

      expect(deleteTripExpenseLinkedMock).toHaveBeenCalledTimes(1);
      expect(deleteExpenseMock).toHaveBeenCalledWith({
        expenseId: "e1",
        mode: "single",
      });
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa excluída do extrato e da viagem",
          variant: "success",
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("ao editar despesa vinculada à viagem, exibe aviso e sincroniza com a viagem via useUpdateTripExpenseLinkedMutation", async () => {
      updateExpenseMock.mockClear();
      updateTripExpenseLinkedMock.mockClear();
      updateExpenseMock.mockResolvedValueOnce({});
      updateTripExpenseLinkedMock.mockResolvedValueOnce({ id: "trip-exp-1" });
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      const tripExpenseWithDesc: Expense = {
        ...tripExpense,
        description: "Despesa teste",
      };

      render(
        <ExpenseDetailDialog
          expense={tripExpenseWithDesc}
          open={true}
          onOpenChange={onOpenChange}
          initialEditing={true}
        />
      );

      // Deve exibir o aviso de despesa vinculada à viagem
      expect(
        screen.getByText(
          "Vinculada ao Modo Viagem. As alterações de valor, descrição e data serão sincronizadas automaticamente com os participantes da viagem."
        )
      ).toBeInTheDocument();

      // Altera a descrição da despesa
      const descInput = screen.getByDisplayValue("Despesa teste");
      await user.clear(descInput);
      await user.type(descInput, "Almoço da Galera");

      // Clica em Salvar alterações
      await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

      await waitFor(() => {
        expect(updateExpenseMock).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "e1",
            input: expect.objectContaining({
              description: "Almoço da Galera",
              value: 120.5,
              date: "2026-08-04",
            }),
          })
        );
      });

      expect(updateTripExpenseLinkedMock).toHaveBeenCalledWith({
        personalExpenseId: "e1",
        value: 120.5,
        description: "Almoço da Galera",
        date: "2026-08-04",
        categoryName: "Alimentação",
      });

      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa atualizada no extrato e na viagem",
          description: "Os valores e a divisão na viagem foram sincronizados.",
          variant: "success",
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("exibe Toast com ação Desfazer ao excluir despesa simples e restaura ao clicar (R32)", async () => {
      deleteExpenseMock.mockClear();
      createExpenseMock.mockClear();
      deleteExpenseMock.mockResolvedValueOnce(1);
      createExpenseMock.mockResolvedValueOnce({ id: "e-restaurada" });
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      render(<ExpenseDetailDialog expense={baseExpense} open={true} onOpenChange={onOpenChange} />);

      await user.click(screen.getByRole("button", { name: "Excluir" }));
      await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

      expect(deleteExpenseMock).toHaveBeenCalledTimes(1);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa excluída",
          action: expect.objectContaining({
            label: "Desfazer",
          }),
        })
      );

      // Simula clique na ação Desfazer do toast
      const toastCall = toastSpy.mock.calls.find((call) => call[0]?.title === "Despesa excluída");
      const undoAction = toastCall?.[0]?.action;
      expect(undoAction).toBeDefined();
      undoAction?.onClick();

      expect(createExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: baseExpense.value,
          date: baseExpense.date,
          categoryId: baseExpense.category_id,
        })
      );
    });

    it("alerta sobre despesa e racha vinculado ao tentar excluir despesa com report_weight < 1", async () => {
      deleteExpenseMock.mockClear();
      deleteExpenseMock.mockResolvedValueOnce(1);
      const toastSpy = vi.spyOn(toastService, "pushToast");
      const onOpenChange = vi.fn();
      const user = userEvent.setup();

      const rachaExpense: Expense = {
        ...baseExpense,
        id: "e-racha-1",
        description: "Pizza de Sexta",
        report_weight: 0.5,
      };

      render(<ExpenseDetailDialog expense={rachaExpense} open={true} onOpenChange={onOpenChange} />);

      // Abre confirmação de exclusão
      await user.click(screen.getByRole("button", { name: "Excluir" }));

      // Título explícito de exclusão de despesa e racha vinculado
      expect(screen.getByText("Excluir despesa e racha vinculado?")).toBeInTheDocument();
      expect(
        screen.getByText(/Esta despesa originou um racha compartilhado com amigos/i),
      ).toBeInTheDocument();

      // Confirma exclusão
      await user.click(screen.getAllByRole("button", { name: "Excluir" }).at(-1)!);

      expect(deleteExpenseMock).toHaveBeenCalledWith({ expenseId: "e-racha-1", mode: "single" });
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Despesa e racha vinculado excluídos",
        }),
      );
    });
  });
});
