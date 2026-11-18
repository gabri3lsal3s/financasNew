import type { TourTrackId } from "@/domain/demo-simulation";
import { getActiveUserId, getUserStorageKey } from "@/services/user-storage";

const LEGACY_KEYS = {
  COMPLETED_FINANCES: "financas:demo_completed_finances",
  COMPLETED_INVESTMENTS: "financas:demo_completed_investments",
  COMPLETED_ANY: "financas:demo_completed_any",
  WELCOME_SEEN: "financas:welcome_modal_seen",
  WELCOME_FEATURE_SEEN: "financas:welcome_feature_modal_seen",
  NATIVE_ONBOARDING_SEEN: "financas:demo_native_onboarding_seen",
  INITIAL_GOAL: "financas:initial_onboarding_goal",
} as const;

const SCOPED_NAMES = {
  COMPLETED_FINANCES: "demo_completed_finances",
  COMPLETED_INVESTMENTS: "demo_completed_investments",
  COMPLETED_ANY: "demo_completed_any",
  WELCOME_SEEN: "welcome_modal_seen",
  WELCOME_FEATURE_SEEN: "welcome_feature_modal_seen",
  NATIVE_ONBOARDING_SEEN: "demo_native_onboarding_seen",
  INITIAL_GOAL: "initial_onboarding_goal",
} as const;

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readScopedOrLegacy(scopedName: string, legacyKey: string): string | null {
  const scopedKey = getUserStorageKey(scopedName);
  const scopedVal = window.localStorage.getItem(scopedKey);
  if (scopedVal !== null) return scopedVal;
  if (!getActiveUserId()) {
    return window.localStorage.getItem(legacyKey);
  }
  return null;
}

function writeScoped(scopedName: string, value: string, legacyKey?: string): void {
  window.localStorage.setItem(getUserStorageKey(scopedName), value);
  if (!getActiveUserId() && legacyKey) {
    window.localStorage.setItem(legacyKey, value);
  }
}

/**
 * Verifica se o usuário já concluiu o tour de demonstração (com escopo por userId).
 */
export function hasCompletedDemoTour(track?: TourTrackId): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    if (track === "finances") {
      return (
        readScopedOrLegacy(SCOPED_NAMES.COMPLETED_FINANCES, LEGACY_KEYS.COMPLETED_FINANCES) === "true" ||
        readScopedOrLegacy("demo_completed_finances_overview", "financas:demo_completed_finances_overview") === "true"
      );
    }
    if (track === "investments") {
      return (
        readScopedOrLegacy(SCOPED_NAMES.COMPLETED_INVESTMENTS, LEGACY_KEYS.COMPLETED_INVESTMENTS) === "true" ||
        readScopedOrLegacy("demo_completed_investments_overview", "financas:demo_completed_investments_overview") === "true"
      );
    }
    if (track) {
      return (
        readScopedOrLegacy(`demo_completed_${track}`, `financas:demo_completed_${track}`) === "true" ||
        (track === "finances_overview" &&
          readScopedOrLegacy(SCOPED_NAMES.COMPLETED_FINANCES, LEGACY_KEYS.COMPLETED_FINANCES) === "true") ||
        (track === "investments_overview" &&
          readScopedOrLegacy(SCOPED_NAMES.COMPLETED_INVESTMENTS, LEGACY_KEYS.COMPLETED_INVESTMENTS) === "true")
      );
    }
    return (
      readScopedOrLegacy(SCOPED_NAMES.COMPLETED_ANY, LEGACY_KEYS.COMPLETED_ANY) === "true" ||
      readScopedOrLegacy(SCOPED_NAMES.COMPLETED_FINANCES, LEGACY_KEYS.COMPLETED_FINANCES) === "true" ||
      readScopedOrLegacy(SCOPED_NAMES.COMPLETED_INVESTMENTS, LEGACY_KEYS.COMPLETED_INVESTMENTS) === "true"
    );
  } catch {
    return false;
  }
}

/**
 * Marca uma trilha de tour (ou o tour geral) como concluída no localStorage (escopo por userId).
 */
