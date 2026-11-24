import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CreditCard, Expense } from "@/types";
import { useStatementImport } from "./use-statement-import";
import { sanitizeDescriptionForStatementMicroAi } from "./statement-import-helpers";
import * as aiAssistantService from "@/services/ai-assistant";
import * as merchantLearningService from "@/services/merchant-learning";

const mockCard: CreditCard = {
  id: "card-micro-ai",
  user_id: "user-1",
  name: "Cartão Micro-IA",
  closing_day: 5,
  due_day: 12,
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
const mutateImportAsyncMock = vi.fn().mockResolvedValue({ inserted_count: 1, skipped_count: 0 });
const mutateUpdateAsyncMock = vi.fn().mockResolvedValue({});
const mutateRefundAsyncMock = vi.fn().mockResolvedValue({});

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/state")>();
  return {
    ...actual,
    useCategories: () => ({
      data: mockCategories,
      isLoading: false,
    }),
    useCardExpenses: () => ({
      data: mockExistingExpenses,
      isLoading: false,
    }),
    usePredictionHistory: () => ({
      entries: [],
      isLoading: false,
    }),
    useImportStatementExpenses: () => ({
      mutateAsync: mutateImportAsyncMock,
      isPending: false,
    }),
    useUpdateExpense: () => ({
      mutateAsync: mutateUpdateAsyncMock,
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

describe("Etapa 4 — Micro-IA Semântica Deduplicada (useStatementImport)", () => {
  let categorizeAiSpy: ReturnType<typeof vi.spyOn>;
  let autoLearnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingExpenses = [];
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

  describe("4.3 Preservação Absoluta de dirtyFields", () => {
    it("não sobrescreve nome, categoria ou seleção de linhas que foram editadas manualmente pelo usuário", async () => {
      let resolveAiCall: (
        value: Awaited<ReturnType<typeof aiAssistantService.categorizeDescriptionsBatchWithAi>>,
      ) => void = () => {};
      const aiPromise = new Promise<
        Awaited<ReturnType<typeof aiAssistantService.categorizeDescriptionsBatchWithAi>>
      >((resolve) => {
        resolveAiCall = resolve;
      });

      categorizeAiSpy = vi
        .spyOn(aiAssistantService, "categorizeDescriptionsBatchWithAi")
        .mockReturnValue(aiPromise);

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

      await waitFor(() => {
        expect(result.current.reconciledItems).toHaveLength(2);
      });

      const manualItemId = result.current.reconciledItems[0]!.transaction.id;

      // Usuário altera manualmente a categoria do primeiro item antes da IA responder
      act(() => {
        result.current.handleChangeCategory(manualItemId, "cat-food");
      });

      // Agora a IA resolve e tenta aplicar categoria cat-books a ambos
      await act(async () => {
        resolveAiCall!({
          ok: true,
          cached: false,
          source: "ai_text",
          data: {
            items: [
              { index: 0, friendlyName: "Loja Manual IA", categoryId: "cat-books" },
              { index: 1, friendlyName: "Loja Automatica IA", categoryId: "cat-books" },
            ],
          },
        });
      });

      await waitFor(() => {
        // Item manual preserva a escolha humana (cat-food) e não foi sobrescrito pela IA
        const itemManual = result.current.reconciledItems.find((it) => it.transaction.id === manualItemId);
        expect(itemManual?.selectedCategoryId).toBe("cat-food");

        // Item automático que não foi tocado pelo usuário foi hidratado pela IA
        const itemAuto = result.current.reconciledItems.find((it) => it.transaction.id !== manualItemId);
        expect(itemAuto?.selectedCategoryId).toBe("cat-books");
        expect(itemAuto?.transaction.cleanDescription).toBe("Loja Automatica IA");
      });
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

      // Pós-IA: com o bônus semântico de categoria (+10 pts), o item é promovido a probable_match
      await waitFor(() => {
        const item = result.current.reconciledItems[0];
        expect(item?.status).toBe("probable_match");
        expect(item?.score).toBe(75);
        expect(item?.matchedExpenseId).toBe("exp-livros-existente");
        expect(item?.matchedExpenseDescription).toBe("Livros");
        expect(item?.matchedExpenseValueCents).toBe(11079);
        expect(item?.suggestedAction).toBe("link_and_adjust_amount");
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
        "10/08/2026\tNOVA LOJA INEDITA XYZ 999\t99,00";

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

      // Agora sim: memória persistida com a escolha final confirmada pelo usuário
      expect(autoLearnSpy).toHaveBeenCalledWith(
        "Loja Inedita",
        "cat-books",
        undefined,
        expect.stringContaining("NOVA LOJA INEDITA XYZ 999"),
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

      await act(async () => {
        await result.current.handleFileSelect(new File([csvContent], "fatura.csv", { type: "text/csv" }));
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
});
