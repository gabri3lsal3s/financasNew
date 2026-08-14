import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoriesPage } from "./categories-page";

vi.mock("react-router", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const createCategoryMock = vi.fn();
const updateCategoryMock = vi.fn();
const deleteCategoryMock = vi.fn();

const categories = [
  { id: "c1", name: "Alimentação", icon: "alimentacao", color: "#F59E0B", type: "expense", is_reserved: false, is_active: true },
  { id: "c4", name: "Lazer", icon: "lazer", color: null, type: "expense", is_reserved: false, is_active: true },
  { id: "c2", name: "Salário", icon: "salario", color: null, type: "income", is_reserved: false, is_active: true },
  { id: "c3", name: "Estorno", icon: null, color: null, type: "income", is_reserved: true, is_active: true },
];

vi.mock("@/state", () => ({
  useAllCategories: () => ({ data: categories, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  // Alimentação (c1) tem lançamentos; as demais não.
  useCategoryUsage: (id: string | null) => ({
    data: id === "c1" ? { expenses: 5, incomes: 0 } : { expenses: 0, incomes: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useCreateCategory: () => ({ mutateAsync: createCategoryMock, isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: updateCategoryMock, isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: deleteCategoryMock, isPending: false }),
}));

describe("CategoriesPage — CRUD e migração (§3.5.1)", () => {
  it("lista categorias por tipo com ícone e status reservada", () => {
    render(<CategoriesPage />);
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();

    // Aba de rendas mostra a categoria reservada "Estorno" sem ações.
    // (verificado no teste de alternância abaixo)
  });

  it("alterna entre despesas e rendas", async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await user.click(screen.getByRole("tab", { name: "Rendas" }));
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Estorno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir Estorno" })).not.toBeInTheDocument();
  });

  it("cria categoria de despesa aplicando a sugestão inteligente por nome", async () => {
    createCategoryMock.mockResolvedValue({ id: "c9" });
    const user = userEvent.setup();
    render(<CategoriesPage />);

    await user.click(screen.getByRole("button", { name: "Nova categoria" }));
    const name = screen.getByLabelText("Nome");
    await user.type(name, "Transporte");

    // Sugestão por nome: ícone "transporte" pré-selecionado no Select
    const iconTrigger = screen.getByRole("combobox", { name: "Ícone da categoria" });
    expect(iconTrigger).toHaveTextContent("transporte");

    await user.click(screen.getByRole("button", { name: "Criar categoria" }));

    expect(createCategoryMock).toHaveBeenCalledTimes(1);
    const params = createCategoryMock.mock.calls[0]?.[0];
    expect(params.type).toBe("expense");
    expect(params.name).toBe("Transporte");
    expect(params.icon).toBe("transporte");
  });

  it("exclui categoria sem lançamentos diretamente", async () => {
    deleteCategoryMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoriesPage />);

    await user.click(screen.getByRole("button", { name: "Excluir Lazer" }));
    expect(screen.getByText(/não tem lançamentos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Excluir categoria" }));

    expect(deleteCategoryMock).toHaveBeenCalledWith({ id: "c4", migrateTo: null });
  });

  it("com lançamentos, exige migração para outra categoria do mesmo tipo", async () => {
    deleteCategoryMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoriesPage />);

    await user.click(screen.getByRole("button", { name: "Excluir Alimentação" }));
    // Contagem de lançamentos (número em <strong> separado do texto)
    expect(screen.getByText("5")).toBeInTheDocument();

    // Botão desabilitado sem escolher o destino da migração
    expect(screen.getByRole("button", { name: "Excluir categoria" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Categoria de destino da migração" }));
    await user.click(await screen.findByRole("option", { name: "Lazer" }));
    await user.click(screen.getByRole("button", { name: "Excluir categoria" }));

    expect(deleteCategoryMock).toHaveBeenCalledWith({ id: "c1", migrateTo: "c4" });
  });
});
