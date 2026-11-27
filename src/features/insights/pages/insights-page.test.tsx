import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InsightsPage } from "./insights-page";

const renderInsights = (props = {}) => {
  return render(
    <MemoryRouter>
      <InsightsPage {...props} />
    </MemoryRouter>,
  );
};

const setFeedbackMock = vi.fn();

const expenseCategories = [
  { id: "c1", name: "Alimentação", icon: "alimentacao", color: null, type: "expense" },
  { id: "c2", name: "Lazer", icon: "lazer", color: null, type: "expense" },
  { id: "c4", name: "Compras", icon: "compras", color: null, type: "expense" },
];
const incomeCategories = [{ id: "c3", name: "Salário", icon: "salario", color: null, type: "income" }];

/** Fixture mutável (vi.hoisted — disponível no factory do mock) para os cenários F27. */
const fixture = vi.hoisted(() => ({
  incomeCents: 500_000,
  // Default: 2 despesas de Lazer por mês (11.890¢) em dias úteis.
  monthlyExpenses: (month: string) => [
    { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 1990, report_weight: 1, date: `${month}-05`, installment_group_id: null },
    { id: `${month}-2`, description: "Academia", category_id: "c2", value: 9900, report_weight: 1, date: `${month}-10`, installment_group_id: null },
  ],
}));

