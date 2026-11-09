import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { formatCentsAsBRL } from "@/services/masks/money";
import { buildTripSettlementWhatsAppMessage } from "@/domain/trips";
import { TripSettlementDialog } from "./trip-settlement-dialog";
import type { SuggestedSettlement, TripSettlement, TripMember, TripExpense } from "@/types/trips";

const mutateExpenseMock = vi.fn();
const mutateIncomeMock = vi.fn();
const mutateRecordMock = vi.fn();
const mutateConfirmMock = vi.fn();
const mutateRecordSingleMock = vi.fn();
const mutateReopenMock = vi.fn();
const mutateUpdateTripMock = vi.fn();

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { id: "user-alice", email: "alice@example.com" } },
  }),
}));

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-viagem", name: "Viagem e Turismo", color: "#3b82f6", icon: "plane" },
      { id: "cat-reembolso", name: "Reembolsos Recebidos", color: "#10b981", icon: "arrow-down-left" },
    ],
  }),
  useCreateExpense: () => ({
    mutateAsync: mutateExpenseMock,
    isPending: false,
  }),
  useCreateIncome: () => ({
    mutateAsync: mutateIncomeMock,
    isPending: false,
  }),
}));

vi.mock("@/state/queries/use-trips", () => ({
  useRecordTripSettlementsMutation: () => ({
    mutateAsync: mutateRecordMock,
    isPending: false,
  }),
  useConfirmTripSettlementMutation: () => ({
    mutateAsync: mutateConfirmMock,
    mutate: mutateConfirmMock,
    isPending: false,
  }),
  useRecordSingleTripSettlementMutation: () => ({
    mutateAsync: mutateRecordSingleMock,
    mutate: mutateRecordSingleMock,
    isPending: false,
  }),
  useReopenTripSettlementMutation: () => ({
    mutateAsync: mutateReopenMock,
    mutate: mutateReopenMock,
    isPending: false,
  }),
  useUpdateTripMutation: () => ({
    mutateAsync: mutateUpdateTripMock,
    mutate: mutateUpdateTripMock,
    isPending: false,
  }),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

describe("buildTripSettlementWhatsAppMessage", () => {
  const members: TripMember[] = [
    { id: "m-1", trip_id: "trip-1", user_id: "user-alice", name: "Alice", is_host: true, pix_key: "alice@pix.me", pix_key_type: "email", created_at: "" },
    { id: "m-2", trip_id: "trip-1", user_id: "user-bob", name: "Bob", is_host: false, pix_key: "11999999999", pix_key_type: "phone", created_at: "" },
    { id: "m-3", trip_id: "trip-1", user_id: null, name: "Carlos", is_host: false, pix_key: null, pix_key_type: null, created_at: "" },
  ];

  const expenses: TripExpense[] = [
    {
      id: "e-1",
      trip_id: "trip-1",
      paid_by_member_id: "m-1",
      amount_cents: 30000,
      description: "Aluguel Casa",
      category_name: "Hospedagem",
      expense_date: "2026-11-01",
      split_type: "equal",
      receipt_url: null,
      created_by_member_id: "m-1",
      linked_personal_expense_id: null,
      created_at: "",
      updated_at: "",
      splits: [],
    },
  ];

  it("gera mensagem com contas 100% equilibradas quando não há transferências pendentes", () => {
    const text = buildTripSettlementWhatsAppMessage({
      tripTitle: "Praia de Ubatuba",
      suggestedSettlements: [],
      existingSettlements: [],
      members,
      expenses,
      publicToken: "token-ubatuba",
    });

    expect(text).toContain("Praia de Ubatuba");
    expect(text).toContain(`Total de Gastos Coletivos: ${formatCentsAsBRL(30000)}`);
    expect(text).toContain("Todas as contas estao perfeitamente equilibradas e quitadas!");
    expect(text).toContain("viagem/token-ubatuba");
  });

  it("formata transferências pendentes com chave Pix e acertos já quitados sem emojis decorativos", () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-2",
        fromMemberName: "Bob",
        toMemberId: "m-1",
        toMemberName: "Alice",
        amountCents: 15000,
        toPixKey: "alice@pix.me",
        toPixKeyType: "email",
      },
    ];

    const existing: TripSettlement[] = [
      {
        id: "s-1",
        trip_id: "trip-1",
        from_member_id: "m-3",
        to_member_id: "m-1",
        amount_cents: 5000,
        status: "confirmed",
        confirmed_at: "2026-11-02",
        pix_transaction_id: null,
        created_at: "",
      },
    ];

    const text = buildTripSettlementWhatsAppMessage({
      tripTitle: "Praia de Ubatuba",
      suggestedSettlements: suggested,
      existingSettlements: existing,
      members,
      expenses,
      publicToken: "token-ubatuba",
    });

    expect(text).toContain(`[OK] Carlos pagou ${formatCentsAsBRL(5000)} para Alice`);
    expect(text).toContain(`- Bob transfere ${formatCentsAsBRL(15000)} para Alice (Chave Pix [email]: alice@pix.me)`);
    expect(text).not.toMatch(/[\u2190-\u21ff\u2300-\u23ff\u25a0-\u27bf\u2b00-\u2bff]/);
  });
});