export function markTourCompleted(track?: TourTrackId): void {
  if (!isLocalStorageAvailable()) return;
  try {
    writeScoped(SCOPED_NAMES.COMPLETED_ANY, "true", LEGACY_KEYS.COMPLETED_ANY);
    if (track) {
      writeScoped(`demo_completed_${track}`, "true", `financas:demo_completed_${track}`);
      if (track === "finances" || track === "finances_overview") {
        writeScoped(SCOPED_NAMES.COMPLETED_FINANCES, "true", LEGACY_KEYS.COMPLETED_FINANCES);
      }
      if (track === "investments" || track === "investments_overview") {
        writeScoped(SCOPED_NAMES.COMPLETED_INVESTMENTS, "true", LEGACY_KEYS.COMPLETED_INVESTMENTS);
      }
    }
  } catch {
    // Falha silenciosa em ambientes com armazenamento restrito
  }
}

/**
 * Verifica se o modal de boas-vindas inicial já foi apresentado ao usuário ativo.
 */
export function hasSeenWelcomeModal(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return readScopedOrLegacy(SCOPED_NAMES.WELCOME_SEEN, LEGACY_KEYS.WELCOME_SEEN) === "true";
  } catch {
    return false;
  }
}

/**
 * Marca que o modal de boas-vindas inicial já foi visto pelo usuário ativo.
 */
export function markWelcomeModalSeen(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    writeScoped(SCOPED_NAMES.WELCOME_SEEN, "true", LEGACY_KEYS.WELCOME_SEEN);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Verifica se o modal de destaque de captura sem fricção já foi visto pelo usuário ativo.
 */
export function hasSeenWelcomeFeatureModal(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return (
      readScopedOrLegacy(SCOPED_NAMES.WELCOME_FEATURE_SEEN, LEGACY_KEYS.WELCOME_FEATURE_SEEN) ===
      "true"
    );
  } catch {
    return false;
  }
}

/**
 * Marca o modal de destaque de captura sem fricção como visto pelo usuário ativo.
 */
export function markWelcomeFeatureModalSeen(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    writeScoped(SCOPED_NAMES.WELCOME_FEATURE_SEEN, "true", LEGACY_KEYS.WELCOME_FEATURE_SEEN);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Verifica se o onboarding do aplicativo nativo (APK) já foi apresentado ao usuário ativo.
 */
export function hasSeenNativeOnboarding(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return (
      readScopedOrLegacy(SCOPED_NAMES.NATIVE_ONBOARDING_SEEN, LEGACY_KEYS.NATIVE_ONBOARDING_SEEN) ===
      "true"
    );
  } catch {
    return false;
  }
}

/**
 * Marca que o onboarding do aplicativo nativo (APK) já foi visto pelo usuário ativo.
 */
export function markNativeOnboardingSeen(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    writeScoped(SCOPED_NAMES.NATIVE_ONBOARDING_SEEN, "true", LEGACY_KEYS.NATIVE_ONBOARDING_SEEN);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Recupera a meta prioritária inicial selecionada no acolhimento do usuário ativo.
 */
export function getStoredInitialGoal(): "cards" | "ocr" | "debts" | "family" | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const val = readScopedOrLegacy(SCOPED_NAMES.INITIAL_GOAL, LEGACY_KEYS.INITIAL_GOAL);
    if (val === "cards" || val === "ocr" || val === "debts" || val === "family") {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Salva a meta prioritária inicial selecionada no acolhimento do usuário ativo.
 */
export function setStoredInitialGoal(goal: "cards" | "ocr" | "debts" | "family"): void {
  if (!isLocalStorageAvailable()) return;
  try {
    writeScoped(SCOPED_NAMES.INITIAL_GOAL, goal, LEGACY_KEYS.INITIAL_GOAL);
  } catch {
    // Falha silenciosa
  }
}

/**
 * Reseta os sinalizadores de onboarding e tour no localStorage para o usuário atual e chaves legadas.
 */
export function resetDemoTourStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    Object.values(SCOPED_NAMES).forEach((name) => {
      window.localStorage.removeItem(getUserStorageKey(name));
    });
    Object.values(LEGACY_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
    });

    const userPrefix = getUserStorageKey("demo_completed_");
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        (key.startsWith("financas:demo_completed_") || key.startsWith(userPrefix))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Falha silenciosa
  }
}
