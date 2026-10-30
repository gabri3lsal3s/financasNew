import type { TourTrackId } from "@/domain/demo-simulation";

const STORAGE_KEYS = {
  COMPLETED_FINANCES: "financas:demo_completed_finances",
  COMPLETED_INVESTMENTS: "financas:demo_completed_investments",
  COMPLETED_ANY: "financas:demo_completed_any",
  WELCOME_SEEN: "financas:welcome_modal_seen",
  NATIVE_ONBOARDING_SEEN: "financas:demo_native_onboarding_seen",
} as const;

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

/**
 * Verifica se o usuário já concluiu o tour de demonstração.
 * Se uma trilha for informada, verifica a trilha específica; caso contrário, verifica se qualquer trilha foi concluída.
 */
export function hasCompletedDemoTour(track?: TourTrackId): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    if (track === "finances") {
      return (
        window.localStorage.getItem(STORAGE_KEYS.COMPLETED_FINANCES) === "true" ||
        window.localStorage.getItem("financas:demo_completed_finances_overview") === "true"
      );
    }
    if (track === "investments") {
      return (
        window.localStorage.getItem(STORAGE_KEYS.COMPLETED_INVESTMENTS) === "true" ||
        window.localStorage.getItem("financas:demo_completed_investments_overview") === "true"
      );
    }
    if (track) {
      return (
        window.localStorage.getItem(`financas:demo_completed_${track}`) === "true" ||
        (track === "finances_overview" &&
          window.localStorage.getItem(STORAGE_KEYS.COMPLETED_FINANCES) === "true") ||
        (track === "investments_overview" &&
          window.localStorage.getItem(STORAGE_KEYS.COMPLETED_INVESTMENTS) === "true")
      );
    }
    return (
      window.localStorage.getItem(STORAGE_KEYS.COMPLETED_ANY) === "true" ||
      window.localStorage.getItem(STORAGE_KEYS.COMPLETED_FINANCES) === "true" ||
      window.localStorage.getItem(STORAGE_KEYS.COMPLETED_INVESTMENTS) === "true"
    );
  } catch {
    return false;
  }
}

/**
 * Marca uma trilha de tour (ou o tour geral) como concluída no localStorage.
 */
export function markTourCompleted(track?: TourTrackId): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.COMPLETED_ANY, "true");
    if (track) {
      window.localStorage.setItem(`financas:demo_completed_${track}`, "true");
      if (track === "finances" || track === "finances_overview") {
        window.localStorage.setItem(STORAGE_KEYS.COMPLETED_FINANCES, "true");
      }
      if (track === "investments" || track === "investments_overview") {
        window.localStorage.setItem(STORAGE_KEYS.COMPLETED_INVESTMENTS, "true");
      }
    }
  } catch {
    // Falha silenciosa em ambientes com armazenamento restrito
  }
}

/**
 * Verifica se o modal de boas-vindas inicial já foi apresentado ao usuário.
 */
export function hasSeenWelcomeModal(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN) === "true";
  } catch {
    return false;
  }
}

/**
 * Marca que o modal de boas-vindas inicial já foi visto pelo usuário.
 */
export function markWelcomeModalSeen(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, "true");
  } catch {
    // Falha silenciosa
  }
}

/**
 * Verifica se o onboarding do aplicativo nativo (APK) já foi apresentado ao usuário.
 */
export function hasSeenNativeOnboarding(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.NATIVE_ONBOARDING_SEEN) === "true";
  } catch {
    return false;
  }
}

/**
 * Marca que o onboarding do aplicativo nativo (APK) já foi visto pelo usuário.
 */
export function markNativeOnboardingSeen(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.NATIVE_ONBOARDING_SEEN, "true");
  } catch {
    // Falha silenciosa
  }
}

/**
 * Reseta os sinalizadores de tour no localStorage (útil para testes ou reinício manual pelo usuário).
 */
export function resetDemoTourStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_FINANCES);
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_INVESTMENTS);
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_ANY);
    window.localStorage.removeItem(STORAGE_KEYS.WELCOME_SEEN);
    window.localStorage.removeItem(STORAGE_KEYS.NATIVE_ONBOARDING_SEEN);

    // Remove chaves dinâmicas de micro-tours
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("financas:demo_completed_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Falha silenciosa
  }
}
