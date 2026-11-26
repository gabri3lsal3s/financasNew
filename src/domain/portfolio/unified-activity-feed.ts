/**
 * Motor puro de unificação, filtragem, métricas e exportação do Extrato de Carteira.
 * Funções 100% puras — sem import de UI ou Supabase (AGENTS.md §3).
 */

import type { ExportPortfolioActivityRow } from "@/domain/export";
import { numberToCents } from "@/domain/money/parse";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioTransaction,
} from "@/types";
import { isDividendType } from "./dividends";
import { inferSectorFromTicker } from "./tickers-catalog";
import { isCashAssetClass } from "./valuation";

export type ActivityFilterType = "all" | "buy" | "contribution" | "sell" | "dividend";

export interface ActivityItem {
  id: string;
  source: "transaction" | "contribution" | "dividend";
  type: "buy" | "sell" | "dividend" | "split" | "contribution";
  date: string;
  ticker: string;
  assetName?: string;
  assetClass?: string | null;
  quantity?: number;
  price?: number;
  total: number;
  notes?: string | null;
  rawTransaction?: PortfolioTransaction;
  rawContribution?: PortfolioContribution;
  rawDividend?: PortfolioDividend;
  linkedContribution?: PortfolioContribution;
}

export interface ActivityMonthStats {
  boughtCents: number;
  contributionsCents: number;
  soldCents: number;
  dividendsCents: number;
  netInvestedCents: number;
}

export interface ActivityTypeCounts {
  buys: number;
  contributions: number;
  sells: number;
  dividends: number;
}

export function isCashActivityItem(
  item: Pick<ActivityItem, "ticker" | "assetClass">,
  asset?: PortfolioAsset | null,
): boolean {
  if (asset) {
    return isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA";
  }
  if (item.assetClass) {
    return isCashAssetClass(item.assetClass) || item.ticker.toUpperCase() === "CAIXA";
  }
  return item.ticker.toUpperCase() === "CAIXA";
}

export function buildUnifiedActivityTimeline({
  transactions,
  contributions,
  dividends,
  assetMap,
}: {
  transactions: readonly PortfolioTransaction[];
  contributions: readonly PortfolioContribution[];
  dividends: readonly PortfolioDividend[];
  assetMap: ReadonlyMap<string, PortfolioAsset>;
}): ActivityItem[] {
  const list: ActivityItem[] = [];

  const contributionNotesMap = new Map<string, string>();
  const contributionByAssetDateMap = new Map<string, PortfolioContribution>();
  for (const c of contributions) {
    if (c.asset_id) {
      contributionByAssetDateMap.set(`${c.asset_id}_${c.date}`, c);
      if (c.notes) {
        contributionNotesMap.set(`${c.asset_id}_${c.date}`, c.notes);
      }
    }
  }

  const dividendMap = new Map<string, PortfolioDividend>();
  for (const d of dividends) {
    if (d.asset_id) {
      dividendMap.set(`${d.asset_id}_${d.date}`, d);
    }
  }

  for (const t of transactions) {
    const asset = assetMap.get(t.asset_id);
    if (asset && (isCashAssetClass(asset.asset_class) || asset.ticker.toUpperCase() === "CAIXA")) {
      continue;
    }
    const ticker = asset?.ticker ?? "Ativo";
    const totalAmount =
      t.total > 0 ? t.total : t.quantity > 0 && t.price > 0 ? t.quantity * t.price : 0;
    const linkedNote =
      contributionNotesMap.get(`${t.asset_id}_${t.date}`) ??
      (t as { notes?: string | null }).notes ??
      null;
    const linkedContrib = t.asset_id
      ? contributionByAssetDateMap.get(`${t.asset_id}_${t.date}`)
      : undefined;

    const isDiv = isDividendType(t.type);
    const linkedDiv = isDiv && t.asset_id ? dividendMap.get(`${t.asset_id}_${t.date}`) : undefined;
    const activityType: ActivityItem["type"] =
      t.type === "buy" || t.type === "subscription"
        ? "buy"
        : t.type === "sell"
          ? "sell"
          : t.type === "split" || t.type === "reverse_split"
            ? "split"
            : isDiv
              ? "dividend"
              : "buy";

    list.push({
      id: `tx-${t.id}`,
      source: "transaction",
      type: activityType,
      date: t.date,
      ticker,
      assetClass: asset?.asset_class,
      quantity: t.quantity,
      price: t.price,
      total: totalAmount,
      notes: linkedNote,
      rawTransaction: t,
      rawContribution: linkedContrib,
      rawDividend: linkedDiv,
      linkedContribution: linkedContrib,
    });
  }

  for (const d of dividends) {
    const asset = d.asset_id ? assetMap.get(d.asset_id) : undefined;
    const ticker = asset?.ticker ?? "Provento";
    const alreadyInList = list.some(
      (item) =>
        item.type === "dividend" &&
        item.date === d.date &&
        (item.ticker === ticker || ticker === "Provento") &&
        Math.abs(item.total - d.amount) < 0.01,
    );

    if (!alreadyInList) {
      list.push({
        id: `div-${d.id}`,
        source: "dividend",
        type: "dividend",
        date: d.date,
        ticker,
        assetClass: asset?.asset_class,
        total: d.amount,
        notes: d.notes,
        rawDividend: d,
      });
    }
  }

  for (const c of contributions) {
    const asset = c.asset_id ? assetMap.get(c.asset_id) : undefined;
    const ticker = asset?.ticker ?? "Aporte Financeiro";
    const alreadyCovered = list.some(
      (item) =>
        item.source === "transaction" &&
        item.type === "buy" &&
        item.date === c.date &&
        (c.asset_id
          ? item.rawTransaction?.asset_id === c.asset_id
          : item.ticker === ticker || ticker === "Aporte Financeiro"),
    );

    if (!alreadyCovered) {
      list.push({
        id: `contrib-${c.id}`,
        source: "contribution",
        type: "contribution",
        date: c.date,
        ticker,
        assetClass: asset?.asset_class,
        total: c.amount,
        notes: c.notes,
        rawContribution: c,
      });
    }
  }

  return list.sort((a, b) => b.date.localeCompare(a.date));
}

