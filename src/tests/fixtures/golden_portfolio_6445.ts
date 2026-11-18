/**
 * Golden Dataset Fixture — Caso Real BR-20261118-6445
 * Data-base: 18/11/2026
 *
 * Consolida os parâmetros canônicos do caso auditado nos relatórios
 * "Dossiê Executivo da Posição Vigente Consolidada" e "Extrato Analítico de Evolução Patrimonial".
 */

import type { PortfolioAsset, PortfolioTransaction } from "@/types";

export const GOLDEN_CASE_ID = "BR-20261118-6445";
export const GOLDEN_AS_OF_DATE = "2026-11-18";
export const GOLDEN_PTAX_RATE = 5.25;

// Invariantes Contábeis do Gate 1
export const GOLDEN_EXPECTED = {
  // Ativos e Caixa
  activeAssetsMarketValueBRL: 17502.72,
  activeAssetsCostBRL: 17319.94,
  cashBRL: 0.96,
  totalPatrimonyBRL: 17503.68,
  totalConsolidatedCostBRL: 17320.90,
  unrealizedCapitalGainBRL: 182.78,

  // Proventos
  activeDividendsBRL: 1757.57,
  closedDividendsBRL: 36.90,
  totalDividendsBRL: 1794.47,

  // Resultado Econômico
  realizedPnlBRL: 0.0,
  allTimeEconomicPnlBRL: 1977.25, // 182.78 + 1794.47 + 0.00
  custodyTotalReturnBRL: 1940.35, // 182.78 + 1757.57

  // Renda Fixa
  fixedIncomePosFixadoBRL: 2965.52, // 1617.51 (Selic) + 1348.01 (CDB Original)
  fixedIncomeInflacaoBRL: 214.65, // 214.65 (IPCA)
  fixedIncomePrefixadoBRL: 0.0,
  fixedIncomeTotalBRL: 3180.17,

  // Internacional (6 ETFs)
  intlTotalBRL: 6852.60,
  intlTotalCostUSD: 1080.43,
  intlVooBRL: 3616.83,
  intlGldBRL: 1872.26,
  intlBitbBRL: 584.65,
  intlVeaBRL: 329.15,
  intlArgtBRL: 227.63,
  intlMchiBRL: 222.08,

  // Séries e Contagens
  totalCompetenciesCount: 26, // Out/2024 a Nov/2026 (incluindo Ago/2026)
  closedMonthsWindowCount: 12,

  // Metas e Alocação (Gate 4)
  totalTargetPct: 100.0,
  totalAllocationGapBRL: 0.0,
  equilibriumIndexPct: 84.9, // 84.86% -> 85%
  topDeficitClassName: "Renda Fixa",
  topDeficitGapBRL: 1195.75,
} as const;

export const GOLDEN_ASSETS_FIXTURE: PortfolioAsset[] = [
  // Renda Fixa (3 títulos)
  {
    id: "asset-rf-selic",
    user_id: "user-6445",
    ticker: "TESOURO-SELIC",
    notes: "Tesouro Selic 2029",
    asset_class: "Renda Fixa",
    currency: "BRL",
    quantity: 1,
    average_price: 1500.0,
    accumulated_dividends: 0,
    sector: "Pós-fixado (Selic / CDI)",
    fixed_income_metadata: {
      rate_type: "selic",
      rate_value: 100,
      base_value: 1500.0,
      base_date: "2024-10-01",
      initial_investment_date: "2024-10-01",
      maturity_date: "2029-03-01",
      is_tax_exempt: false,
    },
  },
  {
    id: "asset-rf-cdb-original",
    user_id: "user-6445",
    ticker: "CDB ORIGINAL",
    notes: "CDB Banco Original 110% CDI",
    asset_class: "Renda Fixa",
    currency: "BRL",
    quantity: 1,
    average_price: 1200.0,
    accumulated_dividends: 0,
    sector: "Pós-fixado (Selic / CDI)",
    fixed_income_metadata: {
      rate_type: "cdi",
      rate_value: 110,
      base_value: 1200.0,
      base_date: "2024-10-01",
      initial_investment_date: "2024-10-01",
      maturity_date: "2027-10-01",
      is_tax_exempt: false,
    },
  },
  {
    id: "asset-rf-ipca",
    user_id: "user-6445",
    ticker: "TESOURO-IPCA",
    notes: "Tesouro IPCA+ 2035",
    asset_class: "Renda Fixa",
    currency: "BRL",
    quantity: 1,
    average_price: 200.0,
    accumulated_dividends: 0,
    sector: "Inflação (IPCA+)",
    fixed_income_metadata: {
      rate_type: "ipca",
      rate_value: 6.2,
      base_value: 200.0,
      base_date: "2024-10-01",
      initial_investment_date: "2024-10-01",
      maturity_date: "2035-05-15",
      is_tax_exempt: false,
    },
  },

  // Internacional (6 ETFs em USD)
  {
    id: "asset-intl-voo",
    user_id: "user-6445",
    ticker: "VOO",
    notes: "Vanguard S&P 500 ETF",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 1.378,
    average_price: 500.0,
    accumulated_dividends: 45.0,
    sector: "Estados Unidos (US Equity)",
  },
  {
    id: "asset-intl-gld",
    user_id: "user-6445",
    ticker: "GLD",
    notes: "SPDR Gold Trust",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 1.554,
    average_price: 229.47,
    accumulated_dividends: 0,
    sector: "Commodities Globais / Ouro",
  },
  {
    id: "asset-intl-bitb",
    user_id: "user-6445",
    ticker: "BITB",
    notes: "Bitwise Bitcoin ETF",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 2.9887,
    average_price: 41.85,
    accumulated_dividends: 0,
    sector: "Criptoativos Globais / Bitcoin",
  },
  {
    id: "asset-intl-vea",
    user_id: "user-6445",
    ticker: "VEA",
    notes: "Vanguard Developed Markets ETF",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 1.254,
    average_price: 50.0,
    accumulated_dividends: 12.0,
    sector: "Mercados Desenvolvidos (ex-EUA)",
  },
  {
    id: "asset-intl-argt",
    user_id: "user-6445",
    ticker: "ARGT",
    notes: "Global X MSCI Argentina ETF",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 0.7225,
    average_price: 60.0,
    accumulated_dividends: 5.0,
    sector: "Mercados Emergentes (China & América Latina)",
  },
  {
    id: "asset-intl-mchi",
    user_id: "user-6445",
    ticker: "MCHI",
    notes: "iShares MSCI China ETF",
    asset_class: "Internacional",
    currency: "USD",
    quantity: 0.9064,
    average_price: 46.67,
    accumulated_dividends: 6.0,
    sector: "Mercados Emergentes (China & América Latina)",
  },

  // Caixa / Reserva
  {
    id: "asset-cash-brl",
    user_id: "user-6445",
    ticker: "CAIXA",
    notes: "Reserva de Caixa",
    asset_class: "Caixa / Reserva",
    currency: "BRL",
    quantity: 0.96,
    average_price: 1.0,
    accumulated_dividends: 0,
    sector: "Liquidez",
  },
];

