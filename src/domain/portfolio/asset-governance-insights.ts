/**
 * Motor Puro de Gatilhos Proativos de Governança & Auditoria de Teses — §F41.
 *
 * Monitora proativamente a qualidade da carteira e a disciplina do investidor:
 * 1. Revisão Periódica Vencida (> 180 dias ou frequência configurada);
 * 2. Acompanhamento de Quarentena (> 90 dias com posição congelada);
 * 3. Oportunidade com Desconto (Nota ≥ 8 e cotação ≥ 20% abaixo do PM);
 * 4. Hiperconcentração em Ativos de Baixa Convicção (Nota ≤ 4 com exposição > 5%).
 *
 * Suporte a consolidação anti-fadiga (Salvaguarda S6).
 * Função pura — sem efeitos colaterais, sem dependências de UI/Supabase.
 */

import type { AssetAllocationStatus } from "@/types";

export type GovernanceInsightKind =
  | "review_overdue"
  | "review_upcoming"
  | "unscored_asset"
  | "quarantine_followup"
  | "discount_opportunity"
  | "low_score_overweight";

export type GovernanceInsightSeverity = "info" | "warning" | "critical" | "positive";

export interface GovernanceAssetInput {
  id: string;
  ticker: string;
  name?: string | null;
  assetClass: string | null;
  sector?: string | null;
  currentValueBRL: number;
  currentPrice: number;
  averageCost: number;
  ceilingPrice?: number | null;
  score?: number | null;
  allocation_status?: AssetAllocationStatus;
  last_reviewed_at?: string | null;
  review_frequency_months?: number;
  thesis_summary?: string | null;
}

export interface GovernanceInsight {
  id: string;
  kind: GovernanceInsightKind;
  severity: GovernanceInsightSeverity;
  title: string;
  description: string;
  assetId?: string;
  ticker?: string;
  tickers?: string[];
  assetIds?: string[];
  assetClass?: string | null;
  daysSinceReview?: number;
  daysUntilReview?: number;
  daysInQuarantine?: number;
  discountPct?: number;
  allocationPct?: number;
  score?: number | null;
  actionLabel?: string;
}

export interface ConsolidatedGovernanceSummary {
  overdueCount: number;
  upcomingReviewCount: number;
  unscoredCount: number;
  quarantineCount: number;
  opportunityCount: number;
  lowScoreRiskCount: number;
  totalInsights: number;
}

export interface GovernanceInsightsResult {
  insights: GovernanceInsight[];
  summary: ConsolidatedGovernanceSummary;
  /** Card consolidado para carrossel (Salvaguarda S6) evitando fadiga de múltiplos alertas */
  consolidatedReviewAlert: GovernanceInsight | null;
  consolidatedUpcomingAlert: GovernanceInsight | null;
  consolidatedUnscoredAlert: GovernanceInsight | null;
}

/** Limiar padrão (em dias) para alertar que uma revisão de tese está próxima de vencer. */
export const UPCOMING_REVIEW_WINDOW_DAYS = 30;

export function formatTickerListSummary(tickers: readonly string[], maxVisible = 2): string {
  if (tickers.length === 0) return "";
  if (tickers.length <= maxVisible) {
    return tickers.join(", ");
  }
  const head = tickers.slice(0, maxVisible).join(", ");
  const remaining = tickers.length - maxVisible;
  return `${head} e +${remaining} ${remaining === 1 ? "ativo" : "ativos"}`;
}

