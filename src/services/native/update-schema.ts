import { z } from "zod";

export const AppVersionManifestSchema = z.object({
  version: z.string().min(1, "Versão obrigatória"),
  versionCode: z.number().int().positive("Código da versão deve ser um inteiro positivo"),
  releaseDate: z.string(),
  minSupportedVersion: z.string().optional(),
  apkUrl: z.string().min(1, "URL do APK obrigatória"),
  sha256: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  changelog: z.array(z.string()).default([]),
});

export type ValidatedAppVersionManifest = z.infer<typeof AppVersionManifestSchema>;
