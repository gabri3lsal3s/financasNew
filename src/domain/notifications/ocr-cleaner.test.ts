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

  it("corrige espacos anomalos entre digitos monetarios", () => {
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

  describe("Expansão de Tolerância a Ruídos Ópticos (Fase 5 / Tarefa 5.1)", () => {
    it("converte prefixos monetários danificados (B$, RS, P$, A$, h$, F$, 8$, k$) para R$", () => {
      expect(cleanOcrText("VALOR A PAGAR: B$ 150,00")).toContain("VALOR A PAGAR: R$ 150,00");
      expect(cleanOcrText("TOTAL: P$ 42,90")).toContain("TOTAL: R$ 42,90");
      expect(cleanOcrText("A$ 10,00 NO DEBITO")).toContain("R$ 10,00 NO DEBITO");
      expect(cleanOcrText("h$ 85,00")).toContain("R$ 85,00");
      expect(cleanOcrText("F$ 20,00")).toContain("R$ 20,00");
      expect(cleanOcrText("8$ 50,00")).toContain("R$ 50,00");
      expect(cleanOcrText("k$ 30,00")).toContain("R$ 30,00");
      expect(cleanOcrText("RS 99,90 PAGO")).toContain("R$ 99,90 PAGO");
      expect(cleanOcrText("B$: 350,00")).toContain("R$ 350,00");
      // Preserva moedas estrangeiras legítimas
      expect(cleanOcrText("US$ 15.00")).toContain("US$ 15.00");
    });

    it("repara valores fraturados por espaçamento irregular do OCR", () => {
      expect(cleanOcrText("TOTAL R$ 1. 250, 00")).toContain("TOTAL R$ 1.250,00");
      expect(cleanOcrText("VALOR: 45 , 90")).toContain("VALOR: 45,90");
      expect(cleanOcrText("R$ 1 . 250 , 00")).toContain("R$ 1.250,00");
      expect(cleanOcrText("TOTAL LIQUIDO R$ 10 . 500 , 75")).toContain("TOTAL LIQUIDO R$ 10.500,75");
    });

    it("corrige pontuações acidentais em centavos (apóstrofos, traços e espaços)", () => {
      expect(cleanOcrText("TOTAL A PAGAR R$ 42'90")).toContain("TOTAL A PAGAR R$ 42,90");
      expect(cleanOcrText("VALOR R$ 42-90")).toContain("VALOR R$ 42,90");
      expect(cleanOcrText("TOTAL: R$ 42 90")).toContain("TOTAL: R$ 42,90");
      expect(cleanOcrText("R$ 1.250'50")).toContain("R$ 1.250,50");
    });

    it("remove ruídos de linhas decorativas e bordas pontilhadas de cupons térmicos", () => {
      const rawReceipt = [
        "PADARIA CENTRAL LTDA",
        "- - - - - - - - - - - - - - -",
        "ITEM 001 PAO FRANCES 15,00",
        "* * * * * * * * * * * * * * *",
        "ITEM 002 CAFE EXPRESSO 8,00",
        "=============================",
        "TOTAL A PAGAR R$ 23,00",
        "-----------------------------",
        "VOLTE SEMPRE",
      ].join("\n");

      const cleaned = cleanOcrText(rawReceipt);

      expect(cleaned).not.toContain("- - - - - - - - - - - - - - -");
      expect(cleaned).not.toContain("* * * * * * * * * * * * * * *");
      expect(cleaned).not.toContain("=============================");
      expect(cleaned).not.toContain("-----------------------------");
      expect(cleaned).toContain("PADARIA CENTRAL LTDA");
      expect(cleaned).toContain("TOTAL A PAGAR R$ 23,00");
      expect(cleaned).toContain("VOLTE SEMPRE");
    });
  });
});
