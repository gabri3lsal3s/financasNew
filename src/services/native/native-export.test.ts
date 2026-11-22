import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNativeExportPlugin = vi.hoisted(() => ({
  printWebView: vi.fn(),
  exportFile: vi.fn(),
  shareText: vi.fn(),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    registerPlugin: () => mockNativeExportPlugin,
  };
});

import {
  blobToBase64,
  bytesToBase64,
  exportNativeFile,
  isNativeExportInProgress,
  normalizeMimeType,
  printCurrentWebView,
  shareNativeText,
  stripPdfExtension,
} from "./native-export";
import * as platformModule from "./platform";

describe("Native Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.advanceTimersByTime(5000);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Helpers puros (MIME, nome de PDF e Base64 chunked)", () => {
    it("normaliza MIME types removendo ;charset e espaços", () => {
      expect(normalizeMimeType("text/csv;charset=utf-8")).toBe("text/csv");
      expect(normalizeMimeType("application/vnd.ms-excel;charset=utf-8")).toBe(
        "application/vnd.ms-excel",
      );
      expect(normalizeMimeType(" APPLICATION/JSON ; charset=utf-8 ")).toBe("application/json");
      expect(normalizeMimeType("")).toBe("application/octet-stream");
      expect(normalizeMimeType(undefined)).toBe("application/octet-stream");
    });

    it("remove extensão .pdf sem alterar demais caracteres", () => {
      expect(stripPdfExtension("AXIR_DRE_2026.pdf")).toBe("AXIR_DRE_2026");
      expect(stripPdfExtension("Relatorio_Fatura.PDF")).toBe("Relatorio_Fatura");
      expect(stripPdfExtension("   ")).toBe("Relatorio_Axir");
      expect(stripPdfExtension(undefined)).toBe("Relatorio_Axir");
    });

    it("codifica bytes UTF-8 com BOM em Base64", () => {
      const text = "\uFEFFData;Descrição\n2026-11-01;Ação Café";
      const bytes = new TextEncoder().encode(text);
      const b64 = bytesToBase64(bytes);
      const decodedBinary = atob(b64);
      const restored = new Uint8Array(decodedBinary.length);
      for (let i = 0; i < decodedBinary.length; i++) {
        restored[i] = decodedBinary.charCodeAt(i);
      }
      expect(Array.from(restored.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(restored)).toBe(text);
    });

    it("codifica payload > 64KB em blocos sem estourar a stack", () => {
      const largeSize = 96 * 1024;
      const bytes = new Uint8Array(largeSize);
      for (let i = 0; i < largeSize; i++) {
        bytes[i] = i % 251;
      }
      const b64 = bytesToBase64(bytes);
      const decoded = atob(b64);
      expect(decoded.length).toBe(largeSize);
      expect(decoded.charCodeAt(largeSize - 1)).toBe((largeSize - 1) % 251);
    });

    it("converte Blob para Base64 usando arrayBuffer", async () => {
      const blob = new Blob(["Axir JSON OK"], { type: "application/json" });
      const b64 = await blobToBase64(blob);
      expect(atob(b64)).toBe("Axir JSON OK");
    });
  });

  describe("printCurrentWebView", () => {
    it("bloqueia quando fora de plataforma nativa", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(false);
      const res = await printCurrentWebView("AXIR_Relatorio.pdf");
      expect(res.success).toBe(false);
      expect(mockNativeExportPlugin.printWebView).not.toHaveBeenCalled();
    });

    it("invoca plugin nativo sem extensão .pdf e mantém guarda do AppLock durante janela de retorno", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);

      let resolvePrint!: (value: { success: boolean }) => void;
      mockNativeExportPlugin.printWebView.mockImplementation(
        () =>
          new Promise<{ success: boolean }>((resolve) => {
            resolvePrint = resolve;
          }),
      );

      const promise = printCurrentWebView("AXIR_Extrato_2026.pdf");
      expect(isNativeExportInProgress()).toBe(true);
      expect(mockNativeExportPlugin.printWebView).toHaveBeenCalledWith({
        jobName: "AXIR_Extrato_2026",
      });

      resolvePrint({ success: true });
      const res = await promise;
      expect(res.success).toBe(true);
      // Durante a janela de carência de 2000ms continua protegido
      expect(isNativeExportInProgress()).toBe(true);

      vi.advanceTimersByTime(2100);
      expect(isNativeExportInProgress()).toBe(false);
    });
  });

  describe("exportNativeFile & shareNativeText", () => {
    it("normaliza MIME type ao enviar arquivo ao plugin nativo", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockNativeExportPlugin.exportFile.mockResolvedValue({
        success: true,
        fileName: "relatorio.xls",
        savedToDownloads: true,
        shared: true,
      });

      const res = await exportNativeFile({
        filename: "relatorio.xls",
        mimeType: "application/vnd.ms-excel;charset=utf-8",
        base64Data: btoa("abc"),
      });

      expect(res.success).toBe(true);
      expect(mockNativeExportPlugin.exportFile).toHaveBeenCalledWith({
        filename: "relatorio.xls",
        mimeType: "application/vnd.ms-excel",
        base64Data: btoa("abc"),
        share: true,
      });
    });

    it("compartilha texto no Share Sheet nativo quando em plataforma Android", async () => {
      vi.spyOn(platformModule, "isNativePlatform").mockReturnValue(true);
      mockNativeExportPlugin.shareText.mockResolvedValue({ success: true });

      const ok = await shareNativeText("Despesa", "Detalhes");
      expect(ok).toBe(true);
      expect(mockNativeExportPlugin.shareText).toHaveBeenCalledWith({
        title: "Despesa",
        text: "Detalhes",
      });
    });
  });
});
