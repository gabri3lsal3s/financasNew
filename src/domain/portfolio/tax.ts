/**
 * Motor de Apuração Fiscal, IRPF Anual e DARF Mensal (§F40).
 * Funções 100% puras sem dependência de React ou Supabase (AGENTS.md §3).
 */

import { formatCentsAsBRL } from "@/services/masks";
import { sanitizeReportText } from "@/domain/reports/sanitize-text";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import {
  inferCurrencyFromTicker,
  isCashAssetClass,
  isFiiClass,
  isFixedIncomeClass,
  isTesouroAsset,
  normalizeClassName,
} from "./valuation";

export interface TaxAssetItem {
  assetId: string;
  ticker: string;
  assetClass: string;
  quantity: number;
  averagePrice: number;
  totalCostCents: number;
  groupCode: string;
  groupName: string;
  itemCode: string;
  itemName: string;
  discrimination: string;
}

export interface AnnualBensDireitosReport {
  year: number;
  items: TaxAssetItem[];
  totalCostCents: number;
}

/**
 * Determina o enquadramento no programa IRPF da Receita Federal (Grupo e Código).
 */
export function getBensDireitosClassification(assetClass: string | null, ticker: string): {
  groupCode: string;
  groupName: string;
  itemCode: string;
  itemName: string;
} {
  const normClass = (assetClass ?? "").toLowerCase().trim();
  const upperTicker = ticker.toUpperCase();

  if (normClass.includes("fii") || normClass.includes("imobili")) {
    return {
      groupCode: "07",
      groupName: "Fundos",
      itemCode: "03",
      itemName: "Fundos de Investimento Imobiliário (FII)",
    };
  }

  if (normClass.includes("ação") || normClass.includes("acoes") || normClass.includes("stock") || upperTicker.match(/^[A-Z]{4}(3|4|11)$/)) {
    if (upperTicker.endsWith("11") && (normClass.includes("etf") || normClass.includes("índice") || normClass.includes("indice"))) {
      return {
        groupCode: "07",
        groupName: "Fundos",
        itemCode: "09",
        itemName: "Fundos de Índice de Mercado (ETF)",
      };
    }
    return {
      groupCode: "03",
      groupName: "Participações Societárias",
      itemCode: "01",
      itemName: "Ações (inclusive as listadas em bolsa)",
    };
  }

  if (normClass.includes("renda fixa") || normClass.includes("tesouro") || normClass.includes("cdb") || normClass.includes("lci") || normClass.includes("lca")) {
    return {
      groupCode: "04",
      groupName: "Aplicações e Investimentos",
      itemCode: "02",
      itemName: "Títulos Públicos e Privados (Tesouro, CDB, LCI, LCA)",
    };
  }

  if (normClass.includes("cripto") || normClass.includes("crypto") || normClass.includes("btc") || normClass.includes("eth")) {
    return {
      groupCode: "08",
      groupName: "Criptoativos",
      itemCode: "01",
      itemName: "Criptoativos / Moedas Digitais",
    };
  }

  return {
    groupCode: "04",
    groupName: "Aplicações e Investimentos",
    itemCode: "99",
    itemName: "Outras aplicações e investimentos",
  };
}

/**
 * Gera a declaração anual consolidada de Bens e Direitos (em 31/12).
 */
