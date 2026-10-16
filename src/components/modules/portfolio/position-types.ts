import {
  Building2,
  Coins,
  Globe,
  Landmark,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AssetPricingMode, PriceSource } from "@/domain/portfolio";
import type { AssetCurrency } from "@/types";

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
  priceQuote?: number;
  priceBRL: number;
  usdRate?: number;
  source: PriceSource;
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
  isCash: boolean;
  pricingMode?: AssetPricingMode;
}

export interface PositionTableProps {
  rows: PositionRow[];
  /** Abre a lista de lançamentos / detalhes do ativo. */
  onListTransactions?: (assetId: string, ticker: string) => void;
  /** Abre o formulário de edição cadastral do ativo (ticker/classe/moeda). */
  onEditAsset?: (assetId: string, ticker: string) => void;
  /** Abre o diálogo de preço manual/cotação do ativo. */
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
  /** Confirma a exclusão do ativo (transações e metas em cascata). */
  onDeleteAsset?: (assetId: string, ticker: string) => void;
  emptyMessage?: string;
  /**
   * F17 — ordenação por coluna clicável (aria-sort + ícone de direção).
   * Desabilitada por padrão (a Posição atual mantém a ordem do ledger).
   */
  sortable?: boolean;
}

export type SortKey = "ticker" | "quantity" | "price" | "averageCost" | "value" | "unrealizedPct" | "pct";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export const PRICE_SOURCE_LABEL: Record<PriceSource, { label: string; title: string }> = {
  manual: { label: "manual", title: "Preço definido manualmente pelo usuário" },
  api: { label: "cotação", title: "Cotação de fechamento atualizada via API" },
  fallback: { label: "fallback", title: "Preço estimado por fallback estático" },
};

export const formatQuantity = (quantity: number): string =>
  Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

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
  if (norm.includes("fii")) {
    return {
      label: className ?? "FIIs",
      badgeClass: "bg-cat-5/10 text-cat-5 border-cat-5/25",
      icon: Building2,
    };
  }
  if (norm.includes("internacional") || norm.includes("global") || norm.includes("exterior")) {
    return {
      label: className ?? "Internacional",
      badgeClass: "bg-cat-1/10 text-cat-1 border-cat-1/25",
      icon: Globe,
    };
  }
  if (norm.includes("etf")) {
    return {
      label: className ?? "ETFs",
      badgeClass: "bg-cat-7/10 text-cat-7 border-cat-7/25",
      icon: Layers,
    };
  }
  if (
    norm.includes("renda fixa") ||
    norm.includes("cdb") ||
    norm.includes("tesouro") ||
    norm.includes("lci") ||
    norm.includes("lca") ||
    norm.includes("cri") ||
    norm.includes("cra") ||
    norm.includes("debenture")
  ) {
    return {
      label: className ?? "Renda Fixa",
      badgeClass: "bg-warning/10 text-warning-strong border-warning/25",
      icon: Landmark,
    };
  }
  if (norm.includes("caixa") || norm.includes("cash") || norm.includes("moeda")) {
    return {
      label: className ?? "Caixa",
      badgeClass: "bg-portfolio/10 text-portfolio border-portfolio/25",
      icon: Wallet,
    };
  }
  return {
    label: className || "Outros",
    badgeClass: "bg-surface-hover/80 text-muted-foreground border-border/80",
    icon: Coins,
  };
}

export interface ClassGroup {
  className: string;
  rows: PositionRow[];
  totalValueBRL: number;
  totalPct: number;
  totalPnl: number;
  totalCostBRL: number;
  totalDividends: number;
  totalReturnPnl: number;
  totalReturnPct: number | null;
  unrealizedPct: number | null;
  count: number;
}
