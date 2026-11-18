import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { currentMonth, shiftMonth } from "@/lib/date";
import { EarlyAmortizationDialog } from "./early-amortization-dialog";
import type { Debt, Loan } from "@/types";

const amortizeMock = vi.fn();

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [{ id: "cat-1", name: "Empréstimos", type: "expense" }],
    isLoading: false,
  }),
  useEarlyAmortizeLoan: () => ({
    mutateAsync: amortizeMock,
    isPending: false,
  }),
}));

const mockLoan: Loan = {
  id: "loan-1",
  user_id: "u1",
  name: "Financiamento Auto",
  loan_type: "financing",
  principal_amount: 10000,
  interest_rate_monthly: 1.5, // 1,5% a.m. direto (sem multiplicar por 100)
  total_installments: 12,
  amortization_system: "price",
  start_date: "2026-01-01",
  installment_group_id: "g-1",
  created_at: "2026-01-01T00:00:00Z",
};

const futureDate = `${shiftMonth(currentMonth(), 12)}-01`;
const mockDebts: Debt[] = [
  {
    id: "d-future-1",
    user_id: "u1",
    name: "Financiamento Auto (12/12)",
    type: "payable",
    amount: 900,
    due_date: futureDate,
    paid_at: null,
    expense_id: null,
    installment_group_id: "g-1",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("EarlyAmortizationDialog", () => {
  it("calcula desconto a valor presente usando interest_rate_monthly direto (sem multiplicar por 100)", async () => {
    amortizeMock.mockResolvedValueOnce(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <EarlyAmortizationDialog
        loan={mockLoan}
        debts={mockDebts}
        open={true}
        onOpenChange={onOpenChange}
      />,
    );

    // Se tivesse o bug *100 (150% a.m.), o desconto seria quase 100% e o PV seria ~R$ 0,00.
    // Com 1,5% a.m. em horizonte longo, PV > 0 e desconto < R$ 900,00; validamos também com valor suficiente.
    const input = screen.getByRole("textbox", { name: "Valor para amortização extraordinária" });
    await user.clear(input);
    await user.type(input, "100000"); // R$ 1.000,00

    expect(screen.getByText("1 parcela(s)")).toBeInTheDocument();
    expect(document.querySelectorAll(".num").length).toBeGreaterThanOrEqual(3);

    await user.click(screen.getByRole("combobox", { name: "Categoria da despesa de amortização" }));
    await user.click(await screen.findByRole("option", { name: "Empréstimos" }));
    await user.click(screen.getByRole("button", { name: "Confirmar amortização" }));

    expect(amortizeMock).toHaveBeenCalledTimes(1);
    const callArg = amortizeMock.mock.calls[0]?.[0];
    // Com 1,5% a.m. em 12 meses (900 / 1.015^12 ≈ 753), PV > 700; se houvesse o bug *100 (150% a.m.), seria ~0
    expect(callArg.totalPaid).toBeGreaterThan(700);
    expect(callArg.totalPaid + callArg.discountTotal).toBe(900);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