export function generateAnnualBensDireitosReport(
  assets: PortfolioAsset[],
  year: number,
  usdRate = 5.25,
): AnnualBensDireitosReport {
  const items: TaxAssetItem[] = assets
    .filter((a) => a.quantity > 0)
    .map((a) => {
      const classification = getBensDireitosClassification(a.asset_class, a.ticker);
      const isUSD = a.currency === "USD";
      const rate = isUSD ? usdRate : 1;
      const totalCostNative = Math.round(a.quantity * a.average_price * 100) / 100;
      const totalCostBRL = Math.round(totalCostNative * rate * 100) / 100;
      const totalCostCents = Math.round(totalCostBRL * 100);
      const formattedCostBRL = formatCentsAsBRL(totalCostCents).replace(/\u00A0/g, " ");
      const safeTicker = sanitizeReportText(a.ticker);
      const qtyStr = a.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
      const cotaWord = a.quantity === 1 ? "cota/ação" : "cotas/ações";

      let discrimination: string;
      if (isUSD) {
        discrimination = `${qtyStr} ${cotaWord} de ${safeTicker} (${classification.itemName}) adquiridas pelo custo total de $ ${totalCostNative.toFixed(2)} (${formattedCostBRL}, cotação de referência R$ ${rate.toFixed(2)}), preço médio de $ ${a.average_price.toFixed(2)}, custodiadas no exterior em conta própria.`;
      } else {
        const formattedUnitPrice = formatCentsAsBRL(Math.round(a.average_price * 100)).replace(/\u00A0/g, " ");
        discrimination = `${qtyStr} ${cotaWord} de ${safeTicker} (${classification.itemName}) adquiridas pelo custo total de ${formattedCostBRL} (preço médio unitário de ${formattedUnitPrice}), custodiadas em conta própria da corretora.`;
      }

      return {
        assetId: a.id,
        ticker: a.ticker,
        assetClass: a.asset_class ?? "Geral",
        quantity: a.quantity,
        averagePrice: a.average_price,
        totalCostCents,
        groupCode: classification.groupCode,
        groupName: classification.groupName,
        itemCode: classification.itemCode,
        itemName: classification.itemName,
        discrimination,
      };
    })
    .sort((a, b) => b.totalCostCents - a.totalCostCents);

  const totalCostCents = items.reduce((acc, i) => acc + i.totalCostCents, 0);

  return {
    year,
    items,
    totalCostCents,
  };
}

export interface DividendTaxItem {
  assetId: string;
  ticker: string;
  type: "dividend" | "jcp" | "fii_yield" | "other";
  amountCents: number;
}

export interface AnnualDividendsTaxReport {
  year: number;
  /** Ficha 09: Rendimentos Isentos (Dividendos de Ações e Rendimentos de FIIs). */
  exemptDividends: {
    items: DividendTaxItem[];
    totalCents: number;
  };
  /** Ficha 10: Rendimentos com Tributação Exclusiva (JCP). */
  exclusiveJCP: {
    items: DividendTaxItem[];
    totalCents: number;
  };
  /** Rendimentos Recebidos do Exterior (Carnê-Leão / Lei 14.754/2023). */
  foreignDividends: {
    items: DividendTaxItem[];
    totalCents: number;
  };
  totalDividendsCents: number;
}

/**
 * Classifica proventos recebidos por ficha da Declaração de Ajuste Anual.
 */
