import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManageSplitDialog } from "./manage-split-dialog";
import type { Debt, PublicShare } from "@/types";

const mockUpdatePublicShare = vi.fn();
const mockDeletePublicShare = vi.fn();
const mockUpdateExpense = vi.fn();
const mockDeleteExpense = vi.fn();
const mockUpdateDebt = vi.fn();
const mockDeleteDebt = vi.fn();
const mockSettleDebt = vi.fn();
let mockLinkedExpenseData: unknown = { id: "exp-1", value: 100 };
let mockLinkedExpenseIsFetched = true;

vi.mock("@/state", () => ({
  useExpense: () => ({
    data: mockLinkedExpenseData,
    isFetched: mockLinkedExpenseIsFetched,
    isLoading: false,
  }),
  useExpensesByInstallmentGroup: () => ({
    data: undefined,
    isLoading: false,
  }),
  useUpdatePublicShare: () => ({
    mutateAsync: mockUpdatePublicShare,
    isPending: false,
  }),
  useDeletePublicShare: () => ({
    mutateAsync: mockDeletePublicShare,
    isPending: false,
  }),
  useUpdateExpense: () => ({
    mutateAsync: mockUpdateExpense,
    isPending: false,
  }),
  useDeleteExpense: () => ({
    mutateAsync: mockDeleteExpense,
    isPending: false,
  }),
  useUpdateDebt: () => ({
    mutateAsync: mockUpdateDebt,
    isPending: false,
  }),
  useDeleteDebt: () => ({
    mutateAsync: mockDeleteDebt,
    isPending: false,
  }),
  useSettleIntegratedReceivable: () => ({
    mutateAsync: mockSettleDebt,
    isPending: false,
  }),
}));

const mockSyncSplitExpenseReportWeights = vi.fn().mockResolvedValue({ updatedCount: 1, groupId: null });
const mockDeleteAllSplitExpenses = vi.fn().mockResolvedValue({ deletedCount: 1 });

