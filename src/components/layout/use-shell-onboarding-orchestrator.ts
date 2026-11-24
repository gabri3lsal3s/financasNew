import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  isAndroidNative,
  isAppLocked,
  isNativePlatform,
  subscribeAppLock,
} from "@/services/native";
import { shouldOfferAndroidApk } from "@/services/native/app-links";
import {
  hasSeenNativeOnboarding,
  hasSeenWelcomeModal,
  markNativeOnboardingSeen,
  useDemoSession,
} from "@/state/demo-mode";
import type { LaunchState } from "@/features/transactions/wizard/wizard-state";
import type { PaymentMethod } from "@/types";

export type ShellOnboardingStep = "welcome" | "welcome_feature" | "native_onboarding" | null;

const WELCOME_FEATURE_SEEN_KEY = "financas:welcome_feature_modal_seen";
const ACTIVE_DIALOG_SELECTOR =
  '[role="dialog"]:not([data-state="closed"]):not([data-lock-overlay])';

export const WIZARD_QUERY_KEYS = [
  "novo", "modo", "valor", "descricao", "data", "forma", "cartao", "categoria",
  "parcelas", "sug_id", "passo", "step", "racha", "split", "pessoas", "participantes", "familia", "escopo",
] as const;

export function isLaunchShortcutQuery(novoParam: string | null, modoParam: string | null): boolean {
  return (
    novoParam === "transacao" ||
    novoParam === "despesa" ||
    novoParam === "receita" ||
    novoParam === "expense" ||
    novoParam === "income" ||
    novoParam === "pix" ||
    modoParam === "rapido" ||
    modoParam === "quick"
  );
}

export function parseLaunchWizardInitialValues(
  searchKey: string,
  novoParam: string | null,
): Partial<LaunchState> | undefined {
  const params = new URLSearchParams(searchKey);
  const vals: Partial<LaunchState> = {};

  const valor = Number.parseInt(params.get("valor") ?? "", 10);
  if (Number.isFinite(valor) && valor > 0) vals.valueCents = valor;

  const desc = params.get("descricao");
  if (desc) vals.description = desc;

  const data = params.get("data");
  if (data) vals.date = data;

  const forma = (params.get("forma") as PaymentMethod) || (novoParam === "pix" ? "pix" : undefined);
  if (forma) vals.paymentMethod = forma;

  const cartao = params.get("cartao");
  if (cartao) {
    vals.cardId = cartao;
    vals.paymentMethod = "credit_card";
  }

  const categoria = params.get("categoria");
  if (categoria) vals.categoryId = categoria;

  const escopo = params.get("escopo");
  if (escopo === "business" || escopo === "personal") {
    vals.scope = escopo;
  }

  const parcelas = Number.parseInt(params.get("parcelas") ?? "", 10);
  if (Number.isFinite(parcelas) && parcelas >= 1 && parcelas <= 60) vals.installments = parcelas;

  const passo = Number.parseInt(params.get("passo") || params.get("step") || "", 10);
  if (Number.isFinite(passo) && passo >= 1 && passo <= 4) vals.step = passo;

  const racha = params.get("racha") || params.get("split");
  if (racha === "1" || racha === "true" || racha === "sim") vals.splitEnabled = true;

  const pessoas = Number.parseInt(params.get("pessoas") || params.get("participantes") || "", 10);
  if (Number.isFinite(pessoas) && pessoas >= 2 && pessoas <= 50) vals.splitPeopleCount = pessoas;

  const familia = params.get("familia");
  if (familia === "1" || familia === "true") vals.isFamily = true;

  return Object.keys(vals).length > 0 ? vals : undefined;
}

export interface OnboardingQueueInput {
  isAppLocked: boolean;
  isDemoActive: boolean;
  isWizardOpen: boolean;
  hasExternalDialogOpen: boolean;
  isAndroidEligible: boolean;
  isAndroidNativeRuntime: boolean;
  hasSeenWelcome: boolean;
  hasSeenWelcomeFeature: boolean;
  hasSeenNativeOnboarding: boolean;
  isVirginAccount?: boolean;
}

/**
 * Resolvedor puro de fila única de onboarding do shell.
 * Garante no máximo UM modal inicial ativo por vez e suprime Android/APK fora do Android (M10).
 */
