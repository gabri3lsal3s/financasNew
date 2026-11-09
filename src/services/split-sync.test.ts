import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAllSplitExpenses, syncSplitExpenseReportWeights } from "./split-sync";
import * as expenseRepo from "@/data/repositories/expenses";
import * as rpcData from "@/data/rpc";
import type { Expense, SplitParticipantInstallment } from "@/types";

vi.mock("@/data/repositories/expenses", () => ({
  getExpense: vi.fn(),
  updateExpense: vi.fn(),
  listExpensesByInstallmentGroup: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  deleteExpenseInstallments: vi.fn(),
}));

vi.mock("@/data/client", () => ({
  getSupabase: vi.fn(),
}));

describe("syncSplitExpenseReportWeights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna imediatamente se expenseId for vazio", async () => {
    const res = await syncSplitExpenseReportWeights({
      expenseId: "",
      totalCents: 50000,
    });
    expect(res.updatedCount).toBe(0);
    expect(expenseRepo.getExpense).not.toHaveBeenCalled();
  });

  it("sincroniza pesos de cada parcela individual de despesa de cartao com grupo", async () => {
    const mockExpense1: Expense = {
      id: "exp_1",
      user_id: "u1",
      value: 250,
      date: "2026-11-09",
      category_id: "c1",
      payment_method: "credit_card",
      card_id: "card_1",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "grp_1",
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 250,
      description: "Compras",
      created_at: "2026-11-09T00:00:00Z",
    };

    const mockExpense2: Expense = {
      ...mockExpense1,
      id: "exp_2",
      date: "2026-12-09",
      installment_number: 2,
      bill_competence: "2026-12",
    };

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(mockExpense1);
    vi.mocked(expenseRepo.listExpensesByInstallmentGroup).mockResolvedValue([
      mockExpense1,
      mockExpense2,
    ]);

    const installments: SplitParticipantInstallment[] = [
      {
        id: "inst_1",
        participant_id: "p_2",
        installment_number: 1,
        total_installments: 2,
        amount_cents: 12500,
        due_date: "2026-11-09",
        is_settled: true,
        settled_at: "2026-11-09T10:00:00Z",
        signal_status: "none",
        signaled_at: null,
      },
      {
        id: "inst_2",
        participant_id: "p_2",
        installment_number: 2,
        total_installments: 2,
        amount_cents: 12500,
        due_date: "2026-12-09",
        is_settled: true,
        settled_at: "2026-12-09T10:00:00Z",
        signal_status: "none",
        signaled_at: null,
      },
    ];

    const res = await syncSplitExpenseReportWeights({
      expenseId: "exp_1",
      installments,
      hostId: "p_1",
      totalCents: 50000,
      groupId: "grp_1",
    });

    expect(res.updatedCount).toBe(2);
    // Parcela 1: 250 - 125 = 125 -> peso 0.5
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_1", { report_weight: 0.5 });
    // Parcela 2: 250 - 125 = 125 -> peso 0.5
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_2", { report_weight: 0.5 });
  });

  it("atualiza apenas a parcela 1 se a parcela 2 ainda estiver pendente", async () => {
    const mockExpense1: Expense = {
      id: "exp_1",
      user_id: "u1",
      value: 250,
      date: "2026-11-09",
      category_id: "c1",
      payment_method: "credit_card",
      card_id: "card_1",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "grp_1",
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 250,
      description: "Compras",
      created_at: "2026-11-09T00:00:00Z",
    };

    const mockExpense2: Expense = {
      ...mockExpense1,
      id: "exp_2",
      date: "2026-12-09",
      installment_number: 2,
      bill_competence: "2026-12",
      report_weight: 1,
    };

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(mockExpense1);
    vi.mocked(expenseRepo.listExpensesByInstallmentGroup).mockResolvedValue([
      mockExpense1,
      mockExpense2,
    ]);

    const installments: SplitParticipantInstallment[] = [
      {
        id: "inst_1",
        participant_id: "p_2",
        installment_number: 1,
        total_installments: 2,
        amount_cents: 12500,
        due_date: "2026-11-09",
        is_settled: true,
        settled_at: "2026-11-09T10:00:00Z",
        signal_status: "none",
        signaled_at: null,
      },
      {
        id: "inst_2",
        participant_id: "p_2",
        installment_number: 2,
        total_installments: 2,
        amount_cents: 12500,
        due_date: "2026-12-09",
        is_settled: false,
        settled_at: null,
        signal_status: "none",
        signaled_at: null,
      },
    ];

    const res = await syncSplitExpenseReportWeights({
      expenseId: "exp_1",
      installments,
      hostId: "p_1",
      totalCents: 50000,
      groupId: "grp_1",
    });

    expect(res.updatedCount).toBe(1);
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_1", { report_weight: 0.5 });
    expect(expenseRepo.updateExpense).not.toHaveBeenCalledWith("exp_2", expect.anything());
  });
});

describe("deleteAllSplitExpenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 0 se expenseId for vazio", async () => {
    const res = await deleteAllSplitExpenses({ expenseId: "" });
    expect(res.deletedCount).toBe(0);
    expect(rpcData.deleteExpenseInstallments).not.toHaveBeenCalled();
  });

  it("exclui cada parcela do grupo individualmente se encontrar parcelas pelo installment_group_id", async () => {
    const mockExpense1: Expense = {
      id: "exp_1",
      user_id: "u1",
      value: 250,
      date: "2026-11-09",
      category_id: "c1",
      payment_method: "credit_card",
      card_id: "card_1",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "grp_1",
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 250,
      description: "Compras",
      created_at: "2026-11-09T00:00:00Z",
    };
    const mockExpense2: Expense = {
      ...mockExpense1,
      id: "exp_2",
      installment_number: 2,
    };

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(mockExpense1);
    vi.mocked(expenseRepo.listExpensesByInstallmentGroup).mockResolvedValue([
      mockExpense1,
      mockExpense2,
    ]);
    vi.mocked(rpcData.deleteExpenseInstallments).mockResolvedValue(1);

    const res = await deleteAllSplitExpenses({
      expenseId: "exp_1",
      groupId: "grp_1",
    });

    expect(res.deletedCount).toBe(2);
    expect(rpcData.deleteExpenseInstallments).toHaveBeenCalledWith("exp_1", "single");
    expect(rpcData.deleteExpenseInstallments).toHaveBeenCalledWith("exp_2", "single");
  });

  it("faz fallback para modo 'all' caso nao encontre lista de grupo", async () => {
    vi.mocked(expenseRepo.getExpense).mockResolvedValue(null);
    vi.mocked(rpcData.deleteExpenseInstallments).mockResolvedValue(2);

    const res = await deleteAllSplitExpenses({
      expenseId: "exp_single",
    });

    expect(res.deletedCount).toBe(2);
    expect(rpcData.deleteExpenseInstallments).toHaveBeenCalledWith("exp_single", "all");
  });
});