export function classifyAnnualDividendsReport(
  dividends: PortfolioDividend[],
  assets: PortfolioAsset[],
  year: number,
  usdRate = 5.25,
): AnnualDividendsTaxReport {
  const yearPrefix = String(year);
  const yearDividends = dividends.filter((d) => d.date.startsWith(yearPrefix));
  const assetMap = new Map(assets.map((a) => [a.id, a]));

  const exemptItemsMap = new Map<string, { ticker: string; cents: number }>();
  const jcpItemsMap = new Map<string, { ticker: string; cents: number }>();
  const foreignItemsMap = new Map<string, { ticker: string; cents: number }>();

  for (const div of yearDividends) {
    const asset = div.asset_id ? assetMap.get(div.asset_id) : null;
    const ticker = asset?.ticker ?? div.ticker ?? "Ativo";
    const isUSD = asset?.currency === "USD";
    const rate = isUSD ? usdRate : 1;
    const amountCents = Math.round(div.amount * rate * 100);
    const noteUpper = (div.notes ?? "").toUpperCase();
    const isJCP = noteUpper.includes("JCP") || noteUpper.includes("JUROS SOBRE CAPITAL");

    if (isUSD) {
      const cur = foreignItemsMap.get(div.asset_id ?? ticker) ?? { ticker, cents: 0 };
      cur.cents += amountCents;
      foreignItemsMap.set(div.asset_id ?? ticker, cur);
    } else if (isJCP) {
      const cur = jcpItemsMap.get(div.asset_id ?? ticker) ?? { ticker, cents: 0 };
      cur.cents += amountCents;
      jcpItemsMap.set(div.asset_id ?? ticker, cur);
    } else {
      const cur = exemptItemsMap.get(div.asset_id ?? ticker) ?? { ticker, cents: 0 };
      cur.cents += amountCents;
      exemptItemsMap.set(div.asset_id ?? ticker, cur);
    }
  }

  const exemptItems: DividendTaxItem[] = Array.from(exemptItemsMap.entries()).map(([assetId, data]) => ({
    assetId,
    ticker: data.ticker,
    type: "dividend",
    amountCents: data.cents,
  }));

  const jcpItems: DividendTaxItem[] = Array.from(jcpItemsMap.entries()).map(([assetId, data]) => ({
    assetId,
    ticker: data.ticker,
    type: "jcp",
    amountCents: data.cents,
  }));

  const foreignItems: DividendTaxItem[] = Array.from(foreignItemsMap.entries()).map(([assetId, data]) => ({
    assetId,
    ticker: data.ticker,
    type: "dividend",
    amountCents: data.cents,
  }));

  const exemptTotalCents = exemptItems.reduce((acc, i) => acc + i.amountCents, 0);
  const jcpTotalCents = jcpItems.reduce((acc, i) => acc + i.amountCents, 0);
  const foreignTotalCents = foreignItems.reduce((acc, i) => acc + i.amountCents, 0);

  return {
    year,
    exemptDividends: {
      items: exemptItems.sort((a, b) => b.amountCents - a.amountCents),
      totalCents: exemptTotalCents,
    },
    exclusiveJCP: {
      items: jcpItems.sort((a, b) => b.amountCents - a.amountCents),
      totalCents: jcpTotalCents,
    },
    foreignDividends: {
      items: foreignItems.sort((a, b) => b.amountCents - a.amountCents),
      totalCents: foreignTotalCents,
    },
    totalDividendsCents: exemptTotalCents + jcpTotalCents + foreignTotalCents,
  };
}

export interface MonthlyDarfSaleItem {
  ticker: string;
  assetClass: string | null;
  currency?: string | null;
  saleAmountCents: number;
  costAmountCents: number;
  profitCents: number;
}

export interface MonthlyDarfPreviousLosses {
  stockCents?: number;
  fiiCents?: number;
  etfCents?: number;
}

export interface MonthlyDarfInput {
  month: string;
  /** Operações de venda realizadas no mês. */
  sales: MonthlyDarfSaleItem[];
  /** Prejuízos acumulados de meses anteriores a compensar (em centavos). */
  previousLosses?: MonthlyDarfPreviousLosses;
}

export interface MonthlyDarfResult {
  month: string;
  /** Volume de vendas de ações ordinárias/preferenciais locais B3 no mês (centavos). */
  stockSalesVolumeCents: number;
  /** Indica se as vendas de ações no mês ficaram dentro do limite de isenção de R$ 20.000,00. */
  isStockExempt: boolean;
  stockGrossProfitCents: number;
  stockCompensatedLossCents: number;
  stockTaxableProfitCents: number;
  stockTaxDueCents: number;
  /** Volume de vendas de FIIs/FIAGROs no mês (centavos). */
  fiiSalesVolumeCents: number;
  fiiGrossProfitCents: number;
  fiiCompensatedLossCents: number;
  fiiTaxableProfitCents: number;
  fiiTaxDueCents: number;
  /** Volume de vendas de ETFs e BDRs no mês (centavos, sem isenção de 20k). */
  etfSalesVolumeCents: number;
  etfGrossProfitCents: number;
  etfCompensatedLossCents: number;
  etfTaxableProfitCents: number;
  etfTaxDueCents: number;
  /** Volume de vendas de ativos internacionais no exterior (segregados pela Lei 14.754/2023 - IRPF Anual). */
  foreignSalesVolumeCents: number;
  foreignGrossProfitCents: number;
  /** Valor total de imposto a recolher via DARF 6015 (centavos). */
  totalTaxDueCents: number;
  /** true se totalTaxDueCents >= R$ 10,00 (DARF mínimo para emissão). */
  shouldPayDarf: boolean;
  remainingAccumulatedLossCents: {
    stockCents: number;
    fiiCents: number;
    etfCents: number;
  };
}

