import { todayISO } from "@/domain/debts";
import type { ColumnMapping, StatementTransaction } from "./contracts";

export type QualityGateFailureReason =
  | "zero_transactions"
  | "checksum_underflow"
  | "checksum_overflow"
  | "degraded_descriptions"
  | "merged_columns"
  | "synthetic_dates"
  | "outlier_amount"
  | "spatial_collapse"
  | "low_mapping_confidence";

export interface EvaluateQualityGateParams {
  transactions: readonly StatementTransaction[];
  /** Total oficial impresso da fatura ("Valor da fatura" / "Total da fatura"), em centavos. */
  officialTotalCents?: number | null;
  /** Total líquido do ciclo ("Despesas e créditos do mês"), em centavos. */
  cycleNetTargetCents?: number | null;
  /** Saldo da fatura anterior, em centavos (para Equação Contábil Dupla). */
  previousBalanceCents?: number | null;
  /** Pagamentos efetuados sobre a fatura anterior, em centavos. */
  paymentsCents?: number | null;
  /** Total de linhas espaciais extraídas no documento (PDF). */
  allLinesCount?: number;
  /** Linhas com valores monetários descartadas pelas barreiras espaciais. */
  discardedMoneyLines?: number;
  /** Confiança do mapeamento tabular (0-100), para CSV/XLSX. */
  mappingConfidence?: number;
  /** Mapeamento tabular inferido (checa colisão desc === date). */
  columnMapping?: ColumnMapping | null;
  /** Se true, trata-se de OFX estruturado (total/LEDGERBAL é apenas informativo). */
  isOfx?: boolean;
  /** Data de referência "hoje" injetável para testes determinísticos. */
  referenceTodayIso?: string;
}

export interface StatementQualityGateResult {
  score: number;
  passed: boolean;
  reasons: QualityGateFailureReason[];
  /** Soma líquida das transações do ciclo: compras + encargos - estornos (sem pagamentos de fatura). */
  cycleNetCents: number;
  /** Saldo contábil da fatura: carryOver + cycleNetCents. */
  statementBalanceCents: number;
  /** Alvo efetivo usado na checagem de checksum (cycleNetTarget ou officialTotal). */
  effectiveTargetCents: number | null;
  /** Diferença absoluta em centavos contra o alvo efetivo. */
  diffCents: number;
  /** Qual equação foi usada para o checksum. */
  checksumEquation: "cycle_net" | "statement_balance" | "none";
}

