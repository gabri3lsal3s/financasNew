import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  ExistingExpenseForReconciliation,
  ReconciliationPlan,
  StatementQualityGateResult,
} from "@/domain/reconciliation";
import { CategoryPill } from "./category-pill";
import { StatementAppOnlyRow } from "./statement-app-rows";
import { StatementItemForm } from "./statement-item-form";
import { StatementMappingFallback } from "./statement-mapping-fallback";
import { StatementSuccessStep } from "./statement-success-step";
import { StatementSummaryHeader } from "./statement-summary-header";

const CATEGORY_OPTIONS = [
  { value: "cat-1", label: "Alimentação" },
  { value: "cat-2", label: "Transporte" },
];

function makePlan(overrides: Partial<ReconciliationPlan> = {}): ReconciliationPlan {
  return {
    cardId: "card-1",
    competenceMonth: "2026-11",
    blockedByRollover: false,
    paidBillLocksRestricted: false,
    newExpensesToCreate: [],
    futureInstallmentsToProject: [],
    refundsToRegister: [],
    microAdjustmentsToApply: [],
    manualLinkAdjustments: [],
    competenceMovesToApply: [],
    expenseIdsToDelete: [],
    totalActionCount: 0,
    pendingOptInCount: 0,
    ...overrides,
  };
}

