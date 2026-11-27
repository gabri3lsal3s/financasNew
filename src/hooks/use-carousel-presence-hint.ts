import { useEffect, useState } from "react";
import { getActiveUserId, getUserStorageKey } from "@/services/user-storage";

function readCarouselPresenceHint(hintKey: string): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const uid = getActiveUserId();
    if (!uid) return false;
    const storageKey = getUserStorageKey(`carousel_hint_${hintKey}`, uid);
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function writeCarouselPresenceHint(hintKey: string, hasItems: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const uid = getActiveUserId();
    if (!uid) return;
    const storageKey = getUserStorageKey(`carousel_hint_${hintKey}`, uid);
    window.localStorage.setItem(storageKey, hasItems ? "1" : "0");
  } catch {
    // Silencia falha de cota ou modo privado
  }
}

export interface UseCarouselPresenceHintOptions {
  isLoading: boolean;
  hasItems: boolean;
}

/**
 * Evita "skeleton fantasma" em carrosséis opcionais quando o usuário não possui cards:
 * só exibe o placeholder de altura reservada durante `isLoading` se o último estado
 * resolvido para este `userId` tinha ao menos 1 card ativo.
 */
export function useCarouselPresenceHint(
  hintKey: string,
  { isLoading, hasItems }: UseCarouselPresenceHintOptions,
): { shouldShowSkeleton: boolean } {
  const [hadItemsBefore] = useState<boolean>(() => readCarouselPresenceHint(hintKey));

  useEffect(() => {
    if (!isLoading) {
      writeCarouselPresenceHint(hintKey, hasItems);
    }
  }, [hintKey, isLoading, hasItems]);

  return {
    shouldShowSkeleton: isLoading && hadItemsBefore,
  };
}
