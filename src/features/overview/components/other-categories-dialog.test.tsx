import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OtherCategoriesDialog } from "./other-categories-dialog";
import type { Category } from "@/types";

const mockCategory1: Category = {
  id: "cat-1",
  user_id: "user-1",
  name: "Educação",
  icon: "graduation-cap",
  color: "#3b82f6",
  is_active: true,
  is_reserved: false,
  type: "expense",
};

const mockCategory2: Category = {
  id: "cat-2",
  user_id: "user-1",
  name: "Vestuário",
  icon: "shirt",
  color: "#ec4899",
  is_active: true,
  is_reserved: false,
  type: "expense",
};

describe("OtherCategoriesDialog", () => {
  it("renderiza lista de outras categorias com valores e percentuais", () => {
    const handleSelectCategory = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <OtherCategoriesDialog
        open={true}
        onOpenChange={handleOpenChange}
        month="2026-08"
        totalExpensesCents={100000} // R$ 1.000,00
        rows={[
          { category: mockCategory1, spentGrossCents: 20000, percent: 20 },
          { category: mockCategory2, spentGrossCents: 10000, percent: 10 },
        ]}
        onSelectCategory={handleSelectCategory}
      />,
    );

    expect(screen.getByText("Demais Categorias")).toBeInTheDocument();
    expect(screen.getByText("Educação")).toBeInTheDocument();
    expect(screen.getByText("Vestuário")).toBeInTheDocument();
    expect(screen.getByText("2 categorias")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
  });

  it("chama onSelectCategory e fecha o modal ao clicar em uma categoria", () => {
    const handleSelectCategory = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <OtherCategoriesDialog
        open={true}
        onOpenChange={handleOpenChange}
        month="2026-08"
        totalExpensesCents={100000}
        rows={[{ category: mockCategory1, spentGrossCents: 20000, percent: 20 }]}
        onSelectCategory={handleSelectCategory}
      />,
    );

    fireEvent.click(screen.getByText("Educação"));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleSelectCategory).toHaveBeenCalledWith("cat-1");
  });
});
