import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BudgetAdjustDialog } from "./budget-adjust-dialog";
import type { Category } from "@/types";

const mockSetBatchLimits = vi.fn();

vi.mock("@/state", () => ({
  useSetBatchBudgetLimits: () => ({
    mutateAsync: mockSetBatchLimits,
    isPending: false,
  }),
}));

const mockCategories: { category: Category; currentLimitCents: number }[] = [
  {
    category: {
      id: "cat-1",
      user_id: "u1",
      name: "Moradia",
      type: "expense",
      color: "#8B5CF6",
      icon: "moradia",
      is_reserved: false,
      is_active: true,
    },
    currentLimitCents: 100000, // R$ 1.000,00
  },
  {
    category: {
      id: "cat-2",
      user_id: "u1",
      name: "Alimentação",
      type: "expense",
      color: "#DDA726",
      icon: "alimentacao",
      is_reserved: false,
      is_active: true,
    },
    currentLimitCents: 50000, // R$ 500,00
  },
];

describe("BudgetAdjustDialog — Ajuste Proporcional em Lote", () => {
  it("renderiza o diálogo aberto com KPIs de total atual e novo total por percentual padrão (+10%)", () => {
    render(
      <BudgetAdjustDialog
        month="2026-08"
        categories={mockCategories}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Ajustar Orçamento" })).toBeInTheDocument();
    expect(screen.getByText(/Redistribuição proporcional dos limites para ago\. de 2026/i)).toBeInTheDocument();

    // Total Atual: R$ 1.500,00 · Novo Total: R$ 1.650,00 (+10%)
    expect(screen.getAllByText("Total Atual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Novo Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.650,00/).length).toBeGreaterThan(0);
  });

  it("permite alterar a variação percentual através dos botões de atalho", async () => {
    const user = userEvent.setup();
    render(
      <BudgetAdjustDialog
        month="2026-08"
        categories={mockCategories}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Clica no atalho +20% -> Novo total deve ser R$ 1.800,00
    const plus20Btn = screen.getByRole("button", { name: "+20%" });
    await user.click(plus20Btn);

    expect(screen.getAllByText(/1\.800,00/).length).toBeGreaterThan(0);
  });

  it("permite alternar para modo de valor total pretendido e aplicar ajuste", async () => {
    mockSetBatchLimits.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <BudgetAdjustDialog
        month="2026-08"
        categories={mockCategories}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Alterna para aba "Por Valor Total (R$)"
    const targetTab = screen.getByRole("tab", { name: /Por Valor Total/i });
    await user.click(targetTab);

    // Preenche novo total de R$ 3.000,00 (300000 centavos)
    const targetInput = screen.getByRole("textbox", { name: /Novo valor total pretendido para o mês/i });
    await user.clear(targetInput);
    await user.type(targetInput, "300000");

    // Aplica o ajuste
    const applyBtn = screen.getByRole("button", { name: "Aplicar ajuste" });
    await user.click(applyBtn);

    await vi.waitFor(() => {
      expect(mockSetBatchLimits).toHaveBeenCalledWith({
        month: "2026-08",
        items: [
          { categoryId: "cat-1", limit: 2000 }, // R$ 2.000,00 (2/3 de R$ 3.000,00)
          { categoryId: "cat-2", limit: 1000 }, // R$ 1.000,00 (1/3 de R$ 3.000,00)
        ],
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
