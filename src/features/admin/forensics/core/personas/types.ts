/**
 * Contratos de Definição de Personas Teóricas Determinísticas (Golden Seeds).
 * Suporte a execução isomórfica em memória, com precisão matemática estrita.
 */

import type { AuditModule } from "../types";
import type { PortfolioAsset, PortfolioTransaction } from "@/types";

export interface TheoreticalPersona<TState = unknown> {
  id: string;
  name: string;
  description: string;
  targetModules: readonly AuditModule[];
  /** Gera o snapshot determinístico integral em memória (< 50ms) */
  instantiate: () => TState;
}

export interface PersonaCatalogItem {
  id: string;
  name: string;
  description: string;
  targetModules: readonly AuditModule[];
  estimatedExecutionMs: number;
}

export interface SyntheticAllocationGoal {
  id: string;
  user_id: string;
  asset_class: string;
  target_percentage: number;
}

// ==========================================
// Estados Específicos de Cada Persona
// ==========================================

export interface Investor6445State {
  caseId: string;
  asOfDate: string;
  ptaxRate: number;
  expected: {
    activeAssetsMarketValueBRL: number;
    activeAssetsCostBRL: number;
    cashBRL: number;
    totalPatrimonyBRL: number;
    totalConsolidatedCostBRL: number;
    unrealizedCapitalGainBRL: number;
    activeDividendsBRL: number;
    closedDividendsBRL: number;
    totalDividendsBRL: number;
    realizedPnlBRL: number;
    allTimeEconomicPnlBRL: number;
    custodyTotalReturnBRL: number;
    fixedIncomeTotalBRL: number;
    intlTotalBRL: number;
    intlTotalCostUSD: number;
    totalCompetenciesCount: number;
    closedMonthsWindowCount: number;
    totalTargetPct: number;
    totalAllocationGapBRL: number;
    equilibriumIndexPct: number;
  };
  assets: readonly PortfolioAsset[];
  transactions: readonly PortfolioTransaction[];
  allocationGoals: readonly SyntheticAllocationGoal[];
  historicalQuotes: Readonly<Record<string, number>>;
  usdHistoricalPtax: Readonly<Record<string, number>>;
}

export interface TemporalStressState {
  timelineStart: string;
  timelineEnd: string;
  blankMonth: string;
  consecutiveMonths: readonly string[];
  startingCapitalCents: number;
  intraMonthFlows: ReadonlyArray<{
    date: string;
    amountCents: number;
    description: string;
    calendarDaysInMonth: number;
    dayOfMonth: number;
  }>;
  denominatorCollapse: {
    initialEquityCents: number;
    largeRedemptionCents: number;
    postRedemptionValuationCents: number;
    epsilonThresholdCents: number;
  };
}

export interface CardsLoansState {
  periodicSplits: ReadonlyArray<{
    totalCents: number;
    installmentsCount: number;
    expectedParts: readonly number[];
  }>;
  closingDayTest: {
    closingDay: number;
    dueDay: number;
    purchaseBeforeCutoffIso: string;
    purchaseAfterCutoffIso: string;
    expectedCompetenceBefore: string;
    expectedCompetenceAfter: string;
  };
  refundScenario: {
    originalTotalCents: number;
    installmentsCount: number;
    paidInstallmentsCount: number;
    refundCents: number;
    expectedAdjustedInstallments: readonly number[];
  };
  revolvingCreditScenario: {
    invoiceTotalCents: number;
    paidCents: number;
    penaltyRatePercent: number;
    revolvingRatePercent: number;
    daysLate: number;
    expectedPenaltyCents: number;
  };
  loanPrice: {
    principalCents: number;
    monthlyRatePercent: number;
    totalInstallments: number;
    startDate: string;
  };
  loanSac: {
    principalCents: number;
    monthlyRatePercent: number;
    totalInstallments: number;
    startDate: string;
  };
  earlyAmortization: {
    remainingInstallments: ReadonlyArray<{
      id: string;
      installmentNumber: number;
      amountCents: number;
      dueDate: string;
    }>;
    monthlyRatePercent: number;
  };
}

