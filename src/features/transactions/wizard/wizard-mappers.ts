import { todayISO } from "@/domain/debts";
import {
  inferCategoryKeyword,
  matchCategoryBySlug,
  parseClipboardTransactionCandidate,
  type CanonicalCategorySlug,
  type ParsedBankTransaction,
} from "@/domain/notifications";
import type { ResolvedReceiptResult } from "@/services/receipt-resolution";
import type { Category, CreditCard } from "@/types";
import type { EntryType, LaunchState } from "./wizard-types";

export function buildClipboardCandidateTransaction(
  candidate: NonNullable<ReturnType<typeof parseClipboardTransactionCandidate>>,
  rawText: string,
): ParsedBankTransaction {
  const hasCounterparty = Boolean(candidate.recipientName || candidate.merchant);
  const amountConfidence = candidate.valueCents > 0 ? "high" : "low";
  const counterpartyConfidence = hasCounterparty
    ? "high"
    : candidate.kind === "PIX_KEY"
      ? "medium"
      : "low";
  const overallConfidence =
    candidate.kind === "PIX_BRCODE" && candidate.valueCents > 0
      ? "high"
      : candidate.kind === "PIX_KEY"
        ? "medium"
        : candidate.confidence;

  return {
    id: `pix_clip_${Date.now()}`,
    bankName: "Pix",
    nature: candidate.nature,
    type: candidate.nature,
    amountCents: candidate.valueCents,
    description: candidate.description,
    merchant: candidate.merchant,
    recipientName: candidate.recipientName,
    pixKey: candidate.pixKey,
    taxId: candidate.taxId,
    date: candidate.date || todayISO(),
    paymentMethod:
      candidate.paymentMethod === "debit_card"
        ? "debit"
        : candidate.paymentMethod === "boleto"
          ? "other"
          : candidate.paymentMethod,
    timestamp: Date.now(),
    rawText,
    confidence: overallConfidence,
    fieldConfidence: {
      amount: amountConfidence,
      counterparty: counterpartyConfidence,
      nature: "high",
      date: candidate.date ? "high" : "low",
    },
    extractionSource: "local_deterministic",
  };
}

export function applyResolvedReceiptToLaunchState(
  prev: LaunchState,
  resolved: ResolvedReceiptResult,
  categories: Category[] | undefined,
  cards: CreditCard[] | undefined,
): LaunchState {
  const { parsed: enriched, identity, matchedCard, installmentCount } = resolved;
  const nature: EntryType = enriched.nature === "income" ? "income" : "expense";
  const next: LaunchState = {
    ...prev,
    type: nature,
    valueCents: enriched.amountCents,
    date: enriched.date || prev.date,
    description: identity.friendlyName || enriched.description,
    paymentMethod: enriched.paymentMethod ?? prev.paymentMethod,
  };

  if (installmentCount && installmentCount > 1) {
    next.installments = installmentCount;
    if (nature === "expense") next.paymentMethod = "credit_card";
  }
  if (matchedCard) {
    next.cardId = matchedCard.id;
    if (nature === "expense") next.paymentMethod = "credit_card";
  } else if (enriched.cardId && cards?.some((c) => c.id === enriched.cardId)) {
    next.cardId = enriched.cardId;
    if (nature === "expense") next.paymentMethod = "credit_card";
  }

  if (categories?.length) {
    const slug = identity.categorySlug || enriched.categorySlug;
    let matched = slug ? matchCategoryBySlug(categories, slug as CanonicalCategorySlug) : undefined;
    if (!matched && slug) {
      matched = categories.find(
        (c) =>
          c.name.toLowerCase().includes(slug.toLowerCase()) ||
          slug.toLowerCase().includes(c.name.toLowerCase()),
      );
    }
    if (!matched) {
      const inferred = inferCategoryKeyword(next.description);
      if (inferred) matched = matchCategoryBySlug(categories, inferred);
    }
    if (matched) next.categoryId = matched.id;
  }

  return next;
}
