import type {
  Category,
  Expense,
  Income,
  CreditCard,
  CardPayment,
  Budget,
  PortfolioAsset,
  AllocationTarget,
  GroupTarget,
  PortfolioSnapshot,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
} from "@/types";

/**
 * Categorias principais dos grupos de trilhas e micro-tours de demonstração.
 */
export type TourTrackCategory = "native" | "finances" | "investments" | "settings";

/**
 * Trilhas consolidadas originais mantidas para compatibilidade retroativa.
 */
export type LegacyTourTrackId = "finances" | "investments";

/**
 * Catálogo de micro-tours específicos sob demanda.
 */
export type MicroTourTrackId =
  | "finances_overview"
  | "finances_wizard"
  | "finances_cards"
  | "finances_budgets"
  | "finances_insights"
  | "investments_overview"
  | "investments_assets"
  | "investments_targets"
  | "investments_aporte"
  | "settings_support"
  | "app_native_apk";

/**
 * Identificador unificado de todas as trilhas e micro-tours suportados.
 */
export type TourTrackId = LegacyTourTrackId | MicroTourTrackId;

/**
 * Nomes semânticos dos ícones Lucide associados às trilhas.
 */
export type TourIconName =
  | "smartphone"
  | "wallet"
  | "plus-circle"
  | "credit-card"
  | "pie-chart"
  | "lightbulb"
  | "trending-up"
  | "briefcase"
  | "target"
  | "calculator"
  | "settings"
  | "shield";

/**
 * Metadados descritivos canônicos de cada micro-tour ou trilha.
 */
export interface TourTrackMeta {
  /** Identificador único da trilha / micro-tour */
  id: TourTrackId;
  /** Título legível da trilha */
  title: string;
  /** Título conciso para badges e cards compactos */
  shortTitle: string;
  /** Descrição resumida dos objetivos deste micro-tour */
  description: string;
  /** Categoria / macro-grupo à qual a trilha pertence */
  category: TourTrackCategory;
  /** Quantidade esperada de passos interativos */
  stepsCount: number;
  /** Identificador semântico do ícone Lucide representativo */
  iconName: TourIconName;
  /** Rota inicial onde o micro-tour inicia */
  startRoute: string;
  /** Rótulo da badge de passos (ex: "3 passos", "2 passos") */
  badgeLabel: string;
  /** Se este micro-tour é exclusivo do aplicativo nativo (APK Android) */
  isNativeOnly?: boolean;
}

/**
 * Estrutura de agrupamento das trilhas para exibição no Hub de Aprendizado e Modal Seletor.
 */
export interface TourTrackGroup {
  /** Categoria do macro-grupo */
  category: TourTrackCategory;
  /** Título descritivo do grupo */
  title: string;
  /** Descrição do escopo do grupo */
  description: string;
  /** Identificador semântico do ícone representativo */
  iconName: TourIconName;
  /** Rótulo da badge do grupo (ex: "5 micro-tours") */
  badgeLabel?: string;
  /** Se o grupo inteiro é exclusivo do APK Nativo */
  isNativeOnly?: boolean;
  /** Lista ordenada de micro-tours pertencentes a este grupo */
  tracks: TourTrackMeta[];
}

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
  cardPayments: CardPayment[];
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
  tourSteps: Partial<Record<TourTrackId, TourStep[]>>;
}
