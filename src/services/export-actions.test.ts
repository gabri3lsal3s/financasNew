import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeFilename, shareText } from "./export-actions";

describe("services/export-actions — shareText", () => {
  const originalNav = globalThis.navigator;
  const originalClipboard = globalThis.navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", { value: originalNav, configurable: true });
    Object.defineProperty(globalThis.navigator, "clipboard", { value: originalClipboard, configurable: true });
  });

  function mockNavigator(overrides: {
    share?: () => Promise<void>;
    canShare?: () => boolean;
    clipboard?: { writeText: () => Promise<void> };
  }): void {
    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNav, ...overrides },
      configurable: true,
    });
  }

  it("usa a Web Share API quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    mockNavigator({ share, canShare: () => true });
    const result = await shareText("Título", "Texto");
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Título", text: "Texto" });
  });

  it("silencia AbortError (usuário cancelou)", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError"));
    mockNavigator({ share });
    await expect(shareText("Título", "Texto")).resolves.toBe("shared");
  });

  it("cai para clipboard quando share falha ou não existe", async () => {
    mockNavigator({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const result = await shareText("Título", "Texto");
    expect(result).toBe("copied");
  });

  it("retorna unsupported sem share e sem clipboard", async () => {
    mockNavigator({});
    const result = await shareText("Título", "Texto");
    expect(result).toBe("unsupported");
  });
});

describe("services/export-actions — sanitizeFilename", () => {
  it("remove sequências de path traversal (../ e ..\\)", () => {
    expect(sanitizeFilename("../../etc/passwd.csv")).toBe("etc_passwd.csv");
    expect(sanitizeFilename("..\\..\\windows\\system32.json")).toBe("windows_system32.json");
  });

  it("substitui caracteres perigosos e reservados por underscore", () => {
    expect(sanitizeFilename("relatorio:financeiro*2026?teste.csv")).toBe("relatorio_financeiro_2026_teste.csv");
    expect(sanitizeFilename("arquivo<com>tags|pipes.json")).toBe("arquivo_com_tags_pipes.json");
  });

  it("remove caracteres de controle e whitespace excessivo", () => {
    expect(sanitizeFilename("  relatorio\x00\x1F.csv  ")).toBe("relatorio.csv");
  });

  it("retorna defaultName quando o resultado fica vazio", () => {
    expect(sanitizeFilename("")).toBe("export");
    expect(sanitizeFilename("   ", "fallback.csv")).toBe("fallback.csv");
  });
});
