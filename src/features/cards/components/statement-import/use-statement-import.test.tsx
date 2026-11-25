import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CreditCard, Expense } from "@/types";
import { useStatementImport } from "./use-statement-import";
import * as statementFileLoader from "./statement-file-loader";
import { sanitizeDescriptionForStatementMicroAi } from "./statement-file-loader";
import * as aiAssistantService from "@/services/ai-assistant";
import * as merchantLearningService from "@/services/merchant-learning";
import * as receiptExtractorService from "@/services/native/receipt-extractor";
import * as toastService from "@/services/toast";

const mockCard: CreditCard = {
  id: "card-micro-ai",
  user_id: "user-1",
  name: "Cartão Micro-IA",
  closing_day: 25,
  due_day: 5,
  credit_limit: 5000,
  brand: "mastercard",
  color: "#820ad1",
  is_active: true,
};

const mockCategories = [
  { id: "cat-books", name: "Livros e Educação", color: "#3b82f6", icon: "book" },
  { id: "cat-food", name: "Alimentação", color: "#22c55e", icon: "utensils" },
  { id: "cat-default", name: "Outros", color: "#64748b", icon: "help-circle" },
];

let mockExistingExpenses: Expense[] = [];
let mockCanRunPassiveCategorizeBatch = true;
const mutateImportAsyncMock = vi.fn().mockResolvedValue({ inserted_count: 1, skipped_count: 0 });
const mutateCommitAsyncMock = vi.fn().mockResolvedValue({
  success: true,
  inserted_count: 1,
  projected_count: 0,
  skipped_count: 0,
  adjusted_count: 0,
  moved_count: 0,
  refunds_count: 0,
  deleted_count: 0,
});
const mutateUpdateAsyncMock = vi.fn().mockResolvedValue({});
const mutateRefundAsyncMock = vi.fn().mockResolvedValue({});
const mutateUpsertBlueprintMock = vi.fn().mockResolvedValue({});
const mutateRecordOutcomeMock = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useCategories: () => ({
      data: mockCategories,
      isLoading: false,
    }),
    useCreditCards: () => ({
      data: [mockCard],
      isLoading: false,
    }),
    useCardExpenses: () => ({
      data: mockExistingExpenses,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    useCardPayments: () => ({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    useCardBillRollovers: () => ({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    }),
    usePredictionHistory: () => ({
      entries: [],
      isLoading: false,
    }),
    useStatementBlueprints: () => ({
      data: [],
      isLoading: false,
    }),
    useAiQuota: () => ({
      summary: {
        periodMonth: "2026-08",
        periodDay: "2026-08-15",
        batchDailyLimit: 30,
        batchMonthlyLimit: 120,
        batchUsedDay: mockCanRunPassiveCategorizeBatch ? 0 : 29,
        batchUsedMonth: mockCanRunPassiveCategorizeBatch ? 0 : 29,
        batchRemainingDay: mockCanRunPassiveCategorizeBatch ? 30 : 1,
        batchRemainingMonth: mockCanRunPassiveCategorizeBatch ? 120 : 91,
        receiptDailyLimit: 15,
        receiptMonthlyLimit: 100,
        receiptRemainingDay: 15,
        receiptRemainingMonth: 100,
        canRunPassiveCategorizeBatch: mockCanRunPassiveCategorizeBatch,
        getAffordableBatchCalls: (n: number) => Math.min(n, mockCanRunPassiveCategorizeBatch ? 30 : 1),
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    }),
    useUpsertStatementBlueprint: () => ({
      mutateAsync: mutateUpsertBlueprintMock,
      isPending: false,
    }),
    useRecordStatementBlueprintOutcome: () => ({
      mutateAsync: mutateRecordOutcomeMock,
      isPending: false,
    }),
    useImportStatementExpenses: () => ({
      mutateAsync: mutateImportAsyncMock,
      isPending: false,
    }),
    useCommitStatementReconciliation: () => ({
      mutateAsync: mutateCommitAsyncMock,
      isPending: false,
    }),
    useUpdateExpense: () => ({
      mutateAsync: mutateUpdateAsyncMock,
      isPending: false,
    }),
    useDeleteExpense: () => ({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    }),
    useCreateRefund: () => ({
      mutateAsync: mutateRefundAsyncMock,
      isPending: false,
    }),
    useBusinessMode: () => ({
      isBusinessModeEnabled: false,
    }),
  };
});

describe("Etapa 4 — Micro-IA Semântica Síncrona Deduplicada (useStatementImport)", () => {
  let categorizeAiSpy: ReturnType<typeof vi.spyOn>;
  let autoLearnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingExpenses = [];
    mockCanRunPassiveCategorizeBatch = true;
    autoLearnSpy = vi.spyOn(merchantLearningService, "autoLearnExpenseCategory").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("4.1 Sanitização e Blindagem de Privacidade (Payload Mínimo)", () => {
    it("mascara CPFs, remove valores monetários, datas e injeções, limitando a 80 caracteres", () => {
      const raw = "PAGTO TITULO 123.456.789-00 R$ 349,90 EM 12/04/2026 <script>alert(1)</script> BRL 50.00";
      const sanitized = sanitizeDescriptionForStatementMicroAi(raw);

      expect(sanitized).not.toContain("123.456.789-00");
      expect(sanitized).toContain("[CPF_OCULTO]");
      expect(sanitized).not.toContain("349,90");
      expect(sanitized).not.toContain("R$");
      expect(sanitized).not.toContain("BRL");
      expect(sanitized).not.toContain("12/04/2026");
      expect(sanitized).not.toContain("<script>");
      expect(sanitized.length).toBeLessThanOrEqual(80);
    });

    it("trunca descrições longas em até 80 caracteres estritos", () => {
      const veryLong = "ESTABELECIMENTO COMERCIAL DE PRODUTOS E SERVICOS DE TECNOLOGIA DA INFORMACAO E CONSULTORIA EM SOFTWARE LTDA E CIA";
      const sanitized = sanitizeDescriptionForStatementMicroAi(veryLong);

      expect(sanitized.length).toBeLessThanOrEqual(80);
      expect(sanitized).toBe(veryLong.slice(0, 80).trim());
    });
  });

  describe("4.2 Deduplicação e Zero Vazamento de PII/Valores", () => {
    it("envia apenas descrições deduplicadas de itens unmatched_new sem valores monetários nem datas", async () => {
      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi").mockResolvedValue({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          items: [
            {
              index: 0,
              friendlyName: "Posto Ipiranga",
              canonicalMerchant: "Posto Ipiranga",
              categoryId: "cat-default",
            },
          ],
        },
      });

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      // Linhas com 3 compras no mesmo posto em datas e valores diferentes
      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tPOSTO IPIRANGA 01\t150,00\n" +
        "12/08/2026\tPOSTO IPIRANGA 01\t220,50\n" +
        "15/08/2026\tPOSTO IPIRANGA 01\t85,00";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      await waitFor(() => {
        expect(result.current.step).toBe("reconcile");
      });

      await waitFor(() => {
        expect(categorizeAiSpy).toHaveBeenCalled();
      });

      const callArgs = categorizeAiSpy.mock.calls[0]?.[0];
      expect(callArgs).toBeDefined();

      // Deduplicação estrita: apenas 1 descrição enviada
      expect(callArgs?.descriptions).toHaveLength(1);
      expect(callArgs?.descriptions[0]).toContain("POSTO IPIRANGA 01");

      // Zero valores monetários e zero datas no payload
      const payloadString = JSON.stringify(callArgs);
      expect(payloadString).not.toContain("150,00");
      expect(payloadString).not.toContain("220,50");
      expect(payloadString).not.toContain("85,00");
      expect(payloadString).not.toContain("10/08/2026");
      expect(payloadString).not.toContain("12/08/2026");
      expect(payloadString).not.toContain("15/08/2026");
    });
  });

  describe("4.3 Categorização Síncrona (D4), Preservação Humana e Reserva do Último Crédito", () => {
    it("executa categorize_batch antes de abrir a conferência e preserva edições humanas subsequentes", async () => {
      let resolvedAiBeforeOpen = false;
      categorizeAiSpy = vi
        .spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi")
        .mockImplementation(async () => {
          resolvedAiBeforeOpen = true;
          return {
            ok: true,
            cached: false,
            source: "ai_text",
            data: {
              items: [
                { index: 0, friendlyName: "Loja Manual IA", categoryId: "cat-books" },
                { index: 1, friendlyName: "Loja Automatica IA", categoryId: "cat-books" },
              ],
            },
          };
        });

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tLOJA MANUAL 123\t100,00\n" +
        "12/08/2026\tLOJA AUTOMATICA 456\t50,00";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      // D4: IA já terminou de organizar categorias ANTES de abrir "reconcile" (tela estática!)
      expect(resolvedAiBeforeOpen).toBe(true);
      expect(result.current.step).toBe("reconcile");
      expect(result.current.reconciledItems).toHaveLength(2);

      const manualItemId = result.current.reconciledItems[0]!.transaction.id;
      act(() => {
        result.current.handleChangeCategory(manualItemId, "cat-food");
      });

      expect(
        result.current.reconciledItems.find((it) => it.transaction.id === manualItemId)?.selectedCategoryId,
      ).toBe("cat-food");
      expect(
        result.current.reconciledItems.find((it) => it.transaction.id !== manualItemId)?.transaction.cleanDescription,
      ).toBe("Loja Automatica IA");
    });

    it("pula automaticamente categorize_batch quando restar <= 1 crédito diário (reserva para extração)", async () => {
      mockCanRunPassiveCategorizeBatch = false;
      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi");

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tESTABELECIMENTO INEDITO TESTE\t80,00";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      expect(result.current.step).toBe("reconcile");
      expect(categorizeAiSpy).not.toHaveBeenCalled();
    });
  });

  describe("4.4 Re-scoring Incremental Pós-IA (Caso Livros vs Amazon)", () => {
    it("promove item unmatched_new para probable_match com tolerância de centavos após a IA identificar a categoria", async () => {
      // Despesa pré-existente no app: Livros R$ 110,79 com categoria "cat-books"
      mockExistingExpenses = [
        {
          id: "exp-livros-existente",
          card_id: mockCard.id,
          user_id: mockCard.user_id,
          payment_method: "credit_card",
          description: "Livros",
          value: 110.79,
          base_amount: 110.79,
          report_weight: 1.0,
          date: "2026-08-10",
          bill_competence: "2026-08",
          category_id: "cat-books",
          charge_kind: "regular",
          installment_number: 1,
          installments_total: 1,
          installment_group_id: null,
          created_at: "2026-08-10T12:00:00Z",
        },
      ];

      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi").mockResolvedValue({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          items: [
            {
              index: 0,
              friendlyName: "Amazon Marketplace",
              canonicalMerchant: "Amazon",
              categoryId: "cat-books", // IA identifica categoria compatível
            },
          ],
        },
      });

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      // Fatura traz AMZN MKTP BR R$ 110,80 (diferença de 1 centavo)
      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tAMZN MKTP BR\t110,80";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      // Pós-IA: com o bônus semântico de categoria (+10 pts, teto G7 em 70 pts), o item é promovido a probable_match
      await waitFor(() => {
        const item = result.current.reconciledItems[0];
        expect(item?.status).toBe("probable_match");
        expect(item?.score).toBe(70);
        expect(item?.matchedExpenseId).toBe("exp-livros-existente");
        expect(item?.matchedExpenseDescription).toBe("Livros");
        expect(item?.matchedExpenseValueCents).toBe(11079);
        expect(item?.suggestedAction).toBe("link_and_adjust_amount");
        expect(item?.hasStrongSemanticSignal).toBe(true);
      });

      // A despesa "Livros" foi removida da lista de despesas não conciliadas
      expect(result.current.unmatchedAppExpenses).toHaveLength(0);
    });
  });

  describe("4.5 Precedência Humana Absoluta na Memória (merchant-learning)", () => {
    it("não grava em autoLearnExpenseCategory durante a resposta da IA; grava apenas ao confirmar a importação", async () => {
      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi").mockResolvedValue({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          items: [
            {
              index: 0,
              friendlyName: "Loja Inedita XYZ",
              canonicalMerchant: "Loja Inedita",
              categoryId: "cat-books",
            },
          ],
        },
      });

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tNOVA LOJA INEDITA XYZ 999\t99,00\n" +
        "12/08/2026\tNOVA LOJA INEDITA XYZ 999\t49,00";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      await waitFor(() => {
        expect(result.current.reconciledItems[0]?.transaction.cleanDescription).toBe("Loja Inedita");
      });

      // TRAVA INVIOLÁVEL: Durante a conferência, a memória NÃO pode ser tocada
      expect(autoLearnSpy).not.toHaveBeenCalled();

      // Usuário clica em confirmar importação
      await act(async () => {
        await result.current.handleConfirmImport();
      });

      // G14: memória persistida 1 única vez por estabelecimento distinto usando nome limpo (sem valor/data)
      expect(autoLearnSpy).toHaveBeenCalledTimes(1);
      expect(autoLearnSpy).toHaveBeenCalledWith(
        "Loja Inedita",
        "cat-books",
        undefined,
        "NOVA LOJA INEDITA XYZ 999",
      );
    });
  });

  describe("4.6 Degradação Graciosa e Cancelamento Limpo", () => {
    it("degrada 100% silenciosamente se a IA falhar ou estiver offline sem gerar erros", async () => {
      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi").mockRejectedValue(
        new Error("Network timeout / quota exceeded"),
      );

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tNOVA LOJA DESCONHECIDA\t45,00";

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      await waitFor(() => {
        expect(result.current.step).toBe("reconcile");
      });

      // Mantém categoria padrão/fallback sem erro
      expect(result.current.error).toBeNull();
      expect(result.current.reconciledItems[0]?.selectedCategoryId).toBe("cat-books"); // primeira categoria como fallback
    });

    it("aborta requisição em trânsito via AbortController quando desmontado", async () => {
      let capturedSignal: AbortSignal | undefined;

      categorizeAiSpy = vi.spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi").mockImplementation((params) => {
        capturedSignal = params.signal;
        return new Promise(() => {}); // pendente infinito
      });

      const { result, unmount } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      const csvContent =
        "Data\tDescricao\tValor\n" +
        "10/08/2026\tCOMPRA PARA ABORTAR\t30,00";

      act(() => {
        void result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
      });

      await waitFor(() => {
        expect(capturedSignal).toBeDefined();
        expect(capturedSignal?.aborted).toBe(false);
      });

      // Desmonta o modal enquanto a IA está em trânsito
      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  describe("4.7 PDF Protegido por Senha + Escalada Vision IA (Camada 3B)", () => {
    it("repassa a senha informada para renderScannedPdfPageToBlob quando o PDF exige Vision IA", async () => {
      const pdfFile = new File(
        [new TextEncoder().encode("%PDF-1.7\nencrypted")],
        "fatura-protegida.pdf",
        { type: "application/pdf" },
      );

      const readSpy = vi
        .spyOn(statementFileLoader, "readStatementFileContent")
        .mockRejectedValueOnce(new receiptExtractorService.PdfPasswordProtectedError())
        .mockResolvedValueOnce({
          kind: "pdf_scanned",
          buffer: new TextEncoder().encode("%PDF-1.7\nencrypted").buffer,
          fileName: "fatura-protegida.pdf",
          sha256: "a".repeat(64),
          pdfPageTexts: [""],
          pdfTotalPages: 1,
        });

      const renderBlobSpy = vi
        .spyOn(receiptExtractorService, "renderScannedPdfPageToBlob")
        .mockResolvedValueOnce(new Blob(["png-page-1"], { type: "image/png" }))
        .mockResolvedValueOnce(null);

      const visionSpy = vi
        .spyOn(aiAssistantService, "extractStatementPdfRowsWithAi")
        .mockResolvedValueOnce({
          ok: true,
          cached: false,
          source: "ai_vision",
          data: {
            rows: [
              {
                date: "2026-08-15",
                description: "Padaria Protegida",
                amountCents: 4590,
                installmentCurrent: null,
                installmentTotal: null,
                entryType: "purchase",
              },
            ],
            detectedTotalInvoiceCents: 4590,
          },
        });

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          userId: "user-1",
          onClose: vi.fn(),
        }),
      );

      await act(async () => {
        await result.current.handleFileSelect(pdfFile);
      });

      expect(result.current.pendingPasswordFile).toBe(pdfFile);

      await act(async () => {
        await result.current.handlePasswordSubmit("segredo-123");
      });

      await waitFor(() => {
        expect(result.current.step).toBe("reconcile");
      });

      expect(readSpy).toHaveBeenCalledTimes(2);
      expect(renderBlobSpy).toHaveBeenNthCalledWith(1, expect.anything(), 1, {
        password: "segredo-123",
      });
      expect(visionSpy).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeNull();
      expect(result.current.reconciledItems).toHaveLength(1);
      expect(result.current.reconciledItems[0]?.transaction.cleanDescription).toBe("Padaria Protegida");
      expect(result.current.reconciledItems[0]?.transaction.amountCents).toBe(4590);
    });
  });

  describe("4.8 Confirmação de Importação, Erros Visíveis e Conferência Já Conciliada", () => {
    it("conclui conferência quando todas as despesas já estão conciliadas (selectedCount === 0)", async () => {
      const onCloseMock = vi.fn();
      const toastSpy = vi.spyOn(toastService, "pushToast");

      mockExistingExpenses = [
        {
          id: "exp-1",
          user_id: "user-1",
          card_id: mockCard.id,
          category_id: "cat-food",
          payment_method: "credit_card",
          value: 25,
          base_amount: 25,
          report_weight: 1,
          date: "2026-08-10",
          bill_competence: "2026-08",
          description: "Padaria Estrela",
          installments_total: 1,
          installment_number: 1,
          statement_hash: null,
          imported_from_statement: false,
          is_paid: false,
          created_at: "",
          updated_at: "",
        } as unknown as Expense,
      ];

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: onCloseMock,
        }),
      );

      await act(async () => {
        await result.current.handleFileSelect(
          new File(["Data\tDescricao\tValor\n10/08/2026\tPadaria Estrela\t25,00"], "fatura.csv", {
            type: "text/csv",
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.step).toBe("reconcile");
      });
      expect(result.current.selectedCount).toBe(0);

      await act(async () => {
        await result.current.handleConfirmImport();
      });

      expect(result.current.step).toBe("success");
      expect(result.current.commitSummary?.insertedCount).toBe(0);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Conferência concluída",
        }),
      );
      act(() => result.current.handleCloseDialog());
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it("exibe pushToast destrutivo além do alert quando o RPC de importação falha (sem erro silencioso)", async () => {
      const toastSpy = vi.spyOn(toastService, "pushToast");
      mutateCommitAsyncMock.mockRejectedValueOnce(new Error("Falha de rede no Supabase"));

      const { result } = renderHook(() =>
        useStatementImport({
          card: mockCard,
          competenceMonth: "2026-08",
          onClose: vi.fn(),
        }),
      );

      await act(async () => {
        await result.current.handleFileSelect(
          new File(["Data\tDescricao\tValor\n10/08/2026\tMercado Novo\t80,00"], "fatura.csv", {
            type: "text/csv",
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.step).toBe("reconcile");
      });

      await act(async () => {
        await result.current.handleConfirmImport();
      });

      expect(result.current.error).toContain("Falha de rede no Supabase");
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Não foi possível importar a fatura",
        }),
      );
    });
  });
});