export function generateAssetGovernanceInsights(params: {
  assets: readonly GovernanceAssetInput[];
  totalPortfolioBRL?: number;
  referenceDate?: Date;
}): GovernanceInsightsResult {
  const { assets, referenceDate = new Date() } = params;
  const nowTime = referenceDate.getTime();

  const totalPortfolioBRL =
    params.totalPortfolioBRL ??
    assets.reduce((acc, a) => acc + Math.max(0, a.currentValueBRL), 0);

  const insights: GovernanceInsight[] = [];
  const overdueAssets: GovernanceAssetInput[] = [];
  const upcomingAssets: Array<{ asset: GovernanceAssetInput; daysUntilReview: number }> = [];
  const unscoredAssets: GovernanceAssetInput[] = [];

  for (const asset of assets) {
    const status = asset.allocation_status ?? "active";
    const score = asset.score;

    // Se o ativo não possui nota definida (avaliação inicial pendente),
    // ele pertence estritamente ao gatilho de Ativos sem Nota Definida (GATILHO 1C),
    // e NÃO deve disparar revisão periódica vencida ou próxima (GATILHO 1A / 1B).
    const hasInitialEvaluation = score !== null && score !== undefined;

    if (!hasInitialEvaluation && status !== "exit") {
      // GATILHO 1C: Ativo sem nota definida (Avaliação inicial pendente)
      unscoredAssets.push(asset);
      insights.push({
        id: `gov-unscored-${asset.id}`,
        kind: "unscored_asset",
        severity: "info",
        title: `Ativo sem nota: ${asset.ticker}`,
        description: `${asset.ticker} ainda não possui nota de convicção para o motor de rebalanceamento.`,
        assetId: asset.id,
        ticker: asset.ticker,
        tickers: [asset.ticker],
        assetIds: [asset.id],
        assetClass: asset.assetClass,
        score: null,
        actionLabel: "Avaliar agora",
      });
    } else if (hasInitialEvaluation && status !== "exit") {
      // GATILHO 1A / 1B: Revisão Periódica de Teses
      // Só é executado quando a avaliação inicial já tiver sido feita (score != null)
      let daysSinceReview = 0;
      if (asset.last_reviewed_at) {
        const reviewedTime = new Date(asset.last_reviewed_at).getTime();
        if (!Number.isNaN(reviewedTime)) {
          daysSinceReview = Math.max(0, Math.floor((nowTime - reviewedTime) / (1000 * 60 * 60 * 24)));
        }
      } else {
        // Ativo possui nota definida, mas ainda não tem data formal registrada:
        // assume vencido para que o usuário confirme/reavalie a nota e registre a data formal.
        daysSinceReview = (asset.review_frequency_months ?? 6) * 30 + 1;
      }

      const maxAllowedDays = (asset.review_frequency_months ?? 6) * 30;

      // GATILHO 1A: Revisão Periódica Vencida
      if (daysSinceReview > maxAllowedDays) {
        overdueAssets.push(asset);
        insights.push({
          id: `gov-overdue-${asset.id}`,
          kind: "review_overdue",
          severity: "warning",
          title: `Revisão pendente: ${asset.ticker}`,
          description: `A tese e nota de ${asset.ticker} não são revisadas há ${daysSinceReview} dias (limite: ${maxAllowedDays} dias).`,
          assetId: asset.id,
          ticker: asset.ticker,
          tickers: [asset.ticker],
          assetIds: [asset.id],
          assetClass: asset.assetClass,
          daysSinceReview,
          score,
          actionLabel: "Revisar tese",
        });
      } else {
        // GATILHO 1B: Revisão Próxima do Vencimento (<= 30 dias restantes)
        const daysUntilReview = maxAllowedDays - daysSinceReview;
        if (daysUntilReview >= 0 && daysUntilReview <= UPCOMING_REVIEW_WINDOW_DAYS) {
          upcomingAssets.push({ asset, daysUntilReview });
          insights.push({
            id: `gov-upcoming-${asset.id}`,
            kind: "review_upcoming",
            severity: "info",
            title: `Reavaliação próxima: ${asset.ticker}`,
            description:
              daysUntilReview === 0
                ? `A revisão da nota de ${asset.ticker} vence hoje.`
                : `A revisão da nota de ${asset.ticker} vence em ${daysUntilReview} ${daysUntilReview === 1 ? "dia" : "dias"}.`,
            assetId: asset.id,
            ticker: asset.ticker,
            tickers: [asset.ticker],
            assetIds: [asset.id],
            assetClass: asset.assetClass,
            daysSinceReview,
            daysUntilReview,
            score,
            actionLabel: "Antecipar revisão",
          });
        }
      }
    }

    // GATILHO 2: Acompanhamento de Quarentena (> 90 dias)
    if (status === "quarantine") {
      let daysInQuarantine = 0;
      if (asset.last_reviewed_at) {
        const reviewedTime = new Date(asset.last_reviewed_at).getTime();
        if (!Number.isNaN(reviewedTime)) {
          daysInQuarantine = Math.max(0, Math.floor((nowTime - reviewedTime) / (1000 * 60 * 60 * 24)));
        }
      }
      if (daysInQuarantine >= 90) {
        insights.push({
          id: `gov-quarantine-${asset.id}`,
          kind: "quarantine_followup",
          severity: "warning",
          title: `Quarentena prolongada: ${asset.ticker}`,
          description: `${asset.ticker} está em quarentena há ${daysInQuarantine} dias. Reavalie se os fundamentos melhoraram ou se é momento de desinvestir.`,
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          daysInQuarantine,
          score,
          actionLabel: "Avaliar quarentena",
        });
      }
    }

    // GATILHO 3: Oportunidade com Margem de Segurança (Nota ≥ 8 e Preço ≤ Preço Teto - 15%)
    if (status === "active" && (score ?? 5) >= 8) {
      if (asset.ceilingPrice != null && asset.ceilingPrice > 0 && asset.currentPrice > 0 && asset.currentPrice < asset.ceilingPrice) {
        const discountPct = Math.round(((asset.ceilingPrice - asset.currentPrice) / asset.ceilingPrice) * 100);
        if (discountPct >= 15) {
          insights.push({
            id: `gov-discount-${asset.id}`,
            kind: "discount_opportunity",
            severity: "positive",
            title: `Oportunidade em ${asset.ticker} (-${discountPct}%)`,
            description: `Ativo com Nota ${score}/10 está cotado com ${discountPct}% de margem de segurança frente ao Preço Teto.`,
            assetId: asset.id,
            ticker: asset.ticker,
            assetClass: asset.assetClass,
            discountPct,
            score,
            actionLabel: "Ver no aporte",
          });
        }
      }
    }

    // GATILHO 4: Risco de Hiperconcentração em Ativo de Baixa Convicção (Nota ≤ 4 e Alocação > 5%)
    if (totalPortfolioBRL > 0 && score != null && score <= 4 && status !== "exit") {
      const allocationPct = Math.round(((asset.currentValueBRL / totalPortfolioBRL) * 100) * 10) / 10;
      if (allocationPct > 5.0) {
        const formattedPct = allocationPct.toFixed(1).replace(".", ",");
        insights.push({
          id: `gov-lowscore-${asset.id}`,
          kind: "low_score_overweight",
          severity: "critical",
          title: `Alerta de risco: ${asset.ticker} (${formattedPct}%)`,
          description: `${asset.ticker} possui Nota baixa (${score}/10) mas representa ${formattedPct}% do patrimônio. Considere reduzir a exposição.`,
          assetId: asset.id,
          ticker: asset.ticker,
          assetClass: asset.assetClass,
          allocationPct,
          score,
          actionLabel: "Ver detalhes",
        });
      }
    }
  }

  const overdueCount = overdueAssets.length;
  const upcomingReviewCount = upcomingAssets.length;
  const unscoredCount = unscoredAssets.length;
  const quarantineCount = insights.filter((i) => i.kind === "quarantine_followup").length;
  const opportunityCount = insights.filter((i) => i.kind === "discount_opportunity").length;
  const lowScoreRiskCount = insights.filter((i) => i.kind === "low_score_overweight").length;

  // Consolidação anti-fadiga para o carrossel (Salvaguarda S6)
  let consolidatedReviewAlert: GovernanceInsight | null = null;
  if (overdueCount > 1) {
    const tickers = overdueAssets.map((a) => a.ticker);
    const assetIds = overdueAssets.map((a) => a.id);
    consolidatedReviewAlert = {
      id: "gov-consolidated-overdue",
      kind: "review_overdue",
      severity: "warning",
      title: `${overdueCount} ativos com revisão pendente`,
      description: `Prazo expirado em ${formatTickerListSummary(tickers)}. Reavalie as notas para calibrar os aportes.`,
      tickers,
      assetIds,
      daysSinceReview: Math.max(...overdueAssets.map((a) => (a.last_reviewed_at ? Math.floor((nowTime - new Date(a.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)) : 180))),
      actionLabel: "Reavaliar agora",
    };
  } else if (overdueCount === 1) {
    consolidatedReviewAlert = insights.find((i) => i.kind === "review_overdue") ?? null;
  }

  let consolidatedUpcomingAlert: GovernanceInsight | null = null;
  if (upcomingReviewCount > 0) {
    const sortedUpcoming = [...upcomingAssets].sort((a, b) => a.daysUntilReview - b.daysUntilReview);
    const tickers = sortedUpcoming.map((item) => item.asset.ticker);
    const assetIds = sortedUpcoming.map((item) => item.asset.id);
    const minDays = sortedUpcoming[0]!.daysUntilReview;
    if (upcomingReviewCount === 1) {
      consolidatedUpcomingAlert = insights.find((i) => i.kind === "review_upcoming") ?? null;
    } else {
      consolidatedUpcomingAlert = {
        id: "gov-consolidated-upcoming",
        kind: "review_upcoming",
        severity: "info",
        title: `${upcomingReviewCount} revisões próximas do prazo`,
        description:
          minDays === 0
            ? `${formatTickerListSummary(tickers)} vencem hoje.`
            : `${formatTickerListSummary(tickers)} vencem em até ${minDays} ${minDays === 1 ? "dia" : "dias"}.`,
        tickers,
        assetIds,
        daysUntilReview: minDays,
        actionLabel: "Antecipar revisão",
      };
    }
  }

  let consolidatedUnscoredAlert: GovernanceInsight | null = null;
  if (unscoredCount > 1) {
    const tickers = unscoredAssets.map((a) => a.ticker);
    const assetIds = unscoredAssets.map((a) => a.id);
    consolidatedUnscoredAlert = {
      id: "gov-consolidated-unscored",
      kind: "unscored_asset",
      severity: "info",
      title: `${unscoredCount} ativos sem nota definida`,
      description: `Avalie ${formatTickerListSummary(tickers)} para incluí-los no motor de rebalanceamento.`,
      tickers,
      assetIds,
      actionLabel: "Avaliar agora",
    };
  } else if (unscoredCount === 1) {
    consolidatedUnscoredAlert = insights.find((i) => i.kind === "unscored_asset") ?? null;
  }

  return {
    insights,
    summary: {
      overdueCount,
      upcomingReviewCount,
      unscoredCount,
      quarantineCount,
      opportunityCount,
      lowScoreRiskCount,
      totalInsights: insights.length,
    },
    consolidatedReviewAlert,
    consolidatedUpcomingAlert,
    consolidatedUnscoredAlert,
  };
}

/**
 * Determina de forma pura e determinística se a revisão de tese de um ativo está vencida.
 * - Se tem nota mas não possui last_reviewed_at, considera vencido (para incentivar registro formal);
 * - Se decorreram mais dias que a periodicidade configurada (reviewFrequencyMonths * 30), está vencida.
 */
export function isAssetReviewOverdue(
  lastReviewedAt?: string | null,
  reviewFrequencyMonths: number = 6,
  nowTime: number = Date.now(),
): boolean {
  if (!lastReviewedAt || lastReviewedAt.trim() === "") {
    return true;
  }
  const reviewedTime = new Date(lastReviewedAt).getTime();
  if (Number.isNaN(reviewedTime)) {
    return true;
  }
  const daysSince = Math.max(0, Math.floor((nowTime - reviewedTime) / (1000 * 60 * 60 * 24)));
  return daysSince > (reviewFrequencyMonths || 6) * 30;
}

