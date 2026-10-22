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

  it("exibe bloco informativo do impacto na fatura em aberto para cartão associado a assinaturas (F22 / Tarefa 7.6)", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const cardNubank = {
      id: "card-nubank",
      name: "Nubank Ultravioleta",
      brand: "Mastercard",
      credit_limit: 5000,
      color: "#8B5CF6",
      closing_day: 28,
      due_day: 5,
      is_active: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      user_id: "u1",
    };

    const cardOccurrences: RecurrenceOccurrence[] = [
      {
        key: "sub:netflix",
        name: "Netflix",
        level: "subscription",
        segment: "streaming",
        months: ["2026-06", "2026-07", "2026-08"],
        averageCents: 3990,
        confidence: 0.98,
        typicalDayOfMonth: 10,
        nextDueDate: todayStr, // hoje
        cardId: "card-nubank",
        cardName: "Nubank Ultravioleta",
        paymentMethod: "credit_card",
      },
    ];

    render(
      <RecurrencesTab
        totalRecurringCents={3990}
        totalAnnualRecurringCents={47880}
        canCutRecurringCents={0}
        canCutAnnualCents={0}
        activeOccurrences={cardOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{}}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
        cards={[cardNubank]}
      />,
    );

    expect(screen.getByText("Impacto de Assinaturas na Fatura em Aberto")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank Ultravioleta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Você possui/i)).toBeInTheDocument();
    expect(screen.getByText(/em assinaturas previstas para este cartão antes do fechamento da fatura/i)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 39,90").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exibe alerta preventivo quando o total de assinaturas projetadas no cartão supera o limite disponível (F22 / Tarefa 7.6)", () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const cardLimitLow = {
      id: "card-nubank",
      name: "Nubank Ultravioleta",
      brand: "Mastercard",
      credit_limit: 20, // R$ 20,00 vs R$ 39,90 de assinatura
      color: "#8B5CF6",
      closing_day: 28,
      due_day: 5,
      is_active: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      user_id: "u1",
    };

    const cardOccurrences: RecurrenceOccurrence[] = [
      {
        key: "sub:netflix",
        name: "Netflix",
        level: "subscription",
        segment: "streaming",
        months: ["2026-06", "2026-07", "2026-08"],
        averageCents: 3990,
        confidence: 0.98,
        typicalDayOfMonth: 10,
        nextDueDate: todayStr,
        cardId: "card-nubank",
        cardName: "Nubank Ultravioleta",
        paymentMethod: "credit_card",
      },
    ];

    render(
      <RecurrencesTab
        totalRecurringCents={3990}
        totalAnnualRecurringCents={47880}
        canCutRecurringCents={0}
        canCutAnnualCents={0}
        activeOccurrences={cardOccurrences}
        ignoredOccurrences={[]}
        feedbackMap={{}}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
        cards={[cardLimitLow]}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Alerta de Limite Comprometido")).toBeInTheDocument();
    expect(screen.getByText(/supera o limite disponível/i)).toBeInTheDocument();
  });

  it("permite micro-feedback qualificado 'Já cancelei' celebrando a economia gerada", async () => {
    const user = userEvent.setup();
    const onFeedbackMock = vi.fn();

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
        onFeedback={onFeedbackMock}
      />,
    );

    const ignoreBtn = screen.getByRole("button", { name: "Ignorar Spotify" });
    await user.click(ignoreBtn);

    const cancelOption = screen.getByText("Já cancelei");
    await user.click(cancelOption);

    expect(onFeedbackMock).toHaveBeenCalledWith("sub:spotify", "already_cancelled");
  });

  it("exibe métrica de economia celebrada no card de resumo para assinaturas já canceladas", () => {
    render(
      <RecurrencesTab
        totalRecurringCents={0}
        totalAnnualRecurringCents={0}
        canCutRecurringCents={0}
        canCutAnnualCents={0}
        activeOccurrences={[]}
        ignoredOccurrences={mockOccurrences}
        feedbackMap={{ "sub:spotify": "already_cancelled" }}
        showIgnored={false}
        setShowIgnored={vi.fn()}
        onFeedback={vi.fn()}
      />,
    );

    expect(screen.getByText("Economia celebrada (canceladas)")).toBeInTheDocument();
    expect(screen.getByText("Conquistada com sucesso")).toBeInTheDocument();
    expect(screen.getByText("R$ 262,80")).toBeInTheDocument();
  });
});
