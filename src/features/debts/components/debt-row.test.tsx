import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DebtRow } from "./debt-row";
import type { Debt } from "@/types";

const mockPendingDebt: Debt = {
  id: "d-1",
  user_id: "u-1",
  name: "Aluguel",
  amount: 1500,
  due_date: "2026-12-10",
  paid_at: null,
  type: "payable",
  expense_id: null,
  installment_group_id: null,
  created_at: "2026-11-01T10:00:00Z",
};

const mockPaidDebt: Debt = {
  ...mockPendingDebt,
  id: "d-2",
  paid_at: "2026-12-05",
};

describe("DebtRow", () => {
  it("renderiza dívida pendente com botão Quitar e dispara callback", async () => {
    const user = userEvent.setup();
    const onSettle = vi.fn();
    const onUnsettle = vi.fn();
    const onEdit = vi.fn();

    render(
      <DebtRow
        debt={mockPendingDebt}
        onSettle={onSettle}
        onUnsettle={onUnsettle}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    const settleBtn = screen.getByRole("button", { name: "Quitar Aluguel" });
    await user.click(settleBtn);
    expect(onSettle).toHaveBeenCalledWith(mockPendingDebt);

    const editBtn = screen.getByRole("button", { name: "Editar Aluguel" });
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockPendingDebt);
  });

  it("renderiza dívida quitada com botão Quitada e permite desmarcar", async () => {
    const user = userEvent.setup();
    const onSettle = vi.fn();
    const onUnsettle = vi.fn();
    const onEdit = vi.fn();

    render(
      <DebtRow
        debt={mockPaidDebt}
        onSettle={onSettle}
        onUnsettle={onUnsettle}
        onEdit={onEdit}
      />,
    );

    const unsettleBtn = screen.getByRole("button", { name: /Quitada \(Aluguel\)/i });
    expect(unsettleBtn).toBeInTheDocument();
    await user.click(unsettleBtn);
    expect(onUnsettle).toHaveBeenCalledWith(mockPaidDebt);
  });
});
