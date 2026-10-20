import { useEffect, useState } from "react";
import {
  forgetMerchantCategoryMemory,
  recordMerchantCategoryMemory,
  type MerchantCategoryMapping,
} from "@/domain/notifications";
import {
  getUserStorageItem,
  setUserStorageItem,
  subscribeActiveUserId,
} from "@/services/user-storage";

const STORAGE_KEY = "merchant_category_memory";
const listeners = new Set<(memory: MerchantCategoryMapping) => void>();

function notifyListeners(memory: MerchantCategoryMapping) {
  listeners.forEach((listener) => {
    try {
      listener(memory);
    } catch {
      // Evita interrupção por listeners com falha
    }
  });
}

/**
 * Lê o dicionário de aprendizado estabelecimento -> categoria com isolamento por usuário.
 */
export function getStoredMerchantCategoryMapping(): MerchantCategoryMapping {
  try {
    const raw = getUserStorageItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as MerchantCategoryMapping;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Grava ou atualiza a categoria memorizada para um estabelecimento.
 */
export function storeMerchantCategory(
  merchant: string,
  categoryIdOrSlug: string,
): MerchantCategoryMapping {
  const current = getStoredMerchantCategoryMapping();
  const next = recordMerchantCategoryMemory(merchant, categoryIdOrSlug, current);

  try {
    setUserStorageItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage indisponível ou quota excedida
  }

  notifyListeners(next);
  return next;
}

/**
 * Remove um estabelecimento da memória persistida.
 */
export function forgetStoredMerchantCategory(merchant: string): MerchantCategoryMapping {
  const current = getStoredMerchantCategoryMapping();
  const next = forgetMerchantCategoryMemory(merchant, current);

  try {
    setUserStorageItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage indisponível
  }

  notifyListeners(next);
  return next;
}

/**
 * Hook reativo para observar o dicionário de aprendizado de estabelecimentos.
 */
export function useMerchantCategoryMapping(): MerchantCategoryMapping {
  const [mapping, setMapping] = useState<MerchantCategoryMapping>(() =>
    getStoredMerchantCategoryMapping(),
  );

  useEffect(() => {
    const handleUpdate = (updated: MerchantCategoryMapping) => {
      setMapping(updated);
    };

    listeners.add(handleUpdate);
    const unsubscribeUser = subscribeActiveUserId(() => {
      setMapping(getStoredMerchantCategoryMapping());
    });

    return () => {
      listeners.delete(handleUpdate);
      unsubscribeUser();
    };
  }, []);

  return mapping;
}
