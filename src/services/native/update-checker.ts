import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "./platform";
import { AppVersionManifestSchema } from "./update-schema";
import type { AppUpdateCheckResult, AppVersionManifest } from "@/types/app-update";

export interface AppUpdatePluginInterface {
  canRequestPackageInstalls(): Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  installApk(options: { filePath: string }): Promise<void>;
  downloadAndInstall(options: { url: string; sha256?: string }): Promise<{ downloadId: number; status: string }>;
}

export const AppUpdatePlugin = registerPlugin<AppUpdatePluginInterface>("AppUpdatePlugin", {
  web: {
    async canRequestPackageInstalls() {
      return { canInstall: false };
    },
    async openInstallPermissionSettings() {
      // No-op na web
    },
    async installApk() {
      throw new Error("Instalação nativa de APK suportada apenas no ambiente Android.");
    },
    async downloadAndInstall(options: { url: string }) {
      if (typeof window !== "undefined") {
        window.open(options.url, "_blank");
      }
      return { downloadId: 0, status: "web_opened" };
    },
  },
});

export const REMOTE_MANIFEST_URL = "https://pub-8b490da0649647f0a70d2eff96bd39e0.r2.dev/version.json";
export const DEFAULT_MANIFEST_PATH = "/releases/version.json";

export interface CheckUpdateOptions {
  manifestUrl?: string;
  forceCheck?: boolean;
}

/**
 * Consulta o manifesto de versão remoto e compara com o app instalado.
 */
export async function checkAppUpdate(options?: CheckUpdateOptions): Promise<AppUpdateCheckResult> {
  const defaultUrl = isNativePlatform() ? REMOTE_MANIFEST_URL : DEFAULT_MANIFEST_PATH;
  const url = options?.manifestUrl || defaultUrl;

  let currentVersion = "1.0.0";
  let currentVersionCode = 1;

  if (isNativePlatform()) {
    try {
      const info = await App.getInfo();
      currentVersion = info.version || "1.0.0";
      currentVersionCode = parseInt(info.build, 10) || 1;
    } catch {
      // Fallback gracioso
    }
  }

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        isMandatory: false,
        currentVersion,
        currentVersionCode,
        error: `Servidor de atualizações retornou código ${res.status}`,
      };
    }

    const data = await res.json();
    const parseResult = AppVersionManifestSchema.safeParse(data);

    if (!parseResult.success) {
      return {
        hasUpdate: false,
        isMandatory: false,
        currentVersion,
        currentVersionCode,
        error: "Manifesto de atualização com formato inválido.",
      };
    }

    const manifest = parseResult.data;
    const hasUpdate = manifest.versionCode > currentVersionCode;
    const isMandatory = false; // Pode ser estendido se minSupportedVersion > currentVersion

    return {
      hasUpdate,
      isMandatory,
      currentVersion,
      currentVersionCode,
      latestVersion: manifest.version,
      latestVersionCode: manifest.versionCode,
      manifest,
    };
  } catch (err) {
    return {
      hasUpdate: false,
      isMandatory: false,
      currentVersion,
      currentVersionCode,
      error: err instanceof Error ? err.message : "Falha ao verificar atualizações.",
    };
  }
}

/**
 * Dispara o download e instalação da atualização.
 */
export async function triggerAppUpdate(manifest: AppVersionManifest): Promise<void> {
  if (isNativePlatform()) {
    // Normaliza URL se for relativa
    let fullUrl = manifest.apkUrl;
    if (fullUrl.startsWith("/")) {
      fullUrl = window.location.origin + fullUrl;
    }

    await AppUpdatePlugin.downloadAndInstall({
      url: fullUrl,
      sha256: manifest.sha256,
    });
  } else {
    // Na web, abre o link direto para download
    const link = document.createElement("a");
    link.href = manifest.apkUrl;
    link.download = "axis-pro.apk";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
