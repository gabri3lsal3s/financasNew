import { describe, expect, it } from "vitest";
import type { SpatialPdfLine } from "@/domain/reconciliation";
import {
  reconstructSpatialReceiptText,
  selectCandidateReceiptVisionPages,
} from "./receipt-spatial-normalizer";

function makeLine(
  text: string,
  y: number,
  xStart: number,
  pageNumber = 1,
): SpatialPdfLine {
  return {
    text,
    y,
    xStart,
    xEnd: xStart + text.length * 6,
    fontSize: 10,
    column: 1,
    pageNumber,
    tokens: [],
  };
}

describe("receipt-spatial-normalizer", () => {
  it("reconstrói linhas visuais em ordem top-down preservando colunas lado a lado", () => {
    const lines: SpatialPdfLine[] = [
      makeLine("Valor do Documento: R$ 420,00", 700, 320, 1),
      makeLine("Beneficiário: Condomínio Parque", 700, 40, 1),
      makeLine("Vencimento: 10/12/2026", 680, 40, 1),
      makeLine("Linha digitável: 34191.09008 12345.678901 23456.789012 1 16420000042000", 500, 40, 2),
    ];

    const reconstructed = reconstructSpatialReceiptText(lines);
    const rows = reconstructed.split("\n");

    expect(rows[0]).toBe("Beneficiário: Condomínio Parque  Valor do Documento: R$ 420,00");
    expect(rows[1]).toBe("Vencimento: 10/12/2026");
    expect(rows[2]).toContain("Linha digitável:");
  });

  it("prioriza página com ficha de compensação/boleto em PDF multi-página", () => {
    const pageTexts = [
      "Demonstrativo mensal de despesas do condomínio. Confira os avisos gerais da assembleia.",
      "Ficha de compensação\nBeneficiário: Condomínio Sol\nVencimento: 15/12/2026\nValor do documento: R$ 650,00\nLinha digitável: 34191.09008 12345.678901 23456.789012 1 16420000065000",
      "Anexo de regras de convivência.",
    ];

    const selected = selectCandidateReceiptVisionPages(pageTexts, 3, 2);
    expect(selected).toEqual([1, 2]);
    expect(selectCandidateReceiptVisionPages(pageTexts, 3, 1)).toEqual([2]);
  });
});
