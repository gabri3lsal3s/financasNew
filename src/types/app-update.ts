/**
 * Contratos de tipo para o sistema de atualizações do aplicativo Áxis.
 */

export interface AppVersionManifest {
  version: string;
  versionCode: number;
  releaseDate: string;
  minSupportedVersion?: string;
  apkUrl: string;
  sha256?: string;
  fileSizeBytes?: number;
  changelog: string[];
}

export type AppUpdateState =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "ready"
  | "error";

export interface AppUpdateCheckResult {
  hasUpdate: boolean;
  isMandatory: boolean;
  currentVersion: string;
  currentVersionCode: number;
  latestVersion?: string;
  latestVersionCode?: number;
  manifest?: AppVersionManifest;
  error?: string;
}