describe("Onda 4 — Componentes Padronizados de Importação de Fatura", () => {
  it("CategoryPill renderiza busca >= 16px mobile sem autoFocus e seleciona categoria", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CategoryPill value="cat-1" options={CATEGORY_OPTIONS} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Categoria: Alimentação/i }));

    const searchInput = await screen.findByPlaceholderText("Buscar categoria...");
    expect(searchInput.className).toContain("text-base");
    expect(searchInput).not.toHaveAttribute("autofocus");

    await user.type(searchInput, "Trans");
    await user.click(screen.getByRole("button", { name: /Transporte/i }));
    expect(onChange).toHaveBeenCalledWith("cat-2");
  });

  it("StatementItemForm permite alternar Compra <-> Estorno (D18) com FormField padronizado", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <StatementItemForm
        mode="edit"
        categoryOptions={CATEGORY_OPTIONS}
        initialValues={{
          date: "2026-11-10",
          cleanDescription: "Amazon Brasil",
          amountCents: 15000,
          selectedCategoryId: "cat-1",
          isRefund: false,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Tipo de lançamento")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Estorno" }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        cleanDescription: "Amazon Brasil",
        amountCents: 15000,
        isRefund: true,
        selectedCategoryId: "cat-1",
      }),
    );
  });

  it("StatementSummaryHeader exibe apenas status contábil objetivo (zero selos técnicos) e micro-link de Atenção", async () => {
    const user = userEvent.setup();
    const onReviewAttention = vi.fn();
    const onOpenMapping = vi.fn();
    const qualityGate: StatementQualityGateResult = {
      passed: false,
      score: 68,
      reasons: ["checksum_underflow"],
      cycleNetCents: 19500,
      statementBalanceCents: 19500,
      effectiveTargetCents: 20000,
      diffCents: 500,
      checksumEquation: "cycle_net",
    };

    const { container } = render(
      <StatementSummaryHeader
        totalReadCents={19500}
        totalAppCents={0}
        printedTotalCents={20000}
        qualityGate={qualityGate}
        plan={makePlan({ totalActionCount: 2, pendingOptInCount: 3 })}
        activeTab="import"
        canAdjustColumns={false}
        onOpenMapping={onOpenMapping}
        onChangeFile={vi.fn()}
        onReviewAttention={onReviewAttention}
      />,
    );

    expect(screen.getByText("Conferência da fatura")).toBeInTheDocument();
    expect(container.textContent).toContain("Diferença de");
    expect(screen.queryByText(/Reanalisar com IA/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estruturado com IA|Leitura assistida|Layout aprendido|Leitura local/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajustar colunas/i })).not.toBeInTheDocument();

    const reviewBtn = screen.getByRole("button", { name: /3 itens em Atenção não incluídos/i });
    await user.click(reviewBtn);
    expect(onReviewAttention).toHaveBeenCalledTimes(1);
  });

  it("StatementAppOnlyRow alterna 'Marcar para excluir' e 'Desfazer' e bloqueia quando fatura quitada/rolada", async () => {
    const user = userEvent.setup();
    const onQueueDelete = vi.fn();
    const onUndoDelete = vi.fn();
    const expense: ExistingExpenseForReconciliation = {
      id: "exp-1",
      date: "2026-11-05",
      description: "Compra órfã no app",
      valueCents: 8900,
      categoryId: "cat-1",
      installmentNumber: 1,
      installmentsTotal: 1,
    };

    const { rerender } = render(
      <StatementAppOnlyRow
        expense={expense}
        categoryName="Alimentação"
        isQueuedForDelete={false}
        isLockedByBillProtection={false}
        onQueueDelete={onQueueDelete}
        onUndoDelete={onUndoDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Marcar para excluir/i }));
    expect(onQueueDelete).toHaveBeenCalledWith("exp-1");

    rerender(
      <StatementAppOnlyRow
        expense={expense}
        categoryName="Alimentação"
        isQueuedForDelete={true}
        isLockedByBillProtection={false}
        onQueueDelete={onQueueDelete}
        onUndoDelete={onUndoDelete}
      />,
    );
    expect(screen.getByText("Marcado para excluir")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Desfazer/i }));
    expect(onUndoDelete).toHaveBeenCalledWith("exp-1");

    rerender(
      <StatementAppOnlyRow
        expense={expense}
        categoryName="Alimentação"
        isQueuedForDelete={false}
        isLockedByBillProtection={true}
        onQueueDelete={onQueueDelete}
        onUndoDelete={onUndoDelete}
      />,
    );
    expect(screen.getByRole("button", { name: /Marcar para excluir/i })).toBeDisabled();
  });

  it("StatementMappingFallback preserva headerRowIndex real em CSV com preâmbulo bancário", () => {
    const onConfirmMapping = vi.fn();
    const rows = [
      { rowIndex: 0, rawText: "Banco XYZ", cells: ["Banco XYZ"] },
      { rowIndex: 1, rawText: "Cliente;Fulano", cells: ["Cliente", "Fulano"] },
      { rowIndex: 2, rawText: "Data;Estabelecimento;Valor", cells: ["Data", "Estabelecimento", "Valor"] },
      { rowIndex: 3, rawText: "10/11/2026;Padaria;25,00", cells: ["10/11/2026", "Padaria", "25,00"] },
    ];

    const { container } = render(
      <StatementMappingFallback
        rows={rows}
        initialMapping={{
          dateColIndex: 0,
          descriptionColIndex: 1,
          amountColIndex: 2,
          hasHeader: true,
          startRowIndex: 3,
        }}
        onConfirmMapping={onConfirmMapping}
        onBack={vi.fn()}
      />,
    );

    fireEvent.submit(container.querySelector("form")!);
    expect(onConfirmMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        hasHeader: true,
        startRowIndex: 3,
      }),
    );
  });

  it("StatementSuccessStep exibe resumo aplicado e saldo estimado formatado via MoneyText", () => {
    const { container } = render(
      <StatementSuccessStep
        cardName="Nubank Roxinho"
        competenceMonth="2026-11"
        summary={{
          insertedCount: 4,
          projectedCount: 6,
          skippedCount: 1,
          adjustedCount: 1,
          movedCount: 0,
          refundsCount: 1,
          deletedCount: 0,
          openBalanceAfterCents: 125000,
        }}
      />,
    );

    expect(screen.getByText("Fatura conciliada com sucesso")).toBeInTheDocument();
    expect(screen.getByText("Compras e encargos lançados")).toBeInTheDocument();
    expect(screen.getByText("Parcelas futuras projetadas")).toBeInTheDocument();
    expect(screen.getByText("Estornos registrados")).toBeInTheDocument();
    expect(container.textContent).toContain("1.250,00");
  });
});
