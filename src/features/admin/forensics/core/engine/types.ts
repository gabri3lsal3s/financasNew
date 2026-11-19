/**
 * Tipos do Núcleo Headless Isomórfico Forense (types.ts).
 *
 * Define o modelo relacional de estado volátil em memória e os contratos
 * de auditoria de transição de estado e fuzzing de schemas.
 * Conforme AGENTS.md (TypeScript estrito, centavos inteiros, sem emojis).
 */

import type {
  PortfolioAsset,
  PortfolioDividend,
  PortfolioTransaction,
  SubscriptionTier,
} from "@/types";

export interface HeadlessUserProfile {
  id: string;
  email: string;
  name: string;
  tier: SubscriptionTier;
  role: "user" | "operator" | "superadmin";
  monthlyIncomeCents: number;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  isLifetime?: boolean;
  pinHash?: string | null;
  mfaEnabled?: boolean;
  createdAt: string;
}

export interface HeadlessCategory {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  type: "expense" | "income";
  parentId?: string | null;
  isArchived?: boolean;
}

export interface HeadlessCreditCard {
  id: string;
  userId: string;
  name: string;
  brand?: string | null;
  creditLimitCents: number;
  closingDay: number;
  dueDay: number;
  color?: string | null;
  isActive: boolean;
}

export interface HeadlessTransaction {
  id: string;
  userId: string;
  type: "expense" | "income";
  amountCents: number;
  description: string;
  categoryId: string;
  date: string;
  competenceMonth: string;
  cardId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  installmentSeriesId?: string | null;
  isPaid: boolean;
  reportWeight: number;
  tags?: string[];
  createdAt: string;
}

export interface HeadlessCardPayment {
  id: string;
  cardId: string;
  competenceMonth: string;
  amountPaidCents: number;
  paymentDate: string;
}

export interface HeadlessDebt {
  id: string;
  userId: string;
  name: string;
  type: "payable" | "receivable";
  amountCents: number;
  dueDate: string;
  isPaid: boolean;
  paidAt?: string | null;
  interestRateMonthlyPercent?: number | null;
  latePenaltyPercent?: number | null;
}

export interface HeadlessLoanContract {
  id: string;
  userId: string;
  creditorName: string;
  principalCents: number;
  monthlyInterestRatePercent: number;
  installmentsCount: number;
  amortizationSystem: "SAC" | "PRICE";
  startDate: string;
  installments: Array<{
    number: number;
    dueDate: string;
    amortizationCents: number;
    interestCents: number;
    totalInstallmentCents: number;
    isPaid: boolean;
  }>;
}

export interface HeadlessBudgetLimit {
  id: string;
  categoryId: string;
  monthlyLimitCents: number;
  month: string; // "YYYY-MM"
}

export interface HeadlessAnnualProvision {
  id: string;
  name: string;
  totalAmountCents: number;
  targetDate: string;
  monthlyReserveCents: number;
  accumulatedCents: number;
}

export interface HeadlessFamilyProfile {
  id: string;
  ownerUserId: string;
  name: string;
  members: Array<{
    userId: string;
    role: "owner" | "admin" | "member";
    name: string;
    email: string;
    allowInvestments: boolean;
    allowTrips: boolean;
    allowBudgets: boolean;
  }>;
}

export interface HeadlessTrip {
  id: string;
  userId: string;
  title: string;
  destination: string | null;
  currency: string;
  exchangeRate: number;
  startDate: string;
  endDate: string;
}

export interface HeadlessTripMember {
  id: string;
  tripId: string;
  name: string;
  isHost: boolean;
  pixKey?: string | null;
  pixKeyType?: string | null;
}

export interface HeadlessTripExpense {
  id: string;
  tripId: string;
  description: string;
  amountBaseCents: number;
  currency: string;
  exchangeRate?: number;
  payerMemberId: string;
  splits: Array<{
    memberId: string;
    shareCents: number;
  }>;
}

export interface HeadlessTripSettlement {
  id: string;
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
  confirmedAt?: string | null;
}

export interface HeadlessState {
  profile: HeadlessUserProfile;
  categories: HeadlessCategory[];
  creditCards: HeadlessCreditCard[];
  transactions: HeadlessTransaction[];
  cardPayments: HeadlessCardPayment[];
  debts: HeadlessDebt[];
  loans: HeadlessLoanContract[];
  assets: PortfolioAsset[];
  portfolioTransactions: PortfolioTransaction[];
  portfolioDividends: PortfolioDividend[];
  portfolioSnapshots: Array<{
    month: string;
    totalValueBRL: number;
    totalCostBRL: number;
    status: "provisional" | "closed";
    origin?: "calculated" | "manual_calibration";
  }>;
  cashBalanceCents: number;
  budgetLimits: HeadlessBudgetLimit[];
  annualProvisions: HeadlessAnnualProvision[];
  familyProfile?: HeadlessFamilyProfile | null;
  trips: HeadlessTrip[];
  tripMembers: HeadlessTripMember[];
  tripExpenses: HeadlessTripExpense[];
  tripSettlements: HeadlessTripSettlement[];
  dismissedInsightIds: Set<string>;
  auditEvents: Array<{
    id: string;
    userId?: string;
    eventType?: string;
    action?: string;
    details?: string;
    timestamp: string;
    payloadSummary?: string;
  }>;
}

export interface FuzzingVector {
  id: string;
  description: string;
  payload: unknown;
  expectedOutcome: "reject" | "sanitize" | "accept";
}

export interface FuzzingResult {
  vectorId: string;
  description: string;
  passed: boolean;
  sanitizedValue?: unknown;
  errorFound?: string;
}
