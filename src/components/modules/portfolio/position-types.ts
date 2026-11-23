import {
  Building2,
  Coins,
  Globe,
  Landmark,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  formatMarketReferenceTimestampBR,
  type AssetPricingMode,
  type FixedIncomeBalanceResult,
  type PriceSource,
  type StaleQuoteAssetIssue,
} from "@/domain/portfolio";
import { formatAssetQuantity } from "@/services/formatting";
import type { AssetAllocationStatus, AssetCurrency, FixedIncomeMetadata } from "@/types";

export interface PositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currency: AssetCurrency;
  quantity: number;
  averageCost: number;
  totalCost?: number;
  totalCostBRL?: number;
  averageCostBRL?: number;
  dividends?: number;
  dividendsNative?: number;
  priceQuote?: number;
  priceBRL: number;
  usdRate?: number;
  source: PriceSource;
  isEstimate?: boolean;
  marketPriceAt?: string | null;
  fetchedAt?: string | null;
  provider?: string | null;
  staleIssue?: StaleQuoteAssetIssue | null;
  valueBRL: number;
  pct: number;
  /** Lucro/prejuízo não realizado em BRL (valor − custo; F14). */
  unrealizedPnl: number;
  /** Variação da cotação % sobre o custo (null quando não há custo — caixa; F14). */
  unrealizedPct: number | null;
  /** Resultado total em BRL ((valor − custo) + proventos). */
  totalReturnPnl?: number;
  /** Retorno Total % sobre o custo (null quando não há custo — caixa). */
  totalReturnPct?: number | null;
  /** Custo histórico total aplicado no ativo (mesmo para posições encerradas). */
  historicalCostBRL?: number;
  /** Total bruto histórico já resgatado/vendido do ativo. */
  historicalRedeemedBRL?: number;
  /** Rentabilidade final realizada % (para posições encerradas). */
  finalReturnPct?: number | null;
  isCash: boolean;
  pricingMode?: AssetPricingMode;
  fixedIncomeMetadata?: FixedIncomeMetadata | null;
  fixedIncomeResult?: FixedIncomeBalanceResult | null;
  isMatured?: boolean;
  maturityDate?: string | null;
  netValueBRL?: number;
  score?: number | null;
  allocationStatus?: AssetAllocationStatus;
}

export interface PositionTableProps {
  rows: PositionRow[];
  /** Abre a lista de lançamentos / detalhes do ativo. */
  onListTransactions?: (assetId: string, ticker: string) => void;
  /** Abre o formulário de edição cadastral do ativo (ticker/classe/moeda). */
  onEditAsset?: (assetId: string, ticker: string) => void;
  /** Abre o diálogo de calibrar saldo com extrato para Renda Fixa / Tesouro Direto. */
  onCalibrateAsset?: (assetId: string, ticker: string, currentValueCents: number) => void;
  /** Abre o diálogo de preço manual/cotação do ativo (para Renda Variável). */
  onSetManualPrice?: (
    assetId: string,
    ticker: string,
    currency: AssetCurrency,
    priceBRL: number,
    source: PriceSource,
    priceQuote?: number,
    pricingMode?: AssetPricingMode,
    usdRate?: number,
  ) => void;
  /** Abre o diálogo de avaliação de Nota (0-10) & Status na carteira. */
  onEvaluateScore?: (assetId: string, ticker: string) => void;
  emptyMessage?: string;
  /**
   * Id do ativo destacado vindo da busca global (?q=<assetId>).
   */
  highlightId?: string | null;
  /**
   * F17 — ordenação por coluna clicável (aria-sort + ícone de direção).
   * Desabilitada por padrão (a Posição atual mantém a ordem do ledger).
   */
  sortable?: boolean;
}

export type SortKey =
  | "ticker"
  | "quantity"
  | "price"
  | "averageCost"
  | "value"
  | "unrealizedPnl"
  | "unrealizedPct"
  | "pct"
  | "maturityDate";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço definido manualmente pelo usuário" },
  api: { label: "cotação", title: "Cotação oficial de mercado via API" },
  fallback: { label: "fallback", title: "Preço estimado por fallback" },
};

const PROVIDER_DISPLAY_LABEL: Record<string, string> = {
  yahoo: "Yahoo Finance",
  brapi: "Brapi",
  bcb_ptax: "PTAX BCB",
  awesomeapi: "AwesomeAPI",
  manual: "Manual",
};

/** Formata tooltip rico e auditável da cotação do ativo para tabelas Desktop e Mobile. */
export function buildPositionPriceTooltip(row: Pick<
  PositionRow,
  "source" | "provider" | "marketPriceAt" | "staleIssue" | "isEstimate"
>): string {
  const baseStatus =
    row.source === "manual"
      ? "Manual"
      : row.isEstimate || row.source === "fallback"
        ? "Estimada"
        : "Oficial";
  const providerLabel = row.provider
    ? PROVIDER_DISPLAY_LABEL[row.provider.toLowerCase()] ?? row.provider
    : null;
  const refTime = formatMarketReferenceTimestampBR(row.marketPriceAt);

  const parts = [`Cotação ${baseStatus}`];
  if (providerLabel && row.source === "api") parts.push(`fonte ${providerLabel}`);
  if (refTime) parts.push(`ref. ${refTime}`);
  if (row.staleIssue?.message) parts.push(row.staleIssue.message);
  parts.push("clique para alterar");
  return parts.join(" · ");
}

export const formatQuantity = (quantity: number, assetClass?: string | null): string =>
  formatAssetQuantity(quantity, assetClass ?? undefined);

export interface AssetClassMeta {
  label: string;
  badgeClass: string;
  icon: typeof TrendingUp;
}

export function getAssetClassMeta(className: string | null): AssetClassMeta {
  const norm = (className ?? "").trim().toLowerCase();
  if (norm.includes("ação") || norm.includes("acoes") || norm.includes("ações")) {
    return {
      label: className ?? "Ações",
      badgeClass: "bg-cat-2/10 text-cat-2 border-cat-2/25",
      icon: TrendingUp,
    };
  }
  if (norm.includes("fii") || norm.includes("imobili")) {
    return {
      label: className ?? "FIIs",
      badgeClass: "bg-cat-3/10 text-cat-3 border-cat-3/25",
      icon: Building2,
    };
  }
  if (norm.includes("renda fixa") || norm.includes("tesouro") || norm.includes("cdb") || norm.includes("lci")) {
    return {
      label: className ?? "Renda Fixa",
      badgeClass: "bg-cat-1/10 text-cat-1 border-cat-1/25",
      icon: Landmark,
    };
  }
  if (norm.includes("cripto") || norm.includes("bitcoin") || norm.includes("crypto")) {
    return {
      label: className ?? "Cripto",
      badgeClass: "bg-cat-6/10 text-cat-6 border-cat-6/25",
      icon: Coins,
    };
  }
  if (norm.includes("internacional") || norm.includes("global") || norm.includes("exterior") || norm.includes("etf")) {
    return {
      label: className ?? "Internacional / ETFs",
      badgeClass: "bg-cat-4/10 text-cat-4 border-cat-4/25",
      icon: Globe,
    };
  }
  if (norm.includes("caixa") || norm.includes("reserva")) {
    return {
      label: className ?? "Caixa / Reserva",
      badgeClass: "bg-cat-5/10 text-cat-5 border-cat-5/25",
      icon: Wallet,
    };
  }
  return {
    label: className ?? "Outros",
    badgeClass: "bg-muted text-muted-foreground border-border",
    icon: Layers,
  };
}
