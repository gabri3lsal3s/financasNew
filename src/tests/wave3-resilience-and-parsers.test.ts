import { describe, expect, it } from "vitest";
import { parseBcbSgsResponse } from "@/domain/portfolio/quotes";
import { extractDateFromText, parseNumberClean } from "@/domain/portfolio/import-parser";
import { decodeBufferToString } from "@/domain/reconciliation/extractors/csv-extractor";
import { extractOfxMetadata } from "@/domain/reconciliation/extractors/ofx-extractor";
import { parseAmountToCents } from "@/domain/reconciliation/extractors/type-sniffer";
import { fetchHistoricalMonthlyQuotes } from "@/services/quotes";

describe("Wave 3 — Parsers, BCB & Async Resilience", () => {
  it("T3.3: preserva sinal negativo em R$ -20,00 e rejeita números malformados", () => {
    expect(parseAmountToCents("R$ -20,00")).toEqual({
      amountCents: 2000,
      isNegative: true,
      isCreditSuffix: undefined,
      isDebitSuffix: undefined,
    });
    expect(parseAmountToCents("1,23,45")).toBeNull();
    expect(parseAmountToCents("123XYZ")).toBeNull();
  });

  it("T3.3: parseNumberClean trata $1,234.56 e rejeita 123XYZ", () => {
    expect(parseNumberClean("$1,234.56")).toBe(1234.56);
    expect(parseNumberClean("1.250,50")).toBe(1250.5);
    expect(parseNumberClean("123XYZ")).toBe(0);
    expect(parseNumberClean("1,23,45")).toBe(0);
  });

  it("T3.3: extractDateFromText rejeita data civil impossível e converte serial Excel", () => {
    expect(extractDateFromText("31/02/2026").dateStr).toBe("");
    expect(extractDateFromText("46000").dateStr).toBe("2025-12-09");
  });

  it("T3.3: decodeBufferToString decodifica UTF-16LE BOM sem NULs", () => {
    const text = "Data;Valor\n";
    const buf = new ArrayBuffer(2 + text.length * 2);
    const view = new Uint8Array(buf);
    view[0] = 0xff;
    view[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      view[2 + i * 2] = text.charCodeAt(i);
      view[2 + i * 2 + 1] = 0;
    }
    const decoded = decodeBufferToString(buf);
    expect(decoded).toBe(text);
    expect(decoded).not.toContain("\u0000");
  });

  it("T3.3: extractOfxMetadata preserva BALAMT negativo", () => {
    const ofx = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><LEDGERBAL><BALAMT>-123.45</BALAMT></LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
    expect(extractOfxMetadata(ofx).ledgerBalanceCents).toBe(-12345);
  });

  it("T3.4: parseBcbSgsResponse preserva IPCA baixo/negativo quando unit='annual'", () => {
    expect(parseBcbSgsResponse([{ data: "01/10/2026", valor: "0.1" }], "annual")?.rateAnnual).toBe(0.1);
    expect(parseBcbSgsResponse([{ data: "01/10/2026", valor: "-0.2" }], "annual")?.rateAnnual).toBe(-0.2);
  });

  it("T3.2: fetchHistoricalMonthlyQuotes aborta transporte na troca de mês sem vazar estado", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchHistoricalMonthlyQuotes(["PETR4"], "2026-01", {
        existingHistoryRows: [],
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("T3.2: fetchHistoricalMonthlyQuotes reusa existingHistoryRows em memória sem chamar banco", async () => {
    const result = await fetchHistoricalMonthlyQuotes(["PETR4"], "2026-01", {
      existingHistoryRows: [{ ticker: "PETR4", price: 38.5, currency: "BRL" }],
    });
    expect(result).toEqual([
      {
        ticker: "PETR4",
        price: 38.5,
        currency: "BRL",
        source: "api",
        marketPriceAt: null,
        provider: null,
      },
    ]);
  });
});
