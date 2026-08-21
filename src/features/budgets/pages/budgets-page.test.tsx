import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetsPage } from "./budgets-page";

const setBudgetLimitMock = vi.fn();
const removeBudgetLimitMock = vi.fn();
const setIncomeGoalMock = vi.fn();
const reallocateMock = vi.fn();

const baseCategories = [
  { id: "c1", name: "Moradia", icon: "moradia", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
  { id: "i1", name: "Salário", icon: "salario", color: null, type: "income" },
];

vi.mock("@/state", () => ({
  useBudgets: () => ({
    data: [
      { category_id: "c1", month: "2026-08", limit: 1000 },
      { category_id: "c2", month: "2026-08", limit: 1000 },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomeGoals: () => ({
    data: [{ category_id: "i1", month: "2026-08", expected: 5000 }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCategories: (type?: string) => ({
    data: baseCategories.filter((c) => c.type === type),
    isLoading: false,
    isError: false,
    error: null,
  }),
  useAllCategories: () => ({
    data: baseCategories,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCategoryUsage: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExpenses: () => ({
    data: [
      { id: "e1", category_id: "c1", value: 1200, report_weight: 1 },
      { id: "e2", category_id: "c2", value: 100, report_weight: 1 },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useIncomes: () => ({
    data: [{ id: "in1", category_id: "i1", value: 5000, report_weight: 1 }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSetBudgetLimit: () => ({ mutateAsync: setBudgetLimitMock, isPending: false }),
  useRemoveBudgetLimit: () => ({ mutateAsync: removeBudgetLimitMock, isPending: false }),
  useSetIncomeGoal: () => ({ mutateAsync: setIncomeGoalMock, isPending: false }),
  useRemoveIncomeGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReallocateBudget: () => ({ mutateAsync: reallocateMock, isPending: false }),
}));

describe("BudgetsPage — limites e metas (§3.5.2/§3.5.3)", () => {
  it("exibe o KPI de total de limites e as categorias com progresso", () => {
    render(<BudgetsPage />);
    expect(screen.getByText("Orçamento do Mês")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.000,00")).toBeInTheDocument();
    // "Moradia" aparece na linha da categoria e na sugestão de realocação
    expect(screen.getAllByText("Moradia").length).toBeGreaterThan(0);
    // Moradia 1.200/1.000 → excedida
    expect(screen.getByText("Excedida")).toBeInTheDocument();
  });

  it("recomenda realocação da maior folga para o maior excesso", () => {
    render(<BudgetsPage />);
    // Lazer (100/1.000 → folga R$ 900) → Moradia (1.200/1.000 → excesso R$ 200)
    expect(screen.getByText("Sugestão de Realocação de Limite")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 200,00/)).toBeInTheDocument();
  });

  it("aplica a realocação com confirmação", async () => {
    reallocateMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BudgetsPage />);

    await user.click(screen.getByRole("button", { name: "Aplicar realocação" }));
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(reallocateMock).toHaveBeenCalledTimes(1);
    const params = reallocateMock.mock.calls[0]?.[0];
    expect(params.fromCategoryId).toBe("c2");
    expect(params.toCategoryId).toBe("c1");
    expect(params.amount).toBe(200);
  });

  it("edita o limite de uma categoria com sugestão por % da renda", async () => {
    setBudgetLimitMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BudgetsPage />);

    await user.click(screen.getAllByRole("button", { name: "Editar limite de Moradia" })[0]!);
    expect((screen.getByRole("textbox", { name: "Limite mensal da categoria" }) as HTMLInputElement).value).toMatch(/1\.000,00/);
    // Moradia → 30% da renda R$ 5.000 = R$ 1.500
    expect(screen.getByText(/30% da renda/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Aplicar/ }));
    await user.click(screen.getByRole("button", { name: "Salvar limite" }));

    expect(setBudgetLimitMock).toHaveBeenCalledTimes(1);
    const params = setBudgetLimitMock.mock.calls[0]?.[0];
    expect(params.categoryId).toBe("c1");
    expect(params.limit).toBe(1500);
  });

  it("metas de renda: compara realizado × esperado", async () => {
    const user = userEvent.setup();
    render(<BudgetsPage />);
    await user.click(screen.getByRole("tab", { name: /Rendas/ }));

    expect(screen.getByText("Salário")).toBeInTheDocument();
    // Realizado R$ 5.000 = meta R$ 5.000 → na meta
    expect(screen.getByText("Na meta")).toBeInTheDocument();
    expect(screen.getByText(/Realizado:/)).toBeInTheDocument();
  });

  it("salva uma nova meta de renda através do diálogo", async () => {
    setIncomeGoalMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BudgetsPage />);
    await user.click(screen.getByRole("tab", { name: /Rendas/ }));

    await user.click(screen.getAllByRole("button", { name: "Editar meta de renda de Salário" })[0]!);
    const goalInput = screen.getByRole("textbox", { name: "Expectativa de renda mensal da categoria" });
    await user.clear(goalInput);
    await user.type(goalInput, "600000");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));

    expect(setIncomeGoalMock).toHaveBeenCalledTimes(1);
    const params = setIncomeGoalMock.mock.calls[0]?.[0];
    expect(params.categoryId).toBe("i1");
    expect(params.expected).toBe(6000);
  });

  it("falha ao salvar meta mostra erro no modal", async () => {
    setIncomeGoalMock.mockRejectedValue(new Error("Falha de rede"));
    const user = userEvent.setup();
    render(<BudgetsPage />);
    await user.click(screen.getByRole("tab", { name: /Rendas/ }));

    await user.click(screen.getAllByRole("button", { name: "Editar meta de renda de Salário" })[0]!);
    const goalInput = screen.getByRole("textbox", { name: "Expectativa de renda mensal da categoria" });
    await user.clear(goalInput);
    await user.type(goalInput, "600000");
    await user.click(screen.getByRole("button", { name: "Salvar meta" }));

    expect(await screen.findByText("Falha de rede")).toBeInTheDocument();
    // Restaura para não contaminar os demais testes.
    setIncomeGoalMock.mockResolvedValue(undefined);
  });
});

