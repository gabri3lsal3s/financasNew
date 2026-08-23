import type { AssetCurrency, PortfolioAsset } from "@/types";
import { inferAssetClassFromTicker } from "./import-parser";
import { inferCurrencyFromTicker } from "./valuation";

export interface CatalogTickerItem {
  ticker: string;
  name: string;
  assetClass: string;
  currency: AssetCurrency;
}

export interface TickerSearchResult extends CatalogTickerItem {
  isExisting: boolean;
  existingAssetId?: string;
  currentQuantity?: number;
  currentAveragePrice?: number;
}

export interface AporteSuggestionItem {
  assetId: string;
  ticker: string;
  assetClass: string;
  currentValueBRL: number;
  targetValueBRL: number;
  gapBRL: number;
  targetPercentage: number;
  currentPercentage: number;
}

/**
 * Catálogo curado dos principais ativos da B3 e mercado global.
 * Utilizado para autocomplete inteligente e inferência rápida no Investment Wizard.
 */
export const CURATED_TICKERS_CATALOG: readonly CatalogTickerItem[] = [
  // Ações B3 (Ibovespa Top 30)
  { ticker: "PETR4", name: "Petróleo Brasileiro S.A. Petrobras PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "PETR3", name: "Petróleo Brasileiro S.A. Petrobras ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "VALE3", name: "Vale S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "ITUB4", name: "Itaú Unibanco Holding S.A. PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "BBDC4", name: "Banco Bradesco S.A. PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "BBAS3", name: "Banco do Brasil S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "WEGE3", name: "WEG S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "ABEV3", name: "Ambev S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "RENT3", name: "Localiza Rent a Car S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "ELET3", name: "Centrais Elétricas Brasileiras S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "ELET6", name: "Centrais Elétricas Brasileiras S.A. PNB", assetClass: "Ações", currency: "BRL" },
  { ticker: "ITSA4", name: "Itaúsa S.A. PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "PRIO3", name: "PetroRio S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "GGBR4", name: "Gerdau S.A. PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "CSNA3", name: "Companhia Siderúrgica Nacional ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "SUZB3", name: "Suzano S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "JBSS3", name: "JBS S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "RADL3", name: "Raia Drogasil S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "VIVT3", name: "Telefônica Brasil S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "EQTL3", name: "Equatorial Energia S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "SBSP3", name: "Sabesp S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "CPLE6", name: "Copel PNB", assetClass: "Ações", currency: "BRL" },
  { ticker: "CMIG4", name: "Cemig PN", assetClass: "Ações", currency: "BRL" },
  { ticker: "TAEE11", name: "Taesa Unit", assetClass: "Ações", currency: "BRL" },
  { ticker: "EGIE3", name: "Engie Brasil S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "BBSE3", name: "BB Seguridade Participações S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "CXSE3", name: "Caixa Seguridade Participações S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "KLBN11", name: "Klabin S.A. Unit", assetClass: "Ações", currency: "BRL" },
  { ticker: "TOTS3", name: "Totvs S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "LREN3", name: "Lojas Renner S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "MGLU3", name: "Magazine Luiza S.A. ON", assetClass: "Ações", currency: "BRL" },
  { ticker: "B3SA3", name: "B3 S.A. Brasil, Bolsa, Balcão ON", assetClass: "Ações", currency: "BRL" },

  // FIIs e FIAGROs B3 (IFIX Top 25)
  { ticker: "MXRF11", name: "Maxi Renda FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "HGLG11", name: "CSHG Logística FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "KNIP11", name: "Kinea Índice de Preços FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "XPLG11", name: "XP Log FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "XPML11", name: "XP Malls FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "VISC11", name: "Vinci Shopping Centers FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "BTLG11", name: "BTG Pactual Logística FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "CPTS11", name: "Capitânia Securities II FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "HGRU11", name: "CSHG Renda Urbana FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "TGAR11", name: "TG Ativo Real FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "HGCR11", name: "CSHG Recebíveis Imobiliários FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "VRTA11", name: "Fator Veritá FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "IRDM11", name: "Iridium Recebíveis Imobiliários FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "RBRR11", name: "RBR Rendimento High Grade FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "PVBI11", name: "VBI Prime Properties FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "VINO11", name: "Vinci Offices FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "VGIR11", name: "Valora RE III FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "RZTR11", name: "Riza Terrax FII", assetClass: "FIIs", currency: "BRL" },
  { ticker: "VGIA11", name: "Valora CRA FIAGRO", assetClass: "FIIs", currency: "BRL" },
  { ticker: "KNCA11", name: "Kinea Crédito Agro FIAGRO", assetClass: "FIIs", currency: "BRL" },
  { ticker: "RURA11", name: "Itaú Asset Rural FIAGRO", assetClass: "FIIs", currency: "BRL" },

  // ETFs B3
  { ticker: "BOVA11", name: "iShares Ibovespa ETF", assetClass: "ETFs", currency: "BRL" },
  { ticker: "IVVB11", name: "iShares S&P 500 Fundo de Índice", assetClass: "ETFs", currency: "BRL" },
  { ticker: "SPXI11", name: "Trend ETF S&P 500", assetClass: "ETFs", currency: "BRL" },
  { ticker: "SMAL11", name: "iShares BM&FBOVESPA Small Cap ETF", assetClass: "ETFs", currency: "BRL" },
  { ticker: "HASH11", name: "Hashdex Nasdaq Crypto Index ETF", assetClass: "ETFs", currency: "BRL" },
  { ticker: "GOLD11", name: "Trend ETF Ouro Fundo de Índice", assetClass: "ETFs", currency: "BRL" },
  { ticker: "NASD11", name: "Trend ETF Nasdaq 100", assetClass: "ETFs", currency: "BRL" },
  { ticker: "BDEF11", name: "Trend ETF Dólar Fundo de Índice", assetClass: "ETFs", currency: "BRL" },

  // BDRs B3
  { ticker: "AAPL34", name: "Apple Inc. BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "MSFT34", name: "Microsoft Corporation BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "NVDC34", name: "NVIDIA Corporation BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "AMZO34", name: "Amazon.com Inc. BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "GOGL34", name: "Alphabet Inc. (Google) BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "TSLA34", name: "Tesla Inc. BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "META34", name: "Meta Platforms Inc. BDR", assetClass: "BDRs", currency: "BRL" },
  { ticker: "BERK34", name: "Berkshire Hathaway Inc. BDR", assetClass: "BDRs", currency: "BRL" },

  // Renda Fixa & Caixa
  { ticker: "TESOURO-SELIC", name: "Tesouro Selic (LFT)", assetClass: "Renda Fixa", currency: "BRL" },
  { ticker: "TESOURO-IPCA", name: "Tesouro IPCA+ (NTN-B)", assetClass: "Renda Fixa", currency: "BRL" },
  { ticker: "TESOURO-PREFIXADO", name: "Tesouro Prefixado (LTN)", assetClass: "Renda Fixa", currency: "BRL" },
  { ticker: "CDB-100-CDI", name: "CDB 100% CDI Liquidez Diária", assetClass: "Renda Fixa", currency: "BRL" },
  { ticker: "LCI-LCA-CDI", name: "LCI / LCA Isenta de IR", assetClass: "Renda Fixa", currency: "BRL" },
  { ticker: "CAIXA", name: "Saldo em Caixa / Conta Corrente", assetClass: "Caixa", currency: "BRL" },
  { ticker: "RESERVA-EMERGENCIA", name: "Reserva de Emergência", assetClass: "Caixa", currency: "BRL" },

  // Criptoativos
  { ticker: "BTC", name: "Bitcoin", assetClass: "Cripto", currency: "BRL" },
  { ticker: "ETH", name: "Ethereum", assetClass: "Cripto", currency: "BRL" },
  { ticker: "SOL", name: "Solana", assetClass: "Cripto", currency: "BRL" },
  { ticker: "USDT", name: "Tether USD", assetClass: "Cripto", currency: "USD" },
  { ticker: "USDC", name: "USD Coin", assetClass: "Cripto", currency: "USD" },

  // Ativos Globais / EUA (Internacional)
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "Internacional", currency: "USD" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", assetClass: "Internacional", currency: "USD" },
  { ticker: "QQQ", name: "Invesco QQQ Trust (Nasdaq 100)", assetClass: "Internacional", currency: "USD" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "Internacional", currency: "USD" },
  { ticker: "VT", name: "Vanguard Total World Stock ETF", assetClass: "Internacional", currency: "USD" },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF (US REITs)", assetClass: "Internacional", currency: "USD" },
  { ticker: "AAPL", name: "Apple Inc. Common Stock", assetClass: "Internacional", currency: "USD" },
  { ticker: "MSFT", name: "Microsoft Corporation Common Stock", assetClass: "Internacional", currency: "USD" },
  { ticker: "NVDA", name: "NVIDIA Corporation Common Stock", assetClass: "Internacional", currency: "USD" },
  { ticker: "AMZN", name: "Amazon.com Inc. Common Stock", assetClass: "Internacional", currency: "USD" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", assetClass: "Internacional", currency: "USD" },
  { ticker: "META", name: "Meta Platforms Inc. Class A", assetClass: "Internacional", currency: "USD" },
  { ticker: "TSLA", name: "Tesla Inc. Common Stock", assetClass: "Internacional", currency: "USD" },
];

/**
 * Sanitiza um ticker livre para uppercase e trim.
 */
export function cleanTicker(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Pesquisa no catálogo e mescla com ativos já cadastrados na carteira do usuário.
 */
export function searchTickers(
  query: string,
  existingAssets: readonly PortfolioAsset[] = [],
  limit = 8,
): TickerSearchResult[] {
  const q = cleanTicker(query);
  const existingMap = new Map(existingAssets.map((a) => [cleanTicker(a.ticker), a]));

  const results: TickerSearchResult[] = [];
  const seenTickers = new Set<string>();

  // 1. Se houver query vazia, sugere os ativos já existentes na carteira primeiro
  if (!q) {
    for (const asset of existingAssets) {
      const t = cleanTicker(asset.ticker);
      if (seenTickers.has(t)) continue;
      seenTickers.add(t);

      const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === t);
      results.push({
        ticker: t,
        name: catalogMatch?.name ?? asset.notes ?? t,
        assetClass: asset.asset_class ?? catalogMatch?.assetClass ?? "Outros",
        currency: asset.currency,
        isExisting: true,
        existingAssetId: asset.id,
        currentQuantity: asset.quantity,
        currentAveragePrice: asset.average_price,
      });
      if (results.length >= limit) return results;
    }
    return results;
  }

  // 2. Prioridade A: Ativos existentes do usuário que batem com a query
  for (const asset of existingAssets) {
    const t = cleanTicker(asset.ticker);
    const matchTicker = t.includes(q);
    const matchNotes = (asset.notes ?? "").toUpperCase().includes(q);

    if (matchTicker || matchNotes) {
      seenTickers.add(t);
      const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === t);
      results.push({
        ticker: t,
        name: catalogMatch?.name ?? asset.notes ?? t,
        assetClass: asset.asset_class ?? catalogMatch?.assetClass ?? "Outros",
        currency: asset.currency,
        isExisting: true,
        existingAssetId: asset.id,
        currentQuantity: asset.quantity,
        currentAveragePrice: asset.average_price,
      });
      if (results.length >= limit) return results;
    }
  }

  // 3. Prioridade B: Catálogo estático curado
  for (const item of CURATED_TICKERS_CATALOG) {
    if (seenTickers.has(item.ticker)) continue;

    const matchTicker = item.ticker.includes(q);
    const matchName = item.name.toUpperCase().includes(q);

    if (matchTicker || matchName) {
      seenTickers.add(item.ticker);
      const existing = existingMap.get(item.ticker);
      results.push({
        ticker: item.ticker,
        name: item.name,
        assetClass: item.assetClass,
        currency: item.currency,
        isExisting: existing !== undefined,
        existingAssetId: existing?.id,
        currentQuantity: existing?.quantity,
        currentAveragePrice: existing?.average_price,
      });
      if (results.length >= limit) return results;
    }
  }

  // 4. Se a query não estiver no catálogo nem na carteira, oferece como novo ativo livre
  if (q.length >= 2 && !seenTickers.has(q)) {
    const inferredClass = inferAssetClassFromTicker(q) ?? "Ações";
    const inferredCurrency = inferCurrencyFromTicker(q);
    results.push({
      ticker: q,
      name: `Ativo personalizado (${q})`,
      assetClass: inferredClass,
      currency: inferredCurrency,
      isExisting: false,
    });
  }

  return results.slice(0, limit);
}

/**
 * Gera sugestões preditivas de aporte baseadas na lógica hierárquica
 * (defasagem macro da classe -> maior gap financeiro do ativo em relação às metas).
 */
export function buildAporteSuggestions(
  assets: readonly PortfolioAsset[],
  assetRows: readonly {
    assetId: string;
    ticker: string;
    valueBRL: number;
    pct: number;
    assetClass?: string | null;
  }[],
  targets: readonly { asset_id: string; target_percentage: number }[],
  totalPortfolioBRL: number,
  limit = 3,
  classTargets?: readonly { name: string; target_percentage: number }[],
): AporteSuggestionItem[] {
  const hasTargets = targets.length > 0 || (classTargets && classTargets.length > 0);
  if (totalPortfolioBRL <= 0 || !hasTargets) return [];

  const targetMap = new Map(targets.map((t) => [t.asset_id, t.target_percentage]));
  const classTargetMap = new Map((classTargets ?? []).map((t) => [t.name, t.target_percentage]));
  const rowMap = new Map(assetRows.map((r) => [r.assetId, r]));

  // Agrupamento por classe
  const assetsByClass = new Map<string, PortfolioAsset[]>();
  for (const asset of assets) {
    const key = asset.asset_class ?? "";
    const list = assetsByClass.get(key) ?? [];
    list.push(asset);
    assetsByClass.set(key, list);
  }

  // Resolução de metas efetivas hierárquicas
  const effectiveTargetMap = new Map<string, number>();

  // 1. Metas individuais diretas
  for (const asset of assets) {
    const targetPct = targetMap.get(asset.id);
    if (targetPct && targetPct > 0) {
      effectiveTargetMap.set(asset.id, targetPct);
    }
  }

  // 2. Metas de classe distribuídas equiponderadamente para ativos sem meta própria
  for (const [className, members] of assetsByClass) {
    const classTargetPct = classTargetMap.get(className) ?? 0;
    if (!(classTargetPct > 0)) continue;

    const unassigned = members.filter((a) => !effectiveTargetMap.has(a.id));
    if (unassigned.length === 0) continue;

    const assignedSum = members
      .filter((a) => effectiveTargetMap.has(a.id))
      .reduce((acc, a) => acc + (targetMap.get(a.id) ?? 0), 0);

    const remainingClassPct = Math.max(0, classTargetPct - assignedSum);
    if (remainingClassPct > 0) {
      const share = remainingClassPct / unassigned.length;
      for (const member of unassigned) {
        effectiveTargetMap.set(member.id, share);
      }
    }
  }

  // Estatísticas macro por classe para ordenação hierárquica
  const classDeficitMap = new Map<string, number>();
  for (const [className, members] of assetsByClass) {
    const classTargetPct = classTargetMap.get(className) ?? 0;
    const classTargetValueBRL = (totalPortfolioBRL * classTargetPct) / 100;
    const classCurrentValueBRL = members.reduce((acc, a) => acc + (rowMap.get(a.id)?.valueBRL ?? 0), 0);

    const deficitRel =
      classTargetValueBRL > 0
        ? Math.max(0, (classTargetValueBRL - classCurrentValueBRL) / classTargetValueBRL)
        : 0;
    classDeficitMap.set(className, deficitRel);
  }

  interface SuggestionWithPriority extends AporteSuggestionItem {
    classDeficitRel: number;
  }

  const suggestions: SuggestionWithPriority[] = [];

  for (const asset of assets) {
    const targetPct = effectiveTargetMap.get(asset.id);
    if (!targetPct || targetPct <= 0) continue;

    const row = rowMap.get(asset.id);
    const currentValueBRL = row?.valueBRL ?? 0;
    const currentPct = row?.pct ?? 0;
    const targetValueBRL = (totalPortfolioBRL * targetPct) / 100;
    const gapBRL = targetValueBRL - currentValueBRL;

    if (gapBRL > 0) {
      const className = asset.asset_class ?? "Ações";
      suggestions.push({
        assetId: asset.id,
        ticker: cleanTicker(asset.ticker),
        assetClass: className,
        currentValueBRL,
        targetValueBRL,
        gapBRL: Math.round(gapBRL * 100) / 100,
        targetPercentage: targetPct,
        currentPercentage: currentPct,
        classDeficitRel: classDeficitMap.get(asset.asset_class ?? "") ?? 0,
      });
    }
  }

  return suggestions
    .sort((a, b) => {
      if (Math.abs(b.classDeficitRel - a.classDeficitRel) > 0.001) {
        return b.classDeficitRel - a.classDeficitRel;
      }
      return b.gapBRL - a.gapBRL;
    })
    .slice(0, limit)
    .map((item) => ({
      assetId: item.assetId,
      ticker: item.ticker,
      assetClass: item.assetClass,
      currentValueBRL: item.currentValueBRL,
      targetValueBRL: item.targetValueBRL,
      gapBRL: item.gapBRL,
      targetPercentage: item.targetPercentage,
      currentPercentage: item.currentPercentage,
    }));
}

/**
 * Retorna os ativos que possuem metas definidas, ordenados pela lógica hierárquica
 * (classe mais defasada -> maior gap de aporte), no formato TickerSearchResult.
 * Usado na lista "recomendados" do wizard quando não há busca ativa.
 */
export function buildTopSuggestionResults(
  assets: readonly PortfolioAsset[],
  assetRows: readonly {
    assetId: string;
    ticker: string;
    valueBRL: number;
    pct: number;
    assetClass?: string | null;
  }[],
  targets: readonly { asset_id: string; target_percentage: number }[],
  totalPortfolioBRL: number,
  limit = 5,
  classTargets?: readonly { name: string; target_percentage: number }[],
): TickerSearchResult[] {
  const hasTargets = targets.length > 0 || (classTargets && classTargets.length > 0);
  if (!hasTargets) return [];

  const suggestions = buildAporteSuggestions(assets, assetRows, targets, totalPortfolioBRL, limit, classTargets);

  return suggestions.map((item) => {
    const asset = assets.find((a) => a.id === item.assetId);
    const catalogMatch = CURATED_TICKERS_CATALOG.find((c) => c.ticker === item.ticker);
    return {
      ticker: item.ticker,
      name: catalogMatch?.name ?? asset?.notes ?? item.ticker,
      assetClass: item.assetClass,
      currency: asset?.currency ?? catalogMatch?.currency ?? "BRL",
      isExisting: true,
      existingAssetId: item.assetId,
      currentQuantity: asset?.quantity,
      currentAveragePrice: asset?.average_price,
    };
  });
}

