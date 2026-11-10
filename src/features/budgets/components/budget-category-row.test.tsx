import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetCategoryRow, type BudgetCategoryRowData } from "./budget-category-row";
import type { Category } from "@/types";

const mockCategory: Category = {
  id: "cat-1",
  user_id: "user-1",
  name: "Alimentação",
  icon: "alimentacao",
  color: "#F59E0B",
  type: "expense",
  is_reserved: false,
  is_active: true,
};

const mockRowData: BudgetCategoryRowData = {
  category: mockCategory,
  limitCents: 100000,
  spentCents: 45000,
  spentWeightedCents: 45000,
  spentGrossCents: 60000,
  hasSplitDifference: true,
  inherited: true,
};

describe("BudgetCategoryRow", () => {
  it("renderiza o nome da categoria, badge de herdado e badge de rateio", () => {
    render(
      <BudgetCategoryRow
        row={mockRowData}
        spendMetric="personal"
        onOpenLimit={vi.fn()}
        onEditCategory={vi.fn()}
      />,
    );

    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("herdado")).toBeInTheDocument();
    expect(screen.getByText(/Total bruto:/i)).toBeInTheDocument();
  });

  it("chama onOpenLimit e onEditCategory nas ações do usuário", async () => {
    const user = userEvent.setup();
    const onOpenLimit = vi.fn();
    const onEditCategory = vi.fn();

    render(
      <BudgetCategoryRow
        row={mockRowData}
        spendMetric="personal"
        onOpenLimit={onOpenLimit}
        onEditCategory={onEditCategory}
      />,
    );

    const editBtn = screen.getByRole("button", { name: /Editar cadastro de Alimentação/i });
    await user.click(editBtn);
    expect(onEditCategory).toHaveBeenCalledWith(mockCategory);

    const openLimitBtns = screen.getAllByRole("button", { name: "Editar limite de Alimentação" });
    if (openLimitBtns[0]) {
      await user.click(openLimitBtns[0]);
    }
    expect(onOpenLimit).toHaveBeenCalledWith(mockCategory);
  });
});
