import { afterEach, describe, expect, it, vi } from "vitest";

const mockClipboardWrite = vi.hoisted(() => vi.fn());

vi.mock("@capacitor/clipboard", () => ({
  Clipboard: {
    write: mockClipboardWrite,
  },
}));

import * as nativeModule from "@/services/native";
import * as toastModule from "@/services/toast";
import { downloadBlob, downloadCsv, downloadJson, sanitizeFilename, shareText } from "./export-actions";

describe("services/export-actions — shareText", () => {
  const originalNav = globalThis.navigator;
  const originalClipboard = globalThis.navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", { value: originalNav, configurable: true });
    Object.defineProperty(globalThis.navigator, "clipboard", { value: originalClipboard, configurable: true });
    vi.restoreAllMocks();
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

  it("usa Share Sheet nativo no Android e cai para Capacitor Clipboard se falhar", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    const nativeShareSpy = vi.spyOn(nativeModule, "shareNativeText").mockResolvedValue(true);
    expect(await shareText("Racha", "Link Pix")).toBe("shared");
    expect(nativeShareSpy).toHaveBeenCalledWith("Racha", "Link Pix");

    nativeShareSpy.mockResolvedValue(false);
    mockClipboardWrite.mockResolvedValueOnce(undefined);
    expect(await shareText("Racha", "Link Pix")).toBe("copied");
    expect(mockClipboardWrite).toHaveBeenCalledWith({ string: "Link Pix" });
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

describe("services/export-actions — downloadBlob/CSV/JSON (Web vs Android Nativo)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("dispara download clássico via ObjectURL + anchor na Web/PWA", async () => {
    vi.useFakeTimers();
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(false);
    const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:axir-test");
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName === "a") {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    const ok = await downloadCsv("extrato", "col1;col2\n1;2");
    expect(ok).toBe(true);
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1100);
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:axir-test");
  });

  it("roteia downloadJson e downloadCsv para exportNativeFile no Android com feedback toast", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(nativeModule, "blobToBase64").mockResolvedValue("eyJhIjoxfQ==");
    const exportSpy = vi.spyOn(nativeModule, "exportNativeFile").mockResolvedValue({
      success: true,
      fileName: "backup.json",
      savedToDownloads: true,
      shared: true,
    });
    const toastSpy = vi.spyOn(toastModule, "pushToast").mockImplementation(() => 1);

    const ok = await downloadJson("backup.json", { a: 1 });
    expect(ok).toBe(true);
    expect(exportSpy).toHaveBeenCalledWith({
      filename: "backup.json",
      mimeType: "application/json",
      base64Data: "eyJhIjoxfQ==",
      share: true,
    });
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Arquivo exportado",
        variant: "success",
      }),
    );
  });

  it("retorna false e exibe toast de erro quando exportNativeFile falha", async () => {
    vi.spyOn(nativeModule, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(nativeModule, "blobToBase64").mockResolvedValue("ZGF0YQ==");
    vi.spyOn(nativeModule, "exportNativeFile").mockResolvedValue({
      success: false,
      error: "Espaço insuficiente.",
    });
    const toastSpy = vi.spyOn(toastModule, "pushToast").mockImplementation(() => 2);

    const ok = await downloadBlob("dados.csv", new Blob(["a,b"], { type: "text/csv" }));
    expect(ok).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao exportar arquivo",
        description: "Espaço insuficiente.",
        variant: "destructive",
      }),
    );
  });
});
