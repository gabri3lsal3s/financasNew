/**
 * Motor puro de classificação de motivos de aporte e auditoria de teses — §3.11.3 & F41.
 *
 * Determina:
 * 1. O motivo determinante pelo qual um ativo recebeu sugestão de aporte:
 *    • Defasagem de Classe (estabilização macro da carteira);
 *    • Defasagem de Setor (déficit meso prioritário na classe);
 *    • Destaque por Nota / Qualidade (mérito fundamentalista frente aos pares).
 * 2. Alerta Crítico (Qualidade vs. Alocação):
 *    • Detecta quando um ativo de baixa convicção (nota <= 4) é sugerido
 *      apenas por ser o único ou um dos poucos representantes de um setor/classe defasado.
 * 3. Auditoria temporal de revisão periódica de teses (vencida / próxima / em dia).
 *
 * 100% puro, sem dependências de UI/Supabase.
 */

export type AporteReasonKind = "class_deficit" | "sector_deficit" | "asset_conviction";

export interface AporteSuggestionReason {
  kind: AporteReasonKind;
  label: string;
  shortDescription: string;
  hasQualityConflict: boolean;
  qualityConflictDetail?: string;
}

export interface DeriveAporteReasonParams {
  ticker: string;
  rawScore?: number | null;
  assetClass?: string | null;
  sector?: string | null;
  classDeficitRel?: number;
  classGapBRL?: number;
  sectorDeficitRel?: number;
  sectorGapBRL?: number;
  weightInSector?: number;
  effectiveTargetPct?: number;
  /** Número de ativos elegíveis no mesmo grupo (setor ou classe) */
  groupEligibleCount?: number;
  /** Maior nota encontrada no setor/classe */
  maxScoreInGroup?: number | null;
}

/**
 * Classifica de forma determinística o motivo principal da sugestão de aporte
 * e diagnostica potenciais conflitos de alocação forçada em papéis de baixa qualidade.
 */
export function deriveAporteSuggestionReason(params: DeriveAporteReasonParams): AporteSuggestionReason {
  const {
    ticker,
    rawScore,
    assetClass,
    sector,
    classDeficitRel = 0,
    sectorDeficitRel = 0,
    sectorGapBRL = 0,
    weightInSector = 0,
    groupEligibleCount = 1,
    maxScoreInGroup = null,
  } = params;

  // 1. Diagnóstico de Conflito Crítico (Qualidade vs. Alocação)
  // Ativo com nota baixa (<= 4) que é puxado por haver poucas alternativas (<= 2) no grupo defasado
  const isLowScore = rawScore !== null && rawScore !== undefined && rawScore <= 4;
  const isSparseGroup = groupEligibleCount <= 2;
  const hasGroupDeficit = sectorDeficitRel > 0 || classDeficitRel > 0 || sectorGapBRL > 0;
  const hasQualityConflict = isLowScore && isSparseGroup && hasGroupDeficit;

  const qualityConflictDetail = hasQualityConflict
    ? `Nota de convicção baixa (${rawScore}/10). Sugerido devido à defasagem da classe/setor e poucas alternativas (${groupEligibleCount}) cadastradas.`
    : undefined;

  // 2. Classificação do Motivo Principal
  if (hasQualityConflict) {
    const isSectorDriver = sectorDeficitRel > 0 && Boolean(sector);
    return {
      kind: isSectorDriver ? "sector_deficit" : "class_deficit",
      label: isSectorDriver ? "Puxado por Setor" : "Puxado por Classe",
      shortDescription: isSectorDriver
        ? `Setor ${sector} defasado (poucas alternativas cadastradas)`
        : `Classe ${assetClass ?? "Ativo"} defasada (poucas alternativas cadastradas)`,
      hasQualityConflict: true,
      qualityConflictDetail,
    };
  }

  // Se o ativo tem boa nota (>= 7), peso relevante no setor e lidera a pontuação do grupo
  const isHighConviction = rawScore !== null && rawScore !== undefined && rawScore >= 7;
  const leadsGroup = maxScoreInGroup === null || (rawScore !== null && rawScore !== undefined && rawScore >= maxScoreInGroup);
  const isWeightedLeader = isHighConviction && leadsGroup && (weightInSector >= 0.35 || groupEligibleCount === 1);

  if (isWeightedLeader) {
    return {
      kind: "asset_conviction",
      label: "Destaque por Nota",
      shortDescription: `Nota ${rawScore}/10 destaca o ativo no setor`,
      hasQualityConflict: false,
    };
  }

  // Se o setor tem meta definida e déficit relativo considerável
  if (sector && sectorDeficitRel > 0.05) {
    return {
      kind: "sector_deficit",
      label: "Defasagem de Setor",
      shortDescription: `Setor ${sector} com déficit prioritário na classe`,
      hasQualityConflict: false,
    };
  }

  // Fallback canônico: Estabilização Macro de Classe
  return {
    kind: "class_deficit",
    label: "Defasagem de Classe",
    shortDescription: `Classe ${assetClass ?? ticker} com déficit na carteira`,
    hasQualityConflict: false,
  };
}

