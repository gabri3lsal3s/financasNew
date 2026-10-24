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

export type TourStepPlacement = "top" | "bottom" | "left" | "right" | "auto";

export interface TourStep {
  id: string;
  track: TourTrackId;
  order: number;
  title: string;
  description: string;
  targetRoute: string;
  /** Seletor CSS do elemento alvo a ser destacado pelo Spotlight (ex: '[data-tour="overview-kpis"]') */
  targetSelector?: string;
  /** Posicionamento preferencial do card popover em telas desktop */
  preferredPlacement?: TourStepPlacement;
  /** Padding interno do recorte do spotlight em pixels (default 8px) */
  spotlightPadding?: number;
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
