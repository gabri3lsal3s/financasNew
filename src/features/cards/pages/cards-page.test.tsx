import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardsPage } from "./cards-page";
import { shiftMonth } from "@/domain/cards";

const searchParamsMock = vi.fn(() => [new URLSearchParams(), vi.fn()]);

vi.mock("react-router", () => ({
  useSearchParams: () => searchParamsMock(),
  useNavigate: () => vi.fn(),
}));

const paymentMock = vi.fn();
const refundMock = vi.fn();
const createCardMock = vi.fn();
const updateCardMock = vi.fn();
const deleteCardMock = vi.fn();
const deleteCardPaymentMock = vi.fn();

const defaultCard = {
  id: "c1",
  name: "Nubank",
  brand: "Mastercard",
  credit_limit: 5000,
  color: "#8B5CF6",
  closing_day: 10,
  due_day: 15,
  is_active: true,
};

interface MockExpense {
  id: string;
  description: string;
  date: string;
  value: number;
  report_weight: number;
  bill_competence: string;
  installments_total: number;
  installment_number: number;
  card_id?: string | null;
  payment_method?: string | null;
}

const defaultExpense: MockExpense = {
  id: "e1",
  description: "Supermercado",
  date: "2026-08-05",
  value: 150,
  report_weight: 1,
  bill_competence: "2026-08",
  installments_total: 1,
  installment_number: 1,
  card_id: "c1",
  payment_method: "credit_card",
};

const defaultPayment = {
  id: "p1",
  competence_month: "2026-08",
  amount: 100,
  date: "2026-08-10",
  note: null,
};

// Despesas da fatura variáveis por teste (para validar a separação parceladas × à vista).
const stateMocks = vi.hoisted(() => ({
  cards: [
    {
      id: "c1",
      name: "Nubank",
      brand: "Mastercard",
      credit_limit: 5000,
      color: "#8B5CF6",
      closing_day: 10,
      due_day: 15,
      is_active: true,
    },
  ],
  expenses: [
    {
      id: "e1",
      description: "Supermercado",
      date: "2026-08-05",
      value: 150,
      report_weight: 1,
      bill_competence: "2026-08",
      installments_total: 1,
      installment_number: 1,
      card_id: "c1",
      payment_method: "credit_card",
    },
  ] as MockExpense[],
  payments: [
    { id: "p1", competence_month: "2026-08", amount: 100, date: "2026-08-10", note: null },
  ],
}));

