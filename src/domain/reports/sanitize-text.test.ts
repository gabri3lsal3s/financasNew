import { describe, it, expect } from "vitest";
import { sanitizeReportText } from "./sanitize-text";

describe("sanitizeReportText", () => {
  it("normaliza hífens Unicode especiais para hífens ASCII padrão", () => {
    // Non-breaking hyphen \u2011
    expect(sanitizeReportText("CDB\u2011BMG\u2011JAN27")).toBe("CDB-BMG-JAN27");
    // En-dash \u2013
    expect(sanitizeReportText("TESOURO\u2013IPCA\u201329")).toBe("TESOURO-IPCA-29");
    // Em-dash \u2014
    expect(sanitizeReportText("TESOURO\u2014PREFIXADO")).toBe("TESOURO-PREFIXADO");
    // Minus sign \u2212
    expect(sanitizeReportText("ATIVO\u2212X")).toBe("ATIVO-X");
  });

  it("normaliza espaços especiais para espaços padrão", () => {
    // Non-breaking space \u00A0
    expect(sanitizeReportText("10\u00A0cotas")).toBe("10 cotas");
    // Narrow no-break space \u202F
    expect(sanitizeReportText("R$\u202F100,00")).toBe("R$ 100,00");
  });

  it("remove caracteres invisíveis e zero-width", () => {
    // Zero-width space \u200B
    expect(sanitizeReportText("BBAS3\u200B")).toBe("BBAS3");
    // BOM \uFEFF
    expect(sanitizeReportText("\uFEFFITSA4")).toBe("ITSA4");
  });

  it("lida com valores nulos, vazios ou indefinidos com segurança", () => {
    expect(sanitizeReportText("")).toBe("");
    expect(sanitizeReportText(null)).toBe("");
    expect(sanitizeReportText(undefined)).toBe("");
  });

  it("mantém strings ASCII padrão inalteradas", () => {
    expect(sanitizeReportText("PETR4")).toBe("PETR4");
    expect(sanitizeReportText("HGLG11 - Fundo Imobiliário")).toBe("HGLG11 - Fundo Imobiliário");
  });
});
