import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReconciliationItem } from "@/domain/reconciliation";
import {
  CategoryPill,
  StatementInlineAddRow,
  StatementInlineEditRow,
  StatementReconcileItemRow,
} from "./statement-reconcile-rows";
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
