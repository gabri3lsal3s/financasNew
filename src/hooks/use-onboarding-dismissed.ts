import { useCallback, useState } from "react";

const STORAGE_KEY = "financas:onboarding_dismissed";

export function useOnboardingDismissed() {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch {
      // Falha silenciosa caso cookies/armazenamento estejam bloqueados
    }
    setIsDismissed(true);
  }, []);

  return { isDismissed, dismiss };
}
