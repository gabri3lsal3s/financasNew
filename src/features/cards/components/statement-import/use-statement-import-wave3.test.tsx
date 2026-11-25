import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardBillRollover, CardPayment, CreditCard, Expense } from "@/types";
import * as aiAssistantService from "@/services/ai-assistant";
import { useStatementImport } from "./use-statement-import";
import * as reconcileUtils from "./statement-reconcile-mappers";

const cardA: CreditCard = {
  id: "card-a",
  user_id: "user-1",
  name: "Nubank Roxinho",
  closing_day: 25,
  due_day: 5,
  credit_limit: 8000,
  brand: "mastercard",
  color: "#820ad1",
  last_four_digits: "1111",
  is_active: true,
};

const cardB: CreditCard = {
  id: "card-b",
  user_id: "user-1",
  name: "Banco Inter Black",
  closing_day: 25,
  due_day: 5,
  credit_limit: 12000,
  brand: "mastercard",
  color: "#ff7a00",
  last_four_digits: "2222",
  is_active: true,
};

const mockCategories = [
  { id: "cat-food", name: "Alimentação", color: "#22c55e", icon: "utensils" },
  { id: "cat-fees", name: "Tarifas e Encargos", color: "#f59e0b", icon: "percent" },
];

type QueryState<T> = {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
};

let expensesByCard: Record<string, QueryState<Expense[]>> = {};
let paymentsByCard: Record<string, QueryState<CardPayment[]>> = {};
let rolloversByCard: Record<string, QueryState<CardBillRollover[]>> = {};

