import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import * as merchantLearningService from "@/services/merchant-learning";
import { clearAllColumnMappingCache } from "@/services/statement-mapping-cache";
import type { CreditCard, Expense } from "@/types";
import { StatementImportDialog } from "./statement-import-dialog";

const mockCard: CreditCard = {
  id: "card-test",
  user_id: "user-test",
  name: "Nubank Roxinho",
  closing_day: 5,
  due_day: 12,
  credit_limit: 10000,
  brand: "mastercard",
  color: "#820ad1",
  is_active: true,
};

const mutateAsyncMock = vi.fn().mockResolvedValue({
  inserted_count: 2,
  skipped_count: 0,
});

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
    useCardExpenses: () => ({
      data: [],
      isLoading: false,
    }),
    usePredictionHistory: () => ({
      entries: [
        { id: "p-1", kind: "expense" as const, description: "padaria estrela", categoryId: "cat-1", categoryName: "Alimentação" },
        { id: "p-2", kind: "expense" as const, description: "supermercado dia", categoryId: "cat-1", categoryName: "Alimentação" },
      ],
      isLoading: false,
    }),
    useImportStatementExpenses: () => ({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    }),
    useUpdateExpense: () => ({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    }),
    useCreateRefund: () => ({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    }),
    useBusinessMode: () => ({
      isBusinessModeEnabled: true,
      businessProfile: null,
      toggleBusinessMode: vi.fn(),
      updateBusinessProfile: vi.fn(),
      isLoading: false,
      isPending: false,
    }),
  };
});

const mockUnpdfExtractText = vi.fn().mockResolvedValue({
  text: [
    "15/08/2026\tPadaria Estrela\t25,00",
    "16/08/2026\tSupermercado Dia\t140,50",
  ],
  totalPages: 1,
});

const mockCategorizeDescriptionsBatchWithAi = vi.fn().mockResolvedValue({
  ok: false,
  reason: "unauthenticated",
  fallbackToLocal: true,
});

const mockExtractStatementPdfRowsWithAi = vi.fn().mockResolvedValue({
  ok: false,
  reason: "unauthenticated",
  fallbackToLocal: true,
});

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockUnpdfExtractText(...args),
  getDocumentProxy: vi.fn(),
}));

vi.mock("@/services/ai-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ai-assistant")>();
  return {
    ...actual,
    categorizeDescriptionsBatchWithAi: (...args: unknown[]) =>
      mockCategorizeDescriptionsBatchWithAi(...args),
    extractStatementPdfRowsWithAi: (...args: unknown[]) =>
      mockExtractStatementPdfRowsWithAi(...args),
  };
});

