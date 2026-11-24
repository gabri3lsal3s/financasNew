import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { CategoriesPage } from "./categories-page";

const mockCategories = [
  { id: "c1", name: "Alimentação", icon: "alimentacao", color: "#FF5722", type: "expense", is_reserved: false, scope: "personal", is_family: false },
  { id: "c2", name: "Moradia", icon: "moradia", color: "#2196F3", type: "expense", is_reserved: false, scope: "personal", is_family: false },
  { id: "c3", name: "Serviços PJ", icon: "briefcase", color: "#607D8B", type: "expense", is_reserved: false, scope: "business", is_family: false },
  { id: "c4", name: "Educação dos Filhos", icon: "family", color: "#4CAF50", type: "expense", is_reserved: false, scope: "both", is_family: true },
  { id: "c5", name: "Encargos e Tarifas", icon: "credit-card", color: "#9E9E9E", type: "expense", is_reserved: true, scope: "personal", is_family: false },
  { id: "i1", name: "Salário", icon: "salario", color: "#4CAF50", type: "income", is_reserved: false, scope: "personal", is_family: false },
  { id: "i2", name: "Faturamento PJ", icon: "briefcase", color: "#FF9800", type: "income", is_reserved: false, scope: "business", is_family: false },
];

vi.mock("@/state", () => ({
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
  useUserSubscription: () => ({ isPro: true, isTrial: false, plan: "pro", isReadOnly: false, canWrite: true }),
  useAllCategories: () => ({
    data: mockCategories,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCategories: (type?: string) => ({
    data: mockCategories.filter((c) => c.type === type),
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
  useInstallCategoryKit: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useFamilyMode: () => ({ isFamilyModeEnabled: true }),
  useSafeBusinessMode: () => ({ isBusinessModeEnabled: true }),
  useMyFamily: () => ({ data: null }),
}));

function renderCategoriesPage(initialEntries: string[] = ["/categorias"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <CategoriesPage />
    </MemoryRouter>,
  );
}

describe("CategoriesPage", () => {
  it("renderiza o cabeçalho, atalho para orçamentos e lista inicial de despesas", () => {
    renderCategoriesPage();

    expect(screen.getByRole("heading", { level: 1, name: "Categorias" })).toBeInTheDocument();
    expect(screen.getByText(/Personalize suas categorias de despesas e receitas/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver tetos e orçamentos/i })).toHaveAttribute("href", "/orcamentos");

    // Abas
    expect(screen.getByRole("tab", { name: /Despesas/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Receitas/i })).toBeInTheDocument();

    // Cards de despesa presentes
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.getByText("Serviços PJ")).toBeInTheDocument();
    expect(screen.getByText("Educação dos Filhos")).toBeInTheDocument();
    expect(screen.getByText("Encargos e Tarifas")).toBeInTheDocument();

    // Receitas não devem estar na aba de despesas
    expect(screen.queryByText("Salário")).not.toBeInTheDocument();
  });

  it("alterna para a aba de receitas ao clicar na aba correspondente", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const incomeTab = screen.getByRole("tab", { name: /Receitas/i });
    await user.click(incomeTab);

    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.getByText("Faturamento PJ")).toBeInTheDocument();
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
  });

  it("filtra categorias em tempo real pelo campo de busca", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const searchInput = screen.getByPlaceholderText(/Buscar categoria por nome/i);
    await user.type(searchInput, "Morad");

    expect(screen.getByText("Moradia")).toBeInTheDocument();
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
    expect(screen.queryByText("Serviços PJ")).not.toBeInTheDocument();
  });

  it("filtra categorias por escopo (Negócio PJ)", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const pjChip = screen.getByRole("button", { name: "Negócio PJ" });
    await user.click(pjChip);

    expect(screen.getByText("Serviços PJ")).toBeInTheDocument();
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
    expect(screen.queryByText("Moradia")).not.toBeInTheDocument();
  });

  it("exibe estado vazio de busca e limpa os filtros ao clicar no botão", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const searchInput = screen.getByPlaceholderText(/Buscar categoria por nome/i);
    await user.type(searchInput, "InexistenteXYZ");

    expect(screen.getByText("Nenhuma categoria encontrada")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /Limpar filtros/i });
    await user.click(clearButton);

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
  });

  it("abre o modal de kits de categorias ao clicar na ação do cabeçalho", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const kitsButton = screen.getByRole("button", { name: /Kits de categorias/i });
    await user.click(kitsButton);

    expect(screen.getByRole("heading", { name: /Kits de Categorias/i })).toBeInTheDocument();
  });

  it("abre o modal de nova categoria ao clicar no botão do cabeçalho", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const newButton = screen.getByRole("button", { name: /Nova categoria/i });
    await user.click(newButton);

    expect(screen.getByRole("heading", { name: /Nova categoria/i })).toBeInTheDocument();
  });

  it("abre o modal de edição ao clicar no botão de editar de um card", async () => {
    const user = userEvent.setup();
    renderCategoriesPage();

    const editButton = screen.getByRole("button", { name: /Editar Alimentação/i });
    await user.click(editButton);

    expect(screen.getByRole("heading", { name: /Editar categoria/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alimentação")).toBeInTheDocument();
  });
});
