import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  extractLastFourDigits,
  inferCategoryKeyword,
  matchCategoryBySlug,
  parseClipboardTransactionCandidate,
  resolveBestMatchingCard,
  type CanonicalCategorySlug,
  type ParsedBankTransaction,
  type UniversalReceiptData,
} from "@/domain/notifications";
import { readClipboardText } from "@/services/clipboard";
import {
  useBankCardMapping,
  useCardDigitsMapping,
  useMerchantLearning,
} from "@/services/merchant-learning";
import { getBankAssistantPreferences } from "@/services/native";
import {
  resolveAndScanReceiptFile,
  resolveReceiptTransaction,
  type ScanReceiptFileResult,
} from "@/services/receipt-resolution";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import type { Category, CreditCard } from "@/types";
import { applyResolvedReceiptToLaunchState, buildClipboardCandidateTransaction } from "./wizard-mappers";
import type { LaunchState, ReceiptMeta, WizardMode } from "./wizard-types";

export interface UseReceiptAutofillParams {
  state: LaunchState;
  setState: Dispatch<SetStateAction<LaunchState>>;
  setMode: Dispatch<SetStateAction<WizardMode>>;
  setIsCategoryUnconfirmed: Dispatch<SetStateAction<boolean>>;
  setReceiptMeta: Dispatch<SetStateAction<ReceiptMeta | null>>;
  categories: Category[] | undefined;
  cards: CreditCard[] | undefined;
  initialValues?: Partial<LaunchState>;
  detectedPix: { candidate: ReturnType<typeof parseClipboardTransactionCandidate>; rawText: string } | null;
  clearDetectedPix: () => void;
  onOpenAttachDialog: () => void;
}

export function useReceiptAutofill({
  state,
  setState,
  setMode,
  setIsCategoryUnconfirmed,
  setReceiptMeta,
  categories,
  cards,
  initialValues,
  detectedPix,
  clearDetectedPix,
  onOpenAttachDialog,
}: UseReceiptAutofillParams) {
  const merchantLearning = useMerchantLearning();
  const cardDigits = useCardDigitsMapping();
  const bankCard = useBankCardMapping();

  useEffect(() => {
    if (!categories?.length || categories.some((c) => c.id === state.categoryId)) return;

    const target = initialValues?.categoryId || state.categoryId;
    let matchedCategory = target
      ? categories.find((c) => c.id === target) || matchCategoryBySlug(categories, target as CanonicalCategorySlug)
      : undefined;

    if (!matchedCategory && state.description) {
      const prefs = getBankAssistantPreferences();
      if (prefs.autoCategoryInferenceEnabled) {
        const slug = inferCategoryKeyword(state.description);
        if (slug) matchedCategory = matchCategoryBySlug(categories, slug);
      }
    }

    if (matchedCategory) {
      const targetCategoryId = matchedCategory.id;
      const timer = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          categoryId: targetCategoryId,
          step: prev.valueCents > 0 && prev.step <= 2 ? 3 : prev.step,
        }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [categories, initialValues?.categoryId, state.categoryId, state.description, setState]);

  useEffect(() => {
    if (state.type !== "expense" || state.paymentMethod !== "credit_card") return;
    if (!cards?.length || cards.some((c) => c.id === state.cardId)) return;

    const rawToken = initialValues?.cardId || state.cardId;
    const resolvedCard = resolveBestMatchingCard(cards, {
      cardId: rawToken,
      cardLastDigits: extractLastFourDigits(rawToken),
      bankName: rawToken,
      issuerBank: rawToken,
    });

    if (resolvedCard) {
      const targetCardId = resolvedCard.id;
      const timer = setTimeout(() => setState((prev) => ({ ...prev, cardId: targetCardId })), 0);
      return () => clearTimeout(timer);
    }
  }, [state.type, state.paymentMethod, state.cardId, initialValues?.cardId, cards, setState]);

  const handleReceiptParsed = useCallback(
    (parsed: ParsedBankTransaction | UniversalReceiptData, options?: { silentFeedback?: boolean }) => {
      setMode("quick");
      const resolved = resolveReceiptTransaction(parsed, {
        cards,
        userMemory: merchantLearning.memory,
        cardDigitsMapping: cardDigits.cardDigitsMapping,
        bankCardMapping: bankCard.bankCardMapping,
      });

      const { parsed: enriched, identity, kindLabel } = resolved;
      const packageName = "packageName" in parsed && typeof parsed.packageName === "string" ? parsed.packageName : undefined;
      setReceiptMeta({
        merchant: identity.friendlyName || enriched.description,
        cardLastDigits: enriched.cardLastDigits,
        taxId: enriched.taxId || identity.taxId,
        packageName,
        pixKey: ("pixKey" in enriched ? enriched.pixKey : undefined) || identity.pixKey,
      });

      setState((prev) => applyResolvedReceiptToLaunchState(prev, resolved, categories, cards));
      setIsCategoryUnconfirmed(!identity.isLearned);

      if (!options?.silentFeedback) {
        triggerSensory("success");
        pushToast({
          title: `${kindLabel} reconhecido`,
          description: `${identity.friendlyName || enriched.description} preenchido no Wizard Rápido para conferência.`,
          variant: "success",
        });
      }
    },
    [bankCard.bankCardMapping, cardDigits.cardDigitsMapping, cards, categories, merchantLearning.memory, setIsCategoryUnconfirmed, setMode, setReceiptMeta, setState],
  );

  const scanReceiptFile = useCallback(
    async (file: File): Promise<ScanReceiptFileResult> => {
      const result = await resolveAndScanReceiptFile(file, {
        cards,
        isManualAttachment: true,
        userMemory: merchantLearning.memory,
        cardDigitsMapping: cardDigits.cardDigitsMapping,
        bankCardMapping: bankCard.bankCardMapping,
      });
      if (result.ok && result.parsed) handleReceiptParsed(result.parsed);
      return result;
    },
    [bankCard.bankCardMapping, cardDigits.cardDigitsMapping, cards, handleReceiptParsed, merchantLearning.memory],
  );

  const handlePastePixFromClipboard = useCallback(async () => {
    try {
      if (detectedPix?.candidate && detectedPix.candidate.valueCents > 0) {
        handleReceiptParsed(buildClipboardCandidateTransaction(detectedPix.candidate, detectedPix.rawText));
        clearDetectedPix();
        return;
      }
      const clipResult = await readClipboardText();
      if (clipResult.status === "success" && clipResult.text) {
        const text = clipResult.text.trim();
        const candidate = parseClipboardTransactionCandidate(text);
        if (candidate && candidate.valueCents > 0) {
          handleReceiptParsed(buildClipboardCandidateTransaction(candidate, text));
          clearDetectedPix();
          return;
        }
      }
      onOpenAttachDialog();
    } catch {
      onOpenAttachDialog();
    }
  }, [clearDetectedPix, detectedPix, handleReceiptParsed, onOpenAttachDialog]);

  return { handleReceiptParsed, scanReceiptFile, handlePastePixFromClipboard };
}
