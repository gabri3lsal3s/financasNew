import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryKitsModal } from "./category-kits-modal";
import type { Category } from "@/types";

const mockMutateAsync = vi.fn();

vi.mock("@/state", () => ({
  useInstallCategoryKit: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

const MOCK_CATEGORIES: Category[] = [
  {
    id: "cat-1",
    user_id: "u-1",
    name: "Alimentação",
    type: "expense",
    icon: "alimentacao",
    color: "#DDA726",
    is_reserved: false,
    is_active: true,
    is_family: false,
    scope: "personal",
  },
  {
    id: "cat-2",
    user_id: "u-1",
    name: "Salário",
    type: "income",
    icon: "salario",
    color: "#10B981",
    is_reserved: false,
    is_active: true,
    is_family: false,
    scope: "personal",
  },
];

describe("CategoryKitsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("renderiza o modal com as 4 abas de kits", () => {
    render(
      <CategoryKitsModal
        open={true}
        onOpenChange={vi.fn()}
        existingCategories={MOCK_CATEGORIES}
      />,
    );

    expect(screen.getByText("Kits de Categorias")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Essencial & Dia a Dia/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Negócio & PJ/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Família & Residência/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Veículos & Mobilidade/i })).toBeInTheDocument();
  });

  it("identifica categorias existentes com badge 'Adicionada' e ausentes com botão 'Adicionar'", () => {
    render(
      <CategoryKitsModal
        open={true}
        onOpenChange={vi.fn()}
        existingCategories={MOCK_CATEGORIES}
      />,
    );

    // Alimentação e Salário estão em MOCK_CATEGORIES, devem ter badge Adicionada
    const adicionadaBadges = screen.getAllByText("Adicionada");
    expect(adicionadaBadges.length).toBeGreaterThanOrEqual(2);

    // Outras como Moradia e Transporte devem ter botão Adicionar
    const addButtons = screen.getAllByRole("button", { name: /^Adicionar$/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it("permite instalar um item avulso ao clicar em 'Adicionar'", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce([]);

    render(
      <CategoryKitsModal
        open={true}
        onOpenChange={vi.fn()}
        existingCategories={MOCK_CATEGORIES}
      />,
    );

    const addButtons = screen.getAllByRole("button", { name: /^Adicionar$/i });
    await user.click(addButtons[0]!);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: expect.any(String) })]),
    );
  });

  it("permite instalar o kit completo de uma vez", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce([]);

    render(
      <CategoryKitsModal
        open={true}
        onOpenChange={vi.fn()}
        existingCategories={MOCK_CATEGORIES}
      />,
    );

    const installKitBtn = screen.getByRole("button", { name: /Instalar kit/i });
    await user.click(installKitBtn);

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const passedItems = mockMutateAsync.mock.calls[0]![0];
    // Não deve conter Alimentação nem Salário (pois já existem)
    expect(passedItems.some((i: { name: string }) => i.name === "Alimentação")).toBe(false);
    expect(passedItems.some((i: { name: string }) => i.name === "Salário")).toBe(false);
  });
});
