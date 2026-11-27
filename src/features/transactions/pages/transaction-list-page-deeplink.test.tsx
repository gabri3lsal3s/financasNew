import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionListPage } from "./transaction-list-page";

let params: URLSearchParams;
let setParamsSpy = vi.fn();
let requestedMonths: string[] = [];
const defaultExpensesMock = [
  {
    id: "e1",
    value: 250,
    date: "2026-01-15",
    description: "Mercado antigo",
    installments_total: 1,
    installment_number: 1,
    category_id: "c1",
    payment_method: "pix",
  },
];
let expensesMock = defaultExpensesMock;

vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useSearchParams: () => [params, setParamsSpy],
  useNavigate: () => vi.fn(),
}));

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
}));
vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
}));

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
  useCategories: () => ({ data: [], isLoading: false, error: null }),
  useExpenses: (month: string) => {
    requestedMonths.push(month);
    return {
      data: expensesMock,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useIncomes: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
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
  useFamilyMode: () => ({ isFamilyModeEnabled: false, setFamilyModeEnabled: vi.fn(), isLoading: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useMyPublicShares: () => ({ data: [], isLoading: false }),
  useUpdatePublicShare: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDebts: () => ({ data: [], isLoading: false }),
  useBusinessMode: () => ({ isBusinessModeEnabled: false, businessProfile: null, toggleBusinessMode: vi.fn(), updateBusinessProfile: vi.fn(), isLoading: false, isPending: false }),
  useViewScope: () => ({ viewScope: "all" as const, effectiveViewScope: "all" as const, setViewScope: vi.fn(), isBusinessModeEnabled: false }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpensesByInstallmentGroup: () => ({ data: undefined, isLoading: false }),
  useApplySplitSettlement: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateLinkedSplit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSplitComprehensive: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteLinkedSplit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSyncSplitFromExpenseEdit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDismissSplitPaymentSignal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpense: () => ({ data: null, isLoading: false, isFetched: true }),
}));

describe("TransactionListPage — deep-link da busca global (§3.9)", () => {
  it("inicializa o mês por ?month= e destaca o registro de ?q=", () => {
    params = new URLSearchParams("month=2026-01&q=e1");
    requestedMonths = [];
    render(<TransactionListPage />);

    // A query do mês foi usada (não o mês corrente).
    expect(requestedMonths).toContain("2026-01");
    expect(screen.getByText("Mercado antigo")).toBeInTheDocument();
    // Destaque aplicado na linha do registro (anel primary com cor de destaque do usuário).
    expect(screen.getByText("Mercado antigo").closest(".ring-primary")).not.toBeNull();
  });

  it("sem parâmetro usa o mês corrente (sem destaque)", () => {
    params = new URLSearchParams("");
    requestedMonths = [];
    render(<TransactionListPage />);

    expect(requestedMonths[0]).toMatch(/^\d{4}-\d{2}$/);
    expect(screen.getByText("Mercado antigo").closest(".ring-primary")).toBeNull();
  });

  it("seleciona a aba de Receitas quando ?tipo=receitas ou ?filter=incomes", () => {
    params = new URLSearchParams("tipo=receitas");
    render(<TransactionListPage />);

    const receitasTab = screen.getByRole("tab", { name: "Receitas" });
    expect(receitasTab).toHaveAttribute("aria-selected", "true");
  });

  it("seleciona a aba de Despesas quando ?tipo=despesas ou ?filter=expenses", () => {
    expensesMock = defaultExpensesMock;
    params = new URLSearchParams("tipo=despesas");
    render(<TransactionListPage />);

    const despesasTab = screen.getByRole("tab", { name: "Despesas" });
    expect(despesasTab).toHaveAttribute("aria-selected", "true");
  });

  it("filtra exatamente pelos IDs em ?ids=..., exibe badge de revisão e limpa ?ids ao clicar Limpar revisão", () => {
    params = new URLSearchParams("mes=2026-01&ids=e1,e2");
    setParamsSpy = vi.fn((updater: unknown) => {
      if (typeof updater === "function") {
        params = (updater as (prev: URLSearchParams) => URLSearchParams)(params);
      }
    });
    requestedMonths = [];
    expensesMock = [
      ...defaultExpensesMock,
      {
        id: "e2",
        value: 80,
        date: "2026-01-16",
        description: "Padaria sem categoria",
        installments_total: 1,
        installment_number: 1,
        category_id: "",
        payment_method: "pix",
      },
      {
        id: "e3",
        value: 150,
        date: "2026-01-17",
        description: "Despesa já classificada",
        installments_total: 1,
        installment_number: 1,
        category_id: "c1",
        payment_method: "pix",
      },
    ];

    const { rerender } = render(<TransactionListPage />);

    expect(requestedMonths).toContain("2026-01");
    expect(screen.getByText("Mercado antigo")).toBeInTheDocument();
    expect(screen.getByText("Padaria sem categoria")).toBeInTheDocument();
    expect(screen.queryByText("Despesa já classificada")).not.toBeInTheDocument();
    expect(screen.getByText("2 em revisão")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar revisão" }));
    expect(setParamsSpy).toHaveBeenCalled();
    expect(params.has("ids")).toBe(false);
    expect(params.get("mes")).toBe("2026-01");

    rerender(<TransactionListPage />);
    expect(screen.getByText("Despesa já classificada")).toBeInTheDocument();
  });
});