// ---------------------------------------------------------------------------
// Auditoria Temporal de Revisão de Teses (§F41)
// ---------------------------------------------------------------------------

export interface AssetReviewStatus {
  lastReviewedAt: string | null;
  reviewFrequencyMonths: number;
  nextReviewDate: Date | null;
  daysSinceReview: number;
  daysUntilReview: number | null;
  isOverdue: boolean;
  isUpcoming: boolean;
  status: "never_reviewed" | "overdue" | "upcoming" | "ok";
  badgeVariant: "warning" | "critical" | "muted" | "positive";
  statusLabel: string;
}

export function calculateAssetReviewStatus(params: {
  lastReviewedAt?: string | null;
  reviewFrequencyMonths?: number | null;
  referenceDate?: Date;
}): AssetReviewStatus {
  const { lastReviewedAt, reviewFrequencyMonths, referenceDate = new Date() } = params;
  const frequency = reviewFrequencyMonths && reviewFrequencyMonths > 0 ? reviewFrequencyMonths : 6;
  const now = referenceDate.getTime();

  if (!lastReviewedAt) {
    return {
      lastReviewedAt: null,
      reviewFrequencyMonths: frequency,
      nextReviewDate: null,
      daysSinceReview: 181,
      daysUntilReview: null,
      isOverdue: true,
      isUpcoming: false,
      status: "never_reviewed",
      badgeVariant: "warning",
      statusLabel: "Nunca avaliado formalmente",
    };
  }

  const reviewedDate = new Date(lastReviewedAt);
  if (Number.isNaN(reviewedDate.getTime())) {
    return {
      lastReviewedAt: null,
      reviewFrequencyMonths: frequency,
      nextReviewDate: null,
      daysSinceReview: 181,
      daysUntilReview: null,
      isOverdue: true,
      isUpcoming: false,
      status: "never_reviewed",
      badgeVariant: "warning",
      statusLabel: "Data de revisão inválida",
    };
  }

  const daysSinceReview = Math.max(0, Math.floor((now - reviewedDate.getTime()) / (1000 * 60 * 60 * 24)));
  const nextReviewDate = new Date(reviewedDate);
  nextReviewDate.setMonth(nextReviewDate.getMonth() + frequency);

  const daysUntilReview = Math.round((nextReviewDate.getTime() - now) / (1000 * 60 * 60 * 24));

  if (daysUntilReview < 0) {
    const overdueDays = Math.abs(daysUntilReview);
    return {
      lastReviewedAt,
      reviewFrequencyMonths: frequency,
      nextReviewDate,
      daysSinceReview,
      daysUntilReview,
      isOverdue: true,
      isUpcoming: false,
      status: "overdue",
      badgeVariant: "critical",
      statusLabel: `Revisão vencida há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`,
    };
  }

  if (daysUntilReview <= 30) {
    return {
      lastReviewedAt,
      reviewFrequencyMonths: frequency,
      nextReviewDate,
      daysSinceReview,
      daysUntilReview,
      isOverdue: false,
      isUpcoming: true,
      status: "upcoming",
      badgeVariant: "warning",
      statusLabel: `Vence em ${daysUntilReview} ${daysUntilReview === 1 ? "dia" : "dias"}`,
    };
  }

  return {
    lastReviewedAt,
    reviewFrequencyMonths: frequency,
    nextReviewDate,
    daysSinceReview,
    daysUntilReview,
    isOverdue: false,
    isUpcoming: false,
    status: "ok",
    badgeVariant: "positive",
    statusLabel: "Em dia",
  };
}