export function resolveNextShellOnboardingStep(input: OnboardingQueueInput): ShellOnboardingStep {
  if (input.isAppLocked || input.isDemoActive || input.isWizardOpen || input.hasExternalDialogOpen) {
    return null;
  }
  if (input.isVirginAccount && !input.hasSeenWelcome) return "welcome";
  if (input.isAndroidEligible && !input.hasSeenWelcomeFeature) return "welcome_feature";
  if (input.isAndroidNativeRuntime && !input.hasSeenNativeOnboarding) return "native_onboarding";
  return null;
}

function readHasSeenWelcomeFeature(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return true;
  try {
    return window.localStorage.getItem(WELCOME_FEATURE_SEEN_KEY) === "true";
  } catch {
    return true;
  }
}

function detectActiveDialogInDom(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(ACTIVE_DIALOG_SELECTOR) !== null;
}

export interface UseShellOnboardingOrchestratorOptions {
  isWizardOpen: boolean;
  isVirginAccount?: boolean;
  /** Mantém os modais automáticos silenciados no shell (onboarding 100% inline na Home). */
  autoPrompt?: boolean;
}

export function useShellOnboardingOrchestrator({
  isWizardOpen,
  isVirginAccount = false,
  autoPrompt = false,
}: UseShellOnboardingOrchestratorOptions) {
  const locked = useSyncExternalStore(subscribeAppLock, isAppLocked);
  const { isDemoActive } = useDemoSession();
  const [hasExternalDialogOpen, setHasExternalDialogOpen] = useState(false);
  const [nativeDismissed, setNativeDismissed] = useState(() => hasSeenNativeOnboarding());
  const [nativeQueueActive, setNativeQueueActive] = useState(false);

  const isAndroidNativeRuntime = isNativePlatform() && isAndroidNative();
  const isAndroidEligible = shouldOfferAndroidApk();

  useEffect(() => {
    if (typeof document === "undefined" || !autoPrompt) return;

    const syncFromDom = () => {
      const seenNative = hasSeenNativeOnboarding();
      if (seenNative) {
        setNativeDismissed(true);
        setNativeQueueActive(false);
        return;
      }

      if (locked || isDemoActive || isWizardOpen) return;

      const externalOpen = detectActiveDialogInDom();
      setHasExternalDialogOpen(externalOpen);

      if (
        !externalOpen &&
        isAndroidNativeRuntime &&
        !nativeDismissed &&
        !(isVirginAccount && !hasSeenWelcomeModal())
      ) {
        setNativeQueueActive(true);
      }
    };

    const timer = window.setTimeout(syncFromDom, 0);
    const observer =
      typeof MutationObserver !== "undefined" ? new MutationObserver(syncFromDom) : null;
    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state", "role"],
    });

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [
    autoPrompt,
    isAndroidNativeRuntime,
    isDemoActive,
    isVirginAccount,
    isWizardOpen,
    locked,
    nativeDismissed,
  ]);

  const isNativeOnboardingOpen =
    autoPrompt && nativeQueueActive && !locked && !isDemoActive && !isWizardOpen && !nativeDismissed;

  const onNativeOnboardingOpenChange = useCallback((open: boolean) => {
    if (!open) {
      markNativeOnboardingSeen();
      setNativeDismissed(true);
      setNativeQueueActive(false);
    } else {
      setNativeQueueActive(true);
    }
  }, []);

  const nextStep = autoPrompt
    ? resolveNextShellOnboardingStep({
        isAppLocked: locked,
        isDemoActive,
        isWizardOpen,
        hasExternalDialogOpen: isNativeOnboardingOpen ? false : hasExternalDialogOpen,
        isAndroidEligible,
        isAndroidNativeRuntime,
        hasSeenWelcome: hasSeenWelcomeModal(),
        hasSeenWelcomeFeature: readHasSeenWelcomeFeature(),
        hasSeenNativeOnboarding: nativeDismissed || hasSeenNativeOnboarding(),
        isVirginAccount,
      })
    : null;

  return { nextStep, isNativeOnboardingOpen, onNativeOnboardingOpenChange };
}