async function uploadMockStatementFile(
  user: ReturnType<typeof userEvent.setup>,
  content: string,
  fileName = "fatura.csv",
) {
  const file = new File([content], fileName, { type: "text/csv" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeInTheDocument();
  await user.upload(input, file);
}

async function advanceFromMapping(user: ReturnType<typeof userEvent.setup>) {
  // Se o passo 2 foi pulado automaticamente (confiança determinística >= 85% com cabeçalhos canônicos),
  // o diálogo já se encontra na etapa de conferência.
  const advanceBtn = screen.queryByRole("button", { name: /Avançar para Conferência/i });
  if (advanceBtn) {
    await user.click(advanceBtn);
    const form = document.querySelector("form");
    if (form) fireEvent.submit(form);
  }
}

describe("StatementImportDialog", () => {
  beforeEach(() => {
    clearAllColumnMappingCache();
  });
  it("renderiza o diálogo aberto com o componente de upload de arquivo", () => {
    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    expect(screen.getByText(/Importar Fatura — Nubank Roxinho/i)).toBeInTheDocument();
    expect(screen.getByText(/Selecione o arquivo da fatura/i)).toBeInTheDocument();
  });

  it("permite enviar arquivo de extrato e avançar pelas etapas até a importação", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={handleOpenChange}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    // 1. Envia arquivo CSV de extrato
    await uploadMockStatementFile(
      user,
      "15/08/2026\tPadaria Estrela\t25,00\n16/08/2026\tSupermercado Dia\t140,50",
    );

    // 2. Deve exibir a etapa 2 (Prévia e Mapeamento de Colunas)
    expect(await screen.findByText(/Prévia das primeiras linhas do extrato/i)).toBeInTheDocument();

    // 3. Avança para a etapa de Conferência e Conciliação
    await advanceFromMapping(user);

    // 4. Deve exibir os itens parseados na etapa 3
    expect(await screen.findByText("Padaria Estrela")).toBeInTheDocument();
    expect(screen.getByText("Supermercado Dia")).toBeInTheDocument();

    // 5. Clica no botão de importar os 2 lançamentos
    const importBtn = screen.getByRole("button", { name: /Importar 2 Lançamentos/i });
    await user.click(importBtn);

    // 6. Confirma que a mutação foi acionada com os dados esperados
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      cardId: "card-test",
      competenceMonth: "2026-08",
      expenses: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-08-15",
          description: "Padaria Estrela",
          value: 25,
          category_id: "cat-1",
        }),
        expect.objectContaining({
          date: "2026-08-16",
          description: "Supermercado Dia",
          value: 140.5,
          category_id: "cat-1",
        }),
      ]),
    });
  });

  it("permite alternar escopo para PJ e usar ações em massa Tudo PJ no Modo Negócio", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    mutateAsyncMock.mockClear();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={handleOpenChange}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    await uploadMockStatementFile(
      user,
      "15/08/2026\tPadaria Estrela\t25,00\n16/08/2026\tSupermercado Dia\t140,50",
    );
    await advanceFromMapping(user);

    expect(await screen.findByText("Padaria Estrela")).toBeInTheDocument();

    // Ações em massa Tudo PJ disponíveis
    const tudoPjBtn = screen.getByRole("button", { name: /Tudo PJ/i });
    expect(tudoPjBtn).toBeInTheDocument();
    await user.click(tudoPjBtn);

    // Importa os itens
    const importBtn = screen.getByRole("button", { name: /Importar 2 Lançamentos/i });
    await user.click(importBtn);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      cardId: "card-test",
      competenceMonth: "2026-08",
      expenses: expect.arrayContaining([
        expect.objectContaining({
          description: "Padaria Estrela",
          scope: "business",
        }),
        expect.objectContaining({
          description: "Supermercado Dia",
          scope: "business",
        }),
      ]),
    });
  });

  it("não marca para importação lançamentos que já casam com despesas existentes na competência", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    const existingExpense: Expense = {
      id: "exp-existing-1",
      user_id: "user-test",
      date: "2026-08-07",
      description: "Google AI Pro",
      value: 96.99,
      base_amount: 96.99,
      category_id: "cat-2",
      payment_method: "credit_card",
      card_id: "card-test",
      bill_competence: "2026-08",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      report_weight: 1.0,
      created_at: "2026-08-07T00:00:00Z",
    };

    const expenseSpy = vi.spyOn(await import("@/state"), "useCardExpenses").mockReturnValue({
      data: [existingExpense],
    } as unknown as UseQueryResult<Expense[], Error>);

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    // Envia o item já existente + um item novo
    await uploadMockStatementFile(
      user,
      "07/08/2026\tGoogle AI Pro\t96,99\n10/08/2026\tNova Compra\t50,00",
    );

    // Avança do mapeamento
    await advanceFromMapping(user);

    // Botão de importação deve importar apenas 1 lançamento (o novo)
    const importBtn = await screen.findByRole("button", { name: /Importar 1 Lançamento/i });
    expect(importBtn).toBeInTheDocument();

    await user.click(importBtn);

    // Confirma que apenas o novo foi enviado para importação (o já existente não foi duplicado)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      cardId: "card-test",
      competenceMonth: "2026-08",
      expenses: [
        expect.objectContaining({
          date: "2026-08-10",
          description: "Nova Compra",
          value: 50,
        }),
      ],
    });

    expenseSpy.mockRestore();
  });

  it("exibe alerta e aba 'No App apenas' para despesas cadastradas no app que não constam no extrato", async () => {
    const user = userEvent.setup();

    const orphanExpense: Expense = {
      id: "exp-orphan-1",
      user_id: "user-test",
      date: "2026-08-20",
      description: "Gasto Manual Cancelado",
      value: 120.0,
      base_amount: 120.0,
      category_id: "cat-1",
      payment_method: "credit_card",
      card_id: "card-test",
      bill_competence: "2026-08",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      report_weight: 1.0,
      created_at: "2026-08-20T00:00:00Z",
    };

    const expenseSpy = vi.spyOn(await import("@/state"), "useCardExpenses").mockReturnValue({
      data: [orphanExpense],
    } as unknown as UseQueryResult<Expense[], Error>);

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    // Envia um extrato que contém apenas outra compra
    await uploadMockStatementFile(user, "10/08/2026\tCompra da Fatura\t75,00");
    await advanceFromMapping(user);

    // Deve exibir o alerta informativo de despesa no app ausente no extrato
    expect(
      await screen.findByText(/1 despesa do app não consta neste extrato/i),
    ).toBeInTheDocument();

    // Deve existir a aba "No App apenas (1)"
    const appOnlyTab = screen.getByRole("tab", { name: /No App apenas \(1\)/i });
    expect(appOnlyTab).toBeInTheDocument();

    // Clica na aba e verifica que o gasto ausente é listado com seu badge
    await user.click(appOnlyTab);
    expect(screen.getByText(/Gasto Manual Cancelado/i)).toBeInTheDocument();
    expect(screen.getByText(/Ausente no Extrato/i)).toBeInTheDocument();

    expenseSpy.mockRestore();
  });

  it("permite editar campos, remover itens e adicionar linhas manuais na staging area da fatura", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    await uploadMockStatementFile(
      user,
      "15/08/2026\tCompra Cartao 1\t100,00\n16/08/2026\tItem Indesejado\t50,00",
    );
    await advanceFromMapping(user);

    expect(await screen.findByText("Compra Cartao 1")).toBeInTheDocument();
    expect(screen.getByText("Item Indesejado")).toBeInTheDocument();

    // 1. Remove item indesejado
    const removeBtn = screen.getByRole("button", { name: /Remover Item Indesejado da importação/i });
    await user.click(removeBtn);
    expect(screen.queryByText("Item Indesejado")).not.toBeInTheDocument();

    // 2. Edita item
    const editBtn = screen.getByRole("button", { name: /Editar Compra Cartao 1/i });
    await user.click(editBtn);

    expect(screen.getByText("Editar Lançamento")).toBeInTheDocument();
    const descInput = screen.getByPlaceholderText("Descrição da despesa");
    await user.clear(descInput);
    await user.type(descInput, "Compra Editada");
    await user.click(screen.getByRole("button", { name: /Salvar Alterações/i }));

    expect(screen.getByText("Compra Editada")).toBeInTheDocument();

    // 3. Adiciona linha manual
    const addManualBtn = screen.getByRole("button", { name: /Adicionar linha/i });
    await user.click(addManualBtn);

    expect(screen.getByText("Adicionar Linha Manual")).toBeInTheDocument();
    const manualDescInput = screen.getByPlaceholderText(/Ex.: Compra Farmácia/i);
    await user.type(manualDescInput, "Linha Manual Cartao");
    const manualValueInput = screen.getByPlaceholderText("R$ 0,00");
    await user.type(manualValueInput, "6500"); // R$ 65,00
    await user.click(screen.getByRole("button", { name: /^Adicionar Linha$/i }));

    expect(screen.getByText("Linha Manual Cartao")).toBeInTheDocument();

    // 4. Importa
    const importBtn = screen.getByRole("button", { name: /Importar 2 Lançamentos/i });
    await user.click(importBtn);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      cardId: mockCard.id,
      competenceMonth: "2026-08",
      expenses: expect.arrayContaining([
        expect.objectContaining({
          description: "Compra Editada",
          value: 100,
        }),
        expect.objectContaining({
          description: "Linha Manual Cartao",
          value: 65,
        }),
      ]),
    });
  });

  it("detecta duplicidades na fatura e exibe alerta de duplicidade", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    await uploadMockStatementFile(
      user,
      "15/08/2026\tZara Shopping\t350,00\n15/08/2026\tZara Shopping\t350,00",
    );
    await advanceFromMapping(user);

    expect(await screen.findByText(/1 potencial duplicidade detectada nesta fatura/i)).toBeInTheDocument();
    expect(screen.getByText(/Duplicata no Arquivo/i)).toBeInTheDocument();
  });

  it("particiona extratos de fatura massivos (> 250 itens) em lotes sequenciais de até 250 itens e exibe barra de progresso", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    let resolveFirstBatch!: (value: { success: boolean; inserted_count: number; skipped_count: number }) => void;
    const firstBatchPromise = new Promise<{ success: boolean; inserted_count: number; skipped_count: number }>(
      (resolve) => {
        resolveFirstBatch = resolve;
      },
    );

    mutateAsyncMock
      .mockImplementationOnce(() => firstBatchPromise)
      .mockResolvedValueOnce({
        success: true,
        inserted_count: 20,
        skipped_count: 0,
      });

    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    // Cria 270 linhas em CSV
    const rows: string[] = [];
    for (let i = 1; i <= 270; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      rows.push(`${day}/08/2026\tItem Fatura ${i}\t10,00`);
    }

    await uploadMockStatementFile(user, rows.join("\n"));
    await advanceFromMapping(user);

    const importBtn = await screen.findByRole("button", { name: /Importar 270 Lançamentos/i });
    expect(importBtn).toBeInTheDocument();

    // Dispara a importação em lotes
    await user.click(importBtn);

    // Durante o primeiro lote: barra de progresso deve estar ativa
    expect(
      screen.getByRole("region", { name: /Progresso da importação em lotes/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Importando lote 1 de 2.../i)).toBeInTheDocument();
    expect(screen.getByText(/0\/270 \(0%\)/i)).toBeInTheDocument();

    // Desbloqueia o primeiro lote (250 itens)
    resolveFirstBatch({
      success: true,
      inserted_count: 250,
      skipped_count: 0,
    });

    // Aguarda conclusão do segundo lote e fechamento
    await screen.findByRole("button", { name: /Importar/i }).catch(() => null);

    // Valida que o RPC foi chamado exatamente 2 vezes
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2);

    // Lote 1: exatamente 250 despesas
    expect(mutateAsyncMock.mock.calls[0]![0].expenses).toHaveLength(250);
    expect(mutateAsyncMock.mock.calls[0]![0].cardId).toBe(mockCard.id);
    expect(mutateAsyncMock.mock.calls[0]![0].competenceMonth).toBe("2026-08");

    // Lote 2: exatamente 20 despesas
    expect(mutateAsyncMock.mock.calls[1]![0].expenses).toHaveLength(20);
    expect(mutateAsyncMock.mock.calls[1]![0].cardId).toBe(mockCard.id);
  }, 60_000);

  it("processa arquivo PDF de fatura extraindo seu texto via unpdf", async () => {
    const user = userEvent.setup();
    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    const file = new File(["dummy pdf content"], "fatura-nubank.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    await user.upload(input, file);

    // Deve avançar para a prévia / mapeamento das linhas extraídas do PDF
    expect(await screen.findByText("Padaria Estrela", {}, { timeout: 5000 })).toBeInTheDocument();
  });

  describe("Fase E — Auto-categorização Batch Silenciosa & Fallback PDF Multi-Coluna", () => {
    beforeEach(() => {
      localStorage.clear();
      mutateAsyncMock.mockClear();
      mockCategorizeDescriptionsBatchWithAi.mockReset().mockResolvedValue({
        ok: false,
        reason: "unauthenticated",
        fallbackToLocal: true,
      });
      mockExtractStatementPdfRowsWithAi.mockReset().mockResolvedValue({
        ok: false,
        reason: "unauthenticated",
        fallbackToLocal: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it("auto-categoriza itens desconhecidos em background (Camada 4) sem enviar valores/datas e retroalimenta MerchantLearningMemory", async () => {
      const user = userEvent.setup();
      const autoLearnSpy = vi.spyOn(merchantLearningService, "autoLearnExpenseCategory");

      mockCategorizeDescriptionsBatchWithAi.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          items: [{ index: 0, friendlyName: "Loja XPTZ Tech", categoryId: "cat-2" }],
        },
      });

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      await uploadMockStatementFile(
        user,
        "Data\tDescricao\tValor\n18/08/2026\tLOJA XPTZ 9981\t349,90",
      );
      await advanceFromMapping(user);

      // Camada 4 atualiza descrição amigável e categoria no item desconhecido
      expect(await screen.findByText("Loja XPTZ Tech")).toBeInTheDocument();

      await waitFor(() => {
        expect(mockCategorizeDescriptionsBatchWithAi).toHaveBeenCalledTimes(1);
      });

      // Precedência Humana: antes da confirmação de importação, a memória ainda não foi persistida
      expect(autoLearnSpy).not.toHaveBeenCalled();

      // Verifica que o payload passado à função de lote contém apenas descrições e whitelist
      const callArgs = mockCategorizeDescriptionsBatchWithAi.mock.calls[0]?.[0] as {
        descriptions: string[];
        categories: Array<{ id: string; name: string }>;
      };
      expect(JSON.stringify(callArgs.descriptions)).not.toContain("349,90");
      expect(JSON.stringify(callArgs.descriptions)).not.toContain("18/08/2026");
      expect(callArgs.categories).toEqual([
        { id: "cat-1", name: "Alimentação" },
        { id: "cat-2", name: "Tecnologia" },
      ]);

      // Importação usa a categoria Tecnologia (cat-2) aplicada silenciosamente
      const importBtn = await screen.findByRole("button", { name: /Importar 1 Lançamento/i });
      await user.click(importBtn);

      // Precedência Humana: aprendizado persistido após o clique de confirmação do usuário
      expect(autoLearnSpy).toHaveBeenCalledWith(
        "Loja XPTZ Tech",
        "cat-2",
        undefined,
        expect.stringContaining("LOJA XPTZ 9981"),
      );

      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: "card-test",
        competenceMonth: "2026-08",
        expenses: [
          expect.objectContaining({
            date: "2026-08-18",
            description: "Loja XPTZ Tech",
            value: 349.9,
            category_id: "cat-2",
          }),
        ],
      });
    });

    it("degrada silenciosamente quando offline ou sem cota no categorize_batch sem travar o diálogo", async () => {
      const user = userEvent.setup();
      mockCategorizeDescriptionsBatchWithAi.mockResolvedValueOnce({
        ok: false,
        reason: "quota_exceeded",
        fallbackToLocal: true,
        quotaResetAt: "2026-12-01T00:00:00-03:00",
      });

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      await uploadMockStatementFile(
        user,
        "Data\tDescricao\tValor\n19/08/2026\tCOMERCIO ALPHA\t89,00",
      );
      await advanceFromMapping(user);

      expect(await screen.findByText(/Comercio Alpha/i)).toBeInTheDocument();
      const importBtn = await screen.findByRole("button", { name: /Importar 1 Lançamento/i });
      await user.click(importBtn);

      // Mantém categoria fallback padrão sem erros
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: "card-test",
        competenceMonth: "2026-08",
        expenses: [
          expect.objectContaining({
            date: "2026-08-19",
            value: 89,
            category_id: "cat-1",
          }),
        ],
      });
    });

    it("aciona fallback statement_pdf_rows em PDF multi-coluna desalinhado, pula mapeamento redundante e preserva parcelas/estornos", async () => {
      const user = userEvent.setup();
      // Texto desalinhado que o parser tabular local não consegue fatiar sozinho
      mockUnpdfExtractText.mockResolvedValueOnce({
        text: ["RESUMO DA FATURA BANCO DIGITAL CABECALHO MULTI COLUNA SEM DELIMITADOR"],
        totalPages: 1,
      });

      mockExtractStatementPdfRowsWithAi.mockResolvedValueOnce({
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
            {
              date: "2026-08-11",
              description: "Estorno Livraria",
              amountCents: -4000,
              installmentCurrent: null,
              installmentTotal: null,
              entryType: "refund",
            },
          ],
        },
      });

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      const pdfFile = new File(["pdf-multi-coluna"], "fatura-desalinhada.pdf", {
        type: "application/pdf",
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, pdfFile);

      // Como a IA já estruturou a tabela, vai direto para a etapa de Conciliação sem forçar mapeamento manual
      expect(await screen.findByText("Livraria Cultura")).toBeInTheDocument();
      expect(screen.getByText("2/3")).toBeInTheDocument();
      expect(screen.getByText("Estorno Livraria")).toBeInTheDocument();
      expect(screen.getByText("Organizado automaticamente")).toBeInTheDocument();
      expect(mockExtractStatementPdfRowsWithAi).toHaveBeenCalledTimes(1);

      // Compra positiva fica selecionada; estorno (-40,00) fica desmarcado pelo motor determinístico
      const importBtn = await screen.findByRole("button", { name: /Importar 1 Lançamento/i });
      await user.click(importBtn);

      expect(mutateAsyncMock).toHaveBeenCalledWith({
        cardId: "card-test",
        competenceMonth: "2026-08",
        expenses: [
          expect.objectContaining({
            date: "2026-08-10",
            value: 120,
            installment_number: 2,
            installments_total: 3,
          }),
        ],
      });
    });

    it("detecta falso positivo parcial em PDF, poda texto jurídico/CET antes da IA e valida checksum do Total da Fatura", async () => {
      const user = userEvent.setup();
      mockUnpdfExtractText.mockResolvedValueOnce({
        text: [
          "Valor total desta fatura: R$ 450,00",
          "Custo Efetivo Total",
          "Juros do rotativo 14,90% a.m. CET 412,50% a.a.",
          "Opções de parcelamento da fatura: 12x de R$ 55,00",
          "Lançamentos: Compras nacionais",
          // 1 linha legível pelo parser local + várias linhas quebradas em colunas que o parser local perde
          "10/08/2026\tLoja Isolada\t50,00",
          "R$ 100,00",
          "R$ 100,00",
          "R$ 100,00",
          "R$ 100,00",
        ],
        totalPages: 1,
      });

      mockExtractStatementPdfRowsWithAi.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          rows: [
            { date: "2026-08-10", description: "Loja Isolada", amountCents: 5000, entryType: "purchase" },
            { date: "2026-08-11", description: "Compra Coluna B1", amountCents: 20000, entryType: "purchase" },
            { date: "2026-08-12", description: "Compra Coluna B2", amountCents: 20000, entryType: "purchase" },
          ],
        },
      });

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      const pdfFile = new File(["pdf-falso-positivo"], "fatura-parcial.pdf", {
        type: "application/pdf",
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, pdfFile);

      expect(await screen.findByText("Compra Coluna B1")).toBeInTheDocument();
      expect(screen.getByText("Soma conferida")).toBeInTheDocument();

      // Garante que o pré-processador removeu o bloco de CET/parcelamento antes de enviar tokens à IA
      const sentArg = mockExtractStatementPdfRowsWithAi.mock.calls[0]?.[0] as { text?: string };
      expect(sentArg.text).not.toContain("412,50%");
      expect(sentArg.text).not.toContain("12x de R$");
    });

    it("suporta aba de colagem direta de texto, planilha .xls HTML (0 IA) e prints de fatura via Vision", async () => {
      const user = userEvent.setup();

      const { unmount } = render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      // 1. Aba de colar texto direto
      await user.click(screen.getByRole("tab", { name: /Colar texto ou tabela/i }));
      const textarea = screen.getByLabelText("Conteúdo colado da fatura");
      await user.type(textarea, "15/08/2026\tPadaria Estrela\t32,00");
      await user.click(screen.getByRole("button", { name: /Organizar fatura/i }));

      expect(await screen.findByText(/Prévia das primeiras linhas do extrato/i)).toBeInTheDocument();
      expect(mockExtractStatementPdfRowsWithAi).not.toHaveBeenCalled();
      unmount();

      // 2. Planilha .xls HTML estilo Itaú (0 chamadas de IA)
      const { unmount: unmountXls } = render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );
      const htmlXls = new File(
        ["<table><tr><th>Data</th><th>Estabelecimento</th><th>Valor</th></tr><tr><td>12/08/2026</td><td>Padaria Estrela</td><td>44,90</td></tr></table>"],
        "fatura-itau.xls",
        { type: "application/vnd.ms-excel" },
      );
      const xlsInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(xlsInput, htmlXls);
      // Com confiança >= 85%, pula para conferência com botão "Ajustar colunas" no cabeçalho
      const adjustBtn = await screen.findByRole("button", { name: /Ajustar colunas/i });
      await user.click(adjustBtn);
      expect(await screen.findByText(/Prévia das primeiras linhas do extrato/i)).toBeInTheDocument();
      expect(mockExtractStatementPdfRowsWithAi).not.toHaveBeenCalled();
      unmountXls();

      // 3. Print de fatura aberta (.jpg) via Vision direto para conciliação
      mockExtractStatementPdfRowsWithAi.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_vision",
        data: {
          rows: [
            { date: "2026-08-18", description: "Padaria Estrela", amountCents: 2990, entryType: "purchase" },
          ],
        },
      });

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );
      const printFile = new File(["jpeg-bytes"], "print-fatura-aberta.jpg", { type: "image/jpeg" });
      const printInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(printInput, printFile);

      expect(await screen.findByText("Padaria Estrela")).toBeInTheDocument();
      expect(screen.getByText("Organizado automaticamente")).toBeInTheDocument();
      expect(mockExtractStatementPdfRowsWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          imageBlob: expect.any(File),
          competenceMonth: "2026-08",
        }),
      );
    });

    it("categoriza marcas brasileiras canônicas (ex.: iFood) localmente com 0 chamadas ao categorize_batch", async () => {
      const user = userEvent.setup();

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      await uploadMockStatementFile(
        user,
        "Data\tDescricao\tValor\n20/08/2026\tIFOOD *HAMBURGUERIA\t68,90",
      );
      await advanceFromMapping(user);

      // Como IFOOD/restaurante casa localmente com Alimentação via catálogo/keywords, não gasta cota de IA
      expect(await screen.findByRole("button", { name: /Importar 1 Lançamento/i })).toBeInTheDocument();
      expect(mockCategorizeDescriptionsBatchWithAi).not.toHaveBeenCalled();
    });

    it("exibe alerta de divergência de competência quando a fatura é de outro mês e permite ajustar em 1 clique", async () => {
      const user = userEvent.setup();
      const onCompetenceChange = vi.fn();

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={mockCard}
          competenceMonth="2026-08" // Aberto em Agosto
          userId="user-1"
          aiExtractionEnabled={true}
          onCompetenceChange={onCompetenceChange}
        />,
      );

      // Usuário sobe fatura de Novembro
      const content = `
Nubank Pagamentos S.A.
Fatura de Novembro de 2026
Vencimento: 10/11/2026
Cartão final: 4821

Data;Estabelecimento;Valor
15/11/2026;Restaurante Fogão;120,00
`;
      await uploadMockStatementFile(user, content, "fatura-nubank.csv");
      await advanceFromMapping(user);

      // Deve alertar sobre a competência
      expect(await screen.findByText("Divergência de Competência Detectada")).toBeInTheDocument();
      expect(screen.getByText(/Esta fatura aparenta ser da competência 2026-11/i)).toBeInTheDocument();

      // Clica em ajustar competência
      const adjustBtn = screen.getByRole("button", { name: /Ajustar para/i });
      await user.click(adjustBtn);

      expect(onCompetenceChange).toHaveBeenCalledWith("2026-11");
    });

    it("exibe aviso de compatibilidade de cartão quando os 4 dígitos ou o banco emissor divergem", async () => {
      const user = userEvent.setup();

      render(
        <StatementImportDialog
          open={true}
          onOpenChange={vi.fn()}
          card={{
            ...mockCard,
            name: "Nubank PJ",
            last_four_digits: "1111",
          }}
          competenceMonth="2026-08"
          userId="user-1"
          aiExtractionEnabled={true}
        />,
      );

      // Fatura do Santander com final 9999
      const content = `
Santander Brasil S.A.
Cartão final: 9999
Fatura de Agosto de 2026

Data;Estabelecimento;Valor
15/08/2026;Posto Ipiranga;200,00
`;
      await uploadMockStatementFile(user, content, "fatura-santander.csv");
      await advanceFromMapping(user);

      expect(await screen.findByText("Aviso de Compatibilidade de Cartão")).toBeInTheDocument();
      expect(screen.getByText(/A fatura menciona o cartão com final 9999/i)).toBeInTheDocument();
    });
  });
});
