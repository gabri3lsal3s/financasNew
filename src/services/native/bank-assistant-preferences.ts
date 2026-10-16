import { useEffect, useState } from "react";
import {
  DEFAULT_BANK_ASSISTANT_PREFERENCES,
  normalizeBankPreferences,
  type BankAssistantPreferences,
} from "@/domain/notifications";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "bank_assistant_preferences";
const listeners = new Set<(prefs: BankAssistantPreferences) => void>();

/**
 * Lê as preferências do assistente bancário com isolamento por usuário.
 */
export function getBankAssistantPreferences(): BankAssistantPreferences {
  try {
    const raw = getUserStorageItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BANK_ASSISTANT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return normalizeBankPreferences(parsed);
  } catch {
    return { ...DEFAULT_BANK_ASSISTANT_PREFERENCES };
  }
}

/**
 * Salva atualizações parciais nas preferências do assistente bancário com isolamento por usuário.
 */
export function setBankAssistantPreferences(
  patch: Partial<BankAssistantPreferences>,
): BankAssistantPreferences {
  const current = getBankAssistantPreferences();
  const next = normalizeBankPreferences({
    ...current,
    ...patch,
  });

  try {
    setUserStorageItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage desabilitado ou quota excedida
  }

  notifyListeners(next);
  return next;
}

/**
 * Redefine as preferências do assistente bancário para os padrões de fábrica.
 */
export function resetBankAssistantPreferences(): BankAssistantPreferences {
  return setBankAssistantPreferences(DEFAULT_BANK_ASSISTANT_PREFERENCES);
}

/**
 * Inscreve um ouvinte para alterações nas preferências do assistente bancário.
 */
export function subscribeBankAssistantPreferences(
  callback: (prefs: BankAssistantPreferences) => void,
): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners(prefs: BankAssistantPreferences): void {
  listeners.forEach((listener) => {
    try {
      listener(prefs);
    } catch {
      // falhas em listeners não propagam erro
    }
  });
}

// Sincroniza ao trocar de usuário ativo
if (typeof window !== "undefined") {
  subscribeActiveUserId(() => {
    notifyListeners(getBankAssistantPreferences());
  });
}

/**
 * Hook React reativo para consultar e alterar preferências do assistente passivo de bancos.
 */
export function useBankAssistantPreferences() {
  const [preferences, setPreferences] = useState<BankAssistantPreferences>(() =>
    getBankAssistantPreferences(),
  );

  useEffect(() => {
    const unsubscribe = subscribeBankAssistantPreferences((next) => {
      setPreferences(next);
    });

    return unsubscribe;
  }, []);

  const updatePreferences = (patch: Partial<BankAssistantPreferences>) => {
    setBankAssistantPreferences(patch);
  };

  const resetPreferences = () => {
    resetBankAssistantPreferences();
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
}
