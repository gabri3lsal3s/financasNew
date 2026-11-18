import { numberToCents } from "@/domain/money";
import { getBensDireitosClassification } from "@/domain/portfolio";
import { sanitizeReportText } from "@/domain/reports";
import type { PortfolioAsset, PortfolioDividend } from "@/types";

export interface TaxAssetItemDetails {
  id: string;
  safeTicker: string;
  group: string;
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
  const totalCostBRL = isUSD ? totalCostNative * usdRate : totalCostNative;
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
  return nonCashAssets
    .map((asset) => {
      const amountBRL = dividends
        .filter((d) => d.asset_id === asset.id && d.date.startsWith(String(calendarYear)))
        .reduce((acc, d) => acc + d.amount, 0);

      if (amountBRL <= 0) return null;

      const tipoRendimento =
        asset.asset_class === "fiis"
          ? "Rendimentos Isentos (FII)"
          : "Dividendos Isentos (Ações)";

      return { asset, tipoRendimento, amountBRL };
    })
    .filter((item): item is TaxDividendAssetSummary => item !== null);
}