beforeEach(() => {
  paymentMock.mockClear();
  refundMock.mockClear();
  createCardMock.mockClear();
  updateCardMock.mockClear();
  deleteCardMock.mockClear();
  deleteCardPaymentMock.mockClear();
  stateMocks.cards = [{ ...defaultCard }];
  stateMocks.expenses = [{ ...defaultExpense }];
  stateMocks.payments = [{ ...defaultPayment }];
});

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
  useCategories: () => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreditCards: () => ({
    data: stateMocks.cards,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCardExpenses: () => ({
    data: stateMocks.expenses,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCardPayments: () => ({
    data: stateMocks.payments,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useAllCardExpenses: () => ({
    data: stateMocks.expenses,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAllCardPayments: () => ({
    data: stateMocks.payments,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateCardPayment: () => ({ mutateAsync: paymentMock, isPending: false }),
  useCreateRefund: () => ({ mutateAsync: refundMock, isPending: false }),
  useCreateCard: () => ({ mutateAsync: createCardMock, isPending: false }),
  useUpdateCard: () => ({ mutateAsync: updateCardMock, isPending: false }),
  useDeleteCard: () => ({ mutateAsync: deleteCardMock, isPending: false }),
  useDeleteCardPayment: () => ({ mutateAsync: deleteCardPaymentMock, isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("CardsPage — Gestão completa, Wallet 3D e faturas (§3.3.3)", () => {
  it("exibe a carteira de cartões com todas as métricas embutidas no cartão 3D", () => {
    render(<CardsPage />);
    expect(screen.getByText("Sua Carteira")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fatura Total (Bruto)").length).toBeGreaterThan(0);
    expect(screen.getByText(/Melhor dia:/i)).toBeInTheDocument();
    expect(screen.getByText(/Fech\.:/i)).toBeInTheDocument();
    expect(screen.getByText(/Venc\.:/i)).toBeInTheDocument();
  });

  it("exibe KPIs da fatura (fatura total bruto, pago, saldo aberto)", () => {
    render(<CardsPage />);
    expect(screen.getAllByText("Fatura Total (Bruto)").length).toBeGreaterThan(0);
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Saldo aberto (Bruto)")).toBeInTheDocument();
    // Previsto R$ 150,00 · Pago R$ 100,00 · Saldo R$ 50,00
    expect(screen.getAllByText("R$ 150,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 50,00").length).toBeGreaterThan(0);
  });

  it("lista despesas da competência e pagamentos com botão de exclusão", () => {
    render(<CardsPage />);
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("Pagamento de fatura")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /excluir pagamento/i })).toBeInTheDocument();
  });

  it("permite excluir pagamento com diálogo de confirmação", async () => {
    deleteCardPaymentMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CardsPage />);

    const deletePayBtn = screen.getByRole("button", { name: /excluir pagamento/i });
    await user.click(deletePayBtn);

    expect(screen.getByRole("heading", { name: "Excluir pagamento de fatura" })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Excluir" });
    await user.click(confirmBtn);

    expect(deleteCardPaymentMock).toHaveBeenCalledWith("p1");
  });

  it("permite abrir diálogo de edição do cartão", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);

    const cardBtn = screen.getByRole("button", { name: /^cartão nubank/i });
    await user.click(cardBtn);

    expect(screen.getByRole("heading", { name: "Editar cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Nubank");
  });

  it("permite excluir o cartão através do modal de edição", async () => {
    deleteCardMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CardsPage />);

    const cardBtn = screen.getByRole("button", { name: /^cartão nubank/i });
    await user.click(cardBtn);

    expect(screen.getByRole("heading", { name: "Editar cartão" })).toBeInTheDocument();
    const deleteBtn = screen.getByRole("button", { name: "Excluir" });
    await user.click(deleteBtn);

    expect(screen.getByRole("heading", { name: "Excluir cartão" })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Excluir cartão" });
    await user.click(confirmBtn);

    expect(deleteCardMock).toHaveBeenCalledWith("c1");
  });

  it("registra pagamento via diálogo carregando automaticamente o saldo em aberto", async () => {
    paymentMock.mockResolvedValue("p1");
    const user = userEvent.setup();
    render(<CardsPage />);

    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    // Pré-popular o input com o valor integral pendente por padrão (R$ 50,00)
    expect(input).toHaveValue("R$\u00a050,00");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    expect(paymentMock).toHaveBeenCalledTimes(1);
    const params = paymentMock.mock.calls[0]?.[0];
    expect(params.cardId).toBe("c1");
    expect(params.competenceMonth).toBe("2026-08");
    expect(params.amount).toBe(50);
  });

  it("permite alterar o valor pre-preenchido para pagamento parcial", async () => {
    paymentMock.mockResolvedValue("p2");
    const user = userEvent.setup();
    render(<CardsPage />);

    await user.click(screen.getByRole("button", { name: "Registrar pagamento" }));
    const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
    expect(input).toHaveValue("R$\u00a050,00");
    await user.clear(input);
    await user.type(input, "2500");
    await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

    expect(paymentMock).toHaveBeenCalled();
    const params = paymentMock.mock.calls[0]?.[0];
    expect(params.amount).toBe(25);
  });

  it("trata fatura quitada exibindo aviso e valor inicial zerado", async () => {
    // Quando a fatura estiver quitada (gastos 100, pagamentos 100 -> saldo 0)
    stateMocks.expenses = [
      {
        id: "e1",
        description: "Supermercado",
        date: "2026-08-05",
        value: 100,
        report_weight: 1,
        bill_competence: "2026-08",
        installments_total: 1,
        installment_number: 1,
      },
    ];
    try {
      render(<CardsPage />);

      await userEvent.click(screen.getByRole("button", { name: "Registrar pagamento" }));
      expect(screen.getByText("Esta fatura não possui saldo pendente no momento ou já foi quitada.")).toBeInTheDocument();
      const input = screen.getByRole("textbox", { name: "Valor do pagamento" });
      expect(input).toHaveValue("R$\u00a00,00");
      expect(screen.getByRole("button", { name: "Confirmar pagamento" })).toBeDisabled();
    } finally {
      stateMocks.expenses = [
        {
          id: "e1",
          description: "Supermercado",
          date: "2026-08-05",
          value: 150,
          report_weight: 1,
          bill_competence: "2026-08",
          installments_total: 1,
          installment_number: 1,
        },
      ];
    }
  });

  it("registra estorno via diálogo (gera renda automática)", async () => {
    refundMock.mockResolvedValue("r1");
    const user = userEvent.setup();
    render(<CardsPage />);

    await user.click(screen.getByRole("button", { name: "Estorno" }));
    const input = screen.getByRole("textbox", { name: "Valor do estorno" });
    await user.type(input, "2000");
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(refundMock.mock.calls[0]?.[0]?.amount).toBe(20);
  });

  it("abre o formulário de novo cartão", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);
    await user.click(screen.getByRole("button", { name: /adicionar novo cartão/i }));
    expect(screen.getByRole("heading", { name: "Novo cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });

  it("abre o diálogo de detalhes da despesa ao clicar na linha da fatura", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);
    await user.click(screen.getByText("Supermercado"));
    expect(screen.getByRole("heading", { name: "Detalhes da despesa" })).toBeInTheDocument();
  });

  it("separa a fatura: parceladas no topo e à vista abaixo, ordenadas por data", () => {
    stateMocks.expenses = [
      ...stateMocks.expenses,
      // Parcelada herdada (data do mês anterior à competência) e parcelada recente.
      { id: "e2", description: "Celular 10x", date: "2026-07-20", value: 300, report_weight: 1, bill_competence: "2026-08", installments_total: 10, installment_number: 2 },
      { id: "e3", description: "Notebook 3x", date: "2026-08-12", value: 1200, report_weight: 1, bill_competence: "2026-08", installments_total: 3, installment_number: 1 },
    ];
    try {
      render(<CardsPage />);

      // Os dois grupos aparecem com os títulos.
      expect(screen.getByText("Parceladas")).toBeInTheDocument();
      expect(screen.getByText("À vista")).toBeInTheDocument();
      expect(screen.getByText("Celular 10x")).toBeInTheDocument();
      expect(screen.getByText("Notebook 3x")).toBeInTheDocument();

      // Parceladas exibem a parcela atual como subtítulo (2/10, 1/3).
      expect(screen.getByText(/2\/10/)).toBeInTheDocument();
      expect(screen.getByText(/1\/3/)).toBeInTheDocument();

      // Parceladas vêm ANTES das à vista no DOM (grupo superior).
      const parceladasTitle = screen.getByText("Parceladas");
      const avistaTitle = screen.getByText("À vista");
      expect(parceladasTitle.compareDocumentPosition(avistaTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      stateMocks.expenses = stateMocks.expenses.filter((e) => e.id === "e1");
    }
  });

  it("abre o formulário de criação via deep link direto (?novo=cartao)", () => {
    searchParamsMock.mockReturnValue([new URLSearchParams("novo=cartao"), vi.fn()]);
    render(<CardsPage />);
    expect(screen.getByRole("heading", { name: "Novo cartão" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    searchParamsMock.mockReturnValue([new URLSearchParams(), vi.fn()]);
  });

  it("exibe estado vazio harmonizado para compras parceladas quando só houver compras à vista", () => {
    // stateMocks.expenses contém apenas 'Supermercado' à vista (installments_total: 1)
    render(<CardsPage />);
    expect(screen.getByText("Nenhuma compra parcelada nesta fatura.")).toBeInTheDocument();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
  });

  it("exibe estado vazio harmonizado para compras à vista quando só houver compras parceladas", () => {
    stateMocks.expenses = [
      {
        id: "e2",
        description: "Celular 10x",
        date: "2026-08-01",
        value: 300,
        report_weight: 1,
        bill_competence: "2026-08",
        installments_total: 10,
        installment_number: 1,
      },
    ];
    render(<CardsPage />);
    expect(screen.getByText("Nenhuma compra à vista nesta fatura.")).toBeInTheDocument();
    expect(screen.getByText("Celular 10x")).toBeInTheDocument();
  });

  it("exibe estado vazio harmonizado quando a fatura não possuir despesas", () => {
    stateMocks.expenses = [];
    render(<CardsPage />);
    expect(screen.getByText("Sem despesas nesta fatura")).toBeInTheDocument();
  });

  it("exibe estado vazio harmonizado quando não houver pagamentos ou estornos na fatura", () => {
    stateMocks.payments = [];
    render(<CardsPage />);
    expect(screen.getByText("Nenhum pagamento")).toBeInTheDocument();
  });

  it("exibe estado vazio harmonizado quando não houver nenhum cartão cadastrado", () => {
    stateMocks.cards = [];
    render(<CardsPage />);
    expect(screen.getByText("Nenhum cartão cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /adicionar primeiro cartão/i })).toBeInTheDocument();
  });

  it("exibe limite disponível recalculado dinamicamente na barra de status da fatura", () => {
    // defaultCard.credit_limit = 5000 (R$ 5.000,00)
    // defaultExpense = 150 (R$ 150,00)
    // defaultPayment = 100 (R$ 100,00)
    // saldo aberto = R$ 50,00 -> Limite disponível = R$ 4.950,00
    render(<CardsPage />);
    expect(screen.getByText("Limite disponível:")).toBeInTheDocument();
    expect(screen.getByText(/4\.950,00/)).toBeInTheDocument();
  });

  it("renderiza badge padronizado para compras parceladas", () => {
    stateMocks.expenses = [
      {
        id: "e2",
        description: "Notebook 10x",
        date: "2026-08-01",
        value: 300,
        report_weight: 1,
        bill_competence: "2026-08",
        installments_total: 10,
        installment_number: 2,
      },
    ];
    render(<CardsPage />);
    expect(screen.getByText("Notebook 10x")).toBeInTheDocument();
    expect(screen.getByText("2/10")).toBeInTheDocument();
  });

  it("garante o valor bruto nominal (100%) como métrica primária e exibe a ponderada como consulta analítica", () => {
    // Despesa compartilhada: R$ 200,00 nominal com peso 50% (R$ 100,00 ponderado)
    stateMocks.expenses = [
      {
        id: "e-split",
        description: "Restaurante Compartilhado",
        date: "2026-08-05",
        value: 200,
        report_weight: 0.5,
        bill_competence: "2026-08",
        installments_total: 1,
        installment_number: 1,
      },
    ];
    stateMocks.payments = [];

    render(<CardsPage />);

    // Métrica primária destacada (Fatura Total Bruto): R$ 200,00
    expect(screen.getAllByText("Fatura Total (Bruto)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 200,00").length).toBeGreaterThan(0);

    // Métrica analítica secundária: "Ponderada: R$ 100,00" e "Ponderado: R$ 100,00"
    expect(screen.getByText("Ponderada:")).toBeInTheDocument();
    expect(screen.getByText("Ponderado:")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThan(0);

    // Saldo aberto a pagar no banco: R$ 200,00 (100% nominal do boleto)
    expect(screen.getByText("Saldo aberto (Bruto)")).toBeInTheDocument();
  });

  it("permite alternar rapidamente entre faturas usando os pills de competência", async () => {
    const user = userEvent.setup();
    render(<CardsPage />);

    const anteriorBtn = screen.getByRole("button", { name: /^anterior/i });
    const atualBtn = screen.getByRole("button", { name: /^atual/i });
    const proximaBtn = screen.getByRole("button", { name: /^próxima/i });

    expect(anteriorBtn).toBeInTheDocument();
    expect(atualBtn).toBeInTheDocument();
    expect(proximaBtn).toBeInTheDocument();

    await user.click(proximaBtn);
    expect(proximaBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(anteriorBtn);
    expect(anteriorBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(atualBtn);
    expect(atualBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("exibe bloco informativo do impacto de assinaturas previstas antes do fechamento da fatura em aberto (F22 / Tarefa 7.6)", () => {
    // Configura despesas históricas no cartão c1 (Nubank, closing_day = 10, due_day = 15)
    // formando uma assinatura recorrente prevista antes do fechamento
    const todayStr = new Date().toISOString().slice(0, 10);
    const currM = todayStr.slice(0, 7);
    const mPrev1 = shiftMonth(currM, -1);
    const mPrev2 = shiftMonth(currM, -2);

    stateMocks.cards = [{ ...defaultCard, closing_day: 28, due_day: 5, credit_limit: 5000 }];
    stateMocks.expenses = [
      {
        id: "e-sub-1",
        description: "Netflix",
        date: `${mPrev2}-10`,
        value: 39.9,
        report_weight: 1,
        bill_competence: mPrev2,
        installments_total: 1,
        installment_number: 1,
        card_id: "c1",
        payment_method: "credit_card",
      },
      {
        id: "e-sub-2",
        description: "Netflix",
        date: `${mPrev1}-10`,
        value: 39.9,
        report_weight: 1,
        bill_competence: mPrev1,
        installments_total: 1,
        installment_number: 1,
        card_id: "c1",
        payment_method: "credit_card",
      },
    ];

    render(<CardsPage />);

    // Bloco do Radar de Assinaturas deve estar visível com a mensagem canônica
    expect(screen.getByText(/Radar de Assinaturas/i)).toBeInTheDocument();
    expect(screen.getByText(/Você possui/i)).toBeInTheDocument();
    expect(screen.getByText(/em assinaturas previstas para este cartão antes do fechamento da fatura/i)).toBeInTheDocument();
  });

  it("exibe alerta preventivo quando o total de assinaturas projetadas supera o limite disponível restante (F22 / Tarefa 7.6)", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const currM = todayStr.slice(0, 7);
    const mPrev1 = shiftMonth(currM, -1);
    const mPrev2 = shiftMonth(currM, -2);

    // Limite muito baixo (R$ 20,00) para uma assinatura de R$ 39,90
    stateMocks.cards = [{ ...defaultCard, closing_day: 28, due_day: 5, credit_limit: 20 }];
    stateMocks.expenses = [
      {
        id: "e-sub-1",
        description: "Netflix",
        date: `${mPrev2}-10`,
        value: 39.9,
        report_weight: 1,
        bill_competence: mPrev2,
        installments_total: 1,
        installment_number: 1,
        card_id: "c1",
        payment_method: "credit_card",
      },
      {
        id: "e-sub-2",
        description: "Netflix",
        date: `${mPrev1}-10`,
        value: 39.9,
        report_weight: 1,
        bill_competence: mPrev1,
        installments_total: 1,
        installment_number: 1,
        card_id: "c1",
        payment_method: "credit_card",
      },
    ];

    render(<CardsPage />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Alerta de Limite Comprometido")).toBeInTheDocument();
    expect(screen.getByText(/supera o limite disponível/i)).toBeInTheDocument();
  });
});

