import { numberToCents } from "@/domain/money";
import { getBensDireitosClassification } from "@/domain/portfolio";
import { sanitizeReportText } from "@/domain/reports";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface TaxAssetItemDetails {
  id: string;
  safeTicker: string;
  group: string;
  groupName: string;
  code: string;
  label: string;
  itemName: string;
  totalCostBRL: number;
  textToCopy: string;
}

export interface TaxDividendAssetSummary {
  asset: PortfolioAsset;
  tipoRendimento: string;
  amountBRL: number;
}

function formatMoneyBR(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildTaxItemDetails(asset: PortfolioAsset, usdRate: number): TaxAssetItemDetails {
  const safeTicker = sanitizeReportText(asset.ticker);
  const classification = getBensDireitosClassification(asset.asset_class, asset.ticker);
  const isUSD = asset.currency === "USD";
  const totalCostNative = asset.quantity * asset.average_price;
  const historicalCostBRL =
    asset.total_cost_brl !== null && asset.total_cost_brl !== undefined && asset.total_cost_brl > 0
      ? asset.total_cost_brl
      : isUSD
        ? totalCostNative * (asset.fx_rate_at_purchase && asset.fx_rate_at_purchase > 0 ? asset.fx_rate_at_purchase : usdRate)
        : totalCostNative;
  const totalCostBRL = historicalCostBRL;
  const qtyStr = asset.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  const cotaWord = asset.quantity === 1 ? "cota" : "cotas";

  let textToCopy: string;
  if (isUSD) {
    const unitPriceUSD = asset.average_price.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const totalCostUSD = totalCostNative.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const totalCostBRLFormatted = formatMoneyBR(numberToCents(totalCostBRL));
    textToCopy = `${qtyStr} ${cotaWord} de ${safeTicker} (${classification.itemName}), custodiadas no exterior em conta própria, custo médio unitário de US$ ${unitPriceUSD} (total em moeda estrangeira: US$ ${totalCostUSD}), equivalente a R$ ${totalCostBRLFormatted}.`;
  } else {
    const unitPriceBRL = formatMoneyBR(numberToCents(asset.average_price));
    const totalCostBRLFormatted = formatMoneyBR(numberToCents(totalCostBRL));
    textToCopy = `${qtyStr} ${cotaWord} de ${safeTicker} (${classification.itemName}), custodiadas em conta própria da corretora, custo médio unitário de R$ ${unitPriceBRL}, totalizando R$ ${totalCostBRLFormatted}.`;
  }

  return {
    id: asset.id,
    safeTicker,
    group: classification.groupCode,
    groupName: classification.groupName,
    code: classification.itemCode,
    label: `${classification.groupCode}-${classification.itemCode} ${classification.itemName}`,
    itemName: classification.itemName,
    totalCostBRL,
    textToCopy,
  };
}

export function buildExemptDividendsByAsset(
  nonCashAssets: readonly PortfolioAsset[],
  dividends: readonly PortfolioDividend[],
  calendarYear: number,
): TaxDividendAssetSummary[] {
  const assetMap = new Map(nonCashAssets.map((a) => [a.id, a]));
  const grouped = new Map<string, TaxDividendAssetSummary>();

  for (const div of dividends) {
    if (!div.date.startsWith(String(calendarYear))) continue;
    const asset = div.asset_id ? assetMap.get(div.asset_id) : undefined;
    if (!asset) continue;

    // Segrega rendimentos do exterior (USD) e JCP fora da ficha de rendimentos isentos BRL (T06)
    const noteUpper = (div.notes ?? "").toUpperCase();
    const isJcp =
      (div as { type?: string }).type === "jcp" ||
      noteUpper.includes("[JCP]") ||
      noteUpper.includes("JUROS SOBRE CAPITAL");
    if (asset.currency === "USD" || isJcp) continue;

    const current = grouped.get(asset.id);
    if (current) {
      current.amountBRL += div.amount;
    } else {
      const tipoRendimento =
        asset.asset_class === "fiis"
          ? "Rendimentos Isentos (FII)"
          : "Dividendos Isentos (Ações)";
      grouped.set(asset.id, { asset, tipoRendimento, amountBRL: div.amount });
    }
  }

  return Array.from(grouped.values()).filter((item) => item.amountBRL > 0);
}
