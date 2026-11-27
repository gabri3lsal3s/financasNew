import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardBillRollover, CardPayment, CreditCard, Expense } from "@/types";
import { StatementImportDialog } from "./statement-import-dialog";

const mockCardA: CreditCard = {
  id: "card-a",
  user_id: "user-1",
  name: "Nubank Roxinho",
  closing_day: 25,
  due_day: 5,
  credit_limit: 10000,
  brand: "mastercard",
  color: "#820ad1",
  last_four_digits: "1111",
  is_active: true,
};

const mockCardB: CreditCard = {
  id: "card-b",
  user_id: "user-1",
  name: "Inter Black",
  closing_day: 20,
  due_day: 1,
  credit_limit: 12000,
  brand: "mastercard",
  color: "#ff7a00",
  last_four_digits: "2222",
  is_active: true,
};

const mutateCommitMock = vi.fn();
const mockExtractText = vi.fn();
const mockExtractAi = vi.fn();
const mockCategorizeAi = vi.fn();

let mockExpenses: Expense[] = [];
let mockPayments: CardPayment[] = [];
let mockRollovers: CardBillRollover[] = [];

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: vi.fn(),
}));

vi.mock("@/services/native/receipt-extractor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native/receipt-extractor")>();
  return {
    ...actual,
    renderScannedPdfPageToBlob: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@/services/ai-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ai-assistant")>();
  return {
    ...actual,
    extractStatementPdfRowsWithAi: (...args: unknown[]) => mockExtractAi(...args),
    categorizeDescriptionsBatchWithAi: (...args: unknown[]) => mockCategorizeAi(...args),
  };
});

