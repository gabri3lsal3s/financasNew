/**
 * Contratos de tipos para fechamento mensal e histórico de carteira (Fase 2).
 */

export type MonthlyPriceSource = "api" | "manual" | "fallback";

export interface MonthlyPriceRow {
  id: string;
  user_id: string;
  ticker: string;
  /** Competência YYYY-MM */
  month: string;
  price: number;
  currency: "BRL" | "USD";
  source: MonthlyPriceSource;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyPriceInput {
  ticker: string;
  month: string;
  price: number;
  currency: "BRL" | "USD";
  source: MonthlyPriceSource;
}

export interface MonthlyClosingItem {
  ticker: string;
  assetClass: string;
  quantity: number;
  price: number;
  currency: "BRL" | "USD";
  source: MonthlyPriceSource;
  currentPrice?: number;
  priceChangePct?: number | null;
  totalBRL: number;
}

export interface MonthlyClosingData {
  month: string;
  items: MonthlyClosingItem[];
  cashQuantity: number;
  totalValueBRL: number;
  totalCostBRL: number;
  isCurrentMonth: boolean;
}
