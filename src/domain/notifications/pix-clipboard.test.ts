import { describe, expect, it } from "vitest";
import { parseClipboardTransactionCandidate } from "./pix-clipboard";
import { computeEMVCRC16 } from "./pix-emv-parser";

function makeEmv(baseWithoutCrc: string): string {
  return `${baseWithoutCrc}${computeEMVCRC16(baseWithoutCrc)}`;
}

describe("parseClipboardTransactionCandidate (Golden Dataset G1, G2 e G3)", () => {
  it("G1a: decodifica Pix Copia e Cola estático com valor e CRC16 válido como PIX_BRCODE", () => {
    const payload = makeEmv(
      "00020126360014br.gov.bcb.pix0114+5511987654321520400005303986540545.005802BR5913CAFE SAO JOSE6009SAO PAULO6304",
    );

    const parsed = parseClipboardTransactionCandidate(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("PIX_BRCODE");
    expect(parsed?.valueCents).toBe(4500);
    expect(parsed?.recipientName).toBe("CAFE SAO JOSE");
    expect(parsed?.pixKey).toBe("+5511987654321");
    expect(parsed?.paymentMethod).toBe("pix");
    expect(parsed?.confidence).toBe("high");
  });

  it("G1b: decodifica Pix Copia e Cola sem Tag 54 com valueCents === 0", () => {
    const payload = makeEmv(
      "00020126360014br.gov.bcb.pix0114182361200001585204000053039865802BR5915PADARIA CENTRAL6008CURITIBA6304",
    );

    const parsed = parseClipboardTransactionCandidate(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("PIX_BRCODE");
    expect(parsed?.valueCents).toBe(0);
    expect(parsed?.recipientName).toBe("PADARIA CENTRAL");
  });

  it("G1c: rejeita EMVCo sem GUI Pix ou com CRC adulterado", () => {
    const tampered =
      "00020126360014br.gov.bcb.pix0114+5511987654321520400005303986540545.005802BR5913CAFE SAO JOSE6009SAO PAULO6304ABCD";
    expect(parseClipboardTransactionCandidate(tampered)).toBeNull();
  });

  it("G3: reconhece chave Pix isolada estrita como PIX_KEY com valueCents === 0", () => {
    const uuidCandidate = parseClipboardTransactionCandidate(
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    );
    expect(uuidCandidate).not.toBeNull();
    expect(uuidCandidate?.kind).toBe("PIX_KEY");
    expect(uuidCandidate?.valueCents).toBe(0);
    expect(uuidCandidate?.pixKeyType).toBe("evp");

    const cpfCandidate = parseClipboardTransactionCandidate("Chave: 123.456.789-09");
    expect(cpfCandidate).not.toBeNull();
    expect(cpfCandidate?.kind).toBe("PIX_KEY");
    expect(cpfCandidate?.valueCents).toBe(0);
    expect(cpfCandidate?.pixKey).toBe("12345678909");
  });

  it("G2: zera falsos positivos em mensagens de WhatsApp, links, números soltos e texto genérico", () => {
    expect(
      parseClipboardTransactionCandidate(
        "Oi! Pode mandar para meu cel (11) 98765-4321 no valor de R$ 50,00?",
      ),
    ).toBeNull();
    expect(parseClipboardTransactionCandidate("https://site.com/artigo-v2.50")).toBeNull();
    expect(parseClipboardTransactionCandidate("123.456.789-00")).toBeNull();
    expect(parseClipboardTransactionCandidate("12.345.678/0001-90")).toBeNull();
    expect(parseClipboardTransactionCandidate("Pedido 45.00 confirmado no estoque")).toBeNull();
    expect(parseClipboardTransactionCandidate("45,00")).toBeNull();
  });

  it("aceita apenas comprovante bancário formal inequívoco como PIX_RECEIPT", () => {
    const formalReceipt = [
      "COMPROVANTE DE TRANSFERENCIA PIX",
      "Valor: R$ 128,40",
      "Data: 14/03/2026",
      "Favorecido: MERCADO BOM PRECO LTDA",
      "Chave Pix: financeiro@mercadobompreco.com.br",
      "ID da transacao: E18236120202603141234s1234567890",
    ].join("\n");

    const parsed = parseClipboardTransactionCandidate(formalReceipt);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe("PIX_RECEIPT");
    expect(parsed?.valueCents).toBe(12840);
    expect(parsed?.pixKey).toBe("financeiro@mercadobompreco.com.br");
  });
});
