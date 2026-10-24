import type { TourTrackId } from "@/domain/demo-simulation";

const STORAGE_KEYS = {
  COMPLETED_FINANCES: "financas:demo_completed_finances",
  COMPLETED_INVESTMENTS: "financas:demo_completed_investments",
  COMPLETED_ANY: "financas:demo_completed_any",
  WELCOME_SEEN: "financas:welcome_modal_seen",
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
      return window.localStorage.getItem(STORAGE_KEYS.COMPLETED_FINANCES) === "true";
    }
    if (track === "investments") {
      return window.localStorage.getItem(STORAGE_KEYS.COMPLETED_INVESTMENTS) === "true";
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
    if (track === "finances") {
      window.localStorage.setItem(STORAGE_KEYS.COMPLETED_FINANCES, "true");
    } else if (track === "investments") {
      window.localStorage.setItem(STORAGE_KEYS.COMPLETED_INVESTMENTS, "true");
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
 * Marca o modal de boas-vindas inicial como já visualizado.
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
 * Reseta os sinalizadores de tour no localStorage (útil para testes ou reinício manual pelo usuário).
 */
export function resetDemoTourStorage(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_FINANCES);
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_INVESTMENTS);
    window.localStorage.removeItem(STORAGE_KEYS.COMPLETED_ANY);
    window.localStorage.removeItem(STORAGE_KEYS.WELCOME_SEEN);
  } catch {
    // Falha silenciosa
  }
}
