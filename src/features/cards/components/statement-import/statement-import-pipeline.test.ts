import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiAssistant from "@/services/ai-assistant";
import type { PdfDocumentSession } from "@/services/pdf-session";
import { parseStatementWithPdfAiFallback } from "./statement-import-pipeline";
import { runVisionWavesWithAi } from "./statement-vision-runner";

function makeVisionResponse(descriptions: Array<{ desc: string; cents: number }>, totalCents?: number) {
  return {
    ok: true as const,
    cached: false,
    source: "ai_vision" as const,
    data: {
      rows: descriptions.map((d, idx) => ({
        date: `2026-11-${String(10 + idx).padStart(2, "0")}`,
        description: d.desc,
        amountCents: d.cents,
        installmentCurrent: null,
        installmentTotal: null,
        entryType: "purchase" as const,
      })),
      detectedTotalInvoiceCents: totalCents ?? null,
    },
  };
}

describe("Onda 3 — statement-import-pipeline (Vision 2 Ondas Paralelas, Chunks, Abort & Cota)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("D15: PDF digital encerra na Onda 1 (3 págs em paralelo) quando fecha o Total Oficial sem renderizar Onda 2", async () => {
    const renderMock = vi.fn(async (pageNum: number) => new Blob([`page-${pageNum}`], { type: "image/png" }));
    const mockPdfSession: PdfDocumentSession = {
      fileName: "multi-page.pdf",
      sha256: "a".repeat(64),
      totalPages: 6,
      getTotalPages: () => 6,
      extractPageTexts: async () => [],
      extractSpatialPages: async () => ({ lines: [], usedTwoColumnMode: false, totalPages: 6 }),
      renderPageToBlob: renderMock,
      getBuffer: () => new ArrayBuffer(8),
      dispose: async () => {},
    };

    const pageTexts = Array.from({ length: 6 }, (_, i) => `1${i}/11/2026 Compra ${i + 1} 10,00`);
    const rawFull = [
      "VALOR DA FATURA: R$ 600,00",
      "RESUMO SEM TABELA LOCAL RECONSTRUÍDA",
    ].join("\n");

    const aiSpy = vi
      .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
      // 1 chamada IA Texto insuficiente (100,00 vs 600,00)
      .mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          rows: [{ date: "2026-11-01", description: "Texto Incompleto", amountCents: 10000, installmentCurrent: null, installmentTotal: null, entryType: "purchase" }],
          detectedTotalInvoiceCents: 60000,
        },
      })
      // Onda 1 Vision (págs 1..3) soma exatamente R$ 600,00
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Compra Pg 1", cents: 20000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Compra Pg 2", cents: 20000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Compra Pg 3", cents: 20000 }], 60000));

    const res = await parseStatementWithPdfAiFallback({
      content: rawFull,
      fileNameOrType: "multi-page.pdf",
      cardId: "card-1",
      competenceMonth: "2026-11",
      rawFullText: rawFull,
      pdfSession: mockPdfSession,
      pdfPageTexts: pageTexts,
      pdfTotalPages: 6,
    });

    // 1 IA Texto + 3 Vision Onda 1 = 4 chamadas; páginas 4..6 JAMAIS renderizadas nem chamadas
    expect(aiSpy).toHaveBeenCalledTimes(4);
    expect(renderMock).toHaveBeenCalledTimes(3);
    expect(renderMock).toHaveBeenCalledWith(1);
    expect(renderMock).toHaveBeenCalledWith(2);
    expect(renderMock).toHaveBeenCalledWith(3);
    expect(renderMock).not.toHaveBeenCalledWith(4);
    expect(res.extractionOrigin).toBe("ai_vision");
    expect(res.qualityGate?.passed).toBe(true);
    expect(res.qualityGate?.diffCents).toBe(0);
  });

  it("D15: PDF digital dispara Onda 2 (págs 4..6) automaticamente quando Onda 1 diverge do Total Oficial", async () => {
    const renderMock = vi.fn(async (pageNum: number) => new Blob([`page-${pageNum}`], { type: "image/png" }));
    const mockPdfSession: PdfDocumentSession = {
      fileName: "six-page.pdf",
      sha256: "b".repeat(64),
      totalPages: 6,
      getTotalPages: () => 6,
      extractPageTexts: async () => [],
      extractSpatialPages: async () => ({ lines: [], usedTwoColumnMode: false, totalPages: 6 }),
      renderPageToBlob: renderMock,
      getBuffer: () => new ArrayBuffer(8),
      dispose: async () => {},
    };

    const pageTexts = Array.from({ length: 6 }, (_, i) => `1${i}/11/2026 Compra ${i + 1} 10,00`);
    const rawFull = "TOTAL DA FATURA: R$ 600,00\nRESUMO SEM COMPRAS";

    const aiSpy = vi
      .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
      // 1 IA Texto falhando
      .mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_text",
        data: { rows: [{ date: "2026-11-01", description: "Parcial", amountCents: 5000, installmentCurrent: null, installmentTotal: null, entryType: "purchase" }], detectedTotalInvoiceCents: 60000 },
      })
      // Onda 1 (págs 1..3) fecha só R$ 300,00 -> precisa Onda 2
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 1", cents: 10000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 2", cents: 10000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 3", cents: 10000 }], 60000))
      // Onda 2 (págs 4..6) completa R$ 600,00
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 4", cents: 10000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 5", cents: 10000 }], 60000))
      .mockResolvedValueOnce(makeVisionResponse([{ desc: "Pg 6", cents: 10000 }], 60000));

    const res = await parseStatementWithPdfAiFallback({
      content: rawFull,
      fileNameOrType: "six-page.pdf",
      cardId: "card-1",
      competenceMonth: "2026-11",
      rawFullText: rawFull,
      pdfSession: mockPdfSession,
      pdfPageTexts: pageTexts,
      pdfTotalPages: 6,
    });

    expect(aiSpy).toHaveBeenCalledTimes(7); // 1 texto + 6 Vision
    expect(renderMock).toHaveBeenCalledTimes(6);
    expect(res.transactions).toHaveLength(6);
    expect(res.qualityGate?.passed).toBe(true);
    expect(res.qualityGate?.diffCents).toBe(0);
  });

  it("D5: emite chunks_truncated ao podar documento > 3 blocos de texto (75.000 chars) e respeita limite de 3 chamadas", async () => {
    const bigLines = Array.from(
      { length: 2200 },
      (_, idx) => `ITEM NAO PARSEADO LINHA_${idx}_${"X".repeat(38)}`,
    ).join("\n");

    const aiSpy = vi
      .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
      .mockResolvedValue({
        ok: true,
        cached: false,
        source: "ai_text",
        data: {
          rows: [{ date: "2026-11-10", description: "Compra Longa", amountCents: 5000, installmentCurrent: null, installmentTotal: null, entryType: "purchase" }],
        },
      });

    const res = await parseStatementWithPdfAiFallback({
      content: `RESUMO BANCO\nTOTAL DA FATURA: R$ 150,00\n${bigLines}`,
      fileNameOrType: "fatura-gigante.pdf",
      cardId: "card-1",
      competenceMonth: "2026-11",
      rawFullText: `TOTAL DA FATURA: R$ 150,00\n${bigLines}`,
    });

    expect(aiSpy.mock.calls.length).toBeLessThanOrEqual(3);
    expect(res.aiStatusNotice?.kind).toBe("chunks_truncated");
    expect(res.aiStatusNotice?.message).toMatch(/3 blocos/i);
  });

  it("D5: aborta Vision em andamento imediatamente quando AbortController dispara", async () => {
    const controller = new AbortController();
    const renderWave2Spy = vi.fn(async () => new Blob(["p4"], { type: "image/png" }));

    const aiSpy = vi
      .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
      .mockImplementation(async (args) => {
        if (args.signal?.aborted) {
          return { ok: false, reason: "timeout", fallbackToLocal: true };
        }
        controller.abort();
        return makeVisionResponse([{ desc: "Abortado no meio", cents: 1000 }]);
      });

    const slots = [
      { blob: new Blob(["p1"], { type: "image/png" }), sha256: "1".repeat(64) },
      { blob: new Blob(["p2"], { type: "image/png" }), sha256: "2".repeat(64) },
      { blob: new Blob(["p3"], { type: "image/png" }), sha256: "3".repeat(64) },
      { render: renderWave2Spy, sha256: "4".repeat(64) },
    ];

    const res = await runVisionWavesWithAi({
      slots,
      cardId: "card-1",
      competenceMonth: "2026-11",
      signal: controller.signal,
    });

    expect(aiSpy.mock.calls.length).toBeLessThanOrEqual(3);
    expect(renderWave2Spy).not.toHaveBeenCalled();
    expect(res.wavesExecuted).toBe(1);
  });

  it("D5: pré-checagem availableBatchCalls limita ondas acima do saldo disponível sem chamar páginas excedentes", async () => {
    const aiSpy = vi
      .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
      .mockResolvedValue(makeVisionResponse([{ desc: "Pg", cents: 5000 }], 30000));

    const slots = Array.from({ length: 6 }, (_, i) => ({
      blob: new Blob([`img-${i}`], { type: "image/png" }),
      sha256: String(i + 1).repeat(64),
    }));

    const res = await runVisionWavesWithAi({
      slots,
      cardId: "card-1",
      competenceMonth: "2026-11",
      availableBatchCalls: 3,
    });

    expect(aiSpy).toHaveBeenCalledTimes(3);
    expect(res.wavesExecuted).toBe(1);
  });
});
