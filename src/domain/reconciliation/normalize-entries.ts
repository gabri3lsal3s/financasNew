import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  classifyTransactionNature,
  cleanDescription,
  isInvoicePayment,
  isPaymentOrSettlement,
  isStatementNoiseOrSummary,
  isSubcardHeader,
} from "./clean";
import { extractInstallmentInfo } from "./installments";
import { generateStatementHash } from "./hash";
import {
  alignInstallmentDateToCompetence,
  resolveDateForStatementCycle,
} from "./extractors/type-sniffer";
import type {
  RawEntrySignHint,
  RawExtractedEntry,
  StatementTransaction,
} from "./contracts";

export interface NormalizeRawEntriesParams {
  cardId: string;
  competenceMonth: string;
  closingDay?: number | null;
  defaultSignHint?: RawEntrySignHint;
}

const OBVIOUS_REFUND_HINT_REGEX =
  /\b(?:estorno|estornad[oa]|devolu[çc][aã]o|reembolso|cashback|cancelamento)\b/i;

/**
 * Isola apenas o nome comercial do estabelecimento sem valores ou datas,
 * garantindo que `merchantLearning` jamais receba ruído contábil (G14).
 */
export function sanitizeMerchantRawForLearning(merchantRaw: string): string {
  if (!merchantRaw) return "";
  return merchantRaw
    .replace(/(?:R\$|US\$|BRL|USD)\s*-?\d+(?:[.,]\d{2,3})*/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Infere polaridade global para um lote com `signHint === "auto"`:
 * se compras regulares vierem predominantemente negativas e quitações não contradisserem,
 * converte para convenção `negative_purchase` (compatível com PDFs digitais e CSVs invertidos).
 */
function inferNegativePurchasePolarity(
  entries: readonly RawExtractedEntry[],
  defaultSignHint: RawEntrySignHint,
): boolean {
  if (defaultSignHint === "negative_purchase") return true;
  if (defaultSignHint === "positive_purchase") return false;

  let negRegular = 0;
  let posRegular = 0;
  let posPayment = 0;
  let negPayment = 0;

  for (const entry of entries) {
    if (
      entry.explicitEntryType ||
      entry.isCreditSuffix ||
      entry.isDebitSuffix ||
      entry.signHint === "negative_purchase" ||
      entry.signHint === "positive_purchase"
    ) {
      continue;
    }

    const desc = entry.merchantRaw.trim();
    if (!desc || isStatementNoiseOrSummary(desc) || isSubcardHeader(desc)) {
      continue;
    }

    if (isInvoicePayment(desc, false)) {
      if (entry.isNegative) negPayment++;
      else posPayment++;
      continue;
    }

    if (OBVIOUS_REFUND_HINT_REGEX.test(desc)) {
      continue;
    }

    if (entry.isNegative) negRegular++;
    else posRegular++;
  }

  const totalAmbiguous = negRegular + posRegular;
  if (totalAmbiguous === 0) return false;

  if (negRegular > posRegular && posPayment >= negPayment) {
    // Se houver 2+ negativas (ou 1 negativa acompanhada de pagamento positivo confirmando polaridade)
    return negRegular / totalAmbiguous >= 0.6 || posPayment > 0;
  }

  return false;
}

/**
 * Normalizador Canônico Único (Estágio 1):
 * Transforma `RawExtractedEntry[]` de qualquer origem em `StatementTransaction[]`
 * aplicando integralmente as Guardas G1–G5 e a Regra D13.
 */
export function normalizeRawEntries(
  entries: readonly RawExtractedEntry[],
  params: NormalizeRawEntriesParams,
): StatementTransaction[] {
  const { cardId, competenceMonth, closingDay, defaultSignHint = "auto" } = params;
  const globalNegativeMeansPurchase = inferNegativePurchasePolarity(entries, defaultSignHint);

  const transactions: StatementTransaction[] = [];
  const occurrenceCounter = new Map<string, number>();
  let index = 0;

  for (const entry of entries) {
    const descTrimmed = entry.merchantRaw.trim();
    if (!descTrimmed || entry.amountCents <= 0) {
      continue;
    }

    if (isSubcardHeader(descTrimmed) || isStatementNoiseOrSummary(descTrimmed)) {
      continue;
    }

    const dateIso = resolveDateForStatementCycle(entry.rawDate, {
      competenceMonth,
      closingDay,
      dateFormatHint: entry.dateFormatHint,
    });
    if (!dateIso) {
      continue;
    }

    let isCredit: boolean;
    let isPayment = false;
    let forcedRefund = false;

    if (entry.explicitEntryType === "payment") {
      isCredit = true;
      isPayment = true;
    } else if (entry.explicitEntryType === "refund") {
      isCredit = true;
      forcedRefund = true;
    } else if (
      entry.explicitEntryType === "purchase" ||
      entry.explicitEntryType === "charge"
    ) {
      isCredit = false;
    } else if (entry.isCreditSuffix) {
      isCredit = true;
    } else if (entry.isDebitSuffix) {
      isCredit = false;
    } else {
      const effectiveSignHint =
        entry.signHint && entry.signHint !== "auto"
          ? entry.signHint
          : defaultSignHint !== "auto"
            ? defaultSignHint
            : globalNegativeMeansPurchase
              ? "negative_purchase"
              : "positive_purchase";

      isCredit =
        effectiveSignHint === "negative_purchase"
          ? !entry.isNegative
          : entry.isNegative;
    }

    if (!entry.explicitEntryType) {
      isPayment = isPaymentOrSettlement(descTrimmed, isCredit);
    }
    const isRefund = forcedRefund || (isCredit && !isPayment);

    const cleanDesc = cleanDescription(descTrimmed) || descTrimmed;
    const merchantCleanRaw = sanitizeMerchantRawForLearning(cleanDesc) || cleanDesc;

    const explicitInst =
      entry.explicitInstallment &&
      entry.explicitInstallment.total > 1 &&
      entry.explicitInstallment.current >= 1
        ? entry.explicitInstallment
        : undefined;
    const installment = explicitInst ?? extractInstallmentInfo(descTrimmed, dateIso);

    // D13: parcelas K >= 2 alinham `effectiveDate` ao mês da competência da fatura
    const { effectiveDate, originalDate } = alignInstallmentDateToCompetence(
      dateIso,
      competenceMonth,
      installment,
    );

    const hashDate = originalDate || effectiveDate;
    const occKey = `${hashDate}|${entry.amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId,
      competenceMonth,
      date: hashDate,
      amountCents: entry.amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    const rawLineWithFx =
      entry.fxDetails && entry.fxDetails.length > 0
        ? `${entry.rawLine} | ${entry.fxDetails.join(" | ")}`
        : entry.rawLine;

    const inferredChargeKind =
      entry.explicitEntryType === "charge"
        ? (() => {
            const inferred = inferChargeKindFromDescription(entry.rawLine || descTrimmed);
            return inferred === "regular" ? "bank_fee" : inferred;
          })()
        : inferChargeKindFromDescription(entry.rawLine || descTrimmed);

    const nature = classifyTransactionNature({
      rawDescription: rawLineWithFx || descTrimmed,
      isCredit,
      isPayment,
      isRefund,
      hasChargeKind: inferredChargeKind != null && inferredChargeKind !== "regular",
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      sourceIndex: entry.sourceIndex,
      occurrenceIndex: occIndex,
      date: effectiveDate,
      originalDate,
      nature,
      rawDescription: rawLineWithFx,
      cleanDescription: cleanDesc,
      merchantCleanRaw,
      amountCents: entry.amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
      fitid: entry.fitid,
      inferredChargeKind,
    });
  }

  return transactions;
}