export interface TripsSplitState {
  participants: ReadonlyArray<{
    id: string;
    name: string;
    joinedDate: string;
  }>;
  expenses: ReadonlyArray<{
    id: string;
    description: string;
    amountCents: number;
    paidByMemberId: string;
    expenseDate: string;
    splitType: "equal" | "custom";
    splits?: ReadonlyArray<{
      memberId: string;
      shareCents: number;
    }>;
  }>;
  settlements: ReadonlyArray<{
    id: string;
    fromMemberId: string;
    toMemberId: string;
    amountCents: number;
    settledAt: string;
  }>;
  currencies: ReadonlyArray<{
    code: string;
    rateToBRL: number;
  }>;
}

export interface FamilyBudgetState {
  partners: ReadonlyArray<{
    id: string;
    name: string;
    monthlyIncomeCents: number;
    expectedShareRatio: number;
  }>;
  sharedExpenses: ReadonlyArray<{
    id: string;
    name: string;
    amountCents: number;
    categoryGroup: "needs" | "wants" | "savings";
  }>;
  rule50_30_20: {
    totalIncomeCents: number;
    targetNeedsCents: number;
    targetWantsCents: number;
    targetSavingsCents: number;
  };
  provisions: ReadonlyArray<{
    id: string;
    name: string;
    annualTargetCents: number;
    monthlyAccrualCents: number;
    accruedBalanceCents: number;
    consumedCents: number;
  }>;
  budgetEnvelopes: ReadonlyArray<{
    categoryId: string;
    name: string;
    limitCents: number;
    categoryGroup: "needs" | "wants" | "savings";
  }>;
}

export interface BoundaryZeroState {
  zeroUser: {
    accountsCount: number;
    transactionsCount: number;
    totalEquityCents: number;
  };
  divisionByZeroCases: {
    emptyReturnsSeries: readonly number[];
    singleReturnSeries: readonly number[];
    zeroVarianceSeries: readonly number[];
    zeroBenchmarkReturn: number;
  };
  leapYearTimestamps: {
    utcIso: string;
    localIso: string;
    expectedYear: number;
    expectedMonth: number;
    expectedDay: number;
  };
  cryptoPrecision: {
    ticker: string;
    quantityUnits: number;
    unitPriceBRL: number;
    expectedTotalCents: number;
  };
}

export interface InsightsStressState {
  totalSimulatedEvents: number;
  events: ReadonlyArray<{
    id: string;
    topicKey: string;
    severity: "critical" | "warning" | "info" | "success";
    createdAtIso: string;
    message: string;
  }>;
  cardLimitRadar: {
    cardId: string;
    totalLimitCents: number;
    currentInvoiceSpentCents: number;
    projectedSubscriptionsCents: number;
    usagePercent: number;
  };
  dismissalCooldowns: Readonly<Record<string, number>>;
  annualProvisions: ReadonlyArray<{
    id: string;
    label: string;
    annualAmountCents: number;
    dueMonth: string;
  }>;
  nowMs: number;
}

export interface AdvancedModulesState {
  pixBrCode: {
    rawPayload: string;
    expectedCrc: string;
    amountCents: number;
    pixKey: string;
    merchantName: string;
    merchantCity: string;
  };
  emergencyRunway: {
    liquidAssetsCents: number;
    lockedAssetsCents: number;
    monthlyBurnCents: number;
    expectedMonthsCovered: number;
  };
  debtPayoffComparison: ReadonlyArray<{
    id: string;
    name: string;
    balanceCents: number;
    monthlyRatePercent: number;
    minPaymentCents: number;
  }>;
  backupIntegrity: {
    contentJson: string;
    expectedSha256Hex: string;
  };
  statefulUrlPayload: {
    uncompressedState: Record<string, unknown>;
  };
}
