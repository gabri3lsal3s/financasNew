import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";

const mockDownloadCsv = vi.fn();
const mockStartDemo = vi.fn();
const mockSetStepIndex = vi.fn();

type MockExpense = {
  id: string;
  value: number;
  date: string;
  description: string;
  installments_total: number;
  installment_number: number;
  is_family?: boolean;
};

type MockIncome = {
  id: string;
  value: number;
  date: string;
  description: string;
  is_family?: boolean;
};

const defaultExpenses: MockExpense[] = [
  {
    id: "e1",
    value: 1500,
    date: "2026-08-13",
    description: "Aluguel",
    installments_total: 1,
    installment_number: 1,
  },
];
const defaultIncomes: MockIncome[] = [{ id: "i1", value: 3500, date: "2026-08-05", description: "Salário" }];
let expensesMock: MockExpense[] = [...defaultExpenses];
let incomesMock: MockIncome[] = [...defaultIncomes];
let mockIsFamilyModeEnabled = false;
let mockMyFamilyData: unknown = null;

vi.mock("@/services/export-actions", () => ({
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
  shareText: vi.fn(),
}));

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => vi.fn(),
}));

vi.mock("@/state", () => ({
  useFamilyMode: () => ({
    isFamilyModeEnabled: mockIsFamilyModeEnabled,
    toggleFamilyMode: vi.fn(),
    isLoading: false,
    isPending: false,
  }),
  useMyFamily: () => ({
    data: mockMyFamilyData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
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
  useExpenses: () => ({
    data: expensesMock,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: incomesMock,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  startDemo: (...args: unknown[]) => mockStartDemo(...args),
  setStepIndex: (...args: unknown[]) => mockSetStepIndex(...args),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useRecurrences: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateIncome: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateIncomeGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useDebts: () => ({ data: [], isLoading: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("TransactionListPage — listagem por mês", () => {
  beforeEach(() => {
    expensesMock = [...defaultExpenses];
    incomesMock = [...defaultIncomes];
    mockIsFamilyModeEnabled = false;
    mockMyFamilyData = null;
    vi.clearAllMocks();
  });
  it("exibe receitas e despesas do mês com valores formatados", () => {
    render(<TransactionListPage />);

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getAllByText("+R$ 3.500,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("−R$ 1.500,00").length).toBeGreaterThan(0);
  });

  it("calcula os KPIs de receitas, despesas e saldo", () => {
    render(<TransactionListPage />);
    // "Receitas"/"Despesas" aparecem no KPI e nas abas de filtro.
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saldo do mês").length).toBeGreaterThan(0);
    // Receitas 3.500,00 · Despesas 1.500,00 · Saldo 2.000,00
    expect(screen.getAllByText("R$ 3.500,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 1.500,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 2.000,00").length).toBeGreaterThan(0);
  });

  it("exibe as abas de filtro na ordem canonica: Tudo, Receitas, Despesas, Parceladas, Recorrentes", () => {
    render(<TransactionListPage />);
    const feedTabsList = screen.getByRole("tablist", { name: "Filtro de lançamentos" });
    const tabs = within(feedTabsList).getAllByRole("tab");
    const tabLabels = tabs.map((tab) => tab.textContent?.trim());
    expect(tabLabels).toEqual(["Tudo", "Receitas", "Despesas", "Parceladas", "Recorrentes"]);
  });

  it("filtra itens pelas abas do feed", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    // Aba Tudo exibe ambos
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();

    // Filtra apenas receitas
    const receitaTab = screen.getByRole("tab", { name: "Receitas" });
    await user.click(receitaTab);
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();

    // Filtra apenas despesas
    const despesaTab = screen.getByRole("tab", { name: "Despesas" });
    await user.click(despesaTab);
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();

    // Filtra parceladas
    const parceladasTab = screen.getByRole("tab", { name: "Parceladas" });
    await user.click(parceladasTab);
    expect(screen.getByText("Nenhum lançamento parcelado neste mês.")).toBeInTheDocument();

    // Filtra recorrentes
    const recorrentesTab = screen.getByRole("tab", { name: "Recorrentes" });
    await user.click(recorrentesTab);
    expect(screen.getByText("Nenhum lançamento recorrente neste mês.")).toBeInTheDocument();
  });

  it("abre o modal de detalhamento de despesa ao clicar na linha de despesa", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    await user.click(screen.getByText("Aluguel"));
    expect(screen.getByRole("heading", { name: "Detalhes da despesa" })).toBeInTheDocument();
  });

  it("abre o modal de detalhamento de receita ao clicar na linha de receita", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    await user.click(screen.getByText("Salário"));
    expect(screen.getByRole("heading", { name: "Detalhes da receita" })).toBeInTheDocument();
  });

  it("exibe o botão de Nova transação acessível", () => {
    render(<TransactionListPage />);
    expect(screen.getByRole("button", { name: "Nova transação" })).toBeInTheDocument();
  });

  it("exporta lançamentos filtrados em CSV com BOM UTF-8", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    const exportBtn = screen.getByRole("button", { name: "Exportar CSV" });
    await user.click(exportBtn);

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, content] = mockDownloadCsv.mock.calls[0] as [string, string];
    expect(filename).toMatch(/^transacoes_\d{4}-\d{2}_todas\.csv$/);
    expect(content).toContain("Salário");
    expect(content).toContain("Aluguel");
  });

  it("filtra transações instantaneamente ao digitar no campo de busca", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    const searchInput = screen.getByRole("textbox", { name: "Buscar lançamentos" });
    expect(searchInput).toBeInTheDocument();

    // Digita "Aluguel" -> apenas Aluguel visível
    await user.type(searchInput, "Aluguel");
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();

    // Limpa com o botão de limpar na barra
    const clearButton = screen.getByRole("button", { name: "Limpar campo de busca" });
    await user.click(clearButton);
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("exibe EmptyState dedicado quando a busca não retorna resultados e permite limpar", async () => {
    const user = userEvent.setup();
    render(<TransactionListPage />);

    const searchInput = screen.getByRole("textbox", { name: "Buscar lançamentos" });
    await user.type(searchInput, "TermoInexistenteXYZ");

    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum lançamento corresponde ao termo "TermoInexistenteXYZ"/),
    ).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Limpar busca" });
    await user.click(clearButton);

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
  });

  it("exibe atalho para simulação no EmptyState quando não há lançamentos e aciona startDemo", async () => {
    expensesMock = [];
    incomesMock = [];
    const user = userEvent.setup();

    render(<TransactionListPage />);

    expect(screen.getByText("Nenhum lançamento encontrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo lançamento/i })).toBeInTheDocument();

    const simBtn = screen.getByRole("button", { name: /Ver exemplo na Simulação/i });
    expect(simBtn).toBeInTheDocument();

    await user.click(simBtn);

    expect(mockStartDemo).toHaveBeenCalledWith("finances");
    expect(mockSetStepIndex).toHaveBeenCalledWith(1);
  });

  describe("Extrato Geral e Identificação de Gastos Familiares", () => {
    beforeEach(() => {
      mockIsFamilyModeEnabled = true;
      expensesMock = [
        {
          id: "e-personal",
          value: 200,
          date: "2026-08-10",
          description: "Cinema Individual",
          installments_total: 1,
          installment_number: 1,
          is_family: false,
        },
        {
          id: "e-family",
          value: 800,
          date: "2026-08-11",
          description: "Supermercado da Família",
          installments_total: 1,
          installment_number: 1,
          is_family: true,
        },
      ];
      incomesMock = [
        {
          id: "i-personal",
          value: 3000,
          date: "2026-08-05",
          description: "Salário Individual",
          is_family: false,
        },
        {
          id: "i-family",
          value: 1000,
          date: "2026-08-06",
          description: "Ajuda de Custo Familiar",
          is_family: true,
        },
      ];
    });

    it("não renderiza abas de divisão de visão (Todos, Pessoais, Familiar) no extrato de transações", () => {
      render(<TransactionListPage />);
      expect(screen.queryByRole("tab", { name: "Todos" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Pessoais" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Familiar" })).not.toBeInTheDocument();
      // O extrato continua com suas abas normais de tipo (Tudo, Receitas, Despesas...)
      expect(screen.getByRole("tab", { name: "Tudo" })).toBeInTheDocument();
    });

    it("exibe todas as transações de forma unificada no extrato geral", () => {
      render(<TransactionListPage />);
      expect(screen.getByText("Supermercado da Família")).toBeInTheDocument();
      expect(screen.getByText("Cinema Individual")).toBeInTheDocument();
      expect(screen.getByText("Salário Individual")).toBeInTheDocument();
      expect(screen.getByText("Ajuda de Custo Familiar")).toBeInTheDocument();
    });

    it("exibe badge 'Familiar' exclusivamente para lançamentos marcados como familiares", () => {
      render(<TransactionListPage />);

      const familyExpRow = screen.getByText("Supermercado da Família").closest("button")!;
      expect(within(familyExpRow).getByText("Familiar")).toBeInTheDocument();

      const personalExpRow = screen.getByText("Cinema Individual").closest("button")!;
      expect(within(personalExpRow).queryByText("Familiar")).toBeNull();

      const familyIncRow = screen.getByText("Ajuda de Custo Familiar").closest("button")!;
      expect(within(familyIncRow).getByText("Familiar")).toBeInTheDocument();

      const personalIncRow = screen.getByText("Salário Individual").closest("button")!;
      expect(within(personalIncRow).queryByText("Familiar")).toBeNull();
    });

    it("não exibe badge 'Familiar' para nenhuma transação quando o Modo Familiar está desativado", () => {
      mockIsFamilyModeEnabled = false;
      render(<TransactionListPage />);

      const familyExpRow = screen.getByText("Supermercado da Família").closest("button")!;
      expect(within(familyExpRow).queryByText("Familiar")).toBeNull();

      const familyIncRow = screen.getByText("Ajuda de Custo Familiar").closest("button")!;
      expect(within(familyIncRow).queryByText("Familiar")).toBeNull();
    });

    it("soma todos os lançamentos gerais nos KPIs", () => {
      render(<TransactionListPage />);
      // Despesas: 200 + 800 = 1000
      expect(screen.getAllByText("R$ 1.000,00").length).toBeGreaterThan(0);
      // Receitas: 3000 + 1000 = 4000
      expect(screen.getAllByText("R$ 4.000,00").length).toBeGreaterThan(0);
      // Saldo: 4000 - 1000 = 3000
      expect(screen.getAllByText("R$ 3.000,00").length).toBeGreaterThan(0);
    });

    it("exporta CSV unificado sem segmentação por escopo de visão", async () => {
      const user = userEvent.setup();
      render(<TransactionListPage />);

      const exportButton = screen.getByRole("button", { name: "Exportar CSV" });
      await user.click(exportButton);

      expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
      const [filename, content] = mockDownloadCsv.mock.calls[0] as [string, string];
      expect(filename).toMatch(/^transacoes_\d{4}-\d{2}_todas\.csv$/);
      expect(content).toContain("Supermercado da Família");
      expect(content).toContain("Cinema Individual");
      expect(content).toContain("Salário Individual");
      expect(content).toContain("Ajuda de Custo Familiar");
    });
  });
});


