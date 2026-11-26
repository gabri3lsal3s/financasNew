/**
 * Motor Puro de Consenso Progressivo de Proventos (S5 — §3 e §4.2).
 *
 * Regras invioláveis:
 * - Zero I/O, zero rede, zero segredo/hash do cliente;
 * - Aceites simples, automáticos, lotes sem edição, replay, Undo sem voto prévio,
 *   backup, mensal e N:1 valem 0;
 * - Um único voto (último sinal) por (votante, evento);
 * - Ancorado: >= 2 positivos distintos e S >= 16 décimos (1,6);
 * - Não ancorado: >= 3 positivos distintos e S >= 24 décimos (2,4);
 * - Empate entre duas variantes que atingem quórum suspende promoção.
 */

import { countMarketBusinessDays } from "./market-calendar";

export type ConsensusSignalKind = "dedup" | "edited" | "reverted";

export interface ConsensusSignalInput {
  votante: string;
  sinal: ConsensusSignalKind;
}

export interface ConsensusScoreResult {
  decimos: number;
  positivosDistintos: number;
  elegivel: boolean;
}

export interface ConsensusVariantCandidate {
  variantKey: string;
  sinais: readonly ConsensusSignalInput[];
}

export interface ConsensusEvaluationResult {
  action: "promote" | "shadow_quorum" | "suspend_tie" | "demote" | "keep";
  winnerVariantKey: string | null;
  scoreDecimos: number;
  positivesCount: number;
}

export interface IndependentEvidenceInput {
  kind: "accept" | "auto" | "batch_no_edit" | "replay" | "undo_no_prior_vote" | "backup" | "dedup" | "edited";
  entryOrigin?: "legacy" | "manual" | "engine" | "restore";
  sourceEventId?: string | null;
  isMonthly?: boolean;
  isNTo1?: boolean;
  hasConfirmedTerms?: boolean;
  hasServerPrecedence?: boolean;
  isAnchored?: boolean;
  hasKnownComAndRate?: boolean;
}

export interface ConsensusAnchorTerms {
  ticker: string;
  currency: "BRL" | "USD";
  comDate: string;
  grossRate: number;
}

const SIGNAL_WEIGHT_DECIMOS: Record<ConsensusSignalKind, number> = {
  dedup: 10,
  edited: 8,
  reverted: -15,
};

/**
 * Pontua sinais de uma variante em inteiros de décimos (§3 / §4.2.4),
 * contando estritamente o último sinal por votante distinto.
 */
export function pontuar(
  sinaisDaVariante: readonly ConsensusSignalInput[],
  ancorado: boolean,
): ConsensusScoreResult {
  const latestByVoter = new Map<string, ConsensusSignalKind>();
  for (const item of sinaisDaVariante) {
    const voter = item.votante.trim();
    if (!voter) continue;
    latestByVoter.set(voter, item.sinal);
  }

  let decimos = 0;
  let positivosDistintos = 0;

  for (const signal of latestByVoter.values()) {
    decimos += SIGNAL_WEIGHT_DECIMOS[signal];
    if (signal === "dedup" || signal === "edited") {
      positivosDistintos += 1;
    }
  }

  const elegivel = ancorado
    ? positivosDistintos >= 2 && decimos >= 16
    : positivosDistintos >= 3 && decimos >= 24;

  return { decimos, positivosDistintos, elegivel };
}

/**
 * Verifica se uma ação do usuário gera evidência independente elegível (§4.2.3).
 */
export function isIndependentEvidenceEligible(input: IndependentEvidenceInput): boolean {
  if (
    input.kind === "accept" ||
    input.kind === "auto" ||
    input.kind === "batch_no_edit" ||
    input.kind === "replay" ||
    input.kind === "undo_no_prior_vote" ||
    input.kind === "backup"
  ) {
    return false;
  }

  if (input.isMonthly || input.isNTo1) {
    return false;
  }

  if (input.kind === "dedup") {
    if (input.entryOrigin !== "manual" || Boolean(input.sourceEventId)) {
      return false;
    }
    if (!input.hasServerPrecedence) {
      return false;
    }
    return true;
  }

  if (input.kind === "edited") {
    if (!input.hasConfirmedTerms) return false;
    if (!input.isAnchored && !input.hasKnownComAndRate) return false;
    return true;
  }

  return false;
}

/**
 * Verifica compatibilidade de uma variante não ancorada com os termos fixos de âncora (§4.2.2):
 * COM ±1 pregão no mercado da moeda e taxa bruta dentro de ±1%.
 */
export function isVariantCompatibleWithAnchor(
  anchor: ConsensusAnchorTerms,
  candidate: ConsensusAnchorTerms,
): boolean {
  if (
    anchor.ticker.trim().toUpperCase() !== candidate.ticker.trim().toUpperCase() ||
    anchor.currency !== candidate.currency
  ) {
    return false;
  }
  if (!(anchor.grossRate > 0) || !(candidate.grossRate > 0)) {
    return false;
  }

  const market = anchor.currency === "USD" ? "US" : "BR";
  const aCom = anchor.comDate.slice(0, 10);
  const cCom = candidate.comDate.slice(0, 10);
  const comDiff =
    aCom <= cCom
      ? countMarketBusinessDays(aCom, cCom, market)
      : countMarketBusinessDays(cCom, aCom, market);
  if (comDiff > 1) return false;

  const rateDiffPct = Math.abs(candidate.grossRate - anchor.grossRate) / anchor.grossRate;
  return rateDiffPct <= 0.01 + 1e-9;
}

/**
 * Avalia variantes concorrentes de um evento e decide promoção, suspensão por empate ou rebaixamento (§4.2.5).
 */
export function evaluateConsensusVariants(
  variants: readonly ConsensusVariantCandidate[],
  ancorado: boolean,
  publicationEnabled: boolean,
  currentTrustTier: "official" | "community_verified" | "enriched_fallback" | "raw_fallback" = "raw_fallback",
): ConsensusEvaluationResult {
  if (currentTrustTier === "official") {
    return {
      action: "keep",
      winnerVariantKey: null,
      scoreDecimos: 0,
      positivesCount: 0,
    };
  }

  const passing: Array<{ variantKey: string; score: ConsensusScoreResult }> = [];
  for (const v of variants) {
    const score = pontuar(v.sinais, ancorado);
    if (score.elegivel) {
      passing.push({ variantKey: v.variantKey, score });
    }
  }

  if (passing.length > 1) {
    return {
      action: "suspend_tie",
      winnerVariantKey: null,
      scoreDecimos: 0,
      positivesCount: 0,
    };
  }

  if (passing.length === 1) {
    const winner = passing[0]!;
    return {
      action: publicationEnabled ? "promote" : "shadow_quorum",
      winnerVariantKey: winner.variantKey,
      scoreDecimos: winner.score.decimos,
      positivesCount: winner.score.positivosDistintos,
    };
  }

  if (currentTrustTier === "community_verified") {
    return {
      action: "demote",
      winnerVariantKey: null,
      scoreDecimos: 0,
      positivesCount: 0,
    };
  }

  return {
    action: "keep",
    winnerVariantKey: null,
    scoreDecimos: 0,
    positivesCount: 0,
  };
}