describe("TripSettlementDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  const members: TripMember[] = [
    { id: "m-alice", trip_id: "trip-1", user_id: "user-alice", name: "Alice", is_host: true, pix_key: "alice@pix", pix_key_type: "email", created_at: "" },
    { id: "m-bob", trip_id: "trip-1", user_id: "user-bob", name: "Bob", is_host: false, pix_key: "bob@pix", pix_key_type: "email", created_at: "" },
  ];

  it("renderiza empty state quando todas as contas estão equilibradas", () => {
    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={[]}
        existingSettlements={[]}
        members={members}
      />
    );

    expect(screen.getByText("Contas 100% equilibradas")).toBeInTheDocument();
  });

  it("permite copiar código Pix Copia e Cola com valor e fallback só a chave", async () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 8500,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={suggested}
        existingSettlements={[]}
        members={members}
      />
    );

    const copyBtn = screen.getByRole("button", { name: /Copiar Pix/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("000201")
    );
    await waitFor(() => {
      expect(screen.getByText("Copiado!")).toBeInTheDocument();
    });

    // Testar cópia da chave crua
    const rawKeyBtn = screen.getByRole("button", { name: /Só a chave/i });
    fireEvent.click(rawKeyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("alice@pix");
  });

  it("fluxo do devedor: exibe badge Você e botão 'Pagar Pix e Registrar no Meu Extrato'", async () => {
    // Alice deve para Bob
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-alice",
        fromMemberName: "Alice",
        toMemberId: "m-bob",
        toMemberName: "Bob",
        amountCents: 12000,
        toPixKey: "bob@pix",
        toPixKeyType: "email",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={suggested}
        existingSettlements={[]}
        members={members}
      />
    );

    // Alice é o usuário logado (user-alice -> m-alice), portanto devedor
    expect(screen.getByText(/Voc[eê]/i)).toBeInTheDocument();
    const payBtn = screen.getByRole("button", { name: /Pagar Pix e Registrar no Meu Extrato/i });
    expect(payBtn).toBeInTheDocument();

    // Clica para expandir opções
    fireEvent.click(payBtn);

    expect(screen.getByText("Registrar despesa pessoal no extrato")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /Confirmar Pagamento e Lançamento/i });

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mutateExpenseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 120,
          paymentMethod: "pix",
          description: expect.stringContaining("Bob"),
          reportWeight: 1,
        })
      );
      expect(mutateRecordSingleMock).toHaveBeenCalled();
    });
  });

  it("fluxo do credor: permite registrar reembolso no extrato com report_weight = 0", async () => {
    // Bob deve para Alice (usuária logada)
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 9000,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    const existing: TripSettlement[] = [
      {
        id: "settle-1",
        trip_id: "trip-1",
        from_member_id: "m-bob",
        to_member_id: "m-alice",
        amount_cents: 9000,
        status: "confirmed",
        confirmed_at: "2026-11-02",
        pix_transaction_id: null,
        created_at: "",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={suggested}
        existingSettlements={existing}
        members={members}
      />
    );

    const syncIncomeBtn = screen.getByRole("button", { name: /Registrar Reembolso/i });
    expect(syncIncomeBtn).toBeInTheDocument();

    fireEvent.click(syncIncomeBtn);

    await waitFor(() => {
      expect(mutateIncomeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 90,
          report_weight: 0,
          receive_type: "pix",
          description: expect.stringContaining("Bob"),
        })
      );
    });
  });

  it("abre link do WhatsApp ao clicar no botão de compartilhar", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={[]}
        existingSettlements={[]}
        members={members}
        publicToken="serra-2026"
      />
    );

    const shareBtn = screen.getByRole("button", { name: /Compartilhar no WhatsApp/i });
    fireEvent.click(shareBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining("api.whatsapp.com/send"),
      "_blank"
    );
  });

  it("exibe QR Code ao clicar no botão de QR Code", () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 5000,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={suggested}
        existingSettlements={[]}
        members={members}
      />
    );

    const qrBtn = screen.getByRole("button", { name: /QR Code/i });
    fireEvent.click(qrBtn);

    expect(screen.getByText(/Aponte a câmera do aplicativo bancário/i)).toBeInTheDocument();
  });

  it("permite marcar acerto isolado como Acertado", async () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 5000,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        suggestedSettlements={suggested}
        existingSettlements={[]}
        members={members}
      />
    );

    const settleBtn = screen.getByRole("button", { name: /Marcar como Acertado/i });
    fireEvent.click(settleBtn);

    await waitFor(() => {
      expect(mutateRecordSingleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fromMemberId: "m-bob",
          toMemberId: "m-alice",
          amountCents: 5000,
          status: "confirmed",
        })
      );
    });
  });

  it("permite ao organizador ou credor reabrir/desfazer acerto quitado", async () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 5000,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    const existing: TripSettlement[] = [
      {
        id: "s-1",
        trip_id: "trip-1",
        from_member_id: "m-bob",
        to_member_id: "m-alice",
        amount_cents: 5000,
        status: "confirmed",
        confirmed_at: "2026-11-02",
        pix_transaction_id: null,
        created_at: "",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        isHost={true}
        suggestedSettlements={suggested}
        existingSettlements={existing}
        members={members}
      />
    );

    expect(screen.getByText("Acertado")).toBeInTheDocument();
    const undoBtn = screen.getByRole("button", { name: /Desfazer/i });
    fireEvent.click(undoBtn);

    await waitFor(() => {
      expect(mutateReopenMock).toHaveBeenCalledWith("s-1");
    });
  });

  it("exibe botão Finalizar Viagem para o organizador quando todas as contas foram quitadas e chama updateTripMutation", async () => {
    const suggested: SuggestedSettlement[] = [
      {
        fromMemberId: "m-bob",
        fromMemberName: "Bob",
        toMemberId: "m-alice",
        toMemberName: "Alice",
        amountCents: 5000,
        toPixKey: "alice@pix",
        toPixKeyType: "email",
      },
    ];

    const existing: TripSettlement[] = [
      {
        id: "s-1",
        trip_id: "trip-1",
        from_member_id: "m-bob",
        to_member_id: "m-alice",
        amount_cents: 5000,
        status: "confirmed",
        confirmed_at: "2026-11-02",
        pix_transaction_id: null,
        created_at: "",
      },
    ];

    render(
      <TripSettlementDialog
        open={true}
        onOpenChange={vi.fn()}
        tripId="trip-1"
        tripTitle="Viagem Serra"
        tripStatus="active"
        isHost={true}
        suggestedSettlements={suggested}
        existingSettlements={existing}
        members={members}
      />
    );

    expect(screen.getByText("Todas as contas foram quitadas e equilibradas!")).toBeInTheDocument();
    const finalizeBtn = screen.getByRole("button", { name: /Finalizar Viagem/i });
    expect(finalizeBtn).toBeInTheDocument();

    fireEvent.click(finalizeBtn);

    await waitFor(() => {
      expect(mutateUpdateTripMock).toHaveBeenCalledWith({
        tripId: "trip-1",
        input: { status: "completed" },
      });
    });
  });
});
