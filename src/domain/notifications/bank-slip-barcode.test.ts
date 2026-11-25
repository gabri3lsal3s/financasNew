import { describe, expect, it } from "vitest";
import {
  decodeFebrabanDueDate,
  formatDigitableLine,
  modulo10,
  modulo11Arrecadacao,
  modulo11Febraban,
  parseBankSlipDigitableLine,
} from "./bank-slip-barcode";

/** Constrói linha digitável Febraban (47 dígitos) matematicamente válida para testes. */
function buildValidFebraban47(params: {
  bankCode: string;
  dueFactor: number;
  amountCents: number;
}): string {
  const free25 = "1234567890123456789012345";
  const factorStr = String(params.dueFactor).padStart(4, "0");
  const amountStr = String(params.amountCents).padStart(10, "0");
  const base43 = `${params.bankCode}9${factorStr}${amountStr}${free25}`;
  const dvGeneral = modulo11Febraban(base43);

  const c1 = `${params.bankCode}9${free25.slice(0, 5)}`;
  const dv1 = modulo10(c1);
  const c2 = free25.slice(5, 15);
  const dv2 = modulo10(c2);
  const c3 = free25.slice(15, 25);
  const dv3 = modulo10(c3);

  return `${c1}${dv1}${c2}${dv2}${c3}${dv3}${dvGeneral}${factorStr}${amountStr}`;
}

/** Constrói linha digitável de arrecadação/concessionária (48 dígitos) válida em Módulo 10. */
function buildValidArrecadacao48(params: {
  segmentCode: string;
  amountCents: number;
}): string {
  const amountStr = String(params.amountCents).padStart(11, "0");
  const free29 = "12345678901234567890123456789";
  const base43 = `8${params.segmentCode}6${amountStr}${free29}`;
  const dvGeneral = modulo10(base43);
  const barcode44 = `8${params.segmentCode}6${dvGeneral}${amountStr}${free29}`;

  const blocks = [
    barcode44.slice(0, 11),
    barcode44.slice(11, 22),
    barcode44.slice(22, 33),
    barcode44.slice(33, 44),
  ];

  return blocks.map((b) => `${b}${modulo10(b)}`).join("");
}

describe("bank-slip-barcode — Decodificador Febraban & Arrecadação", () => {
  it("decodifica linha digitável Febraban 47 dígitos válida (valor, vencimento pós-2025 e banco)", () => {
    // Fator 1000 = 2025-02-22; 1000 + 642 = 1642 -> 2026-11-26
    const digits = buildValidFebraban47({
      bankCode: "341",
      dueFactor: 1642,
      amountCents: 35490,
    });
    const formatted = formatDigitableLine(digits);
    const decoded = parseBankSlipDigitableLine(formatted, new Date("2026-11-25T12:00:00Z"));

    expect(decoded).not.toBeNull();
    expect(decoded?.kind).toBe("febraban");
    expect(decoded?.isValidChecksum).toBe(true);
    expect(decoded?.bankCode).toBe("341");
    expect(decoded?.bankName).toBe("Itaú");
    expect(decoded?.amountCents).toBe(35490);
    expect(decoded?.dueDate).toBe("2026-11-26");
  });

  it("respeita o ciclo pré-2025 quando o boleto é histórico (ex.: fator 9999 -> 2025-02-21)", () => {
    expect(decodeFebrabanDueDate(9999, new Date("2026-11-25T12:00:00Z"))).toBe("2025-02-21");
    expect(decodeFebrabanDueDate(1000, new Date("2026-11-25T12:00:00Z"))).toBe("2025-02-22");
  });

  it("detecta dígito verificador adulterado em linha digitável de 47 dígitos", () => {
    const valid = buildValidFebraban47({
      bankCode: "237",
      dueFactor: 1600,
      amountCents: 12000,
    });
    const lastChar = valid.endsWith("0") ? "1" : "0";
    const tampered = `${valid.slice(0, -1)}${lastChar}`;
    const decoded = parseBankSlipDigitableLine(tampered, new Date("2026-11-25T12:00:00Z"));

    expect(decoded).not.toBeNull();
    expect(decoded?.isValidChecksum).toBe(false);
  });

  it("decodifica guia de arrecadação/concessionária de 48 dígitos válida", () => {
    const digits48 = buildValidArrecadacao48({
      segmentCode: "3",
      amountCents: 24785,
    });
    const formatted = formatDigitableLine(digits48);
    const decoded = parseBankSlipDigitableLine(formatted);

    expect(decoded).not.toBeNull();
    expect(decoded?.kind).toBe("arrecadacao");
    expect(decoded?.isValidChecksum).toBe(true);
    expect(decoded?.amountCents).toBe(24785);
    expect(decoded?.segmentCode).toBe("3");
    expect(decoded?.segmentLabel).toContain("Energia");
  });

  it("calcula corretamente Módulo 11 de arrecadação nos casos de borda 0, 1 e 10", () => {
    expect(modulo11Arrecadacao("00000000000")).toBe(0);
    expect(modulo11Arrecadacao("00000000005")).toBe(1);
  });
});
