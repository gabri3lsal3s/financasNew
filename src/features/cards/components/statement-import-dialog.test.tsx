import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatementImportDialog } from "./statement-import-dialog";
import type { CreditCard, Expense } from "@/types";
import type { UseQueryResult } from "@tanstack/react-query";

const mutateAsyncMock = vi.fn().mockResolvedValue({
  success: true,
  inserted_count: 2,
  skipped_count: 0,
});

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Alimentação", icon: "Utensils", color: "#10B981" },
      { id: "cat-2", name: "Transporte", icon: "Car", color: "#3B82F6" },
    ],
  }),
  useCardExpenses: () => ({
    data: [],
  }),
  usePredictionHistory: () => ({
    data: [],
  }),
  useImportStatementExpenses: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

const mockCard: CreditCard = {
  id: "card-test",
  user_id: "user-test",
  name: "Nubank Roxinho",
  brand: "Mastercard",
  credit_limit: 5000,
  closing_day: 10,
  due_day: 15,
  color: "#820AD1",
  is_active: true,
};

describe("StatementImportDialog", () => {
  it("renderiza o diálogo aberto com as abas de arquivo e colar texto", () => {
    render(
      <StatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        card={mockCard}
        competenceMonth="2026-08"
      />,
    );

    expect(screen.getByText(/Importar Fatura — Nubank Roxinho/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Arquivo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Colar Extrato/i })).toBeInTheDocument();
  });

  it("permite colar texto de extrato e avançar pelas etapas até a importação", async () => {
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

    // 1. Alterna para a aba "Colar Extrato"
    const pasteTab = screen.getByRole("tab", { name: /Colar Extrato/i });
    await user.click(pasteTab);

    // 2. Digita as linhas do extrato no textarea
    const textarea = screen.getByPlaceholderText(/Cole aqui as linhas/i);
    await user.type(
      textarea,
      "15/08/2026\tPadaria Estrela\t25,00\n16/08/2026\tSupermercado Dia\t140,50",
    );

    // 3. Clica em "Processar Texto"
    const processBtn = screen.getByRole("button", { name: /Processar Texto/i });
    await user.click(processBtn);

    // 4. Deve exibir a etapa 2 (Prévia e Mapeamento de Colunas)
    expect(screen.getByText(/Prévia das primeiras linhas do extrato/i)).toBeInTheDocument();

    // 5. Avança para a conferência
    const advanceBtn = screen.getByRole("button", { name: /Avançar para Conferência/i });
    await user.click(advanceBtn);

    // 6. Deve exibir a etapa 3 (Tabela de Reconciliação) com os 2 itens
    expect(screen.getByText(/Padaria Estrela/i)).toBeInTheDocument();
    expect(screen.getByText(/Supermercado Dia/i)).toBeInTheDocument();

    // 7. Confirma a importação
    const importBtn = screen.getByRole("button", { name: /Importar 2 Lançamentos/i });
    await user.click(importBtn);

    // 8. Verifica que a mutação foi chamada com o payload correto
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      cardId: "card-test",
      competenceMonth: "2026-08",
      expenses: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-08-15",
          description: "Padaria Estrela",
          value: 25,
        }),
        expect.objectContaining({
          date: "2026-08-16",
          description: "Supermercado Dia",
          value: 140.5,
        }),
      ]),
    });
  });

  it("não marca para importação lançamentos que já casam com despesas existentes na competência", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    // Simula uma despesa já cadastrada no mês
    const existingExpense: Expense = {
      id: "exp-existing-1",
      user_id: "user-test",
      date: "2026-08-07",
      description: "Google AI Pro",
      value: 96.99,
      base_amount: 96.99,
      category_id: "cat-1",
      payment_method: "credit_card",
      card_id: "card-test",
      bill_competence: "2026-08",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      report_weight: 1.0,
      created_at: "2026-08-07T00:00:00Z",
    };

    vi.spyOn(await import("@/state"), "useCardExpenses").mockReturnValue({
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

    // 1. Aba Colar
    await user.click(screen.getByRole("tab", { name: /Colar Extrato/i }));

    // 2. Cola o item já existente + um item novo
    const textarea = screen.getByPlaceholderText(/Cole aqui as linhas/i);
    await user.type(
      textarea,
      "07/08/2026\tGoogle AI Pro\t96,99\n10/08/2026\tNova Compra\t50,00",
    );

    // 3. Processa
    await user.click(screen.getByRole("button", { name: /Processar Texto/i }));

    // 4. Avança do mapeamento
    await user.click(screen.getByRole("button", { name: /Avançar para Conferência/i }));

    // 5. Botão de importação deve importar apenas 1 lançamento (o novo)
    const importBtn = screen.getByRole("button", { name: /Importar 1 Lançamento/i });
    expect(importBtn).toBeInTheDocument();

    await user.click(importBtn);

    // 6. Confirma que apenas o novo foi enviado para importação (o já existente não foi duplicado)
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
  });

  it("exibe alerta e aba 'No App apenas' para despesas cadastradas no app que não constam no extrato", async () => {
    const user = userEvent.setup();

    // Despesa no app que NÃO veio no extrato
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

    vi.spyOn(await import("@/state"), "useCardExpenses").mockReturnValue({
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

    // 1. Aba Colar
    await user.click(screen.getByRole("tab", { name: /Colar Extrato/i }));

    // 2. Cola um extrato que contém apenas outra compra
    const textarea = screen.getByPlaceholderText(/Cole aqui as linhas/i);
    await user.type(textarea, "10/08/2026\tCompra da Fatura\t75,00");

    // 3. Processa e avança
    await user.click(screen.getByRole("button", { name: /Processar Texto/i }));
    await user.click(screen.getByRole("button", { name: /Avançar para Conferência/i }));

    // 4. Deve exibir o alerta informativo de despesa no app ausente no extrato
    expect(
      screen.getByText(/1 despesa do app não consta neste extrato/i),
    ).toBeInTheDocument();

    // 5. Deve existir a aba "No App apenas (1)"
    const appOnlyTab = screen.getByRole("tab", { name: /No App apenas \(1\)/i });
    expect(appOnlyTab).toBeInTheDocument();

    // 6. Clica na aba e verifica que o gasto ausente é listado com seu badge
    await user.click(appOnlyTab);
    expect(screen.getByText(/Gasto Manual Cancelado/i)).toBeInTheDocument();
    expect(screen.getByText(/Ausente no Extrato/i)).toBeInTheDocument();
  });
});