export function resolveActivityItemAsset(
  item: ActivityItem,
  assetMap: ReadonlyMap<string, PortfolioAsset>,
): PortfolioAsset | null {
  const assetId =
    item.rawTransaction?.asset_id ??
    item.rawDividend?.asset_id ??
    item.rawContribution?.asset_id;
  return assetId ? (assetMap.get(assetId) ?? null) : null;
}

export function computeActivityMonthStats({
  monthActivities,
  contributions,
  month,
  assetMap,
  usdRate,
}: {
  monthActivities: readonly ActivityItem[];
  contributions: readonly PortfolioContribution[];
  month: string;
  assetMap: ReadonlyMap<string, PortfolioAsset>;
  usdRate: number;
}): ActivityMonthStats {
  let totalBoughtAssets = 0;
  let totalSoldAssets = 0;
  let totalDividends = 0;

  for (const item of monthActivities) {
    const asset = resolveActivityItemAsset(item, assetMap);
    const isCash = isCashActivityItem(item, asset);
    const rate = asset?.currency === "USD" ? usdRate : 1;
    const totalBRL = item.total * rate;

    if (item.type === "buy" && !isCash) totalBoughtAssets += totalBRL;
    else if (item.type === "sell" && !isCash) totalSoldAssets += totalBRL;
    else if (item.type === "dividend") totalDividends += totalBRL;
  }

  let totalContributions = 0;
  for (const c of contributions) {
    if (c.date && c.date.startsWith(month)) {
      totalContributions += Number(c.amount) || 0;
    }
  }

  return {
    boughtCents: numberToCents(totalBoughtAssets),
    contributionsCents: numberToCents(totalContributions),
    soldCents: numberToCents(totalSoldAssets),
    dividendsCents: numberToCents(totalDividends),
    netInvestedCents: numberToCents(totalBoughtAssets - totalSoldAssets),
  };
}

export function computeActivityTypeCounts(
  monthActivities: readonly ActivityItem[],
  contributions: readonly PortfolioContribution[],
  month: string,
): ActivityTypeCounts {
  let buys = 0;
  let sells = 0;
  let dividends = 0;

  for (const item of monthActivities) {
    if (item.type === "buy") buys++;
    else if (item.type === "sell") sells++;
    else if (item.type === "dividend") dividends++;
  }

  const contribCount = contributions.filter(
    (c) => Boolean(c.date && c.date.startsWith(month)),
  ).length;

  return { buys, contributions: contribCount, sells, dividends };
}

export function filterActivityItems({
  monthActivities,
  filterType,
  selectedClass,
  selectedSector,
  search,
}: {
  monthActivities: readonly ActivityItem[];
  filterType: ActivityFilterType;
  selectedClass: string;
  selectedSector: string;
  search: string;
}): ActivityItem[] {
  return monthActivities.filter((item) => {
    if (filterType === "buy" && item.type !== "buy") return false;
    if (filterType === "contribution") {
      const isDirect = item.type === "contribution";
      const isFunded = item.type === "buy" && Boolean(item.linkedContribution);
      if (!isDirect && !isFunded) return false;
    }
    if (filterType === "sell" && item.type !== "sell") return false;
    if (filterType === "dividend" && item.type !== "dividend") return false;

    if (selectedClass !== "all" && item.assetClass !== selectedClass) return false;

    if (selectedSector !== "all") {
      const sec = inferSectorFromTicker(item.ticker, item.assetClass ?? undefined);
      if (sec !== selectedSector) return false;
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const matchTicker = item.ticker.toLowerCase().includes(query);
      const matchNotes = item.notes?.toLowerCase().includes(query) ?? false;
      const matchClass = item.assetClass?.toLowerCase().includes(query) ?? false;
      const sec = inferSectorFromTicker(item.ticker, item.assetClass ?? undefined);
      const matchSector = sec?.toLowerCase().includes(query) ?? false;
      return matchTicker || matchNotes || matchClass || matchSector;
    }

    return true;
  });
}

export function mapActivitiesToExportRows(
  items: readonly ActivityItem[],
): ExportPortfolioActivityRow[] {
  return items.map((item) => {
    let typeLabel = "Operação";
    const isCash = item.ticker.toUpperCase() === "CAIXA" || isCashAssetClass(item.assetClass);
    if (item.type === "contribution") {
      typeLabel = isCash ? "Aporte em Caixa" : "Aporte";
    } else if (item.type === "buy") {
      typeLabel = "Compra";
    } else if (item.type === "sell") {
      typeLabel = "Venda / Resgate";
    } else if (item.type === "dividend") {
      typeLabel = "Provento";
    } else if (item.type === "split") {
      typeLabel = "Desdobramento";
    }

    return {
      date: item.date,
      type: typeLabel,
      ticker: item.ticker,
      assetClass: item.assetClass ?? null,
      quantity: item.quantity ?? null,
      price: item.price ?? null,
      total: item.total,
      notes: item.notes ?? null,
    };
  });
}
