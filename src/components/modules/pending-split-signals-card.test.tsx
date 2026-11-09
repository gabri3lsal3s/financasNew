import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PendingSplitSignalsCard } from "./pending-split-signals-card";
import { syncSplitExpenseReportWeights } from "@/services/split-sync";
import type { PublicShare, SplitSharePayload } from "@/types";

const mockUpdateShare = vi.fn().mockResolvedValue({});
const mockUpdateExpense = vi.fn().mockResolvedValue({});
const mockSettleDebt = vi.fn().mockResolvedValue({});
const mockDismissSignal = vi.fn().mockResolvedValue({});

let mockSharesData: PublicShare[] = [];

vi.mock("@/state", () => ({
  useMyPublicShares: () => ({ data: mockSharesData }),
  useDebts: () => ({ data: [] }),
  useUpdatePublicShare: () => ({ mutateAsync: mockUpdateShare }),
  useUpdateExpense: () => ({ mutateAsync: mockUpdateExpense }),
  useUpdateDebt: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
  useSettleIntegratedReceivable: () => ({ mutateAsync: mockSettleDebt }),
  useDismissSplitPaymentSignal: () => ({ mutateAsync: mockDismissSignal }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/split-sync", () => ({
  syncSplitExpenseReportWeights: vi.fn().mockResolvedValue({ updatedCount: 1, groupId: null }),
}));

describe("PendingSplitSignalsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSharesData = [];
  });

  it("não renderiza nada quando não há sinais pendentes", () => {
    mockSharesData = [];
    const { container } = render(<PendingSplitSignalsCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza sinais pendentes e permite abater", async () => {
    const payload: SplitSharePayload = {
      title: "Jantar de Amigos",
      total_cents: 10000,
      date: "2026-11-05",
      people_count: 2,
      guest_share_cents: 5000,
      host_share_cents: 5000,
      expense_id: "exp-123",
      remainder_policy: "balanced",
      host_name: "Gabriel",
      host_city: "São Paulo",
      pix_key: "gabriel@test.com",
      pix_key_type: "email",
      pix_br_code: "000201...",
      participants: [
        { id: "p-1", name: "Anfitrião", share_cents: 5000, is_host: true, is_settled: true },
        { id: "p-2", name: "Lucas", share_cents: 5000, is_host: false, is_settled: false, has_payment_signal: true },
      ],
      payment_signals: [
        {
          id: "sig-1",
          participant_name: "Lucas",
          participant_id: "p-2",
          amount_cents: 5000,
          created_at: "2026-11-05T19:00:00Z",
          status: "pending",
        },
      ],
    };

    mockSharesData = [
      {
        id: "share-1",
        user_id: "user-1",
        kind: "split",
        token: "tok123",
        payload: payload as unknown as Record<string, unknown>,
        created_at: "2026-11-05T18:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-11-05T18:00:00Z",
      },
    ];

    render(<PendingSplitSignalsCard />);

    expect(screen.getByText("Pagamento de Racha Sinalizado")).toBeInTheDocument();
    expect(screen.getByText("Lucas")).toBeInTheDocument();
    expect(screen.getByText("Jantar de Amigos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abater/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ainda não recebi/i })).toBeInTheDocument();

    const abaterBtn = screen.getByRole("button", { name: /abater/i });
    fireEvent.click(abaterBtn);

    await waitFor(() => {
      expect(mockUpdateShare).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "share-1",
          payload: expect.objectContaining({
            total_settled_cents: 5000,
            is_completed: true,
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(syncSplitExpenseReportWeights).toHaveBeenCalledWith(
        expect.objectContaining({
          expenseId: "exp-123",
          totalCents: 10000,
        }),
      );
    });
  });

  it("permite desconsiderar sinal com 'Ainda não recebi'", async () => {
    const payload: SplitSharePayload = {
      title: "Churrasco",
      total_cents: 12000,
      date: "2026-11-05",
      people_count: 3,
      guest_share_cents: 4000,
      host_share_cents: 4000,
      remainder_policy: "balanced",
      host_name: "Gabriel",
      host_city: "São Paulo",
      pix_key: "gabriel@test.com",
      pix_key_type: "email",
      pix_br_code: "000201...",
      participants: [
        { id: "p-1", name: "Anfitrião", share_cents: 4000, is_host: true, is_settled: true },
        { id: "p-2", name: "Mariana", share_cents: 4000, is_host: false, is_settled: false, has_payment_signal: true },
      ],
      payment_signals: [
        {
          id: "sig-99",
          participant_name: "Mariana",
          participant_id: "p-2",
          amount_cents: 4000,
          created_at: "2026-11-05T19:00:00Z",
          status: "pending",
        },
      ],
    };

    mockSharesData = [
      {
        id: "share-2",
        user_id: "user-1",
        kind: "split",
        token: "tok456",
        payload: payload as unknown as Record<string, unknown>,
        created_at: "2026-11-05T18:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-11-05T18:00:00Z",
      },
    ];

    render(<PendingSplitSignalsCard />);

    const dismissBtn = screen.getByRole("button", { name: /ainda não recebi/i });
    fireEvent.click(dismissBtn);

    expect(mockDismissSignal).toHaveBeenCalledWith({
      shareId: "share-2",
      signalId: "sig-99",
    });
  });
});