vi.mock("@/state", () => ({
  usePortfolioContributions: () => ({ data: [], isLoading: false, error: null }),
  useAllPortfolioTransactions: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioSnapshots: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioDividends: () => ({ data: [], isLoading: false, error: null }),
  useUserAccess: () => ({ role: "user", status: "active", isAdmin: false, isSuperAdmin: false, hasFeature: () => true, isLoading: false }),
  useViewScope: () => ({ viewScope: "all" as const, effectiveViewScope: "all" as const, setViewScope: vi.fn(), isBusinessModeEnabled: false }),
  useBusinessMode: () => ({ isBusinessModeEnabled: false, businessProfile: null, toggleBusinessMode: vi.fn(), updateBusinessProfile: vi.fn(), isLoading: false, isPending: false }),
  useSavePocketCostMilestoneAtomic: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteInternalTransferPair: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUserFinancialContext: () => ({ context: undefined, isLoading: false }),
  useSetBudgetLimit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEnableWebPushSubscription: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useDisableWebPushSubscription: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useRegisterFcmToken: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useDisableFcmToken: () => ({ mutateAsync: vi.fn().mockResolvedValue(true), isPending: false }),
  useUpdateReminderPreferences: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useExpenses: (month: string) => ({
    data: fixture.monthlyExpenses(month),
    isLoading: false,
    error: null,
  }),
  useIncomes: () => ({
    data: [{ id: "i1", value: fixture.incomeCents / 100, report_weight: 1, category_id: "c3", date: "2026-08-05" }],
    isLoading: false,
    error: null,
  }),
  useBudgets: () => ({
    data: [{ category_id: "c1", month: "2026-08", limit: 2000 }],
    isLoading: false,
    error: null,
  }),
  useCategories: () => ({
    data: [...expenseCategories, ...incomeCategories],
    isLoading: false,
    error: null,
  }),
  useCreditCards: () => ({
    data: [{ id: "card-1", name: "Nubank", limit: 5000 }],
    isLoading: false,
    error: null,
  }),
  useDebts: () => ({
    data: [
      { id: "d1", name: "Receber", type: "receivable", amount: 1000, due_date: "2026-08-20", paid_at: null },
    ],
    isLoading: false,
    error: null,
  }),
  useFeedback: () => ({
    data: {},
    isLoading: false,
    error: null,
  }),
  useFeedbackEntries: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useSetFeedback: () => ({ mutate: setFeedbackMock }),
  useCreateRecurrence: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecurrences: () => ({ data: [], isLoading: false, error: null }),
  useUserPreferences: () => ({ data: { custom_settings: {} }, isLoading: false, error: null }),
  useUpdateCustomSettings: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  usePortfolioPosition: () => ({
    rows: [],
    totalBRL: 0,
    cashBRL: 0,
    monthlySeries: [],
    monthlyContributionCents: 0,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useRealCashBalance: () => ({
    cashBalance: { currentBalanceCents: 1_200_000 },
    safeToSpend: { safeToSpendCents: 1_200_000 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useEmergencyFundComposition: () => ({
    composition: {
      totalReserveCents: 1_200_000,
      cashInAccountsCents: 1_200_000,
      portfolioReserveCents: 0,
      breakdown: [],
      warnings: [],
      targetMonths: 6,
      targetMonthsProgressPercent: 100,
      targetMonthsCents: 1_200_000,
    },
    config: {
      includeCheckingAccounts: true,
      selectionMode: "auto_cash",
      selectedAssetIds: [],
      selectedClasses: [],
      useNetValue: true,
      targetMonths: 6,
    },
    updateConfig: vi.fn(),
    isLoading: false,
    isUpdating: false,
    portfolioRows: [],
  }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false, isLoading: false }),
  useMyFamily: () => ({ data: null, isLoading: false }),
  useFamilyConsolidation: () => ({ data: null, isLoading: false, isError: false, error: null }),
  useIncomeGoals: () => ({ data: [], isLoading: false, isError: false, error: null }),
}));

describe("InsightsPage (motor de insights §3.7)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.incomeCents = 500_000;
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 1990, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Academia", category_id: "c2", value: 9900, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
  });
  it("renderiza as abas de cards analíticos isolados com 'Diagnósticos' como inicial", () => {
    renderInsights();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAccessibleName("Diagnósticos");
    expect(tabs[1]).toHaveAccessibleName("Recorrências");
    expect(tabs[2]).toHaveAccessibleName("Projeção");
    // Na visão inicial de Diagnósticos, os diagnósticos e alertas estão presentes.
    expect(screen.getByText("Saúde da poupança")).toBeInTheDocument();
    expect(screen.getByText("Tendência de gastos")).toBeInTheDocument();
  });

  it("lista assinaturas/recorrências e permite ignorar", async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Recorrências" }));
    // Streaming com valor estável em 3 meses → assinatura.
    expect(screen.getByText("Streaming")).toBeInTheDocument();

    const ignoreButton = screen.getByRole("button", { name: "Ignorar Streaming" });
    await user.click(ignoreButton);
    const reasonOption = screen.getByText("É despesa pontual");
    await user.click(reasonOption);
    expect(setFeedbackMock).toHaveBeenCalledWith({
      occurrenceKey: expect.any(String),
      decision: "one_off",
    });
  });

  it("permite confirmar assinatura via botão animado", async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Recorrências" }));

    const confirmButtons = screen.getAllByRole("button", { name: /Confirmar/ });
    expect(confirmButtons.length).toBeGreaterThan(0);
    await user.click(confirmButtons[0]!);
    expect(setFeedbackMock).toHaveBeenCalledWith({
      occurrenceKey: expect.any(String),
      decision: "confirm",
    });
  });

  it("renderiza projeção e corte com pendências e runway", async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    expect(screen.getByText("Projeção de gastos")).toBeInTheDocument();
    expect(screen.getByText("Reserva de Emergência & Autonomia")).toBeInTheDocument();
    expect(screen.getByText("Pendências do período")).toBeInTheDocument();
  });

  it("renderiza diagnósticos com tendência de gastos (F19 — motor §3.7.6)", async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Diagnósticos" }));
    expect(screen.getByText("Saúde da poupança")).toBeInTheDocument();
    expect(screen.getByText("Tendência de gastos")).toBeInTheDocument();
    // Mês atual igual ao anterior (fixture) → variação 0,0% (não significativa).
    expect(screen.getByText("0,0%")).toBeInTheDocument();
  });

  it("diagnósticos: gastos de fim de semana comparáveis exibem a razão com massa crítica (>= 4 despesas) e sem alerta absurdo (F27 + Fase 4)", async () => {
    const user = userEvent.setup();
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 19.9, report_weight: 1, date: `${month}-03`, installment_group_id: null },
      { id: `${month}-2`, description: "Academia", category_id: "c2", value: 99, report_weight: 1, date: `${month}-04`, installment_group_id: null },
      { id: `${month}-3`, description: "Cinema", category_id: "c2", value: 45, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-4`, description: "Livro", category_id: "c4", value: 60, report_weight: 1, date: `${month}-06`, installment_group_id: null },
    ];
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Diagnósticos" }));
    // Fixture: 4 despesas só em dias úteis → razão 0,0× (comparável, sem alerta).
    expect(screen.getByText("0,0×")).toBeInTheDocument();
    expect(screen.queryByText(/gastos de fim de semana.*maiores/i)).not.toBeInTheDocument();
  });

  it("desafios: linha '30% em não essenciais' some quando duplica o desafio individual e Alimentação nunca entra como corte (F27 + Blindagem)", async () => {
    const user = userEvent.setup();
    // Lazer (não essencial) + Alimentação (essencial, deve ser blindada mesmo com alto gasto).
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Viagem", category_id: "c2", value: 800, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Mercado e Feira", category_id: "c1", value: 900, report_weight: 1, date: `${month}-08`, installment_group_id: null },
    ];
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    // O desafio individual aparece apenas para Lazer; Alimentação jamais vira desafio de corte!
    expect(screen.getByText(/Lazer — cortar 30%/)).toBeInTheDocument();
    expect(screen.queryByText(/Alimentação — cortar/)).not.toBeInTheDocument();
    // A linha agregada fica oculta (apenas 1 categoria discricionária elegível).
    expect(screen.queryByText("30% em não essenciais")).not.toBeInTheDocument();
  });

  it("desafios: linha '30% em não essenciais' aparece com 2+ categorias discricionárias elegíveis (F27)", async () => {
    const user = userEvent.setup();
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Shows", category_id: "c2", value: 600, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Roupas", category_id: "c4", value: 550, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
    renderInsights();
    await user.click(screen.getByRole("tab", { name: "Projeção" }));
    expect(screen.getByText("30% em não essenciais")).toBeInTheDocument();
  });

  it("exibe avisos convertidos na seção de Avisos & Recomendações", () => {
    // Renda R$ 5.000, despesas R$ 118,90 -> poupança > 90%
    fixture.monthlyExpenses = (month) => [
      { id: `${month}-1`, description: "Streaming", category_id: "c2", value: 19.9, report_weight: 1, date: `${month}-05`, installment_group_id: null },
      { id: `${month}-2`, description: "Academia", category_id: "c2", value: 99, report_weight: 1, date: `${month}-10`, installment_group_id: null },
    ];
    renderInsights();
    expect(screen.getByRole("region", { name: "Avisos e recomendações" })).toBeInTheDocument();
    expect(screen.getByText(/Poupança saudável:/)).toBeInTheDocument();
  });

  it("exibe aviso consultivo quando as despesas superam receitas e renderiza Ritual de Fechamento nos dias 1–5", () => {
    // Renda R$ 50, despesas R$ 11.890
    fixture.incomeCents = 5_000;
    vi.setSystemTime(new Date("2026-08-03T12:00:00Z"));
    renderInsights();
    expect(screen.getByText(/Despesas acima das receitas do período:/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ritual de fechamento mensal" })).toBeInTheDocument();
  });

  it("renderiza a aba Projeção com fechamento, runway e termometro de reserva", async () => {
    const user = userEvent.setup();
    renderInsights();
    await user.click(screen.getByRole("tab", { name: /Projeção/i }));
    expect(screen.getByText("Reserva de Emergência & Autonomia")).toBeInTheDocument();
    expect(screen.getByText("Autonomia estimada")).toBeInTheDocument();
    expect(screen.getByText("Pendências do período")).toBeInTheDocument();
  });
});