const mutateCommitAsyncMock = vi.fn();
const mutateUpsertBlueprintMock = vi.fn().mockResolvedValue({});
const mutateRecordOutcomeMock = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useCategories: () => ({ data: mockCategories, isLoading: false }),
    useCreditCards: () => ({ data: [cardA, cardB], isLoading: false }),
    useCardExpenses: (cardId: string | null) =>
      expensesByCard[cardId ?? ""] ?? { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    useCardPayments: (cardId: string | null) =>
      paymentsByCard[cardId ?? ""] ?? { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    useCardBillRollovers: (cardId: string | null) =>
      rolloversByCard[cardId ?? ""] ?? { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    usePredictionHistory: () => ({ entries: [], isLoading: false }),
    useStatementBlueprints: () => ({ data: [], isLoading: false }),
    useAiQuota: () => ({
      summary: {
        periodMonth: "2026-11",
        periodDay: "2026-11-25",
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
        canRunPassiveCategorizeBatch: false,
        getAffordableBatchCalls: (n: number) => n,
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    }),
    useCommitStatementReconciliation: () => ({
      mutateAsync: mutateCommitAsyncMock,
      isPending: false,
    }),
    useUpsertStatementBlueprint: () => ({
      mutateAsync: mutateUpsertBlueprintMock,
      isPending: false,
    }),
    useRecordStatementBlueprintOutcome: () => ({
      mutateAsync: mutateRecordOutcomeMock,
      isPending: false,
    }),
    useBusinessMode: () => ({ isBusinessModeEnabled: false }),
  };
});

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

describe("Onda 3 — useStatementImport (Troca de Cartão c/ Hidratação, Competência, Retry >500, isDirty, D14, D18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expensesByCard = {
      "card-a": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
      "card-b": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    };
    paymentsByCard = {
      "card-a": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
      "card-b": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    };
    rolloversByCard = {
      "card-a": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
      "card-b": { data: [], isLoading: false, isFetching: false, isError: false, error: null },
    };
    mutateCommitAsyncMock.mockResolvedValue(makeCommitSuccess(1));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("D17: handleSwitchCard aguarda hidratação completa de useCardExpenses e useCardPayments do cartão destino (sem reconciliar contra vazio e com 0 IA)", async () => {
    const aiSpy = vi.spyOn(aiAssistantService, "extractStatementPdfRowsWithAi");
    const reconSpy = vi.spyOn(reconcileUtils, "runStatementReconciliation");

    // Cartão B começa NÃO cacheado (isLoading/isFetching = true, data = undefined)
    expensesByCard["card-b"] = { data: undefined, isLoading: true, isFetching: true, isError: false, error: null };
    paymentsByCard["card-b"] = { data: undefined, isLoading: true, isFetching: true, isError: false, error: null };

    const { result, rerender } = renderHook(() =>
      useStatementImport({
        card: cardA,
        availableCards: [cardA, cardB],
        competenceMonth: "2026-11",
        onClose: vi.fn(),
      }),
    );

    const ofxStatement = [
      "<OFX>",
      "  <SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Inter</ORG></FI></SONRS></SIGNONMSGSRSV1>",
      "  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>",
      "    <CCACCTFROM><ACCTID>411111******2222</ACCTID></CCACCTFROM>",
      "    <BANKTRANLIST>",
      "      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-150.00<MEMO>Supermercado Inter</STMTTRN>",
      "      <STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261112<TRNAMT>50.00<MEMO>Estorno Loja Online</STMTTRN>",
      "    </BANKTRANLIST>",
      "  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>",
      "</OFX>",
    ].join("\n");

    await act(async () => {
      await result.current.handleFileSelect(
        new File([ofxStatement], "fatura-inter.ofx", { type: "application/x-ofx" }),
      );
    });

    await waitFor(() => {
      expect(result.current.step).toBe("reconcile");
    });
    expect(result.current.detectedMeta?.hasCardMismatch).toBe(true);
    expect(result.current.matchedCardForMismatch?.id).toBe("card-b");

    const callsBeforeSwitch = reconSpy.mock.calls.length;

    // Aciona troca para Cartão B enquanto cache destino ainda carrega
    act(() => {
      result.current.handleSwitchCard("card-b");
    });

    expect(result.current.activeCard.id).toBe("card-b");
    expect(result.current.isSwitchingCard).toBe(true);
    // NUNCA reconcilia temporariamente contra listas vazias enquanto loading/fetching
    expect(reconSpy).toHaveBeenCalledTimes(callsBeforeSwitch);

    // Somente useCardExpenses termina; useCardPayments ainda carregando -> ainda aguarda!
    expensesByCard["card-b"] = {
      data: [
        {
          id: "exp-cardb-1",
          user_id: "user-1",
          card_id: "card-b",
          category_id: "cat-food",
          payment_method: "credit_card",
          value: 150,
          base_amount: 150,
          report_weight: 1,
          date: "2026-11-10",
          bill_competence: "2026-11",
          description: "Supermercado Inter",
          installments_total: 1,
          installment_number: 1,
          statement_hash: null,
          imported_from_statement: false,
          is_paid: false,
          created_at: "",
          updated_at: "",
        } as unknown as Expense,
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };
    rerender();
    expect(result.current.isSwitchingCard).toBe(true);
    expect(reconSpy).toHaveBeenCalledTimes(callsBeforeSwitch);

    // Agora useCardPayments hidrata com estorno já existente em Card B
    paymentsByCard["card-b"] = {
      data: [
        {
          id: "ref-cardb-1",
          user_id: "user-1",
          card_id: "card-b",
          competence_month: "2026-11",
          amount: -50,
          date: "2026-11-12",
          note: "Estorno Loja Online",
          is_refund: true,
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };
    rerender();

    await waitFor(() => {
      expect(result.current.isSwitchingCard).toBe(false);
    });

    // Re-reconciliou 1x após hidratação completa com 0 chamadas à IA e casou compra + estorno do Card B
    expect(reconSpy).toHaveBeenCalledTimes(callsBeforeSwitch + 1);
    expect(aiSpy).not.toHaveBeenCalled();
    expect(result.current.detectedMeta?.hasCardMismatch).toBe(false);
    expect(result.current.reconciledItems[0]?.status).toBe("exact_match");
    expect(result.current.reconciledItems[1]?.status).toBe("exact_match");
  });

  it("G2: handleSwitchCompetence re-normaliza RawExtractedEntry[] em memória (< 2ms, 0 IA) inclusive na virada de ano", async () => {
    const aiSpy = vi.spyOn(aiAssistantService, "extractStatementPdfRowsWithAi");
    const { result } = renderHook(() =>
      useStatementImport({
        card: cardA,
        competenceMonth: "2026-12",
        onClose: vi.fn(),
      }),
    );

    const csvWithoutYear = [
      "Data;Estabelecimento;Valor",
      "28/12;Padaria Estrela;40,00",
    ].join("\n");

    await act(async () => {
      await result.current.handleFileSelect(
        new File([csvWithoutYear], "dez.csv", { type: "text/csv" }),
      );
    });

    await waitFor(() => expect(result.current.step).toBe("reconcile"));
    expect(result.current.reconciledItems[0]?.transaction.date).toBe("2026-12-28");
    const hashBeforeCompetenceSwitch = result.current.reconciledItems[0]?.transaction.statementHash;

    await act(async () => {
      await result.current.handleSwitchCompetence("2027-01");
    });

    expect(result.current.activeCompetenceMonth).toBe("2027-01");
    expect(result.current.reconciledItems[0]?.transaction.date).toBe("2026-12-28");
    expect(result.current.reconciledItems[0]?.transaction.statementHash).not.toBe(
      hashBeforeCompetenceSwitch,
    );
    expect(aiSpy).not.toHaveBeenCalled();
  });

  it("G11 (> 500 itens): falha no Lote 2 habilita handleRetryPendingChunks reenviando APENAS os lotes pendentes sem duplicar Lote 1", async () => {
    mutateCommitAsyncMock
      .mockResolvedValueOnce(makeCommitSuccess(500))
      .mockRejectedValueOnce(new Error("Falha temporária no Lote 2"))
      .mockResolvedValueOnce(makeCommitSuccess(20));

    const { result } = renderHook(() =>
      useStatementImport({
        card: cardA,
        competenceMonth: "2026-11",
        onClose: vi.fn(),
      }),
    );

    const rows = [
      "Data\tDescricao\tValor",
      ...Array.from({ length: 520 }, (_, i) => {
        const day = String((i % 28) + 1).padStart(2, "0");
        return `${day}/11/2026\tCompra Massa Numero ${i + 1}\t10,00`;
      }),
    ].join("\n");

    await act(async () => {
      await result.current.handleFileSelect(new File([rows], "massa.csv", { type: "text/csv" }));
    });
    await waitFor(() => expect(result.current.step).toBe("reconcile"));

    await act(async () => {
      await result.current.handleConfirmImport();
    });

    expect(mutateCommitAsyncMock).toHaveBeenCalledTimes(2);
    expect(result.current.commitRetryState?.pendingChunkIndex).toBe(1);
    expect(result.current.commitRetryState?.totalChunks).toBe(2);
    expect(result.current.error).toContain("Falha temporária no Lote 2");

    await act(async () => {
      await result.current.handleRetryPendingChunks();
    });

    // Total 3 chamadas: Lote 1 (500) + Lote 2 falho (20) + Retry Lote 2 (20). Lote 1 nunca reenviado!
    expect(mutateCommitAsyncMock).toHaveBeenCalledTimes(3);
    expect(mutateCommitAsyncMock.mock.calls[2]?.[0].expenses).toHaveLength(20);
    expect(result.current.commitRetryState).toBeNull();
    expect(result.current.commitSummary?.insertedCount).toBe(520);
  }, 30_000);

  it("D9 + D18: controla isDirty completo, aba inicial automática em 'attention', toggle Compra<->Estorno e resgate de Pagamento ignorado com recálculo de integridade", async () => {
    expensesByCard["card-a"] = {
      data: [
        {
          id: "exp-only-1",
          user_id: "user-1",
          card_id: "card-a",
          category_id: "cat-food",
          payment_method: "credit_card",
          value: 75,
          base_amount: 75,
          report_weight: 1,
          date: "2026-11-08",
          bill_competence: "2026-11",
          description: "Gasto Só No App",
          installments_total: 1,
          installment_number: 1,
          statement_hash: null,
          imported_from_statement: false,
          is_paid: false,
          created_at: "",
          updated_at: "",
        } as unknown as Expense,
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };

    const { result } = renderHook(() =>
      useStatementImport({
        card: cardA,
        competenceMonth: "2026-11",
        onClose: vi.fn(),
      }),
    );

    // Só estorno -> importCount === 0 e attentionCount === 1 -> aba inicial automática 'attention'
    const onlyRefundCsv = [
      "Data;Estabelecimento;Valor",
      "12/11/2026;Estorno Compra;60,00C",
      "15/11/2026;PAGAMENTO EFETUADO;200,00",
    ].join("\n");

    await act(async () => {
      await result.current.handleFileSelect(new File([onlyRefundCsv], "estorno.csv", { type: "text/csv" }));
    });
    await waitFor(() => expect(result.current.step).toBe("reconcile"));

    expect(result.current.initialCanonicalTab).toBe("attention");
    expect(result.current.activeCanonicalTab).toBe("attention");
    expect(result.current.isDirty).toBe(false);

    // D9: enfileirar exclusão -> isDirty = true (sem mutação no banco); desfazer -> isDirty = false
    act(() => result.current.handleQueueDeleteAppExpense("exp-only-1"));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.reconciliationPlan.expenseIdsToDelete).toEqual(["exp-only-1"]);
    expect(mutateCommitAsyncMock).not.toHaveBeenCalled();

    act(() => result.current.handleUndoDeleteAppExpense("exp-only-1"));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.reconciliationPlan.expenseIdsToDelete).toEqual([]);

    // D18: resgatar "Pagamento ignorado" + toggle Compra <-> Estorno recalculam hash/Quality Gate
    const refundId = result.current.reconciledItems[0]!.transaction.id;
    const paymentId = result.current.reconciledItems[1]!.transaction.id;
    const prevHash = result.current.reconciledItems[0]!.transaction.statementHash;

    act(() => result.current.handleRestoreIgnoredPayment(paymentId, "purchase"));
    expect(result.current.reconciledItems[1]?.ignoredByDefault).toBe(false);
    expect(result.current.reconciledItems[1]?.transaction.isPayment).toBe(false);
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.handleToggleItemRefund(refundId));
    expect(result.current.reconciledItems[0]?.transaction.isRefund).toBe(false);
    expect(result.current.reconciledItems[0]?.transaction.nature).toBe("purchase");
    expect(result.current.reconciledItems[0]?.selected).toBe(true);
    expect(result.current.reconciledItems[0]?.transaction.statementHash).toBe(prevHash);
    expect(prevHash).toBeDefined();
    expect(result.current.qualityGate?.cycleNetCents).toBe(26000);
  });

  it("D14: fatura rolada bloqueia commit integralmente; fatura quitada permite novas compras e bloqueia exclusões/ajustes", async () => {
    rolloversByCard["card-a"] = {
      data: [
        {
          id: "roll-1",
          user_id: "user-1",
          card_id: "card-a",
          from_competence_month: "2026-11",
          to_competence_month: "2026-12",
          principal_amount: 500,
          kind: "rollover",
          group_id: "grp-1",
          note: null,
          created_at: "",
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };

    const { result, rerender } = renderHook(() =>
      useStatementImport({
        card: cardA,
        competenceMonth: "2026-11",
        onClose: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleFileSelect(
        new File(["Data;Descricao;Valor\n10/11/2026;Padaria Estrela;45,00"], "f.csv", { type: "text/csv" }),
      );
    });
    await waitFor(() => expect(result.current.step).toBe("reconcile"));

    expect(result.current.billProtection.isRolledOver).toBe(true);
    expect(result.current.reconciliationPlan.blockedByRollover).toBe(true);

    await act(async () => {
      await result.current.handleConfirmImport();
    });
    expect(mutateCommitAsyncMock).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/rolada/i);

    // Transita para cenário de fatura quitada (sem rollover, saldo zerado por pagamento)
    rolloversByCard["card-a"] = { data: [], isLoading: false, isFetching: false, isError: false, error: null };
    expensesByCard["card-a"] = {
      data: [
        {
          id: "exp-paid-1",
          user_id: "user-1",
          card_id: "card-a",
          category_id: "cat-food",
          payment_method: "credit_card",
          value: 100,
          base_amount: 100,
          report_weight: 1,
          date: "2026-11-05",
          bill_competence: "2026-11",
          description: "Mercado Liquidado",
          installments_total: 1,
          installment_number: 1,
          statement_hash: null,
          imported_from_statement: false,
          is_paid: true,
          created_at: "",
          updated_at: "",
        } as unknown as Expense,
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };
    paymentsByCard["card-a"] = {
      data: [
        {
          id: "pay-1",
          user_id: "user-1",
          card_id: "card-a",
          competence_month: "2026-11",
          amount: 100,
          date: "2026-11-28",
          note: "Pagamento integral",
          is_refund: false,
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    };
    rerender();

    expect(result.current.billProtection.isRolledOver).toBe(false);
    expect(result.current.billProtection.isPaidBill).toBe(true);
    expect(result.current.reconciliationPlan.paidBillLocksRestricted).toBe(true);
    expect(result.current.reconciliationPlan.newExpensesToCreate).toHaveLength(1);
    expect(result.current.reconciliationPlan.expenseIdsToDelete).toEqual([]);

    act(() => result.current.handleQueueDeleteAppExpense("exp-paid-1"));
    expect(result.current.queuedDeleteExpenseIds.size).toBe(0);
  });
});