export const STOCK_MONTHLY_EXEMPTION_LIMIT_CENTS = 20_000 * 100; // R$ 20.000,00
export const STOCK_TAX_RATE = 0.15; // 15%
export const FII_TAX_RATE = 0.20; // 20%
export const ETF_TAX_RATE = 0.15; // 15%
export const MINIMUM_DARF_EMISSION_CENTS = 10 * 100; // R$ 10,00

/**
 * Principais ETFs negociados na B3 (sem isenção de R$ 20.000,00).
 */
export const KNOWN_B3_ETFS = new Set([
  "BOVA11", "SMAL11", "IVVB11", "SPXI11", "HASH11", "GOLD11", "NASD11",
  "BDEF11", "BRAX11", "DIVO11", "PIBB11", "XINA11", "ACWI11", "EURP11",
  "MATB11", "FIND11", "GOVE11", "ISUS11", "ECOO11", "GENB11", "BBSD11",
  "SMAC11", "TECB11", "DNAI11", "USTK11", "WRLD11", "BITH11", "ETHE11",
  "QETH11", "QBTC11", "DEFI11", "CRPT11", "WEB311", "NFTS11", "BDIV11",
  "NSDV11", "SHOT11", "BOVV11", "BOVX11", "IBOB11", "SMALL11", "SPXB11",
]);

/**
 * Identifica se o ativo é um BDR (Brazilian Depositary Receipt) negociado na B3.
 * BDRs não possuem isenção de R$ 20.000,00 e são tributados a 15% via DARF 6015.
 */
export function isBdrAsset(ticker: string, assetClass?: string | null): boolean {
  const upperTicker = ticker.trim().toUpperCase();
  if (/^[A-Z]{4}(34|35|39)$/.test(upperTicker)) {
    return true;
  }
  const normClass = normalizeClassName(assetClass ?? "");
  return normClass === "bdr" || normClass === "bdrs" || normClass.includes("bdr");
}

/**
 * Identifica se o ativo é um Fundo de Índice (ETF).
 * ETFs não possuem a isenção dos R$ 20.000,00 e são tributados a 15% sobre o ganho líquido.
 */
export function isEtfAsset(ticker: string, assetClass?: string | null): boolean {
  const upperTicker = ticker.trim().toUpperCase();
  if (KNOWN_B3_ETFS.has(upperTicker)) {
    return true;
  }
  const normClass = normalizeClassName(assetClass ?? "");
  if (normClass.includes("etf") || normClass.includes("indice") || normClass.includes("index")) {
    return true;
  }
  return false;
}

/**
 * Identifica se o ativo é custodiado no exterior / cotado em moeda estrangeira (USD)
 * sujeito ao regime da Lei 14.754/2023 (tributação unificada de 15% na DAA anual, sem DARF mensal 6015).
 */
