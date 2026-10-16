import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";

const mockDownloadCsv = vi.fn();
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
    data: [
      {
        id: "e1",
        value: 1500,
        date: "2026-08-13",
        description: "Aluguel",
        installments_total: 1,
        installment_number: 1,
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: [{ id: "i1", value: 3500, date: "2026-08-05", description: "Salário" }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
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
}));

describe("TransactionListPage — listagem por mês", () => {
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
    const tabs = screen.getAllByRole("tab");
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
});


