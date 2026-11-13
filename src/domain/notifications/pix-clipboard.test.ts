import { describe, it, expect } from "vitest";
import { parseClipboardTransactionCandidate } from "./pix-clipboard";

describe("pix-clipboard (Parser em Cascata da Área de Transferência)", () => {
  it("reconhece Pix Copia e Cola EMV com valor", () => {
    // Payload EMV sintético válido com tag 54 (valor R$ 25,50) e tag 59 (PADARIA CENTRAL)
    const emvPayload =
      "00020126360014br.gov.bcb.pix0114+5511999999999520400005303986540525.505802BR5915PADARIA CENTRAL6009SAO PAULO62070503***6304ABCD";

    const candidate = parseClipboardTransactionCandidate(emvPayload);
    expect(candidate).not.toBeNull();
    expect(candidate?.kind).toBe("emv_code");
    expect(candidate?.valueCents).toBe(2550);
    expect(candidate?.paymentMethod).toBe("pix");
    expect(candidate?.description).toContain("PADARIA CENTRAL");
  });

  it("reconhece comprovante universal de transferência Pix", () => {
    const receiptText = `
Comprovante de Transferência Pix
Valor: R$ 142,80
Data: 12/11/2026
Destinatário: POSTO IPIRANGA LTDA
CPF/CNPJ: 12.345.678/0001-90
Instituição: BANCO ITAU
    `;

    const candidate = parseClipboardTransactionCandidate(receiptText);
    expect(candidate).not.toBeNull();
    expect(candidate?.kind).toBe("receipt");
    expect(candidate?.valueCents).toBe(14280);
    expect(candidate?.paymentMethod).toBe("pix");
  });

  it("retorna null para texto arbitrário ou vazio", () => {
    expect(parseClipboardTransactionCandidate("")).toBeNull();
    expect(parseClipboardTransactionCandidate("Olá, tudo bem com você?")).toBeNull();
  });
});