vi.mock("@/services/split-sync", () => ({
  syncSplitExpenseReportWeights: (...args: unknown[]) => mockSyncSplitExpenseReportWeights(...args),
  deleteAllSplitExpenses: (...args: unknown[]) => mockDeleteAllSplitExpenses(...args),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("ManageSplitDialog", () => {
  const baseShare: PublicShare = {
    id: "share-123",
    user_id: "u1",
    kind: "split",
    token: "tok-abc",
    created_at: "2026-08-10T12:00:00Z",
    updated_at: "2026-08-10T12:00:00Z",
    expires_at: null,
    is_revoked: false,
    payload: {
      title: "Churrasco de Domingo",
      total_cents: 10000,
      date: "2026-08-10",
      people_count: 4,
      guest_share_cents: 2500,
      host_share_cents: 2500,
      expense_id: "exp-1",
      debt_id: "debt-1",
      participants: [
        { id: "p_1", name: "Você (Anfitrião)", share_cents: 2500, is_host: true, is_settled: true, settled_cents: 2500 },
        { id: "p_2", name: "Lucas", share_cents: 2500, is_host: false, is_settled: false, settled_cents: 0 },
        { id: "p_3", name: "Mariana", share_cents: 2500, is_host: false, is_settled: false, settled_cents: 0 },
        { id: "p_4", name: "Rafael", share_cents: 2500, is_host: false, is_settled: false, settled_cents: 0 },
      ],
    },
  };

  const baseDebt: Debt = {
    id: "debt-1",
    user_id: "u1",
    name: "Churrasco",
    type: "receivable",
    amount: 75,
    due_date: "2026-08-15",
    paid_at: null,
    expense_id: "exp-1",
    installment_group_id: null,
    created_at: "2026-08-10T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkedExpenseData = { id: "exp-1", value: 100 };
    mockLinkedExpenseIsFetched = true;
  });

  it("renderiza participantes e resumo contábil", () => {
    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    expect(screen.getByText("Churrasco de Domingo")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Rafael")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /recebi tudo/i })).toHaveLength(3);
  });

  it("permite dar baixa integral no amigo e atualiza o valor da dívida restante", async () => {
    mockUpdatePublicShare.mockResolvedValueOnce({});
    mockUpdateExpense.mockResolvedValueOnce({});
    mockUpdateDebt.mockResolvedValueOnce({});

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    const settleButtons = screen.getAllByRole("button", { name: /recebi tudo/i });
    expect(settleButtons.length).toBeGreaterThan(0);
    fireEvent.click(settleButtons[0]!);

    await waitFor(() => {
      expect(mockUpdatePublicShare).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "share-123",
          payload: expect.objectContaining({
            total_settled_cents: 2500,
          }),
        })
      );
      // Cobrança a receber diminui de R$ 75 para R$ 50
      expect(mockUpdateDebt).toHaveBeenCalledWith({
        id: "debt-1",
        input: {
          amount: 50,
        },
      });
      // Sincroniza pesos contábeis das despesas
      expect(mockSyncSplitExpenseReportWeights).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: "exp-1",
          totalCents: 10000,
        }),
      );
    });
  });

  it("permite finalizar o racha atualizando a despesa com o peso contábil correto e quitando dívida", async () => {
    mockUpdatePublicShare.mockResolvedValueOnce({});
    mockUpdateExpense.mockResolvedValueOnce({});
    mockSettleDebt.mockResolvedValueOnce({});
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    const finalizeBtn = screen.getByRole("button", { name: /finalizar racha/i });
    fireEvent.click(finalizeBtn);

    const confirmBtn = screen.getByRole("button", { name: /finalizar e quitar cobrança/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSyncSplitExpenseReportWeights).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: "exp-1",
          totalCents: 10000,
        }),
      );
      expect(mockSettleDebt).toHaveBeenCalledWith({
        debtId: "debt-1",
        result: 100,
      });
    });
  });

  it("permite exclusão granular com restauração de 100% na despesa mantida", async () => {
    mockDeletePublicShare.mockResolvedValueOnce({});
    mockUpdateExpense.mockResolvedValueOnce({});
    mockDeleteDebt.mockResolvedValueOnce({});
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /excluir racha/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Escolha quais registros vinculados a este racha você também deseja remover:")).toBeInTheDocument();
    expect(screen.getByText("Link e dados do racha")).toBeInTheDocument();
    expect(screen.getByText("Conta a receber vinculada")).toBeInTheDocument();
    expect(screen.getByText("Despesa original no extrato")).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /confirmar exclusão/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      // Como despesa foi mantida, restaura para 100%
      expect(mockUpdateExpense).toHaveBeenCalledWith({
        id: "exp-1",
        input: {
          report_weight: 1,
        },
      });
      // Dívida vinculada foi excluída (default: true)
      expect(mockDeleteDebt).toHaveBeenCalledWith("debt-1");
      // Racha público foi excluído
      expect(mockDeletePublicShare).toHaveBeenCalledWith("share-123");
    });
  });

  it("permite exclusão total selecionando também a exclusão da despesa original", async () => {
    mockDeletePublicShare.mockResolvedValueOnce({});
    mockDeleteExpense.mockResolvedValueOnce({});
    mockDeleteDebt.mockResolvedValueOnce({});
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /excluir racha/i });
    fireEvent.click(deleteBtn);

    // Marca o checkbox da despesa original
    const expenseCheckbox = screen.getByRole("checkbox", { name: /despesa original no extrato/i });
    fireEvent.click(expenseCheckbox);

    const confirmDeleteBtn = screen.getByRole("button", { name: /confirmar exclusão/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockDeleteAllSplitExpenses).toHaveBeenCalledWith({ expenseId: "exp-1", groupId: null });
      expect(mockDeleteDebt).toHaveBeenCalledWith("debt-1");
      expect(mockDeletePublicShare).toHaveBeenCalledWith("share-123");
    });
  });

  it("permite excluir o racha quando a despesa vinculada ja foi excluida isoladamente", async () => {
    mockDeletePublicShare.mockResolvedValueOnce({});
    mockLinkedExpenseData = null; // Despesa nao existe mais no banco
    mockLinkedExpenseIsFetched = true;
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={null} // Divida tambem ja nao existe
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /excluir racha/i });
    fireEvent.click(deleteBtn);

    // Nao exibe checkbox para a despesa original ja que ela nao existe mais
    expect(screen.queryByRole("checkbox", { name: /despesa original no extrato/i })).not.toBeInTheDocument();
    // Exibe nota informativa de que a despesa vinculada ja foi removida
    expect(screen.getByText("Despesa vinculada já excluída")).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole("button", { name: /confirmar exclusão/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      // Nao tenta restaurar despesa inexistente
      expect(mockUpdateExpense).not.toHaveBeenCalled();
      expect(mockDeleteExpense).not.toHaveBeenCalled();
      // O racha publico e excluido com sucesso
      expect(mockDeletePublicShare).toHaveBeenCalledWith("share-123");
    });
  });

  it("permite excluir o racha mesmo se a restauracao da despesa ou exclusao da divida falhar", async () => {
    mockDeletePublicShare.mockResolvedValueOnce({});
    mockUpdateExpense.mockRejectedValueOnce(new Error("Despesa nao encontrada"));
    mockDeleteDebt.mockRejectedValueOnce(new Error("Divida nao encontrada"));
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={baseDebt}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /excluir racha/i });
    fireEvent.click(deleteBtn);

    const confirmDeleteBtn = screen.getByRole("button", { name: /confirmar exclusão/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      // Mesmo com rejeicao nas operacoes secundarias, o racha principal e removido
      expect(mockDeletePublicShare).toHaveBeenCalledWith("share-123");
    });
  });

  it("exibe a grade de parcelas por amigo e permite baixar individualmente uma parcela", async () => {
    mockUpdatePublicShare.mockResolvedValueOnce({});
    const onOpenChange = vi.fn();

    const shareWithInstallments: PublicShare = {
      ...baseShare,
      payload: {
        ...baseShare.payload,
        installments_count: 2,
        installments_mode: "per_installment",
        participant_installments: [
          {
            id: "p_2_inst_1",
            participant_id: "p_2",
            installment_number: 1,
            total_installments: 2,
            amount_cents: 2500,
            due_date: "2026-08-10",
            is_settled: false,
          },
          {
            id: "p_2_inst_2",
            participant_id: "p_2",
            installment_number: 2,
            total_installments: 2,
            amount_cents: 2500,
            due_date: "2026-09-10",
            is_settled: false,
          },
        ],
      },
    };

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={shareWithInstallments}
      />
    );

    // Deve exibir as parcelas do amigo
    expect(screen.getByText("Parcelas mensais:")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();

    // Clica no botão de baixar a parcela 1
    const baixarParcela1 = screen.getByLabelText("Confirmar recebimento da parcela 1 de Lucas");
    fireEvent.click(baixarParcela1);

    await waitFor(() => {
      expect(mockUpdatePublicShare).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "share-123",
          payload: expect.objectContaining({
            participant_installments: expect.arrayContaining([
              expect.objectContaining({
                id: "p_2_inst_1",
                is_settled: true,
              }),
            ]),
          }),
        }),
      );
      expect(mockSyncSplitExpenseReportWeights).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: "exp-1",
          totalCents: 10000,
          installments: expect.arrayContaining([
            expect.objectContaining({
              id: "p_2_inst_1",
              is_settled: true,
            }),
          ]),
        }),
      );
    });
  });
});
