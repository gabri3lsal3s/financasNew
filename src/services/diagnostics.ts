import { isNativePlatform } from "@/services/native/platform";

export type DevicePlatformLabel =
  | "Android Nativo"
  | "PWA Instalado"
  | "Navegador Web"
  | "unknown";

export type DeviceDiagnostics = {
  platform: DevicePlatformLabel;
  isNative?: boolean;
  isPwa?: boolean;
  screenResolution?: string;
  locale?: string;
  userAgent?: string;
};

type NavigatorWithStandalone = Navigator & {
  readonly standalone?: boolean;
};

/**
 * Coleta metadados técnicos tipados do ambiente do cliente para diagnóstico de suporte.
 */
export function collectDeviceDiagnostics(): DeviceDiagnostics {
  if (typeof window === "undefined") {
    return { platform: "unknown" };
  }

  const standaloneMedia =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
  const navigatorStandalone = Boolean(
    (navigator as NavigatorWithStandalone).standalone,
  );
  const isPwa = standaloneMedia || navigatorStandalone;
  const isNative = isNativePlatform();

  return {
    platform: isNative
      ? "Android Nativo"
      : isPwa
        ? "PWA Instalado"
        : "Navegador Web",
    isNative,
    isPwa,
    screenResolution: `${window.innerWidth}x${window.innerHeight}`,
    locale: navigator.language || "pt-BR",
    userAgent: navigator.userAgent,
  };
}
