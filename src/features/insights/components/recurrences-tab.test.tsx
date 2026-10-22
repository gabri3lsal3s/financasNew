import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecurrencesTab } from "./recurrences-tab";
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
  useCreateRecurrence: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetFeedback: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const mockOccurrences: RecurrenceOccurrence[] = [
  {
    key: "sub:spotify",
    name: "Spotify",
    level: "subscription",
    segment: "streaming",
    months: ["2026-06", "2026-07", "2026-08"],
    averageCents: 2190,
    confidence: 0.99,
    tier: "can_cut",
    typicalDayOfMonth: 15,
    expenses: [
      {
        id: "exp-sp-1",
        description: "Spotify",
        date: "2026-08-15",
        month: "2026-08",
        valueCents: 2190,
        categoryId: "c-lazer",
        categoryName: "Música",
      },
    ],
  },
];

const mockIgnored: RecurrenceOccurrence[] = [
  {
    key: "recurring:academia",
    name: "Academia Smart Fit",
    level: "recurring",
    segment: "fitness",
    months: ["2026-06", "2026-07", "2026-08"],
    averageCents: 11990,
    confidence: 0.9,
    typicalDayOfMonth: 5,
    expenses: [
      {
        id: "exp-ac-1",
        description: "Academia Smart Fit",
        date: "2026-08-05",
        month: "2026-08",
        valueCents: 11990,
        categoryId: "c-saude",
        categoryName: "Saúde",
      },
    ],
  },
];

describe("RecurrencesTab", () => {
  it("renderiza o card de resumo e a lista de ocorrências ativas", () => {
    render(
      <RecurrencesTab
        totalRecurringCents={2190}
        totalAnnualRecurringCents={26280}
        canCutRecurringCents={2190}
        canCutAnnualCents={26280}
        activeOccurrences={mockOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{}}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    expect(screen.getByText("Total mensal recorrente")).toBeInTheDocument();
    expect(screen.getByText("Total anual projetado")).toBeInTheDocument();
    expect(screen.getByText("Economia potencial (corte)")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
  });

  it("abre o modal de auditoria e drill-down ao clicar em um item da lista ativa", async () => {
    const user = userEvent.setup();

    render(
      <RecurrencesTab
        totalRecurringCents={2190}
        totalAnnualRecurringCents={26280}
        canCutRecurringCents={2190}
        canCutAnnualCents={26280}
        activeOccurrences={mockOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{}}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    const spotifyRow = screen.getByRole("button", { name: "Ver detalhes de Spotify" });
    await user.click(spotifyRow);

    expect(screen.getByText("Auditoria detalhada e histórico de cobranças")).toBeInTheDocument();
    expect(screen.getByText("Histórico de lançamentos (1)")).toBeInTheDocument();
    expect(screen.getByText("15/08/2026")).toBeInTheDocument();
  });

  it("abre o modal de auditoria ao clicar em um item da lista de ignoradas", async () => {
    const user = userEvent.setup();

    render(
      <RecurrencesTab
        totalRecurringCents={2190}
        totalAnnualRecurringCents={26280}
        canCutRecurringCents={2190}
        canCutAnnualCents={26280}
        activeOccurrences={mockOccurrences}
        ignoredOccurrences={mockIgnored}
        feedbackMap={{ "recurring:academia": "ignore" }}
        showIgnored={true}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    const academiaRow = screen.getByRole("button", { name: "Ver detalhes de Academia Smart Fit" });
    await user.click(academiaRow);

    expect(screen.getByText("Auditoria detalhada e histórico de cobranças")).toBeInTheDocument();
    expect(screen.getByText("05/08/2026")).toBeInTheDocument();
    expect(screen.getByText("Saúde")).toBeInTheDocument();
  });

  it("permite abrir o diálogo de agendamento formal a partir do botão Fixar formal em ocorrência confirmada", async () => {
    const user = userEvent.setup();

    render(
      <RecurrencesTab
        totalRecurringCents={2190}
        totalAnnualRecurringCents={26280}
        canCutRecurringCents={2190}
        canCutAnnualCents={26280}
        activeOccurrences={mockOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{ "sub:spotify": "confirm" }}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    const fixarFormalBtn = screen.getByRole("button", { name: "Fixar Spotify como Recorrência Formal" });
    expect(fixarFormalBtn).toBeInTheDocument();

    await user.click(fixarFormalBtn);

    expect(screen.getByText("Fixar como Recorrência Formal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spotify")).toBeInTheDocument();
  });

  it("permite abrir o diálogo de agendamento formal a partir do modal de auditoria", async () => {
    const user = userEvent.setup();

    render(
      <RecurrencesTab
        totalRecurringCents={2190}
        totalAnnualRecurringCents={26280}
        canCutRecurringCents={2190}
        canCutAnnualCents={26280}
        activeOccurrences={mockOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{}}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    const spotifyRow = screen.getByRole("button", { name: "Ver detalhes de Spotify" });
    await user.click(spotifyRow);

    const fixarBtn = screen.getByRole("button", { name: "Fixar como Recorrência Formal" });
    await user.click(fixarBtn);

    expect(screen.getByText("Fixar como Recorrência Formal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Spotify")).toBeInTheDocument();
  });
});
