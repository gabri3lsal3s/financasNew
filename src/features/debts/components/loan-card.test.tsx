import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoanCard } from "./loan-card";
import type { Debt, Loan } from "@/types";

const subscriptionState = {
  isReadOnly: false,
  canWrite: true,
};

vi.mock("@/state", () => ({
  useUserSubscription: () => subscriptionState,
  useDeleteLoan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRenegotiateLoanContract: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCategories: () => ({ data: [], isLoading: false }),
  useEarlyAmortizeLoan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const mockLoan: Loan = {
  id: "loan-1",
  user_id: "u1",
  name: "Financiamento Casa",
  loan_type: "financing",
  principal_amount: 100000,
  interest_rate_monthly: 0.9,
  total_installments: 10,
  amortization_system: "sac",
  start_date: "2026-01-01",
  installment_group_id: "g-1",
  created_at: "2026-01-01T00:00:00Z",
};

const mockDebts: Debt[] = [
  {
    id: "d-1",
    user_id: "u1",
    name: "Parcela 1/10",
    type: "payable",
    amount: 1000,
    due_date: "2026-02-01",
    paid_at: null,
    expense_id: null,
    installment_group_id: "g-1",
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("LoanCard", () => {
  beforeEach(() => {
    subscriptionState.isReadOnly = false;
    subscriptionState.canWrite = true;
  });

  it("bloqueia Editar, Amortizar e Excluir abrindo UpgradeDialog em modo somente leitura, mantendo Cronograma acessível", async () => {
    subscriptionState.isReadOnly = true;
    subscriptionState.canWrite = false;
    const user = userEvent.setup();

    render(<LoanCard loan={mockLoan} debts={mockDebts} />);

    // Editar abre UpgradeDialog em vez de LoanEditDialog
    await user.click(screen.getByRole("button", { name: "Editar contrato" }));
    expect(screen.getByText("Editar Contrato de Crédito")).toBeInTheDocument();
    expect(screen.queryByText("Editar e Repactuar Contrato")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /agora não/i }));

    // Excluir abre UpgradeDialog em vez de ConfirmDialog
    await user.click(screen.getByRole("button", { name: "Excluir contrato" }));
    expect(screen.getByText("Excluir Contrato de Crédito")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /agora não/i }));

    // Amortizar abre UpgradeDialog em vez de EarlyAmortizationDialog
    await user.click(screen.getByRole("button", { name: "Amortizar" }));
    expect(screen.getByText("Amortizar Contrato Antecipadamente")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /agora não/i }));

    // Cronograma continua acessível por ser somente leitura
    await user.click(screen.getByRole("button", { name: "Cronograma" }));
    expect(screen.getByText("Cronograma: Financiamento Casa")).toBeInTheDocument();
  });
});
