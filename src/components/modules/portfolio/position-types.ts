import {
  Building2,
  Coins,
  Globe,
  Landmark,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AssetPricingMode, PriceSource, FixedIncomeBalanceResult } from "@/domain/portfolio";
import type { AssetCurrency, FixedIncomeMetadata } from "@/types";

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
  /** Confirma a exclusão do ativo (transações e metas em cascata). */
  onDeleteAsset?: (assetId: string, ticker: string) => void;
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
