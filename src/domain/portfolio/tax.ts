/**
 * Motor de Apuração Fiscal, IRPF Anual e DARF Mensal (§F40).
 * Funções 100% puras sem dependência de React ou Supabase (AGENTS.md §3).
 */

import { formatCentsAsBRL } from "@/services/masks";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

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
export function generateAnnualBensDireitosReport(assets: PortfolioAsset[], year: number): AnnualBensDireitosReport {
  const items: TaxAssetItem[] = assets
    .filter((a) => a.quantity > 0)
    .map((a) => {
      const classification = getBensDireitosClassification(a.asset_class, a.ticker);
      const totalCost = Math.round(a.quantity * a.average_price * 100) / 100;
      const totalCostCents = Math.round(totalCost * 100);
      const formattedCost = formatCentsAsBRL(totalCostCents).replace(/\u00A0/g, " ");
      const formattedUnitPrice = formatCentsAsBRL(Math.round(a.average_price * 100)).replace(/\u00A0/g, " ");

      const discrimination = `${a.quantity} cotas/ações de ${a.ticker} (${classification.itemName}) adquiridas pelo custo total de ${formattedCost} (preço médio unitário de ${formattedUnitPrice}), custodiadas em conta própria da corretora.`;

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
  totalDividendsCents: number;
}

/**
 * Classifica proventos recebidos por ficha da Declaração de Ajuste Anual.
 */
export function classifyAnnualDividendsReport(
  dividends: PortfolioDividend[],
  assets: PortfolioAsset[],
  year: number,
): AnnualDividendsTaxReport {
  const yearPrefix = String(year);
  const yearDividends = dividends.filter((d) => d.date.startsWith(yearPrefix));
  const tickerMap = new Map(assets.map((a) => [a.id, a.ticker]));

  const exemptItemsMap = new Map<string, { ticker: string; cents: number }>();
  const jcpItemsMap = new Map<string, { ticker: string; cents: number }>();

  for (const div of yearDividends) {
    const ticker = (div.asset_id ? tickerMap.get(div.asset_id) : null) ?? div.ticker ?? "Ativo";
    const amountCents = Math.round(div.amount * 100);
    const noteUpper = (div.notes ?? "").toUpperCase();
    const isJCP = noteUpper.includes("JCP") || noteUpper.includes("JUROS SOBRE CAPITAL");

    if (isJCP) {
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

  const exemptTotalCents = exemptItems.reduce((acc, i) => acc + i.amountCents, 0);
  const jcpTotalCents = jcpItems.reduce((acc, i) => acc + i.amountCents, 0);

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
    totalDividendsCents: exemptTotalCents + jcpTotalCents,
  };
}

export interface MonthlyDarfInput {
  month: string;
  /** Operações de venda realizadas no mês. */
  sales: {
    ticker: string;
    assetClass: string | null;
    saleAmountCents: number;
    costAmountCents: number;
    profitCents: number;
  }[];
  /** Prejuízos acumulados de meses anteriores a compensar (em centavos). */
  previousLosses?: {
    stockCents?: number;
    fiiCents?: number;
  };
}

export interface MonthlyDarfResult {
  month: string;
  stockSalesVolumeCents: number;
  isStockExempt: boolean;
  stockGrossProfitCents: number;
  stockCompensatedLossCents: number;
  stockTaxableProfitCents: number;
  stockTaxDueCents: number;
  fiiSalesVolumeCents: number;
  fiiGrossProfitCents: number;
  fiiCompensatedLossCents: number;
  fiiTaxableProfitCents: number;
  fiiTaxDueCents: number;
  totalTaxDueCents: number;
  shouldPayDarf: boolean;
  remainingAccumulatedLossCents: {
    stockCents: number;
    fiiCents: number;
  };
}

const STOCK_MONTHLY_EXEMPTION_LIMIT_CENTS = 20_000 * 100; // R$ 20.000,00
const STOCK_TAX_RATE = 0.15; // 15%
const FII_TAX_RATE = 0.20; // 20%
const MINIMUM_DARF_EMISSION_CENTS = 10 * 100; // R$ 10,00

/**
 * Apuração mensal de impostos sobre ganhos líquidos de renda variável (DARF).
 */
export function calculateMonthlyDarf(input: MonthlyDarfInput): MonthlyDarfResult {
  const { month, sales, previousLosses = {} } = input;

  let initialStockLoss = Math.max(0, previousLosses.stockCents ?? 0);
  let initialFiiLoss = Math.max(0, previousLosses.fiiCents ?? 0);

  let stockSalesVolumeCents = 0;
  let stockGrossProfitCents = 0;
  let stockNewLossCents = 0;

  let fiiSalesVolumeCents = 0;
  let fiiGrossProfitCents = 0;
  let fiiNewLossCents = 0;

  for (const s of sales) {
    const normClass = (s.assetClass ?? "").toLowerCase();
    const isFii = normClass.includes("fii") || normClass.includes("imobili");

    if (isFii) {
      fiiSalesVolumeCents += s.saleAmountCents;
      if (s.profitCents > 0) {
        fiiGrossProfitCents += s.profitCents;
      } else {
        fiiNewLossCents += Math.abs(s.profitCents);
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

  // Isenção de ações: volume de vendas no mês <= R$ 20.000
  const isStockExempt = stockSalesVolumeCents <= STOCK_MONTHLY_EXEMPTION_LIMIT_CENTS;

  let stockTaxableProfitCents = 0;
  let stockCompensatedLossCents = 0;

  if (!isStockExempt && stockGrossProfitCents > 0) {
    stockCompensatedLossCents = Math.min(stockGrossProfitCents, initialStockLoss);
    stockTaxableProfitCents = stockGrossProfitCents - stockCompensatedLossCents;
    initialStockLoss -= stockCompensatedLossCents;
  }

  // Atualiza prejuízo acumulado de ações
  initialStockLoss += stockNewLossCents;

  // FIIs: sem isenção de 20k, tributação de 20%
  let fiiTaxableProfitCents = 0;
  let fiiCompensatedLossCents = 0;

  if (fiiGrossProfitCents > 0) {
    fiiCompensatedLossCents = Math.min(fiiGrossProfitCents, initialFiiLoss);
    fiiTaxableProfitCents = fiiGrossProfitCents - fiiCompensatedLossCents;
    initialFiiLoss -= fiiCompensatedLossCents;
  }

  initialFiiLoss += fiiNewLossCents;

  const stockTaxDueCents = Math.round(stockTaxableProfitCents * STOCK_TAX_RATE);
  const fiiTaxDueCents = Math.round(fiiTaxableProfitCents * FII_TAX_RATE);
  const totalTaxDueCents = stockTaxDueCents + fiiTaxDueCents;
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
    totalTaxDueCents,
    shouldPayDarf,
    remainingAccumulatedLossCents: {
      stockCents: initialStockLoss,
      fiiCents: initialFiiLoss,
    },
  };
}
