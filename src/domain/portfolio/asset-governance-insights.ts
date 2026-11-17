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
  assetClass?: string | null;
  daysSinceReview?: number;
  daysInQuarantine?: number;
  discountPct?: number;
  allocationPct?: number;
  score?: number | null;
  actionLabel?: string;
}

export interface ConsolidatedGovernanceSummary {
  overdueCount: number;
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

  for (const asset of assets) {
    const status = asset.allocation_status ?? "active";
    const score = asset.score;

    // 1. Cálculo de tempo desde a última revisão
    let daysSinceReview = 0;
    if (asset.last_reviewed_at) {
      const reviewedTime = new Date(asset.last_reviewed_at).getTime();
      if (!Number.isNaN(reviewedTime)) {
        daysSinceReview = Math.max(0, Math.floor((nowTime - reviewedTime) / (1000 * 60 * 60 * 24)));
      }
    } else {
      // Se nunca foi revisado formalmente, assume 181 dias para disparar avaliação inicial
      daysSinceReview = 181;
    }

    const maxAllowedDays = (asset.review_frequency_months ?? 6) * 30;

    // GATILHO 1: Revisão Periódica Vencida
    if (daysSinceReview > maxAllowedDays && status !== "exit") {
      overdueAssets.push(asset);
      insights.push({
        id: `gov-overdue-${asset.id}`,
        kind: "review_overdue",
        severity: "warning",
        title: `Revisão pendente: ${asset.ticker}`,
        description: `A tese e nota de ${asset.ticker} não são revisadas há ${daysSinceReview} dias (limite: ${maxAllowedDays} dias).`,
        assetId: asset.id,
        ticker: asset.ticker,
        assetClass: asset.assetClass,
        daysSinceReview,
        score,
        actionLabel: "Revisar tese",
      });
    }

    // GATILHO 2: Acompanhamento de Quarentena (> 90 dias)
    if (status === "quarantine") {
      const daysInQuarantine = daysSinceReview; // Usando last_reviewed_at como marco da quarentena
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

    // GATILHO 3: Oportunidade com Desconto (Nota ≥ 8 e Preço ≤ PM - 20%)
    if (status === "active" && (score ?? 5) >= 8) {
      if (asset.averageCost > 0 && asset.currentPrice > 0 && asset.currentPrice < asset.averageCost) {
        const discountPct = Math.round(((asset.averageCost - asset.currentPrice) / asset.averageCost) * 100);
        if (discountPct >= 20) {
          insights.push({
            id: `gov-discount-${asset.id}`,
            kind: "discount_opportunity",
            severity: "positive",
            title: `Oportunidade em ${asset.ticker} (-${discountPct}%)`,
            description: `Ativo com Nota ${score}/10 está cotado com ${discountPct}% de desconto em relação ao seu Preço Médio.`,
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
  const quarantineCount = insights.filter((i) => i.kind === "quarantine_followup").length;
  const opportunityCount = insights.filter((i) => i.kind === "discount_opportunity").length;
  const lowScoreRiskCount = insights.filter((i) => i.kind === "low_score_overweight").length;

  // Consolidação anti-fadiga para o carrossel (Salvaguarda S6)
  let consolidatedReviewAlert: GovernanceInsight | null = null;
  if (overdueCount > 1) {
    consolidatedReviewAlert = {
      id: "gov-consolidated-overdue",
      kind: "review_overdue",
      severity: "warning",
      title: `${overdueCount} ativos com revisão pendente`,
      description: "Reavalie suas teses e notas para manter as recomendações de aporte calibradas com seus fundamentos.",
      daysSinceReview: Math.max(...overdueAssets.map((a) => (a.last_reviewed_at ? Math.floor((nowTime - new Date(a.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)) : 180))),
      actionLabel: "Revisar carteira",
    };
  } else if (overdueCount === 1) {
    consolidatedReviewAlert = insights.find((i) => i.kind === "review_overdue") ?? null;
  }

  return {
    insights,
    summary: {
      overdueCount,
      quarantineCount,
      opportunityCount,
      lowScoreRiskCount,
      totalInsights: insights.length,
    },
    consolidatedReviewAlert,
  };
}
