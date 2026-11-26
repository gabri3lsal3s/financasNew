import { App } from "@capacitor/app";
import { CapacitorHttp, registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "./platform";
import { AppVersionManifestSchema, isSafeApkDownloadUrl } from "./update-schema";
import { AXIR_APP_VERSION } from "./app-links";
import { isNewerVersion } from "@/domain/version/semver";
import { getPWAUpdateAvailable } from "@/app/pwa";
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
      const cleanUrl = options.url.trim();
      if (!isSafeApkDownloadUrl(cleanUrl)) {
        throw new Error("URL de download do APK inválida ou insegura.");
      }
      if (typeof window !== "undefined") {
        window.open(cleanUrl, "_blank", "noopener,noreferrer");
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
  currentVersion?: string;
  currentVersionCode?: number;
}

/**
 * Consulta o manifesto de versão remoto e compara com o app instalado.
 */
export async function checkAppUpdate(options?: CheckUpdateOptions): Promise<AppUpdateCheckResult> {
  const isNative = isNativePlatform();
  const defaultUrl = isNative ? REMOTE_MANIFEST_URL : DEFAULT_MANIFEST_PATH;
  const url = options?.manifestUrl || defaultUrl;

  let currentVersion = options?.currentVersion || AXIR_APP_VERSION;
  let currentVersionCode = options?.currentVersionCode || 1;

  if (isNative) {
    try {
      const info = await App.getInfo();
      currentVersion = options?.currentVersion || info.version || AXIR_APP_VERSION;
      currentVersionCode = options?.currentVersionCode || parseInt(info.build, 10) || 1;
    } catch {
      // Fallback gracioso
    }
  }

  try {
    let rawData: unknown;
    let statusCode = 200;

    if (isNative) {
      try {
        const response = await CapacitorHttp.get({
          url,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
        statusCode = response.status;
        rawData = response.data;
      } catch {
        // Fallback para fetch web caso ocorra falha de inicialização no plugin nativo
        const res = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        statusCode = res.status;
        rawData = await res.json();
      }
    } else {
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      statusCode = res.status;
      rawData = await res.json();
    }

    if (statusCode < 200 || statusCode >= 300) {
      return {
        hasUpdate: false,
        isMandatory: false,
        currentVersion,
        currentVersionCode,
        error: `Servidor de atualizações retornou código ${statusCode}`,
      };
    }

    let parsedData = rawData;
    if (typeof rawData === "string") {
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        return {
          hasUpdate: false,
          isMandatory: false,
          currentVersion,
          currentVersionCode,
          error: "Manifesto de atualização com formato inválido.",
        };
      }
    }

    const parseResult = AppVersionManifestSchema.safeParse(parsedData);

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
    // No ambiente nativo (Capacitor Android), a governança se dá estritamente por versionCode.
    // No ambiente Web / PWA, baseia-se no Service Worker ativo ou em SemVer estrito (manifest.version > currentVersion).
    const hasUpdate = isNative
      ? manifest.versionCode > currentVersionCode
      : getPWAUpdateAvailable() || isNewerVersion(manifest.version, currentVersion);

    const isMandatory = false;

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
 * Verifica se o aplicativo possui autorização do sistema operacional
 * para instalar pacotes APK (REQUEST_INSTALL_PACKAGES / Fontes Desconhecidas).
 */
export async function canInstallPackages(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true;
  }
  try {
    const res = await AppUpdatePlugin.canRequestPackageInstalls();
    return res.canInstall;
  } catch {
    return false;
  }
}

/**
 * Abre a tela nativa do Android para que o usuário autorize a instalação
 * de atualizações por dentro do aplicativo Axir.
 */
export async function openInstallPermissionSettings(): Promise<void> {
  if (isNativePlatform()) {
    try {
      await AppUpdatePlugin.openInstallPermissionSettings();
    } catch {
      // Fallback gracioso
    }
  }
}

/**
 * Dispara o download e instalação da atualização.
 */
export async function triggerAppUpdate(manifest: AppVersionManifest): Promise<void> {
  const cleanApkUrl = manifest.apkUrl.trim();
  if (!isSafeApkDownloadUrl(cleanApkUrl)) {
    throw new Error("URL de download do APK inválida ou insegura.");
  }

  if (isNativePlatform()) {
    const canInstall = await canInstallPackages();
    if (!canInstall) {
      await openInstallPermissionSettings();
      throw new Error(
        "Permissão necessária: ative 'Permitir desta fonte' para o Axir nas configurações e toque em Atualizar novamente.",
      );
    }

    // Normaliza URL se for relativa
    let fullUrl = cleanApkUrl;
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
    link.href = cleanApkUrl;
    link.download = "axir-pro.apk";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
