import { z } from "zod";

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Valida URL de download de APK para impedir esquemas ativos (`javascript:`, `data:`),
 * caminhos protocol-relative (`//`) e URLs HTTP externas não criptografadas.
 */
export function isSafeApkDownloadUrl(rawUrl: string): boolean {
  if (hasControlChar(rawUrl)) {
    return false;
  }
  const clean = rawUrl.trim();
  if (!clean) {
    return false;
  }
  if (clean.startsWith("/")) {
    return !clean.startsWith("//") && !clean.includes("\\");
  }
  try {
    const parsed = new URL(clean);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export const AppVersionManifestSchema = z.object({
  version: z.string().min(1, "Versão obrigatória"),
  versionCode: z.number().int().positive("Código da versão deve ser um inteiro positivo"),
  releaseDate: z.string(),
  minSupportedVersion: z.string().optional(),
  apkUrl: z
    .string()
    .min(1, "URL do APK obrigatória")
    .refine(isSafeApkDownloadUrl, "URL do APK deve utilizar HTTPS ou caminho relativo seguro."),
  sha256: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  changelog: z.array(z.string()).default([]),
});

export type ValidatedAppVersionManifest = z.infer<typeof AppVersionManifestSchema>;
