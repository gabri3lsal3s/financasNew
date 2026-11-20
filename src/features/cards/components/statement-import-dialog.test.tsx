import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
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
  };
});

vi.mock("unpdf", () => ({
  extractText: vi.fn().mockResolvedValue({
    text: [
      "15/08/2026\tPadaria Estrela\t25,00",
      "16/08/2026\tSupermercado Dia\t140,50",
    ],
    totalPages: 1,
  }),
}));

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
  const advanceBtn = await screen.findByRole("button", { name: /Avançar para Conferência/i });
  await user.click(advanceBtn);
  const form = document.querySelector("form");
  if (form) fireEvent.submit(form);
}

describe("StatementImportDialog", () => {
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
    expect(await screen.findByText("Padaria Estrela")).toBeInTheDocument();
  });
});
