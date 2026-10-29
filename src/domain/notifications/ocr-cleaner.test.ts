import { describe, expect, it } from "vitest";
import { cleanOcrText } from "./ocr-cleaner";

describe("cleanOcrText", () => {
  it("retorna string vazia para entradas nulas ou vazias", () => {
    expect(cleanOcrText("")).toBe("");
    expect(cleanOcrText("   \n\t  ")).toBe("");
  });

  it("normaliza quebras de linha Windows CRLF e limpa espaços excessivos", () => {
    const raw = "Linha 1\r\n\r\n\r\nLinha 2  com   espacos\r\nLinha 3";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toBe("Linha 1\n\nLinha 2 com espacos\nLinha 3");
  });

  it("corrige substituicao de O e o por zero em valores monetarios", () => {
    const raw = "VALOR: R$ 1O,OO\nTOTAL: RS 1OO,5O";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("VALOR: R$ 10,00");
    expect(cleaned).toContain("TOTAL: R$ 100,50");
  });

  it("corrige substituicao de l e I por um em valores monetarios", () => {
    const raw = "R$ l5,00 e R$ I20,OO";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("R$ 15,00");
    expect(cleaned).toContain("R$ 120,00");
  });

  it("corrige espacos anômalos entre digitos monetarios", () => {
    const raw = "VALOR TOTAL R$ 1 50,00";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("R$ 150,00");
  });

  it("corrige substituicoes opticas em datas brasileiras", () => {
    const raw = "DATA: 28/lO/2026\nEMISSAO: 0l/05/2O26";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("DATA: 28/10/2026");
    expect(cleaned).toContain("EMISSAO: 01/05/2026");
  });

  it("corrige anos com 2 digitos para 4 digitos em datas validas", () => {
    const raw = "TRANSACAO REALIZADA EM 15/08/26";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("TRANSACAO REALIZADA EM 15/08/2026");
  });

  it("corrige caracteres opticos em sequencias de CNPJ", () => {
    const raw = "CNPJ: 12.345.678/OOO1-9O";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toContain("CNPJ/CPF: 12.345.678/0001-90");
  });

  it("preserva caracteres acentuados da lingua portuguesa", () => {
    const raw = "COMPROVANTE DE TRANSFERÊNCIA BANCÁRIA - BENEFICIÁRIO";
    const cleaned = cleanOcrText(raw);
    expect(cleaned).toBe("COMPROVANTE DE TRANSFERÊNCIA BANCÁRIA - BENEFICIÁRIO");
  });
});
