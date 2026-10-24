import type {
  Category,
  Expense,
  Income,
  CreditCard,
  Budget,
  PortfolioAsset,
  AllocationTarget,
  GroupTarget,
  PortfolioSnapshot,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
} from "@/types";

export type TourTrackId = "finances" | "investments";

export interface TourStep {
  id: string;
  track: TourTrackId;
  order: number;
  title: string;
  description: string;
  targetRoute: string;
  badgeLabel?: string;
  actionLabel?: string;
}

export interface DailyFinancesDataset {
  referenceMonth: string;
  previousMonth: string;
  categories: Category[];
  expenses: Expense[];
  incomes: Income[];
  cards: CreditCard[];
  budgets: Budget[];
}

export interface InvestmentsDataset {
  referenceMonth: string;
  assets: PortfolioAsset[];
  transactions: PortfolioTransaction[];
  allocationTargets: AllocationTarget[];
  groupTargets: GroupTarget[];
  snapshots: PortfolioSnapshot[];
  contributions: PortfolioContribution[];
  dividends: PortfolioDividend[];
}

export interface DemoSimulationDataset {
  finances: DailyFinancesDataset;
  investments: InvestmentsDataset;
  tourSteps: Record<TourTrackId, TourStep[]>;
}
