import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AppDuplicateCandidate, ReconciliationItem } from "@/domain/reconciliation";
import {
  CategoryPill,
  StatementAppDuplicateRow,
  StatementInlineAddRow,
  StatementInlineEditRow,
  StatementReconcileItemRow,
} from "./statement-reconcile-rows";
import { StatementReconcileStep } from "./statement-reconcile-step";
import { StatementReconcileSummaryCard } from "./statement-reconcile-summary-card";

const mockCategoryOptions = [
  { value: "cat-1", label: "Alimentação" },
  { value: "cat-2", label: "Tecnologia" },
  { value: "cat-3", label: "Transporte" },
];

const baseReconciliationItem: ReconciliationItem = {
  transaction: {
    id: "tx-1",
    index: 0,
    occurrenceIndex: 0,
    date: "2026-08-15",
    rawDescription: "AMAZON BR 01/03",
    cleanDescription: "Amazon Brasil",
    amountCents: 11080,
    isRefund: false,
    isPayment: false,
    installment: { current: 1, total: 3 },
    statementHash: "hash-amazon-1",
  },
  status: "unmatched_new",
  score: 0,
  selected: true,
  selectedCategoryId: "cat-2",
  suggestedCategoryId: "cat-2",
  isInternalDuplicate: false,
  ignoredByDefault: false,
  seriesAnalysis: {
    state: "state_1_new_series",
    installment: { current: 1, total: 3 },
    currentAlreadyExists: false,
    previousExists: false,
    futureProjectedCount: 0,
    missingFutureInstallments: [2, 3],
    badgeLabel: "Nova compra parcelada (1/3)",
    suggestedActionLabel: "Importar 1/3 e projetar 2..3 automaticamente",
  },
  projectSeries: true,
};

describe("CategoryPill", () => {
  it("renderiza o rótulo da categoria selecionada e abre popover ao clique", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <CategoryPill
        value="cat-1"
        options={mockCategoryOptions}
        onChange={handleChange}
      />,
    );

    const pillBtn = screen.getByRole("button", { name: /Categoria: Alimentação/i });
    expect(pillBtn).toBeInTheDocument();

    await user.click(pillBtn);

    const techBtn = await screen.findByRole("button", { name: "Tecnologia" });
    expect(techBtn).toBeInTheDocument();

    await user.click(techBtn);
    expect(handleChange).toHaveBeenCalledWith("cat-2");
  });
});

describe("StatementInlineEditRow", () => {
  it("permite editar campos inline sem abrir modal aninhado e salva com autoFocus desativado", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const handleCancel = vi.fn();

    render(
      <StatementInlineEditRow
        item={baseReconciliationItem}
        categoryOptions={mockCategoryOptions}
        onSave={handleSave}
        onCancel={handleCancel}
      />,
    );

    expect(screen.getByText("Editar Lançamento")).toBeInTheDocument();

    const descInput = screen.getByPlaceholderText("Descrição da despesa");
    expect(descInput).toHaveValue("Amazon Brasil");
    await user.clear(descInput);
    await user.type(descInput, "Amazon Prime Assinatura");

    const saveBtn = screen.getByRole("button", { name: /Salvar Alterações/i });
    await user.click(saveBtn);

    expect(handleSave).toHaveBeenCalledWith(
      "tx-1",
      expect.objectContaining({
        cleanDescription: "Amazon Prime Assinatura",
        amountCents: 11080,
      }),
    );
  });
});

describe("StatementInlineAddRow", () => {
  it("permite incluir despesa manual inline no topo da lista", async () => {
    const user = userEvent.setup();
    const handleAdd = vi.fn();
    const handleCancel = vi.fn();

    render(
      <StatementInlineAddRow
        categoryOptions={mockCategoryOptions}
        defaultCategoryId="cat-1"
        onAdd={handleAdd}
        onCancel={handleCancel}
      />,
    );

    expect(screen.getByText("Adicionar Linha Manual")).toBeInTheDocument();

    const descInput = screen.getByPlaceholderText(/Ex.: Compra Farmácia/i);
    await user.type(descInput, "Padaria São Bento");

    const moneyInput = screen.getByPlaceholderText("R$ 0,00");
    await user.type(moneyInput, "3550");

    const addBtn = screen.getByRole("button", { name: /Adicionar Linha/i });
    await user.click(addBtn);

    expect(handleAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanDescription: "Padaria São Bento",
        amountCents: 3550,
        selectedCategoryId: "cat-1",
      }),
    );
  });
});

