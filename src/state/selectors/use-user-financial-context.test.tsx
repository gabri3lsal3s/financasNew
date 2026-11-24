import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, Income, Recurrence, UserPreferences } from "@/types";
import { useUserFinancialContext } from "./use-user-financial-context";

let incomesByMonth: Record<string, Income[]> = {};
let expensesByMonth: Record<string, Expense[]> = {};
let recurrencesList: Recurrence[] = [];
let userPrefsData: UserPreferences | null = null;
let realCashCentsMock = 0;
let hasCheckpointMock = false;
let hasCashHistoryMock = false;

vi.mock("@/state", () => ({
  useIncomes: (m: string) => ({ data: incomesByMonth[m] ?? [], isLoading: false }),
  useExpenses: (m: string) => ({ data: expensesByMonth[m] ?? [], isLoading: false }),
  useBudgets: () => ({ data: [], isLoading: false }),
  useCategories: () => ({
    data: [
      { id: "c-food", user_id: "u1", type: "expense", name: "Alimentação", icon: "tag", color: null, is_reserved: false, is_active: true },
      { id: "c-sal", user_id: "u1", type: "income", name: "Salário", icon: "briefcase", color: null, is_reserved: false, is_active: true },
    ],
    isLoading: false,
  }),
  useFeedbackEntries: () => ({ data: [], isLoading: false }),
  useFeedback: () => ({ data: {}, isLoading: false }),
  useRecurrences: () => ({ data: recurrencesList, isLoading: false }),
  useIncomeGoals: () => ({ data: [], isLoading: false }),
  usePortfolioContributions: () => ({ data: [], isLoading: false }),
  useCorporateDividends: () => ({ recentlySettled: [], fxRate: 1, isLoading: false }),
  useUserPreferences: () => ({ data: userPrefsData, isLoading: false }),
  useUserAccess: () => ({ hasFeature: () => true }),
  useRealCashBalance: () => ({
    cashBalance: {
      currentBalanceCents: realCashCentsMock,
      latestCheckpoint: hasCheckpointMock ? { id: "chk-1", date: "2026-08-01", balanceCents: realCashCentsMock } : null,
      inflowSinceCheckpointCents: hasCashHistoryMock ? 100000 : 0,
      outflowSinceCheckpointCents: 0,
      eventsSinceCheckpoint: [],
    },
    safeToSpend: {
      committedObligationsCents: 0,
      safeToSpendCents: realCashCentsMock,
    },
    isLoading: false,
  }),
  usePortfolioPosition: () => ({ rows: [], isLoading: false }),
}));

const makeExpense = (id: string, value: number, date: string): Expense => ({
  id,
  user_id: "u1",
  value,
  date,
  category_id: "c-food",
  payment_method: "pix",
  card_id: null,
  installments_total: 1,
  installment_number: 1,
  installment_group_id: null,
  bill_competence: null,
  report_weight: 1,
  base_amount: value,
  description: "Mercado",
  created_at: `${date}T10:00:00Z`,
});

const makeIncome = (id: string, value: number, date: string): Income => ({
  id,
  user_id: "u1",
  value,
  date,
  category_id: "c-sal",
  receive_type: "transfer",
  description: "Salário",
  report_weight: 1,
  source_ref: null,
  created_at: `${date}T10:00:00Z`,
});

describe("useUserFinancialContext (src/state/selectors)", () => {
  beforeEach(() => {
    incomesByMonth = {};
    expensesByMonth = {};
    recurrencesList = [];
    userPrefsData = null;
    realCashCentsMock = 0;
    hasCheckpointMock = false;
    hasCashHistoryMock = false;
  });

  it("identifica Cold Start sem base no dia 23 com R$ 50 de despesa e sem checkpoint", () => {
    expensesByMonth["2026-08"] = [makeExpense("e1", 50, "2026-08-23")];

    const { result } = renderHook(() =>
      useUserFinancialContext({
        month: "2026-08",
        todayISO: "2026-08-23",
        isCurrentMonth: true,
      }),
    );

    expect(result.current.context.maturity).toBe("cold_start");
    expect(result.current.context.referenceBudgetCents).toBe(0);
    expect(result.current.context.lens.liquidity.hasLiquidityContext).toBe(false);
    expect(result.current.predictedUpcomingInflows).toEqual([]);
  });

  it("gera predictedUpcomingInflows para salário recorrente previsto no dia 5", () => {
    incomesByMonth["2026-07"] = [makeIncome("i-jul", 5000, "2026-07-05")];
    incomesByMonth["2026-08"] = [makeIncome("i-aug", 5000, "2026-08-05")];
    realCashCentsMock = 100000;
    hasCheckpointMock = true;

    const { result } = renderHook(() =>
      useUserFinancialContext({
        month: "2026-09",
        todayISO: "2026-09-02",
        isCurrentMonth: true,
      }),
    );

    expect(result.current.context.maturity).toBe("awaiting_income");
    expect(result.current.predictedUpcomingInflows).toHaveLength(1);
    expect(result.current.predictedUpcomingInflows[0]?.expectedDate).toBe("2026-09-05");
    expect(result.current.predictedUpcomingInflows[0]?.amountCents).toBe(500000);
  });

  it("calcula trava de reserva de emergência (2m/6m -> incompleta vs 6m/6m -> completa vs override externo)", () => {
    incomesByMonth["2026-08"] = [makeIncome("i-aug", 6000, "2026-08-05")];
    expensesByMonth["2026-07"] = [makeExpense("e-jul", 3000, "2026-07-10")];
    expensesByMonth["2026-08"] = [makeExpense("e-aug", 2000, "2026-08-10")];
    realCashCentsMock = 600000; // R$ 6.000 = 2 meses de R$ 3.000
    hasCheckpointMock = true;

    const { result, rerender } = renderHook(
      ({ cash }) =>
        useUserFinancialContext({
          month: "2026-08",
          todayISO: "2026-08-15",
          isCurrentMonth: true,
          realCashBalanceCents: cash,
          hasCashCheckpoint: true,
        }),
      { initialProps: { cash: 600000 } },
    );

    expect(result.current.context.lens.wealth.emergencyMonthsCovered).toBe(2);
    expect(result.current.context.lens.wealth.isEmergencyFundComplete).toBe(false);
    expect(result.current.context.lens.wealth.emergencyGapCents).toBe(1200000);

    // Reserva 6m/6m completa (R$ 18.000)
    rerender({ cash: 1800000 });
    expect(result.current.context.lens.wealth.emergencyMonthsCovered).toBe(6);
    expect(result.current.context.lens.wealth.isEmergencyFundComplete).toBe(true);
    expect(result.current.context.lens.wealth.emergencyGapCents).toBe(0);

    // Reserva 2m/6m com override externo -> completa!
    userPrefsData = {
      user_id: "u1",
      custom_settings: {
        emergencyFundConfig: {
          includeCheckingAccounts: true,
          selectionMode: "auto_cash",
          selectedAssetIds: [],
          selectedClasses: [],
          useNetValue: true,
          targetMonths: 6,
          hasExternalEmergencyFund: true,
        },
      },
    } as unknown as UserPreferences;
    rerender({ cash: 600000 });
    expect(result.current.context.lens.wealth.hasExternalEmergencyFund).toBe(true);
    expect(result.current.context.lens.wealth.isEmergencyFundComplete).toBe(true);
    expect(result.current.context.lens.wealth.emergencyGapCents).toBe(0);
  });
});
