import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ActiveSplitsCard } from "./active-splits-card";
import type { Debt, PublicShare } from "@/types";

const mockSettleIntegratedReceivable = vi.fn();
let mockPublicShares: PublicShare[] = [];
let mockDebts: Debt[] = [];

vi.mock("@/state", () => ({
  useMyPublicShares: () => ({
    data: mockPublicShares,
    isLoading: false,
  }),
  useDebts: () => ({
    data: mockDebts,
    isLoading: false,
  }),
  useSettleIntegratedReceivable: () => ({
    mutateAsync: mockSettleIntegratedReceivable,
    isPending: false,
  }),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("ActiveSplitsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicShares = [];
    mockDebts = [];
  });

  it("não renderiza nada quando não há rachas ativos", () => {
    const { container } = render(<ActiveSplitsCard month="2026-08" />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza rachas ativos e exibe os dados do racha", () => {
    const mockShare: PublicShare = {
      id: "share-1",
      user_id: "u1",
      token: "tok-123",
      kind: "split",
      created_at: "2026-08-10T12:00:00Z",
      expires_at: null,
      is_revoked: false,
      updated_at: "2026-08-10T12:00:00Z",
      payload: {
        title: "Pizza com a galera",
        total_cents: 10000,
        people_count: 4,
        host_share_cents: 2500,
        guest_share_cents: 2500,
        pix_key: "123.456.788-00",
        pix_key_type: "cpf",
        merchant_name: "Gabriel",
        merchant_city: "Aracaju",
        debt_id: "debt-1",
      },
    };

    const mockDebt: Debt = {
      id: "debt-1",
      user_id: "u1",
      name: "Pizza com a galera",
      type: "receivable",
      amount: 75,
      due_date: "2026-08-15",
      paid_at: null,
      expense_id: "exp-1",
      installment_group_id: null,
      created_at: "2026-08-10T12:00:00Z",
    };

    mockPublicShares = [mockShare];
    mockDebts = [mockDebt];

    render(<ActiveSplitsCard month="2026-08" />);

    expect(screen.getByText("Rachas de Despesa Ativos")).toBeInTheDocument();
    expect(screen.getByText("Pizza com a galera")).toBeInTheDocument();
    expect(screen.getByText(/A receber/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dar baixa/i })).toBeInTheDocument();
  });

  it("chama settleIntegratedReceivable ao clicar em 'Dar Baixa'", async () => {
    mockSettleIntegratedReceivable.mockResolvedValueOnce({ success: true });

    const mockShare: PublicShare = {
      id: "share-1",
      user_id: "u1",
      token: "tok-123",
      kind: "split",
      created_at: "2026-08-10T12:00:00Z",
      expires_at: null,
      is_revoked: false,
      updated_at: "2026-08-10T12:00:00Z",
      payload: {
        title: "Churrasco",
        total_cents: 20000,
        people_count: 2,
        host_share_cents: 10000,
        guest_share_cents: 10000,
        pix_key: "123456",
        debt_id: "debt-2",
      },
    };

    const mockDebt: Debt = {
      id: "debt-2",
      user_id: "u1",
      name: "Churrasco",
      type: "receivable",
      amount: 100,
      due_date: "2026-08-15",
      paid_at: null,
      expense_id: "exp-2",
      installment_group_id: null,
      created_at: "2026-08-10T12:00:00Z",
    };

    mockPublicShares = [mockShare];
    mockDebts = [mockDebt];

    render(<ActiveSplitsCard month="2026-08" />);

    const settleBtn = screen.getByRole("button", { name: /dar baixa/i });
    fireEvent.click(settleBtn);

    await waitFor(() => {
      expect(mockSettleIntegratedReceivable).toHaveBeenCalledWith({
        debtId: "debt-2",
        result: 100,
      });
    });
  });

  it("permite transitar entre blocos com setas exibindo 2 rachas por vez", () => {
    // 3 rachas ativos -> 2 blocos (2 no primeiro, 1 no segundo)
    mockPublicShares = Array.from({ length: 3 }, (_, i) => ({
      id: `share-${i + 1}`,
      user_id: "u1",
      token: `tok-${i + 1}`,
      kind: "split",
      created_at: `2026-08-1${i}T12:00:00Z`,
      expires_at: null,
      is_revoked: false,
      updated_at: `2026-08-1${i}T12:00:00Z`,
      payload: {
        title: `Racha Número ${i + 1}`,
        total_cents: 10000,
        people_count: 2,
        host_share_cents: 5000,
        guest_share_cents: 5000,
        pix_key: "123456",
        debt_id: `debt-${i + 1}`,
      },
    }));

    mockDebts = Array.from({ length: 3 }, (_, i) => ({
      id: `debt-${i + 1}`,
      user_id: "u1",
      name: `Racha Número ${i + 1}`,
      type: "receivable",
      amount: 50,
      due_date: "2026-08-20",
      paid_at: null,
      expense_id: `exp-${i + 1}`,
      installment_group_id: null,
      created_at: `2026-08-1${i}T12:00:00Z`,
    }));

    render(<ActiveSplitsCard month="2026-08" />);

    // Bloco 1: 2 itens visíveis (itens 1 e 2), item 3 não visível
    expect(screen.getByText("Racha Número 1")).toBeInTheDocument();
    expect(screen.getByText("Racha Número 2")).toBeInTheDocument();
    expect(screen.queryByText("Racha Número 3")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();

    // Botão de avançar
    const nextBtn = screen.getByRole("button", { name: /próximo bloco de rachas/i });
    expect(nextBtn).toBeEnabled();

    // Botão de voltar está desabilitado na primeira página
    const prevBtn = screen.getByRole("button", { name: /bloco anterior de rachas/i });
    expect(prevBtn).toBeDisabled();

    // Clica para ir para o próximo bloco
    fireEvent.click(nextBtn);

    // Bloco 2: item 3 visível, itens 1 e 2 não visíveis
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByText("Racha Número 3")).toBeInTheDocument();
    expect(screen.queryByText("Racha Número 1")).not.toBeInTheDocument();

    // Clica para voltar ao bloco anterior
    fireEvent.click(prevBtn);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText("Racha Número 1")).toBeInTheDocument();
  });

  it("ordena rachas pela data de vencimento mais próxima e depois do mais antigo para o mais recente", () => {
    // Racha A: Vence em 2026-08-25
    // Racha B: Vence em 2026-08-15 (mais próximo)
    // Racha C: Sem vencimento, criado em 2026-08-01 (mais antigo)
    // Racha D: Sem vencimento, criado em 2026-08-10 (mais recente)
    mockPublicShares = [
      {
        id: "share-a",
        user_id: "u1",
        token: "tok-a",
        kind: "split",
        created_at: "2026-08-05T10:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-08-05T10:00:00Z",
        payload: { title: "Racha Vence Tarde", total_cents: 10000, debt_id: "debt-a" },
      },
      {
        id: "share-b",
        user_id: "u1",
        token: "tok-b",
        kind: "split",
        created_at: "2026-08-06T10:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-08-06T10:00:00Z",
        payload: { title: "Racha Vence Cedo", total_cents: 10000, debt_id: "debt-b" },
      },
      {
        id: "share-c",
        user_id: "u1",
        token: "tok-c",
        kind: "split",
        created_at: "2026-08-01T10:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-08-01T10:00:00Z",
        payload: { title: "Racha Sem Venc Antigo", total_cents: 10000 },
      },
      {
        id: "share-d",
        user_id: "u1",
        token: "tok-d",
        kind: "split",
        created_at: "2026-08-10T10:00:00Z",
        expires_at: null,
        is_revoked: false,
        updated_at: "2026-08-10T10:00:00Z",
        payload: { title: "Racha Sem Venc Recente", total_cents: 10000 },
      },
    ];

    mockDebts = [
      {
        id: "debt-a",
        user_id: "u1",
        name: "Racha Vence Tarde",
        type: "receivable",
        amount: 50,
        due_date: "2026-08-25",
        paid_at: null,
        created_at: "2026-08-05T10:00:00Z",
        expense_id: null,
        installment_group_id: null,
      },
      {
        id: "debt-b",
        user_id: "u1",
        name: "Racha Vence Cedo",
        type: "receivable",
        amount: 50,
        due_date: "2026-08-15",
        paid_at: null,
        created_at: "2026-08-06T10:00:00Z",
        expense_id: null,
        installment_group_id: null,
      },
    ];

    render(<ActiveSplitsCard month="2026-08" />);

    // Bloco 1 (2 itens): os dois primeiros ordenados devem ser:
    // 1º: Racha Vence Cedo (15/08)
    // 2º: Racha Vence Tarde (25/08)
    expect(screen.getByText("Racha Vence Cedo")).toBeInTheDocument();
    expect(screen.getByText("Racha Vence Tarde")).toBeInTheDocument();
    expect(screen.queryByText("Racha Sem Venc Antigo")).not.toBeInTheDocument();

    // Avança para o Bloco 2
    const nextBtn = screen.getByRole("button", { name: /próximo bloco de rachas/i });
    fireEvent.click(nextBtn);

    // Bloco 2: os dois sem vencimento, do mais antigo para o mais recente:
    // 3º: Racha Sem Venc Antigo (01/08)
    // 4º: Racha Sem Venc Recente (10/08)
    expect(screen.getByText("Racha Sem Venc Antigo")).toBeInTheDocument();
    expect(screen.getByText("Racha Sem Venc Recente")).toBeInTheDocument();
  });
});
