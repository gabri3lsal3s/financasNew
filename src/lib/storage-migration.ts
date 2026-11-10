/**
 * Utilitário de Migração Transparente de LocalStorage: Áxis -> Axir
 *
 * Lê primeiramente a chave nova ('axir_*'). Se não existir, faz fallback
 * para a chave legada ('axis_*'), migra o dado para a chave nova e
 * remove a chave antiga, preservando o estado do usuário sem perdas.
 */

export function getMigratedStorageItem(newKey: string, legacyKey: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const currentVal = window.localStorage.getItem(newKey);
    if (currentVal !== null) {
      return currentVal;
    }

    const legacyVal = window.localStorage.getItem(legacyKey);
    if (legacyVal !== null) {
      window.localStorage.setItem(newKey, legacyVal);
      window.localStorage.removeItem(legacyKey);
      return legacyVal;
    }
  } catch {
    // Falha silenciosa em navegadores com storage bloqueado (modo anônimo estrito)
  }

  return null;
}