export const GOLDEN_TRANSACTIONS_FIXTURE: PortfolioTransaction[] = [
  // Transações de Compra dos Ativos Vivos
  {
    id: "tx-buy-rf-selic",
    user_id: "user-6445",
    asset_id: "asset-rf-selic",
    type: "buy",
    date: "2024-10-01",
    quantity: 1,
    price: 1500.0,
    total: 1500.0,
  },
  {
    id: "tx-buy-rf-cdb",
    user_id: "user-6445",
    asset_id: "asset-rf-cdb-original",
    type: "buy",
    date: "2024-10-01",
    quantity: 1,
    price: 1200.0,
    total: 1200.0,
  },
  {
    id: "tx-buy-rf-ipca",
    user_id: "user-6445",
    asset_id: "asset-rf-ipca",
    type: "buy",
    date: "2024-10-01",
    quantity: 1,
    price: 200.0,
    total: 200.0,
  },

  // Transações de Compra e Venda de Posição Encerrada
  {
    id: "tx-buy-closed-1",
    user_id: "user-6445",
    asset_id: "asset-closed-historical",
    type: "buy",
    date: "2024-10-15",
    quantity: 50,
    price: 20.0,
    total: 1000.0,
  },
  {
    id: "tx-sell-closed-1",
    user_id: "user-6445",
    asset_id: "asset-closed-historical",
    type: "sell",
    date: "2025-03-20",
    quantity: 50,
    price: 22.0,
    total: 1100.0, // Ganho de capital realizado de R$ 100,00
  },
];

// Metas Corrompidas do Caso BR-20261118-6445 (Soma 200%, gerando BUG-11 e BUG-12)
export const GOLDEN_TARGETS_CORRUPTED = [
  // 5 Metas Canônicas Ativas (Soma = 100%)
  { assetClass: "FIIs", targetPercentage: 20 },
  { assetClass: "Ações", targetPercentage: 25 },
  { assetClass: "Renda Fixa", targetPercentage: 25 },
  { assetClass: "Internacional", targetPercentage: 25 },
  { assetClass: "ETFs", targetPercentage: 5 },

  // 4 Metas Legadas Órfãs sem Saldo (Soma = 100%)
  { assetClass: "Fundos Imobiliários", targetPercentage: 40 },
  { assetClass: "Ações De Dividendos", targetPercentage: 30 },
  { assetClass: "Renda Fixa CDI", targetPercentage: 20 },
  { assetClass: "REITs Globais", targetPercentage: 10 },
] as const;

// Metas Canônicas Saneadas do Caso BR-20261118-6445 (Soma = 100%)
export const GOLDEN_TARGETS_SANITIZED = [
  { assetClass: "FIIs", targetPercentage: 20 },
  { assetClass: "Ações", targetPercentage: 25 },
  { assetClass: "Renda Fixa", targetPercentage: 25 },
  { assetClass: "Internacional", targetPercentage: 25 },
  { assetClass: "ETFs", targetPercentage: 5 },
] as const;

// Posições Consolidadas por Classe do Caso BR-20261118-6445 (Total = R$ 17.503,68)
export const GOLDEN_ALLOCATION_POSITIONS = [
  { id: "pos-rf", ticker: "RF-CONSOLIDADA", assetClass: "Renda Fixa", valueBRL: 3180.17 },
  { id: "pos-etfs", ticker: "ETFS-CONSOLIDADA", assetClass: "ETFs", valueBRL: 122.33 },
  { id: "pos-acoes", ticker: "ACOES-CONSOLIDADA", assetClass: "Ações", valueBRL: 3673.74 },
  { id: "pos-caixa", ticker: "CAIXA", assetClass: "Caixa", valueBRL: 0.96, isCash: true },
  { id: "pos-fiis", ticker: "FIIS-CONSOLIDADA", assetClass: "FIIs", valueBRL: 3673.88 },
  { id: "pos-intl", ticker: "INTL-CONSOLIDADA", assetClass: "Internacional", valueBRL: 6852.60 },
] as const;