export function isForeignAsset(
  ticker: string,
  assetClass?: string | null,
  currency?: string | null,
): boolean {
  const normCurrency = (currency ?? "").trim().toUpperCase();
  if (normCurrency === "USD") return true;

  const upperTicker = ticker.trim().toUpperCase();
  // BDRs negociados na B3 são locais BRL e não ativos estrangeiros diretos
  if (isBdrAsset(upperTicker, assetClass)) return false;

  // Se a moeda não foi forçada como BRL e o ticker tem padrão internacional (1 a 5 letras puras)
  if (normCurrency !== "BRL" && inferCurrencyFromTicker(upperTicker) === "USD") {
    return true;
  }

  const normClass = normalizeClassName(assetClass ?? "");
  if (
    normClass.includes("internacional") ||
    normClass.includes("exterior") ||
    normClass.includes("offshore") ||
    normClass.includes("global")
  ) {
    if (upperTicker.endsWith("11") || upperTicker.match(/^[A-Z]{4}(34|35|39)$/)) {
      return false;
    }
    return true;
  }

  return false;
}

/** Units de ações locais B3 (compostas por ON + PN) que mantêm isenção de R$ 20.000,00. */
export const KNOWN_STOCK_UNITS = new Set([
  "KLBN11", "SANB11", "TAEE11", "BPAC11", "SAPR11", "ALUP11", "TIET11", "ENGI11", "SULA11", "CPLE11",
]);

/**
 * Identifica se o ativo é um FII, FIAGRO ou FI-Infra negociado na B3 (tributado a 20%).
 */
export function isFiiAsset(ticker: string, assetClass?: string | null): boolean {
  if (isFiiClass(assetClass)) return true;
  const normClass = normalizeClassName(assetClass ?? "");
  if (
    normClass.includes("fii") ||
    normClass.includes("imobili") ||
    normClass.includes("fiagro") ||
    normClass.includes("fi-infra")
  ) {
    return true;
  }
  const upperTicker = ticker.trim().toUpperCase();
  if (
    upperTicker.endsWith("11") &&
    !KNOWN_B3_ETFS.has(upperTicker) &&
    !KNOWN_STOCK_UNITS.has(upperTicker) &&
    !isBdrAsset(upperTicker, assetClass)
  ) {
    return true;
  }
  return false;
}

/**
 * Apuração mensal de impostos sobre ganhos líquidos de renda variável (DARF).
 * Segrega estritamente ações comuns B3 (isenção 20k), FIIs (20%), ETFs/BDRs (15% sem isenção)
 * e ativos no exterior (Lei 14.754/2023 - DAA anual, sem DARF 6015 mensal).
 */
