import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectDeviceDiagnostics } from "./diagnostics";
import * as platformService from "@/services/native/platform";

describe("collectDeviceDiagnostics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(platformService, "isNativePlatform").mockReturnValue(false);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("identifica Navegador Web por padrão quando não é nativo nem standalone", () => {
    const diagnostics = collectDeviceDiagnostics();

    expect(diagnostics.platform).toBe("Navegador Web");
    expect(diagnostics.isNative).toBe(false);
    expect(diagnostics.isPwa).toBe(false);
    expect(diagnostics.screenResolution).toMatch(/^\d+x\d+$/);
    expect(typeof diagnostics.userAgent).toBe("string");
  });

  it("identifica PWA Instalado quando display-mode standalone está ativo", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const diagnostics = collectDeviceDiagnostics();

    expect(diagnostics.platform).toBe("PWA Instalado");
    expect(diagnostics.isPwa).toBe(true);
    expect(diagnostics.isNative).toBe(false);
  });

  it("identifica Android Nativo quando isNativePlatform() retorna true", () => {
    vi.spyOn(platformService, "isNativePlatform").mockReturnValue(true);

    const diagnostics = collectDeviceDiagnostics();

    expect(diagnostics.platform).toBe("Android Nativo");
    expect(diagnostics.isNative).toBe(true);
  });
});
