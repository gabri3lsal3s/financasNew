import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecurrenceAuditModal } from "./recurrence-audit-modal";
import type { RecurrenceOccurrence } from "@/domain/insights/recurrences";

vi.mock("@/state", () => ({
  useUserSubscription: () => ({
    canWrite: true,
    isReadOnly: false,
    tier: "pro_annual",
  }),
  useCategories: () => ({ data: [], isLoading: false, error: null }),
  useCreditCards: () => ({ data: [], isLoading: false, error: null }),
  useDeleteExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateExpenseGrouped: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurrenceOccurrences: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const baseOccurrence: RecurrenceOccurrence = {
  key: "sub:netflix",
  name: "Netflix",
  level: "subscription",
  segment: "streaming",
  months: ["2026-06", "2026-07", "2026-08"],
  averageCents: 3990,
  confidence: 0.95,
  typicalDayOfMonth: 10,
  daysUntilNextDue: 5,
  tier: "can_cut",
  expenses: [
    {
      id: "exp-3",
      description: "Netflix",
      date: "2026-08-10",
      month: "2026-08",
      valueCents: 3990,
      categoryId: "cat-lazer",
      categoryName: "Lazer e Streaming",
      paymentMethod: "credit_card",
      cardName: "Nubank Ultravioleta",
    },
    {
      id: "exp-2",
      description: "Netflix",
      date: "2026-07-10",
      month: "2026-07",
      valueCents: 3990,
      categoryId: "cat-lazer",
      categoryName: "Lazer e Streaming",
      paymentMethod: "credit_card",
      cardName: "Nubank Ultravioleta",
    },
    {
      id: "exp-1",
      description: "Netflix",
      date: "2026-06-10",
      month: "2026-06",
      valueCents: 3990,
      categoryId: "cat-lazer",
      categoryName: "Lazer e Streaming",
      paymentMethod: "credit_card",
      cardName: "Nubank Ultravioleta",
    },
  ],
};

describe("RecurrenceAuditModal", () => {
  it("renderiza detalhes da ocorrência, badges, métricas e histórico de lançamentos", () => {
    render(
      <RecurrenceAuditModal
        occurrence={baseOccurrence}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Auditoria detalhada e histórico de cobranças")).toBeInTheDocument();
    expect(screen.getByText("Streaming")).toBeInTheDocument();
    expect(screen.getByText("Pode cortar")).toBeInTheDocument();

    // Métricas de resumo
    expect(screen.getByText("Valor médio")).toBeInTheDocument();
    expect(screen.getByText("Custo anual")).toBeInTheDocument();
    expect(screen.getByText("Dia ~10")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();

    // Histórico de transações
    expect(screen.getByText("Histórico de lançamentos (3)")).toBeInTheDocument();
    expect(screen.getByText("10/08/2026")).toBeInTheDocument();
    expect(screen.getByText("10/07/2026")).toBeInTheDocument();
    expect(screen.getByText("10/06/2026")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank Ultravioleta")).toHaveLength(3);
  });

  it("exibe destaque contextual de cobrança duplicada quando duplicateChargesThisMonth >= 2", () => {
    const duplicateOccurrence: RecurrenceOccurrence = {
      ...baseOccurrence,
      duplicateChargesThisMonth: 2,
      expenses: [
        {
          id: "exp-dup-1",
          description: "Netflix",
          date: "2026-08-10",
          month: "2026-08",
          valueCents: 3990,
          categoryId: "cat-lazer",
        },
        {
          id: "exp-dup-2",
          description: "Netflix",
          date: "2026-08-10",
          month: "2026-08",
          valueCents: 3990,
          categoryId: "cat-lazer",
        },
      ],
    };

    render(
      <RecurrenceAuditModal
        occurrence={duplicateOccurrence}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Cobrança duplicada detectada")).toBeInTheDocument();
    expect(
      screen.getByText(/Identificamos 2 cobranças registradas para este serviço no mesmo ciclo/),
    ).toBeInTheDocument();

    const duplicateBadges = screen.getAllByText("Cobrança duplicada");
    expect(duplicateBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("exibe comparativo lado a lado de reajuste detectado com percentual e valores", () => {
    const adjustedOccurrence: RecurrenceOccurrence = {
      ...baseOccurrence,
      priceAdjustment: {
        oldCents: 3990,
        newCents: 5590,
        percentIncrease: 40,
        kind: "inflationary",
        isInflationary: true,
        isPlanChange: false,
        label: "Reajuste inflacionário",
      },
    };

    render(
      <RecurrenceAuditModal
        occurrence={adjustedOccurrence}
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Reajuste inflacionário")).toBeInTheDocument();
    expect(screen.getByText("+40%")).toBeInTheDocument();
    expect(screen.getByText("Valor histórico anterior")).toBeInTheDocument();
    expect(screen.getByText("Valor mais recente")).toBeInTheDocument();
    expect(screen.getByText("(+40%)")).toBeInTheDocument();
  });

  it("chama onEditExpense ao clicar no botão Editar de uma transação", async () => {
    const user = userEvent.setup();
    const handleEditExpense = vi.fn();

    render(
      <RecurrenceAuditModal
        occurrence={baseOccurrence}
        open={true}
        onOpenChange={vi.fn()}
        onEditExpense={handleEditExpense}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: /Editar lançamento de/ });
    expect(editButtons.length).toBe(3);

    await user.click(editButtons[0]!);
    expect(handleEditExpense).toHaveBeenCalledTimes(1);
    expect(handleEditExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "exp-3",
        value: 39.9,
      }),
    );
  });
});
