import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BankStatementImportDialog } from "./bank-statement-import-dialog";
import type { Expense, Income } from "@/types";
import type { UseQueryResult } from "@tanstack/react-query";

const mutateAsyncMock = vi.fn().mockResolvedValue({
  success: true,
  expenses_inserted: 1,
  expenses_skipped: 0,
  incomes_inserted: 1,
  incomes_skipped: 0,
});

vi.mock("@/state", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Alimentação", icon: "Utensils", color: "#10B981" },
      { id: "cat-2", name: "Transporte", icon: "Car", color: "#3B82F6" },
    ],
  }),
  useExpenses: () => ({
    data: [],
  }),
  useIncomes: () => ({
    data: [],
  }),
  usePredictionHistory: () => ({
    entries: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useImportBankTransactions: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

describe("BankStatementImportDialog", () => {
  it("renderiza o diálogo aberto com abas de arquivo e quick-paste", () => {
    render(
      <BankStatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        competenceMonth="2026-08"
      />,
    );

    expect(screen.getByText(/Importar Extrato Bancário — 2026-08/i)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Arquivo/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Quick-Paste/i })).toBeInTheDocument();
  });

  it("processa texto livre com despesa e receita e permite importação conjunta", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    render(
      <BankStatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        competenceMonth="2026-08"
      />,
    );

    // 1. Alterna para Quick-Paste
    await user.click(screen.getByRole("tab", { name: /Quick-Paste/i }));

    // 2. Digita linhas de despesa e receita
    const textarea = screen.getByPlaceholderText(/Cole aqui linhas copiadas/i);
    await user.type(
      textarea,
      "15/08/2026\tSupermercado Dia\t85,50\n16/08/2026\tPix Recebido Ana\t120,00\tC",
    );

    // 3. Clica em processar
    await user.click(screen.getByRole("button", { name: /Processar Texto/i }));

    // 4. Se passar pelo mapeamento, avança
    const advanceBtn = screen.queryByRole("button", { name: /Avançar para Conferência/i });
    if (advanceBtn) {
      await user.click(advanceBtn);
    }

    // 5. Verifica itens na conferência
    expect(screen.getByText(/Supermercado Dia/i)).toBeInTheDocument();
    expect(screen.getByText(/Pix Recebido Ana/i)).toBeInTheDocument();

    // 6. Confirma importação
    const importBtn = screen.getByRole("button", { name: /Importar \(2\)/i });
    await user.click(importBtn);

    // 7. Valida chamada da mutação com despesa e receita
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      expenses: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-08-15",
          description: "Supermercado Dia",
          value: 85.5,
        }),
      ]),
      incomes: expect.arrayContaining([
        expect.objectContaining({
          date: "2026-08-16",
          description: "Pix Recebido Ana",
          value: 120,
        }),
      ]),
    });
  });

  it("desmarca por padrão pagamento de fatura e transferências com travas anti-fragilidade", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockClear();

    render(
      <BankStatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        competenceMonth="2026-08"
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Quick-Paste/i }));

    const textarea = screen.getByPlaceholderText(/Cole aqui linhas copiadas/i);
    await user.type(
      textarea,
      "10/08/2026\tPAGTO FATURA NUBANK\t1200,00\n12/08/2026\tAPLICACAO CDB DI\t5000,00\n15/08/2026\tPadaria Nova\t22,00",
    );

    await user.click(screen.getByRole("button", { name: /Processar Texto/i }));

    const advanceBtn = screen.queryByRole("button", { name: /Avançar para Conferência/i });
    if (advanceBtn) {
      await user.click(advanceBtn);
    }

    // Apenas 1 item (Padaria Nova) deve estar selecionado por padrão
    const importBtn = screen.getByRole("button", { name: /Importar \(1\)/i });
    expect(importBtn).toBeInTheDocument();

    await user.click(importBtn);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      expenses: [
        expect.objectContaining({
          date: "2026-08-15",
          description: "Padaria Nova",
          value: 22,
        }),
      ],
      incomes: [],
    });
  });

  it("não exibe alerta falso de sobras no app garantindo fluxo de extrato limpo e sem alarmismo", async () => {
    const user = userEvent.setup();

    const orphanExpense: Expense = {
      id: "exp-orphan-1",
      user_id: "user-test",
      date: "2026-08-15",
      description: "Gasto Manual em Dinheiro",
      value: 50.0,
      base_amount: 50.0,
      category_id: "cat-1",
      payment_method: "cash",
      card_id: null,
      bill_competence: null,
      installment_number: 1,
      installments_total: 1,
      installment_group_id: null,
      report_weight: 1.0,
      created_at: "2026-08-15T00:00:00Z",
    };

    const orphanIncome: Income = {
      id: "inc-orphan-1",
      user_id: "user-test",
      date: "2026-08-22",
      description: "Renda Extra Dinheiro",
      value: 200.0,
      category_id: "cat-1",
      receive_type: "other",
      report_weight: 1.0,
      source_ref: null,
      created_at: "2026-08-22T00:00:00Z",
    };

    vi.spyOn(await import("@/state"), "useExpenses").mockReturnValue({
      data: [orphanExpense],
    } as unknown as UseQueryResult<Expense[], Error>);

    vi.spyOn(await import("@/state"), "useIncomes").mockReturnValue({
      data: [orphanIncome],
    } as unknown as UseQueryResult<Income[], Error>);

    render(
      <BankStatementImportDialog
        open={true}
        onOpenChange={vi.fn()}
        competenceMonth="2026-08"
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Quick-Paste/i }));

    const textarea = screen.getByPlaceholderText(/Cole aqui linhas copiadas/i);
    await user.type(textarea, "10/08/2026\tCompra Outra\t30,00");

    await user.click(screen.getByRole("button", { name: /Processar Texto/i }));

    const advanceBtn = screen.queryByRole("button", { name: /Avançar para Conferência/i });
    if (advanceBtn) {
      await user.click(advanceBtn);
    }

    // Não deve conter alerta ou aba de ausência do app no extrato bancário
    expect(
      screen.queryByText(/não constam neste extrato/i),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("tab", { name: /No App apenas/i }),
    ).not.toBeInTheDocument();

    // Deve exibir normalmente a transação importada
    expect(screen.getByText("Compra Outra")).toBeInTheDocument();
  });
});
