import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useReportsData } from "./use-reports-data";

let mockExpenses: Array<{ id: string; date: string; category_id: string; value: number; report_weight: number; payment_method: string }> = [];
let mockPositionLoading = false;
let mockPositionError: Error | null = null;

vi.mock("@/state", () => ({
  useExpenses: () => ({ data: mockExpenses, isLoading: false, error: null, refetch: vi.fn() }),
  useIncomes: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useExpensesByRange: () => ({ data: mockExpenses, isLoading: false, error: null, refetch: vi.fn() }),
  useIncomesByRange: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useDebts: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useCategories: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useBudgets: () => ({ data: [], isLoading: false, error: null }),
  useFamilyMode: () => ({ isFamilyModeEnabled: false }),
  useMyFamily: () => ({ data: null, isLoading: false, error: null }),
  useFamilyConsolidation: () => ({ data: null, isLoading: false, error: null }),
  usePortfolioPosition: () => ({
    rows: [],
    totalBRL: 0,
    totalCostBRL: 0,
    cashBRL: 0,
    totalDividendsBRL: 0,
    isLoading: mockPositionLoading,
    error: mockPositionError,
    refetch: vi.fn(),
  }),
  usePortfolioMonthlyPosition: () => ({ data: null, isLoading: false, error: null }),
  useEmergencyFundComposition: () => ({
    composition: { totalReserveCents: 0 },
  }),
  usePortfolioSnapshots: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  useMacroIndicators: () => ({ data: null, isLoading: false, error: null }),
  usePortfolioAssets: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
  usePortfolioDividends: () => ({ data: [], isLoading: false, error: null }),
  useAllPortfolioTransactions: () => ({ data: [], isLoading: false, error: null }),
  usePortfolioContributions: () => ({ data: [], isLoading: false, error: null }),
  useGroupTargets: () => ({ data: [], isLoading: false, error: null }),
  useRealCashBalance: () => ({
    cashBalance: { currentBalanceCents: 500000 },
    cycleBreakdown: { openInvoicesCents: 150000 },
    safeToSpend: { safeToSpendCents: 350000 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("useReportsData — gates, períodos e integridade de cálculo", () => {
  beforeEach(() => {
    mockExpenses = [];
    mockPositionLoading = false;
    mockPositionError = null;
  });

  it("não inventa despesa mensal de R$ 3.000 quando não há gastos no mês", () => {
    const { result } = renderHook(() =>
      useReportsData({
        hasFinanceFeatures: true,
        hasInvestmentsFeature: true,
        weightsEnabled: true,
        month: "2026-08",
        year: 2026,
        mode: "month",
        debouncedCustomStart: "",
        debouncedCustomEnd: "",
      }),
    );

    expect(result.current.freedomAnalysis.monthlyExpensesBRL).toBe(0);
    expect(result.current.freedomAnalysis.freedomPct).toBe(0);
    expect(result.current.freedomAnalysis.runwayMonths).toBe(0);
  });

  it("formata customStart/customEnd em pt-BR no periodLabel e usa appName Axir no workbook", () => {
    const { result } = renderHook(() =>
      useReportsData({
        hasFinanceFeatures: true,
        hasInvestmentsFeature: true,
        weightsEnabled: true,
        month: "2026-08",
        year: 2026,
        mode: "custom",
        debouncedCustomStart: "2026-08-01",
        debouncedCustomEnd: "2026-08-15",
        customStart: "2026-08-01",
        customEnd: "2026-08-15",
      }),
    );

    expect(result.current.periodLabel).toBe("01/08/2026 a 15/08/2026");
    expect(result.current.workbookData.appName).toBe("Axir");
  });

  it("não trava a aba Finanças nem vaza erro de investimentos quando gateado", () => {
    mockPositionLoading = true;
    mockPositionError = new Error("Falha carteira");

    const onFinancasTab = renderHook(() =>
      useReportsData({
        hasFinanceFeatures: true,
        hasInvestmentsFeature: true,
        weightsEnabled: true,
        month: "2026-08",
        year: 2026,
        mode: "month",
        debouncedCustomStart: "",
        debouncedCustomEnd: "",
        activeTab: "financas",
      }),
    );

    expect(onFinancasTab.result.current.loading).toBe(false);
    expect(onFinancasTab.result.current.error).toBeNull();

    const withoutInvestments = renderHook(() =>
      useReportsData({
        hasFinanceFeatures: true,
        hasInvestmentsFeature: false,
        weightsEnabled: true,
        month: "2026-08",
        year: 2026,
        mode: "month",
        debouncedCustomStart: "",
        debouncedCustomEnd: "",
      }),
    );

    expect(withoutInvestments.result.current.loading).toBe(false);
    expect(withoutInvestments.result.current.error).toBeNull();
  });

  it("injeta saldos bancários reais e faturas de cartão de crédito no Balanço 360° (AUD-06)", () => {
    const { result } = renderHook(() =>
      useReportsData({
        hasFinanceFeatures: true,
        hasInvestmentsFeature: true,
        weightsEnabled: true,
        month: "2026-08",
        year: 2026,
        mode: "month",
        debouncedCustomStart: "",
        debouncedCustomEnd: "",
      }),
    );

    // 500000 cents = R$ 5.000,00 de caixa bancário
    expect(result.current.consolidatedBalance.cashBalanceBRL).toBe(5000);
    // 150000 cents = R$ 1.500,00 de faturas de cartão
    expect(result.current.consolidatedBalance.creditCardInvoicesBRL).toBe(1500);
    expect(result.current.consolidatedBalance.totalLiabilitiesBRL).toBe(1500);
    // Net worth = 5000 - 1500 = 3500
    expect(result.current.consolidatedBalance.netWorthBRL).toBe(3500);
  });
});
