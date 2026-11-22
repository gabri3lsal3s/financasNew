import { render as originalRender, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ManageSplitDialog } from "./manage-split-dialog";
import type { Debt, PublicShare } from "@/types";

function render(ui: React.ReactElement, options?: Parameters<typeof originalRender>[1]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return originalRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options,
  );
}

const mockApplySplitSettlement = vi.fn();
const mockUpdateSplitComprehensive = vi.fn();
const mockDeleteLinkedSplit = vi.fn();
const mockDismissSignal = vi.fn();
let mockLinkedExpenseData: unknown = { id: "exp-1", value: 100, installments_total: 1 };
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
  useApplySplitSettlement: () => ({
    mutateAsync: mockApplySplitSettlement,
    isPending: false,
  }),
  useUpdateSplitComprehensive: () => ({
    mutateAsync: mockUpdateSplitComprehensive,
    isPending: false,
  }),
  useDeleteLinkedSplit: () => ({
    mutateAsync: mockDeleteLinkedSplit,
    isPending: false,
  }),
  useDismissSplitPaymentSignal: () => ({
    mutateAsync: mockDismissSignal,
    isPending: false,
  }),
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
    expense_id: "exp-1",
    installment_group_id: null,
    debt_id: "debt-1",
    created_at: "2026-08-10T12:00:00Z",
    updated_at: "2026-08-10T12:00:00Z",
    expires_at: "2026-10-10T12:00:00Z",
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
      pix_key: "gabriel@exemplo.com",
      pix_key_type: "email",
      host_name: "Gabriel",
      host_city: "ARACAJU",
      remainder_policy: "host",
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
    name: "Racha: Churrasco de Domingo",
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
    mockLinkedExpenseData = { id: "exp-1", value: 100, installments_total: 1 };
    mockLinkedExpenseIsFetched = true;
    mockApplySplitSettlement.mockResolvedValue({
      share: baseShare,
      transition: { hostNetCostCents: 7500 },
      debt: baseDebt,
    });
    mockUpdateSplitComprehensive.mockResolvedValue({
      share: baseShare,
      result: { nextPayload: baseShare.payload },
      debt: baseDebt,
    });
    mockDeleteLinkedSplit.mockResolvedValue({ deletedExpense: false });
    mockDismissSignal.mockResolvedValue({ success: true });
  });

  it("renderiza as 3 abas canônicas, participantes e resumo contábil", () => {
    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    expect(screen.getByText("Churrasco de Domingo")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Baixas/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Editar Racha/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Pix e Página/i })).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Mariana")).toBeInTheDocument();
    expect(screen.getByText("Rafael")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /recebi tudo/i })).toHaveLength(3);
  });

  it("permite dar baixa integral no amigo via useApplySplitSettlement", async () => {
    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    const settleButtons = screen.getAllByRole("button", { name: /recebi tudo/i });
    fireEvent.click(settleButtons[0]!);

    await waitFor(() => {
      expect(mockApplySplitSettlement).toHaveBeenCalledWith({
        share: baseShare,
        action: { type: "settle_full_participant", participantId: "p_2" },
        linkedDebt: baseDebt,
        installmentsTotal: 1,
      });
    });
  });

  it("permite finalizar o racha via finalize_as_is ou quitar todos com Recebi Tudo", async () => {
    const onOpenChange = vi.fn();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={onOpenChange}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /finalizar racha/i }));
    fireEvent.click(screen.getByRole("button", { name: /finalizar e quitar cobrança/i }));

    await waitFor(() => {
      expect(mockApplySplitSettlement).toHaveBeenCalledWith({
        share: baseShare,
        action: { type: "finalize_as_is" },
        linkedDebt: baseDebt,
        installmentsTotal: 1,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("permite exclusão granular mantendo a despesa ou excluindo tudo via useDeleteLinkedSplit", async () => {
    const { unmount } = render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir racha/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar exclusão/i }));

    await waitFor(() => {
      expect(mockDeleteLinkedSplit).toHaveBeenCalledWith({
        share: baseShare,
        linkedDebt: baseDebt,
        deleteExpense: false,
      });
    });

    unmount();
    vi.clearAllMocks();

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /excluir racha/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /despesa original no extrato/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar exclusão/i }));

    await waitFor(() => {
      expect(mockDeleteLinkedSplit).toHaveBeenCalledWith({
        share: baseShare,
        linkedDebt: baseDebt,
        deleteExpense: true,
      });
    });
  });

  it("exibe avisos de pagamento pendentes inline e permite confirmar ou recusar", async () => {
    const shareWithSignals: PublicShare = {
      ...baseShare,
      payload: {
        ...baseShare.payload,
        payment_signals: [
          {
            id: "sig-9",
            participant_id: "p_2",
            participant_name: "Lucas",
            amount_cents: 2500,
            status: "pending",
            created_at: "2026-08-10T15:00:00Z",
          },
        ],
      },
    };

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={shareWithSignals}
        linkedDebt={baseDebt}
      />,
    );

    expect(screen.getByText(/Avisos de Pix Aguardando Confirmação/i)).toBeInTheDocument();
    expect(screen.getByText("Lucas informou pagamento")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));
    await waitFor(() => {
      expect(mockApplySplitSettlement).toHaveBeenCalledWith({
        share: shareWithSignals,
        action: { type: "confirm_signal", signalId: "sig-9" },
        linkedDebt: baseDebt,
        installmentsTotal: 1,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /Recusar/i }));
    await waitFor(() => {
      expect(mockDismissSignal).toHaveBeenCalledWith({
        shareId: "share-123",
        signalId: "sig-9",
      });
    });
  });

  it("exibe a grade de parcelas e permite baixar parcela individualmente", async () => {
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
        onOpenChange={vi.fn()}
        share={shareWithInstallments}
      />,
    );

    const baixarParcela1 = screen.getByLabelText("Confirmar recebimento da parcela 1 de Lucas");
    fireEvent.click(baixarParcela1);

    await waitFor(() => {
      expect(mockApplySplitSettlement).toHaveBeenCalledWith({
        share: shareWithInstallments,
        action: { type: "toggle_installment", installmentId: "p_2_inst_1", markSettled: true },
        linkedDebt: undefined,
        installmentsTotal: 2,
      });
    });
  });

  it("ativa calculadora apenas ao abrir Outro Valor na aba Baixas e permite editar na aba Editar Racha", async () => {
    const user = userEvent.setup();
    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={baseShare}
        linkedDebt={baseDebt}
      />,
    );

    expect(screen.queryByRole("button", { name: "Abrir calculadora" })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /outro valor/i })[0]!);
    expect(screen.getByRole("button", { name: "Abrir calculadora" })).toBeInTheDocument();

    // Navega para aba Editar Racha e salva alteração
    await user.click(screen.getByRole("tab", { name: /Editar Racha/i }));
    const titleInput = screen.getByLabelText("Nome do racha");
    fireEvent.change(titleInput, { target: { value: "Churrasco da Equipe" } });
    await user.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    await waitFor(() => {
      expect(mockUpdateSplitComprehensive).toHaveBeenCalledWith(
        expect.objectContaining({
          share: baseShare,
          syncExpense: true,
          edit: expect.objectContaining({
            title: "Churrasco da Equipe",
          }),
        }),
      );
    });
  });

  it("permite reabrir um racha concluído", async () => {
    const completedShare: PublicShare = {
      ...baseShare,
      is_revoked: true,
      payload: {
        ...baseShare.payload,
        is_completed: true,
      },
    };

    render(
      <ManageSplitDialog
        open={true}
        onOpenChange={vi.fn()}
        share={completedShare}
        linkedDebt={baseDebt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Reabrir Racha/i }));
    await waitFor(() => {
      expect(mockApplySplitSettlement).toHaveBeenCalledWith({
        share: completedShare,
        action: { type: "reopen" },
        linkedDebt: baseDebt,
        installmentsTotal: 1,
      });
    });
  });
});
