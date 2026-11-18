import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncomeGoalDialog } from "./income-goal-dialog";
import { LimitDialog } from "./limit-dialog";
import type { Category } from "@/types";

const setLimitMock = vi.fn();
const removeLimitMock = vi.fn();
const setGoalMock = vi.fn();
const removeGoalMock = vi.fn();

vi.mock("@/state", () => ({
  useSetBudgetLimit: () => ({ mutateAsync: setLimitMock, isPending: false }),
  useRemoveBudgetLimit: () => ({ mutateAsync: removeLimitMock, isPending: false }),
  useSetIncomeGoal: () => ({ mutateAsync: setGoalMock, isPending: false }),
  useRemoveIncomeGoal: () => ({ mutateAsync: removeGoalMock, isPending: false }),
}));

const expenseCategory: Category = {
  id: "cat-food",
  user_id: "u1",
  name: "Alimentação",
  type: "expense",
  icon: "alimentacao",
  color: "#DDA726",
  is_reserved: false,
  is_active: true,
};

const incomeCategory: Category = {
  id: "cat-salary",
  user_id: "u1",
  name: "Salário",
  type: "income",
  icon: "salario",
  color: "#2A9D8F",
  is_reserved: false,
  is_active: true,
};

describe("LimitDialog & IncomeGoalDialog (base unificada GoalOrLimitDialog)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe monthLabel formatado no LimitDialog e aplica sugestão de limite", async () => {
    setLimitMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <LimitDialog
        category={expenseCategory}
        month="2026-08"
        currentLimitCents={50000}
        inherited={false}
        monthlyIncomeCents={1000000}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText(/Ago\. de 2026/i)).toBeInTheDocument();
    expect(screen.queryByText("Mês 2026-08")).not.toBeInTheDocument();

    // Sugestão: 15% de R$ 10.000,00 = R$ 1.500,00
    await user.click(screen.getByRole("button", { name: /Aplicar/i }));
    await user.click(screen.getByRole("button", { name: "Salvar limite" }));

    expect(setLimitMock).toHaveBeenCalledWith({
      categoryId: "cat-food",
      month: "2026-08",
      limit: 1500,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("exibe monthLabel formatado no IncomeGoalDialog e permite remover meta", async () => {
    removeGoalMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <IncomeGoalDialog
        category={incomeCategory}
        month="2026-08"
        currentExpectedCents={500000}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByText(/Definição para Ago\. de 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/em Ago\. de 2026\./i)).toBeInTheDocument();
    expect(screen.queryByText(/2026-08/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remover meta" }));

    expect(removeGoalMock).toHaveBeenCalledWith({
      categoryId: "cat-salary",
      month: "2026-08",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