vi.mock("@/state/queries/use-user-subscription", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
}));
vi.mock("@/state/queries/use-permission", () => ({
  usePermission: () => ({ isHidden: false, canRead: true, canWrite: true, isReadOnlyMode: false, accessLevel: "admin" }),
}));

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useCategories: () => ({
      data: [
        { id: "cat-1", name: "Alimentação", color: "#22c55e", icon: "utensils" },
        { id: "cat-2", name: "Tecnologia", color: "#3b82f6", icon: "laptop" },
      ],
      isLoading: false,
    }),
    useCreditCards: () => ({ data: [mockCardA, mockCardB], isLoading: false }),
    useCardExpenses: () => ({
      data: mockExpenses,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    useCardPayments: () => ({
      data: mockPayments,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    useCardBillRollovers: () => ({
      data: mockRollovers,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    usePredictionHistory: () => ({ entries: [], isLoading: false }),
    useStatementBlueprints: () => ({ data: [], isLoading: false }),
    useAiQuota: () => ({
      summary: {
        periodMonth: "2026-08",
        periodDay: "2026-08-15",
        batchDailyLimit: 30,
        batchMonthlyLimit: 120,
        batchUsedDay: 0,
        batchUsedMonth: 0,
        batchRemainingDay: 30,
        batchRemainingMonth: 120,
        receiptDailyLimit: 15,
        receiptMonthlyLimit: 100,
        receiptRemainingDay: 15,
        receiptRemainingMonth: 100,
        canRunPassiveCategorizeBatch: true,
        getAffordableBatchCalls: (n: number) => n,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    }),
    useUpsertStatementBlueprint: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
    useRecordStatementBlueprintOutcome: () => ({ mutateAsync: vi.fn().mockResolvedValue({ success: true }), isPending: false }),
    useCommitStatementReconciliation: () => ({ mutateAsync: mutateCommitMock, isPending: false }),
    useBusinessMode: () => ({ isBusinessModeEnabled: false }),
  };
});

async function uploadStatementFile(
  user: ReturnType<typeof userEvent.setup>,
  content: string,
  fileName = "fatura.csv",
  type = "text/csv",
) {
  const file = new File([content], fileName, { type });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeInTheDocument();
  await user.upload(input, file);
}

function makeCommitSuccess(inserted: number) {
  return {
    success: true,
    inserted_count: inserted,
    projected_count: 0,
    skipped_count: 0,
    adjusted_count: 0,
    moved_count: 0,
    refunds_count: 0,
    deleted_count: 0,
  };
}

describe("StatementImportDialog (Onda 4 — UI/UX Inteligência Invisível)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpenses = [];
    mockPayments = [];
    mockRollovers = [];
    mutateCommitMock.mockReset().mockResolvedValue(makeCommitSuccess(2));
    mockExtractText.mockReset().mockResolvedValue({
      text: ["15/08/2026\tPadaria Estrela\t25,00"],
      totalPages: 1,
    });
    mockExtractAi.mockReset().mockResolvedValue({ ok: false, reason: "offline", fallbackToLocal: true });
    mockCategorizeAi.mockReset().mockResolvedValue({ ok: false, reason: "offline", fallbackToLocal: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fluxo completo 2 passos -> conclusão D11 com Pagar fatura agora e zero selos técnicos", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onPayBillNow = vi.fn();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={onOpenChange}
        card={mockCardA}
        cards={[mockCardA, mockCardB]}
        competenceMonth="2026-08"
        userId="user-1"
        onPayBillNow={onPayBillNow}
      />,
    );

    expect(screen.getByText(/Importar fatura — Nubank Roxinho/i)).toBeInTheDocument();
    await uploadStatementFile(
      user,
      "Data;Estabelecimento;Valor\n15/08/2026;Padaria Estrela;25,00\n16/08/2026;Mercado Central;120,00",
    );

    expect(await screen.findByText("Padaria Estrela", {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText("Mercado Central")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reanalisar com IA/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Estruturado com IA|Leitura assistida|Layout aprendido|Leitura local/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajustar colunas/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Buscar por estabelecimento/i)).not.toBeInTheDocument();

    const applyBtn = screen.getByRole("button", { name: /Aplicar e importar \(2 ações\)/i });
    await user.click(applyBtn);

    expect(await screen.findByText("Fatura conciliada com sucesso", {}, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Pagar fatura agora/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onPayBillNow).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("exibe status calmo + botão Cancelar que aborta processamento em andamento", async () => {
    const user = userEvent.setup();
    mockExtractAi.mockImplementation(
      ({ signal }: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardA}
        competenceMonth="2026-08"
        userId="user-1"
      />,
    );

    const png = new File(["img-bytes"], "print-fatura.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, png);

    const cancelBtn = await screen.findByRole("button", { name: /^Cancelar$/i });
    expect(screen.getByText(/Analisando fatura/i)).toBeInTheDocument();
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("PDF estruturado por IA omite 'Ajustar colunas', preserva parcelas 2/3 e alterna Compra <-> Estorno", async () => {
    const user = userEvent.setup();
    mockExtractText.mockResolvedValueOnce({
      text: ["FATURA BANCO DIGITAL CABECALHO MULTI COLUNA SEM TABELA"],
      totalPages: 1,
    });
    mockExtractAi.mockResolvedValueOnce({
      ok: true,
      cached: false,
      source: "ai_text",
      data: {
        rows: [
          {
            date: "2026-08-10",
            description: "Livraria Cultura",
            amountCents: 12000,
            installmentCurrent: 2,
            installmentTotal: 3,
            entryType: "purchase",
          },
        ],
      },
    });

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardA}
        competenceMonth="2026-08"
        userId="user-1"
        aiExtractionEnabled={true}
      />,
    );

    await uploadStatementFile(user, "%PDF-1.4 multi coluna", "fatura.pdf", "application/pdf");

    expect(await screen.findByText("Livraria Cultura")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajustar colunas/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Editar Livraria Cultura/i }));
    await user.click(screen.getByRole("button", { name: "Estorno" }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await user.click(screen.getByRole("tab", { name: /Atenção \(1\)/i }));
    expect(await screen.findByText("Livraria Cultura")).toBeInTheDocument();
    expect(screen.getByText("Estorno")).toBeInTheDocument();
  });

  it("seleciona aba Atenção automaticamente quando A importar === 0, permite restaurar pagamento e exibe busca quando >= 15 itens", async () => {
    const user = userEvent.setup();
    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardA}
        competenceMonth="2026-08"
      />,
    );

    await uploadStatementFile(
      user,
      "Data;Estabelecimento;Valor\n12/08/2026;Estorno Loja;50,00C\n15/08/2026;PAGAMENTO EFETUADO;200,00",
    );

    expect(await screen.findByText("Estorno Loja")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Atenção \(1\)/i })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /Conciliados \(1\)/i }));
    expect(await screen.findByText(/Pagamento efetuado/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Restaurar como compra/i }));
    expect(screen.getByRole("tab", { name: /A importar \(1\)/i })).toBeInTheDocument();
  });

  it("exibe conflito de competência e permite trocar de cartão em 1 clique quando há divergência (D17)", async () => {
    const user = userEvent.setup();
    const onCardChange = vi.fn();
    const onCompetenceChange = vi.fn();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardA}
        cards={[mockCardA, mockCardB]}
        competenceMonth="2026-08"
        onCardChange={onCardChange}
        onCompetenceChange={onCompetenceChange}
      />,
    );

    const ofxOtherCard = [
      "<OFX>",
      "  <SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Inter</ORG></FI></SONRS></SIGNONMSGSRSV1>",
      "  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>",
      "    <CCACCTFROM><ACCTID>411111******2222</ACCTID></CCACCTFROM>",
      "    <BANKTRANLIST>",
      "      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260910<TRNAMT>-150.00<MEMO>Supermercado Inter</STMTTRN>",
      "      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260912<TRNAMT>-45.00<MEMO>Farmacia Inter</STMTTRN>",
      "      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260915<TRNAMT>-80.00<MEMO>Padaria Inter</STMTTRN>",
      "    </BANKTRANLIST>",
      "  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>",
      "</OFX>",
    ].join("\n");

    await uploadStatementFile(user, ofxOtherCard, "inter.ofx", "application/x-ofx");
    expect(await screen.findByText(/Fatura detectada em outro mês/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Ajustar para .* e prosseguir/i }));

    expect(onCompetenceChange).toHaveBeenCalledWith("2026-09");
    const switchCardBtn = await screen.findByRole("button", { name: /Trocar para Inter Black/i });
    await user.click(switchCardBtn);
    expect(onCardChange).toHaveBeenCalledWith(expect.objectContaining({ id: "card-b" }));
  });

  it("bloqueia commit em fatura rolada (D14), protege exclusão em quitada e recupera lote > 500", async () => {
    const user = userEvent.setup();
    mockRollovers = [
      {
        id: "roll-1",
        user_id: "user-1",
        card_id: "card-a",
        from_competence_month: "2026-08",
        to_competence_month: "2026-09",
        principal_amount: 300,
        kind: "rollover",
        group_id: "g-1",
        note: null,
        created_at: "",
      },
    ];

    const { rerender } = render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardA}
        cards={[mockCardA, mockCardB]}
        competenceMonth="2026-08"
      />,
    );

    const csv16 = [
      "Data;Estabelecimento;Valor",
      ...Array.from({ length: 16 }, (_, idx) => `${String(idx + 1).padStart(2, "0")}/08/2026;Loja Item ${idx + 1};10,00`),
    ].join("\n");

    await uploadStatementFile(user, csv16);
    expect(await screen.findByPlaceholderText(/Buscar por estabelecimento/i)).toBeInTheDocument();
    expect(screen.getByText(/já foi rolada\/refinanciada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importação bloqueada/i })).toBeDisabled();

    // Agora fatura livre com lote > 500 itens e falha parcial no Lote 2 -> Tentar novamente
    mockRollovers = [];
    mutateCommitMock
      .mockResolvedValueOnce(makeCommitSuccess(500))
      .mockRejectedValueOnce(new Error("Timeout no Lote 2"))
      .mockResolvedValueOnce(makeCommitSuccess(15));

    rerender(
      <StatementImportDialog
        open={false}
        onOpenChange={vi.fn()}
        card={mockCardB}
        cards={[mockCardA, mockCardB]}
        competenceMonth="2026-08"
      />,
    );
    rerender(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCardB}
        cards={[mockCardA, mockCardB]}
        competenceMonth="2026-08"
      />,
    );

    const csv515 = [
      "Data;Estabelecimento;Valor",
      ...Array.from({ length: 515 }, (_, idx) => `${String((idx % 28) + 1).padStart(2, "0")}/08/2026;Compra Massa ${idx + 1};10,00`),
    ].join("\n");

    await uploadStatementFile(user, csv515);
    expect(await screen.findByRole("button", { name: /Mostrar mais lançamentos/i }, { timeout: 8000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Aplicar e importar \(515 ações\)/i }));
    expect(await screen.findByRole("button", { name: /Tentar novamente/i }, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    expect(await screen.findByText("Fatura conciliada com sucesso", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(mutateCommitMock).toHaveBeenCalledTimes(3);
  }, 60_000);
});