export function calculateMonthlyDarf(input: MonthlyDarfInput): MonthlyDarfResult {
  const { month, sales, previousLosses = {} } = input;

  let initialStockLoss = Math.max(0, previousLosses.stockCents ?? 0);
  let initialFiiLoss = Math.max(0, previousLosses.fiiCents ?? 0);
  let initialEtfLoss = Math.max(0, previousLosses.etfCents ?? 0);

  let stockSalesVolumeCents = 0;
  let stockGrossProfitCents = 0;
  let stockNewLossCents = 0;

  let fiiSalesVolumeCents = 0;
  let fiiGrossProfitCents = 0;
  let fiiNewLossCents = 0;

  let etfSalesVolumeCents = 0;
  let etfGrossProfitCents = 0;
  let etfNewLossCents = 0;

  let foreignSalesVolumeCents = 0;
  let foreignGrossProfitCents = 0;

  for (const s of sales) {
    if (
      isFixedIncomeClass(s.assetClass) ||
      isCashAssetClass(s.assetClass) ||
      isTesouroAsset(s.ticker, s.assetClass)
    ) {
      continue;
    }

    const isForeign = isForeignAsset(s.ticker, s.assetClass, s.currency);
    const isFii = !isForeign && isFiiAsset(s.ticker, s.assetClass);
    const isEtfOrBdr =
      !isForeign && !isFii && (isEtfAsset(s.ticker, s.assetClass) || isBdrAsset(s.ticker, s.assetClass));

    if (isForeign) {
      foreignSalesVolumeCents += s.saleAmountCents;
      if (s.profitCents > 0) {
        foreignGrossProfitCents += s.profitCents;
      }
    } else if (isFii) {
      fiiSalesVolumeCents += s.saleAmountCents;
      if (s.profitCents > 0) {
        fiiGrossProfitCents += s.profitCents;
      } else {
        fiiNewLossCents += Math.abs(s.profitCents);
      }
    } else if (isEtfOrBdr) {
      etfSalesVolumeCents += s.saleAmountCents;
      if (s.profitCents > 0) {
        etfGrossProfitCents += s.profitCents;
      } else {
        etfNewLossCents += Math.abs(s.profitCents);
      }
    } else {
      stockSalesVolumeCents += s.saleAmountCents;
      if (s.profitCents > 0) {
        stockGrossProfitCents += s.profitCents;
      } else {
        stockNewLossCents += Math.abs(s.profitCents);
      }
    }
  }

  // 1. Ações Locais B3: isenção de R$ 20.000/mês
  const isStockExempt = stockSalesVolumeCents <= STOCK_MONTHLY_EXEMPTION_LIMIT_CENTS;
  let stockTaxableProfitCents = 0;
  let stockCompensatedLossCents = 0;

  if (!isStockExempt && stockGrossProfitCents > 0) {
    stockCompensatedLossCents = Math.min(stockGrossProfitCents, initialStockLoss);
    stockTaxableProfitCents = stockGrossProfitCents - stockCompensatedLossCents;
    initialStockLoss -= stockCompensatedLossCents;
  }
  initialStockLoss += stockNewLossCents;

  // 2. FIIs B3: sem isenção de 20k, tributação de 20%
  let fiiTaxableProfitCents = 0;
  let fiiCompensatedLossCents = 0;

  if (fiiGrossProfitCents > 0) {
    fiiCompensatedLossCents = Math.min(fiiGrossProfitCents, initialFiiLoss);
    fiiTaxableProfitCents = fiiGrossProfitCents - fiiCompensatedLossCents;
    initialFiiLoss -= fiiCompensatedLossCents;
  }
  initialFiiLoss += fiiNewLossCents;

  // 3. ETFs & BDRs B3: sem isenção de 20k, tributação de 15%
  let etfTaxableProfitCents = 0;
  let etfCompensatedLossCents = 0;

  if (etfGrossProfitCents > 0) {
    etfCompensatedLossCents = Math.min(etfGrossProfitCents, initialEtfLoss);
    etfTaxableProfitCents = etfGrossProfitCents - etfCompensatedLossCents;
    initialEtfLoss -= etfCompensatedLossCents;
  }
  initialEtfLoss += etfNewLossCents;

  const stockTaxDueCents = Math.round(stockTaxableProfitCents * STOCK_TAX_RATE);
  const fiiTaxDueCents = Math.round(fiiTaxableProfitCents * FII_TAX_RATE);
  const etfTaxDueCents = Math.round(etfTaxableProfitCents * ETF_TAX_RATE);

  const totalTaxDueCents = stockTaxDueCents + fiiTaxDueCents + etfTaxDueCents;
  const shouldPayDarf = totalTaxDueCents >= MINIMUM_DARF_EMISSION_CENTS;

  return {
    month,
    stockSalesVolumeCents,
    isStockExempt,
    stockGrossProfitCents,
    stockCompensatedLossCents,
    stockTaxableProfitCents,
    stockTaxDueCents,
    fiiSalesVolumeCents,
    fiiGrossProfitCents,
    fiiCompensatedLossCents,
    fiiTaxableProfitCents,
    fiiTaxDueCents,
    etfSalesVolumeCents,
    etfGrossProfitCents,
    etfCompensatedLossCents,
    etfTaxableProfitCents,
    etfTaxDueCents,
    foreignSalesVolumeCents,
    foreignGrossProfitCents,
    totalTaxDueCents,
    shouldPayDarf,
    remainingAccumulatedLossCents: {
      stockCents: initialStockLoss,
      fiiCents: initialFiiLoss,
      etfCents: initialEtfLoss,
    },
  };
}
