import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectSplitCategoryDialog } from "./select-split-category-dialog";
import type { Category } from "@/types";

describe("SelectSplitCategoryDialog", () => {
  const mockCategories: Category[] = [
    { id: "cat-1", name: "Alimentação", icon: "Utensils", color: "#EF4444", type: "expense", user_id: "u1", is_reserved: false, is_active: true },
    { id: "cat-2", name: "Lazer & Restaurante", icon: "Coffee", color: "#3B82F6", type: "expense", user_id: "u1", is_reserved: false, is_active: true },
  ];

  it("renderiza lista de categorias e permite selecionar", () => {
    const onConfirm = vi.fn();
    render(
      <SelectSplitCategoryDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Jantar de amigos"
        amountCents={3500}
        sentCategoryName="Gastronomia"
        categories={mockCategories}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Escolha uma Categoria")).toBeInTheDocument();
    expect(screen.getByText(/Gastronomia/i)).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Lazer & Restaurante")).toBeInTheDocument();

    const secondCategoryBtn = screen.getByRole("button", { name: /lazer & restaurante/i });
    fireEvent.click(secondCategoryBtn);

    const confirmBtn = screen.getByRole("button", { name: /salvar nesta categoria/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledWith("cat-2");
  });
});
