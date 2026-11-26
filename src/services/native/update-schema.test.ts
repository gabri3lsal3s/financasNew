import { describe, expect, it } from "vitest";
import { AppVersionManifestSchema, isSafeApkDownloadUrl } from "./update-schema";

describe("update-schema — validação segura de manifesto e URL de APK", () => {
  it("aceita URLs HTTPS válidas e caminhos relativos internos seguros", () => {
    expect(isSafeApkDownloadUrl("https://cdn.axir.com.br/releases/axir-pro.apk")).toBe(true);
    expect(isSafeApkDownloadUrl("/releases/axir-pro.apk")).toBe(true);
  });

  it("rejeita esquemas ativos, protocol-relative, HTTP inseguro e caracteres de controle", () => {
    expect(isSafeApkDownloadUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeApkDownloadUrl("data:application/octet-stream,abc")).toBe(false);
    expect(isSafeApkDownloadUrl("http://cdn.axir.com.br/axir-pro.apk")).toBe(false);
    expect(isSafeApkDownloadUrl("//evil.example/axir-pro.apk")).toBe(false);
    expect(isSafeApkDownloadUrl("/\\evil.example/axir-pro.apk")).toBe(false);
    expect(isSafeApkDownloadUrl("https://cdn.axir.com.br/axir.apk\n")).toBe(false);
    expect(isSafeApkDownloadUrl("")).toBe(false);
  });

  it("AppVersionManifestSchema rejeita manifesto com apkUrl inseguro", () => {
    const parsed = AppVersionManifestSchema.safeParse({
      version: "3.30.0",
      versionCode: 330,
      releaseDate: "2026-11-25T00:00:00Z",
      apkUrl: "javascript:alert(1)",
      changelog: [],
    });
    expect(parsed.success).toBe(false);
  });
});
