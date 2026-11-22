import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteAllSplitExpenses,
  syncExpenseFieldsFromSplit,
  syncSplitDebtStatus,
  syncSplitExpenseReportWeights,
} from "./split-sync";
import * as debtRepo from "@/data/repositories/debts";
import * as expenseRepo from "@/data/repositories/expenses";
import * as rpcData from "@/data/rpc";
import type { Debt, Expense, SplitParticipantInstallment, SplitParticipantItem } from "@/types";

vi.mock("@/data/repositories/expenses", () => ({
  getExpense: vi.fn(),
  updateExpense: vi.fn(),
  listExpensesByInstallmentGroup: vi.fn(),
}));

vi.mock("@/data/repositories/debts", () => ({
  createLinkedReceivableDebt: vi.fn(),
  listDebts: vi.fn(),
  updateDebt: vi.fn(),
}));

vi.mock("@/data/rpc", () => ({
  deleteExpenseInstallments: vi.fn(),
  settleIntegratedReceivable: vi.fn(),
  updateExpenseInstallmentsGroup: vi.fn(),
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

  it("desconta corretamente report_weight em despesa à vista (1x) sem parcelas", async () => {
    const singleExp: Expense = {
      id: "exp_vista",
      user_id: "u1",
      value: 300,
      date: "2026-11-10",
      category_id: "c1",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 300,
      description: "Jantar",
      created_at: "2026-11-10T00:00:00Z",
    };

    const participants: SplitParticipantItem[] = [
      { id: "p_1", name: "Gabriel", share_cents: 10000, is_host: true, is_settled: true, settled_cents: 10000 },
      { id: "p_2", name: "Lucas", share_cents: 10000, is_host: false, is_settled: true, settled_cents: 10000 },
      { id: "p_3", name: "Ana", share_cents: 10000, is_host: false, is_settled: false, settled_cents: 0 },
    ];

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(singleExp);

    const res = await syncSplitExpenseReportWeights({
      expenseId: "exp_vista",
      participants,
      installments: [],
      hostId: "p_1",
      totalCents: 30000,
    });

    expect(res.updatedCount).toBe(1);
    // 300 - 100 = 200 -> 200/300 = 0.6667
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_vista", { report_weight: 0.6667 });
  });

  it("distribui abatimento proporcionalmente em grupo parcelado com modo single_total", async () => {
    const exp1: Expense = {
      id: "exp_g1",
      user_id: "u1",
      value: 150,
      date: "2026-11-10",
      category_id: "c1",
      payment_method: "credit_card",
      card_id: "card_1",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "grp_st",
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 150,
      description: "Hotel",
      created_at: "2026-11-10T00:00:00Z",
    };
    const exp2: Expense = {
      ...exp1,
      id: "exp_g2",
      installment_number: 2,
      date: "2026-12-10",
      bill_competence: "2026-12",
    };

    const participants: SplitParticipantItem[] = [
      { id: "p_1", name: "Gabriel", share_cents: 15000, is_host: true, is_settled: true, settled_cents: 15000 },
      { id: "p_2", name: "Lucas", share_cents: 15000, is_host: false, is_settled: true, settled_cents: 15000 },
    ];

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(exp1);
    vi.mocked(expenseRepo.listExpensesByInstallmentGroup).mockResolvedValue([exp1, exp2]);

    const res = await syncSplitExpenseReportWeights({
      expenseId: "exp_g1",
      groupId: "grp_st",
      participants,
      installments: [],
      installmentsMode: "single_total",
      totalCents: 30000,
    });

    expect(res.updatedCount).toBe(2);
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_g1", { report_weight: 0.5 });
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_g2", { report_weight: 0.5 });
  });
});

describe("syncExpenseFieldsFromSplit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sincroniza titulo, data e valor/base_amount em despesa simples", async () => {
    const exp: Expense = {
      id: "exp_s1",
      user_id: "u1",
      value: 100,
      date: "2026-11-10",
      category_id: "c1",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 100,
      description: "Antigo",
      created_at: "2026-11-10T00:00:00Z",
    };

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(exp);

    const res = await syncExpenseFieldsFromSplit({
      expenseId: "exp_s1",
      description: "Churrasco Novo",
      totalCents: 18050,
      date: "2026-11-12",
    });

    expect(res.updatedCount).toBe(1);
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_s1", {
      description: "Churrasco Novo",
      date: "2026-11-12",
      value: 180.5,
      base_amount: 180.5,
    });
  });

  it("sincroniza titulo em lote e redistribui total alterado nas parcelas do grupo", async () => {
    const exp1: Expense = {
      id: "exp_m1",
      user_id: "u1",
      value: 100,
      date: "2026-11-10",
      category_id: "c1",
      payment_method: "credit_card",
      card_id: "card_1",
      installments_total: 2,
      installment_number: 1,
      installment_group_id: "grp_m",
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 100,
      description: "Viagem",
      created_at: "2026-11-10T00:00:00Z",
    };
    const exp2: Expense = {
      ...exp1,
      id: "exp_m2",
      installment_number: 2,
      date: "2026-12-10",
    };

    vi.mocked(expenseRepo.getExpense).mockResolvedValue(exp1);
    vi.mocked(expenseRepo.listExpensesByInstallmentGroup).mockResolvedValue([exp1, exp2]);

    const res = await syncExpenseFieldsFromSplit({
      expenseId: "exp_m1",
      groupId: "grp_m",
      description: "Viagem Atualizada",
      totalCents: 30001,
    });

    expect(rpcData.updateExpenseInstallmentsGroup).toHaveBeenCalledWith("exp_m1", "all", {
      description: "Viagem Atualizada",
    });
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_m1", { value: 150.01, base_amount: 150.01 });
    expect(expenseRepo.updateExpense).toHaveBeenCalledWith("exp_m2", { value: 150, base_amount: 150 });
    expect(res.updatedCount).toBe(4);
  });
});