const DEGRADED_DESCRIPTION_REGEX =
  /^(?:transa[çc][aã]o|\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|[\d\s/.,+-]+)$|\b(?:cet\s*\(?m[eê]s|cet\s*\(?ano|taxa\s*\(?m[eê]s|taxa\s+ao\s+m[eê]s|juros\s+de\s+atraso|mora\s+de\s+atraso|pagamento\s+m[ií]nimo)\b/i;

const MERGED_COLUMNS_DESCRIPTION_REGEX =
  /(?:r\$\s*-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d{1,3}(?:\.\d{3})*,\d{2})\s+\d{1,2}(?:\s+(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)|[/.-]\d{1,2})\b/i;

const CHECKSUM_TOLERANCE_CENTS = 5;

/**
 * Avalia a qualidade contábil e estrutural de uma extração de fatura (Score 0–100)
 * com Equação Contábil Dupla e Checksum Bidirecional (falta e excesso).
 */
export function evaluateStatementExtractionQuality(
  params: EvaluateQualityGateParams,
): StatementQualityGateResult {
  const {
    transactions,
    officialTotalCents = null,
    cycleNetTargetCents = null,
    previousBalanceCents = null,
    paymentsCents = null,
    allLinesCount = 0,
    discardedMoneyLines = 0,
    mappingConfidence,
    columnMapping = null,
    isOfx = false,
    referenceTodayIso = todayISO(),
  } = params;

  const reasons: QualityGateFailureReason[] = [];
  let score = 100;

  // 1. Equação Contábil Dupla
  // cycleNetCents = compras + encargos - estornos (pagamentos da fatura anterior não entram)
  let cycleNetCents = 0;
  let maxSingleAmountCents = 0;
  for (const tx of transactions) {
    if (tx.isPayment || tx.nature === "invoice_payment") continue;
    if (tx.amountCents > maxSingleAmountCents) {
      maxSingleAmountCents = tx.amountCents;
    }
    if (tx.isRefund || tx.nature === "refund") {
      cycleNetCents -= tx.amountCents;
    } else {
      cycleNetCents += tx.amountCents;
    }
  }

  // Micro-trava: aplica (saldoAnterior - pagamentosFatura) somente quando saldoAnterior > 0
  // (preservando eventual crédito de pagamento a maior); usa 0 quando saldoAnterior === 0 ou ausente.
  const carryOverCents =
    previousBalanceCents !== null && previousBalanceCents > 0
      ? previousBalanceCents - (paymentsCents ?? 0)
      : 0;
  const statementBalanceCents = carryOverCents + cycleNetCents;

  // Define alvo prioritário: "Despesas e créditos do mês" (cycle_net) > "Valor da fatura" (statement_balance)
  let effectiveTargetCents: number | null = null;
  let comparedActualCents = cycleNetCents;
  let checksumEquation: "cycle_net" | "statement_balance" | "none" = "none";

  if (cycleNetTargetCents !== null && cycleNetTargetCents > 0) {
    effectiveTargetCents = cycleNetTargetCents;
    comparedActualCents = cycleNetCents;
    checksumEquation = "cycle_net";
  } else if (officialTotalCents !== null && officialTotalCents > 0) {
    effectiveTargetCents = officialTotalCents;
    comparedActualCents = statementBalanceCents;
    checksumEquation = "statement_balance";
  }

  const diffCents =
    effectiveTargetCents !== null ? Math.abs(comparedActualCents - effectiveTargetCents) : 0;

  // 2. Zero transações
  if (transactions.length === 0) {
    reasons.push("zero_transactions");
    if (allLinesCount > 15 && discardedMoneyLines >= 1) {
      reasons.push("spatial_collapse");
    }
    return {
      score: 0,
      passed: false,
      reasons,
      cycleNetCents,
      statementBalanceCents,
      effectiveTargetCents,
      diffCents,
      checksumEquation,
    };
  }

  // 3. Checksum Bidirecional (OFX tem <LEDGERBAL> apenas informativo, nunca reprova OFX estruturado)
  if (!isOfx && effectiveTargetCents !== null && effectiveTargetCents > 0 && diffCents > CHECKSUM_TOLERANCE_CENTS) {
    const ratio = comparedActualCents / effectiveTargetCents;
    if (comparedActualCents < effectiveTargetCents - CHECKSUM_TOLERANCE_CENTS) {
      reasons.push("checksum_underflow");
      score -= ratio < 0.55 ? 55 : 30;
    } else if (comparedActualCents > effectiveTargetCents + CHECKSUM_TOLERANCE_CENTS) {
      reasons.push("checksum_overflow");
      score -= ratio > 1.5 ? 65 : 35;
    }
  }

  // 4. Sanidade de descrições + detecção de colunas fundidas (ex.: "Loja R$ 112,39 29 Out OutraLoja")
  const mergedColumnsCount = transactions.filter((tx) =>
    MERGED_COLUMNS_DESCRIPTION_REGEX.test(tx.cleanDescription) ||
    MERGED_COLUMNS_DESCRIPTION_REGEX.test(tx.rawDescription),
  ).length;
  if (mergedColumnsCount > 0) {
    reasons.push("merged_columns");
    score -= 35;
  }

  const degradedCount = transactions.filter((tx) => {
    const desc = tx.cleanDescription.trim();
    return !desc || DEGRADED_DESCRIPTION_REGEX.test(desc);
  }).length;
  const degradedRatio = degradedCount / transactions.length;
  if (degradedRatio >= 0.15) {
    reasons.push("degraded_descriptions");
    score -= degradedRatio >= 0.5 ? 50 : 25;
  }

  // 5. Sanidade temporal (datas sintéticas todayISO)
  if (transactions.length >= 3) {
    const syntheticDateCount = transactions.filter((tx) => tx.date === referenceTodayIso).length;
    if (syntheticDateCount / transactions.length > 0.4) {
      reasons.push("synthetic_dates");
      score -= 35;
    }
  }

  // 6. Outlier monetário (ex.: CEP ou Nosso Número lido como reais)
  if (
    !isOfx &&
    effectiveTargetCents !== null &&
    effectiveTargetCents >= 5_000 &&
    maxSingleAmountCents > effectiveTargetCents * 3
  ) {
    reasons.push("outlier_amount");
    score -= 45;
  }

  // 7. Colapso espacial
  if (allLinesCount > 15 && transactions.length <= 2 && discardedMoneyLines >= 3) {
    reasons.push("spatial_collapse");
    score -= 40;
  }

  // 8. Baixa confiança tabular / colisão de colunas
  const hasColumnCollision =
    columnMapping !== null &&
    columnMapping !== undefined &&
    columnMapping.descriptionColIndex === columnMapping.dateColIndex;
  if (hasColumnCollision || (mappingConfidence !== undefined && mappingConfidence < 75)) {
    reasons.push("low_mapping_confidence");
    score -= hasColumnCollision ? 40 : 20;
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
  const hasCriticalFailure = reasons.some(
    (r) =>
      r === "checksum_overflow" ||
      r === "degraded_descriptions" ||
      r === "merged_columns" ||
      r === "synthetic_dates" ||
      r === "outlier_amount" ||
      r === "spatial_collapse",
  );

  return {
    score: clampedScore,
    passed: clampedScore >= 85 && !hasCriticalFailure,
    reasons,
    cycleNetCents,
    statementBalanceCents,
    effectiveTargetCents,
    diffCents,
    checksumEquation,
  };
}