describe("StatementReconcileItemRow", () => {
  it("exibe badge de série de parcelamento e toggle de projeção futura para Estado 1", () => {
    const handleToggleProject = vi.fn();

    render(
      <StatementReconcileItemRow
        item={baseReconciliationItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
        onToggleProjectSeries={handleToggleProject}
      />,
    );

    expect(screen.getByText("Nova compra parcelada (1/3)")).toBeInTheDocument();
    expect(
      screen.getByText(/Projetar parcelas futuras \(2 a 3\)/i),
    ).toBeInTheDocument();
  });

  it("exibe micro-indicador de data ajustada quando originalDate difere da data clampada", () => {
    const clampedItem: ReconciliationItem = {
      ...baseReconciliationItem,
      transaction: {
        ...baseReconciliationItem.transaction,
        originalDate: "2025-11-20",
        date: "2026-01-01",
      },
    };

    render(
      <StatementReconcileItemRow
        item={clampedItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
      />,
    );

    expect(screen.getByText(/Data ajustada \(era 20\/11\/2025\)/i)).toBeInTheDocument();
  });

  it("exibe botão de vincular e ajustar valor para sugestão com divergência de centavos", async () => {
    const user = userEvent.setup();
    const handleLinkAndAdjust = vi.fn();

    const probableMatchItem: ReconciliationItem = {
      ...baseReconciliationItem,
      status: "probable_match",
      score: 88,
      matchedExpenseId: "exp-existing-1",
      matchedExpenseValueCents: 11079,
      matchedExpenseDescription: "Amazon Livros",
    };

    render(
      <StatementReconcileItemRow
        item={probableMatchItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
        onLinkAndAdjust={handleLinkAndAdjust}
      />,
    );

    expect(screen.getByText(/Sugestão \(88%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Amazon Livros/i)).toBeInTheDocument();

    const linkBtn = screen.getByRole("button", { name: /Vincular e ajustar valor/i });
    expect(linkBtn).toBeInTheDocument();

    await user.click(linkBtn);
    expect(handleLinkAndAdjust).toHaveBeenCalledWith("tx-1");
  });

  it("exibe badge de vinculado e ajustado quando isLinkedAndAdjusted é verdadeiro", () => {
    const linkedItem: ReconciliationItem = {
      ...baseReconciliationItem,
      status: "probable_match",
      isLinkedAndAdjusted: true,
      pendingAdjustmentDifferenceCents: 1,
    };

    render(
      <StatementReconcileItemRow
        item={linkedItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
      />,
    );

    expect(screen.getByText(/Vinculado e ajustado/i)).toBeInTheDocument();
  });

  it("exibe ação de Registrar Estorno para lançamentos de estorno", async () => {
    const user = userEvent.setup();
    const handleRefund = vi.fn();

    const refundItem: ReconciliationItem = {
      ...baseReconciliationItem,
      transaction: {
        ...baseReconciliationItem.transaction,
        isRefund: true,
        cleanDescription: "Estorno Compra Cancelada",
        amountCents: 5000,
      },
    };

    render(
      <StatementReconcileItemRow
        item={refundItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
        onCreateRefund={handleRefund}
      />,
    );

    const refundBtn = screen.getByRole("button", { name: /Registrar Estorno/i });
    expect(refundBtn).toBeInTheDocument();

    await user.click(refundBtn);
    expect(handleRefund).toHaveBeenCalledWith(refundItem);
  });
});

describe("StatementReconcileSummaryCard", () => {
  it("exibe conferência perfeita com badge Soma conferida quando a diferença é <= 5 centavos", () => {
    render(
      <StatementReconcileSummaryCard
        totalReadCents={50000}
        totalAppCents={20000}
        selectedNewCount={3}
        selectedNewCents={30000}
        officialInvoiceTotalCents={50002}
      />,
    );

    expect(screen.getByText("Soma conferida")).toBeInTheDocument();
    expect(screen.getByText("Total Lido")).toBeInTheDocument();
    expect(screen.getByText("Já no App")).toBeInTheDocument();
    expect(screen.getByText("Novos (3)")).toBeInTheDocument();
  });

  it("exibe aviso de diferença quando o total lido diverge do total oficial da fatura", () => {
    render(
      <StatementReconcileSummaryCard
        totalReadCents={50000}
        totalAppCents={20000}
        selectedNewCount={3}
        selectedNewCents={30000}
        officialInvoiceTotalCents={52000}
      />,
    );

    expect(screen.getByText(/Diferença:/i)).toBeInTheDocument();
  });
});

describe("Duplicatas do App, Cross-Competência e Conciliados Limpos", () => {
  it("StatementAppDuplicateRow exige confirmação em 2 cliques para excluir duplicata do app", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const candidate: AppDuplicateCandidate = {
      id: "app-dup:e1:e2",
      keepExpense: {
        id: "e1",
        date: "2026-11-10",
        description: "Padaria Estrela",
        valueCents: 4070,
        categoryId: "cat-1",
        installmentNumber: null,
        installmentsTotal: null,
      },
      duplicateExpense: {
        id: "e2",
        date: "2026-11-11",
        description: "Padaria Estrela",
        valueCents: 4070,
        categoryId: "cat-1",
        installmentNumber: null,
        installmentsTotal: null,
      },
      keepIsMatchedOnStatement: true,
      reason: "Mesmo valor e descrição semelhante (1 dia de diferença)",
    };

    render(
      <StatementAppDuplicateRow
        candidate={candidate}
        categoryName="Alimentação"
        onDeleteDuplicate={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Excluir duplicata/i }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));
    expect(onDelete).toHaveBeenCalledWith("e2", "single");
  });

  it("StatementReconcileItemRow exibe crossCompetenceMatch e 'Vincular à despesa' quando valor já coincide", async () => {
    const user = userEvent.setup();
    const onMoveCross = vi.fn();

    const crossItem: ReconciliationItem = {
      ...baseReconciliationItem,
      selected: false,
      crossCompetenceMatch: {
        expenseId: "exp-11",
        expenseDescription: "Amazon Brasil",
        expenseDate: "2026-11-28",
        expenseValueCents: 11080,
        currentBillCompetence: "2026-11",
        score: 95,
        statementHash: "hash-tx-1",
      },
    };

    const { rerender } = render(
      <StatementReconcileItemRow
        item={crossItem}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
        onMoveCrossCompetence={onMoveCross}
      />,
    );

    expect(screen.getByText("Na fatura 11/2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mover para esta fatura/i }));
    expect(onMoveCross).toHaveBeenCalledWith(crossItem);

    const probableSameValue: ReconciliationItem = {
      ...baseReconciliationItem,
      status: "probable_match",
      score: 68,
      matchedExpenseId: "exp-22",
      matchedExpenseDescription: "Amazon",
      matchedExpenseDate: "2026-08-13",
      matchedExpenseValueCents: 11080,
      selected: false,
    };

    rerender(
      <StatementReconcileItemRow
        item={probableSameValue}
        categoryOptions={mockCategoryOptions}
        onToggleItem={vi.fn()}
        onChangeCategory={vi.fn()}
        onLinkAndAdjust={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Vincular à despesa/i })).toBeInTheDocument();
  });

  it("StatementReconcileStep não exibe aba ou alerta de Duplicatas quando há apenas itens Conciliados", () => {
    const matchedItem: ReconciliationItem = {
      ...baseReconciliationItem,
      status: "exact_match",
      score: 100,
      selected: false,
      matchedExpenseId: "exp-1",
      matchedExpenseDescription: "Amazon Brasil",
      matchedExpenseDate: "2026-08-15",
      matchedExpenseValueCents: 11080,
    };

    render(
      <StatementReconcileStep
        items={[matchedItem]}
        appDuplicates={[]}
        categories={[
          { id: "cat-1", user_id: "u1", name: "Alimentação", type: "expense", icon: "tag", color: "#000", is_reserved: false, is_active: true },
        ]}
        onToggleItem={vi.fn()}
        onToggleAll={vi.fn()}
        onChangeCategory={vi.fn()}
        onBack={vi.fn()}
        onConfirm={vi.fn()}
        isPending={false}
      />,
    );

    expect(screen.queryByText(/potenciais? duplicidades? detectada/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Duplicatas/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Conciliados \(1\)/i })).toBeInTheDocument();
  });
});