describe("syncSplitDebtStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria cobranca vinculada quando ausente e shouldCreateIfMissing=true", async () => {
    vi.mocked(debtRepo.listDebts).mockResolvedValue([]);
    vi.mocked(debtRepo.createLinkedReceivableDebt).mockResolvedValue({
      id: "debt_new",
      user_id: "u1",
      name: "Racha: Jantar",
      amount: 150,
      due_date: "2026-11-20",
      type: "receivable",
      paid_at: null,
      expense_id: "exp_1",
      installment_group_id: null,
      created_at: "2026-11-10T00:00:00Z",
    });

    const res = await syncSplitDebtStatus({
      expenseId: "exp_1",
      title: "Jantar",
      dueDate: "2026-11-20",
      remainingReceivableCents: 15000,
      hostNetCostCents: 15000,
      isCompleted: false,
      isMultiInstallment: false,
      shouldCreateIfMissing: true,
    });

    expect(debtRepo.createLinkedReceivableDebt).toHaveBeenCalledWith({
      name: "Racha: Jantar",
      amount: 150,
      due_date: "2026-11-20",
      expense_id: "exp_1",
      installment_group_id: null,
    });
    expect(res?.id).toBe("debt_new");
  });

  it("atualiza valor/nome em aberto e reabre divida se voltar a ter pendencia", async () => {
    const settledDebt: Debt = {
      id: "debt_1",
      user_id: "u1",
      name: "Racha: Antigo",
      amount: 100,
      due_date: "2026-11-15",
      type: "receivable",
      paid_at: "2026-11-12T10:00:00Z",
      expense_id: "exp_1",
      installment_group_id: null,
      created_at: "2026-11-10T00:00:00Z",
    };

    await syncSplitDebtStatus({
      linkedDebt: settledDebt,
      title: "Novo Nome",
      dueDate: "2026-11-25",
      remainingReceivableCents: 12000,
      hostNetCostCents: 18000,
      isCompleted: false,
      isMultiInstallment: false,
    });

    expect(debtRepo.updateDebt).toHaveBeenCalledWith("debt_1", {
      name: "Racha: Novo Nome",
      amount: 120,
      due_date: "2026-11-25",
      paid_at: null,
    });
  });

  it("quita divida simples via settleIntegratedReceivable e multi-parcela via updateDebt", async () => {
    const singleDebt: Debt = {
      id: "debt_s",
      user_id: "u1",
      name: "Racha: Antigo",
      amount: 100,
      due_date: "2026-11-15",
      type: "receivable",
      paid_at: null,
      expense_id: "exp_1",
      installment_group_id: null,
      created_at: "2026-11-10T00:00:00Z",
    };

    await syncSplitDebtStatus({
      linkedDebt: singleDebt,
      title: "Jantar",
      remainingReceivableCents: 0,
      hostNetCostCents: 10000,
      isCompleted: true,
      isMultiInstallment: false,
    });

    expect(rpcData.settleIntegratedReceivable).toHaveBeenCalledWith("debt_s", 100);
    expect(debtRepo.updateDebt).toHaveBeenCalledWith("debt_s", { name: "Racha: Jantar" });

    vi.clearAllMocks();
    await syncSplitDebtStatus({
      linkedDebt: singleDebt,
      title: "Jantar",
      remainingReceivableCents: 0,
      hostNetCostCents: 10000,
      isCompleted: true,
      isMultiInstallment: true,
    });

    expect(rpcData.settleIntegratedReceivable).not.toHaveBeenCalled();
    expect(debtRepo.updateDebt).toHaveBeenCalledWith(
      "debt_s",
      expect.objectContaining({ name: "Racha: Jantar", paid_at: expect.any(String) }),
    );
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
