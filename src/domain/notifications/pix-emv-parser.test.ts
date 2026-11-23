import { describe, expect, it } from "vitest";
import {
  computeEMVCRC16,
  parseEMVAmountToCents,
  parseEMVTLV,
  parsePixEMVPayload,
  validateEMVCRC16,
} from "./pix-emv-parser";

const UTF8_ENCODER = new TextEncoder();

function buildTlv(tag: string, value: string): string {
  const byteLength = UTF8_ENCODER.encode(value).length;
  return `${tag}${String(byteLength).padStart(2, "0")}${value}`;
}

function buildValidPixEmv(options: {
  accountTag?: string;
  gui?: string;
  pixKey?: string;
  customDesc?: string;
  dynamicUrl?: string;
  amount?: string;
  merchant?: string;
  city?: string;
  txId?: string;
}): string {
  const accountSubtags = [
    buildTlv("00", options.gui ?? "br.gov.bcb.pix"),
    options.pixKey ? buildTlv("01", options.pixKey) : "",
    options.customDesc ? buildTlv("02", options.customDesc) : "",
    options.dynamicUrl ? buildTlv("25", options.dynamicUrl) : "",
  ].join("");

  const parts = [
    buildTlv("00", "01"),
    buildTlv(options.accountTag ?? "26", accountSubtags),
    buildTlv("52", "0000"),
    buildTlv("53", "986"),
    options.amount !== undefined ? buildTlv("54", options.amount) : "",
    buildTlv("58", "BR"),
    buildTlv("59", options.merchant ?? "CAFE SAO JOSE"),
    buildTlv("60", options.city ?? "SAO PAULO"),
    options.txId ? buildTlv("62", buildTlv("05", options.txId)) : "",
  ].join("");

  const withTag63Prefix = `${parts}6304`;
  return `${withTag63Prefix}${computeEMVCRC16(withTag63Prefix)}`;
}

describe("pix-emv-parser (Decodificação EMVCo & CRC16-CCITT UTF-8)", () => {
  it("calcula e valida checksum CRC16-CCITT UTF-8 oficial", () => {
    const validPayload = buildValidPixEmv({
      pixKey: "financeiro@cafesaojose.com.br",
      amount: "45.00",
      merchant: "CAFÉ SÃO JOSÉ",
      city: "SÃO PAULO",
      txId: "TX9988",
    });

    expect(validateEMVCRC16(validPayload)).toBe(true);
    expect(validateEMVCRC16(`${validPayload.slice(0, -4)}0000`)).toBe(false);
    expect(validateEMVCRC16("00020126360014br.gov.bcb.pix6304ABCD")).toBe(false);
  });

  it("interpreta TLV e converte Tag 54 para centavos inteiros", () => {
    const sample = "000201520400005303986540550.005802BR";
    const tlv = parseEMVTLV(sample);

    expect(tlv["00"]).toBe("01");
    expect(tlv["52"]).toBe("0000");
    expect(tlv["53"]).toBe("986");
    expect(tlv["54"]).toBe("50.00");
    expect(tlv["58"]).toBe("BR");

    expect(parseEMVAmountToCents("45.00")).toBe(4500);
    expect(parseEMVAmountToCents("1500.5")).toBe(150050);
    expect(parseEMVAmountToCents("0.00")).toBe(0);
    expect(parseEMVAmountToCents("abc")).toBeNull();
  });

  it("decodifica BR Code estático com valor (G1a) e caracteres UTF-8 acentuados nas Tags 59/60", () => {
    const payload = buildValidPixEmv({
      pixKey: "+5511987654321",
      amount: "45.00",
      merchant: "CAFÉ SÃO JOSÉ",
      city: "SÃO PAULO",
      txId: "PEDIDO123",
    });

    const parsed = parsePixEMVPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(4500);
    expect(parsed?.pixKey).toBe("+5511987654321");
    expect(parsed?.recipientName).toBe("CAFÉ SÃO JOSÉ");
    expect(parsed?.city).toBe("SÃO PAULO");
    expect(parsed?.txId).toBe("PEDIDO123");
    expect(parsed?.paymentMethod).toBe("pix");
  });

  it("decodifica BR Code estático SEM Tag 54 com amountCents === 0 (G1b)", () => {
    const payload = buildValidPixEmv({
      pixKey: "18236120000158",
      merchant: "PADARIA CENTRAL",
      city: "CURITIBA",
    });

    const parsed = parsePixEMVPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(0);
    expect(parsed?.pixKey).toBe("18236120000158");
    expect(parsed?.recipientName).toBe("PADARIA CENTRAL");
  });

  it("decodifica QR Code dinâmico com Tag 26.25 sem subtag 01 (G1c) e varre Tags 26..51", () => {
    const payload = buildValidPixEmv({
      accountTag: "27",
      dynamicUrl: "pix.example.com/qr/v2/cob/9d36b84f",
      amount: "129.90",
      merchant: "LOJA MODELO",
      city: "BELO HORIZONTE",
    });

    const parsed = parsePixEMVPayload(payload);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(12990);
    expect(parsed?.dynamicUrl).toBe("pix.example.com/qr/v2/cob/9d36b84f");
    expect(parsed?.pixKey).toBeUndefined();
    expect(parsed?.recipientName).toBe("LOJA MODELO");
  });

  it("extrai payload válido encapsulado com quebras \\r\\n e ruído ao redor (G1d)", () => {
    const cleanPayload = buildValidPixEmv({
      pixKey: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      amount: "89.90",
      merchant: "MERCADO SUL",
      city: "PORTO ALEGRE",
    });

    const midpoint = Math.floor(cleanPayload.length / 2);
    const wrapped = `Segue o Pix Copia e Cola abaixo:\r\n${cleanPayload.slice(0, midpoint)}\r\n${cleanPayload.slice(midpoint)}\r\nValido ate hoje!`;

    const parsed = parsePixEMVPayload(wrapped);
    expect(parsed).not.toBeNull();
    expect(parsed?.amountCents).toBe(8990);
    expect(parsed?.pixKey).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(parsed?.rawText).toBe(cleanPayload);
  });

  it("rejeita payload adulterado, CRC inválido (6304ABCD) ou sem GUI br.gov.bcb.pix", () => {
    const valid = buildValidPixEmv({
      pixKey: "+5511987654321",
      amount: "50.00",
    });
    const tamperedAmount = valid.replace("540550.00", "540590.00");
    const fakeCrc = `${valid.slice(0, -4)}ABCD`;
    const wrongGui = buildValidPixEmv({
      gui: "com.outro.arranjo",
      pixKey: "+5511987654321",
      amount: "50.00",
    });

    expect(parsePixEMVPayload(tamperedAmount)).toBeNull();
    expect(parsePixEMVPayload(fakeCrc)).toBeNull();
    expect(parsePixEMVPayload(wrongGui)).toBeNull();
  });
});
