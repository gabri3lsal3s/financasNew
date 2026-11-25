import { describe, expect, it } from "vitest";
import type { RawExtractedEntry } from "./contracts";
import {
  normalizeRawEntries,
  sanitizeMerchantRawForLearning,
} from "./normalize-entries";

function makeRawEntry(overrides: Partial<RawExtractedEntry> = {}): RawExtractedEntry {
  return {
    sourceIndex: 0,
    rawDate: "10/11",
    merchantRaw: "PADARIA ESTRELA",
    rawLine: "10/11 PADARIA ESTRELA 45,90",
    amountCents: 4590,
    isNegative: false,
    sourceKind: "spatial_pdf",
    ...overrides,
  };
}

describe("normalize-entries — Normalizador Canônico Único (G1–G5, D13, G14)", () => {
  it("rejeita datas inválidas de calendário real (G1: 31/02, 29/02/2026) e aceita ano bissexto (29/02/2028)", () => {
    const entries: RawExtractedEntry[] = [
      makeRawEntry({ sourceIndex: 0, rawDate: "31/02", merchantRaw: "LOJA A" }),
      makeRawEntry({ sourceIndex: 1, rawDate: "29/02", merchantRaw: "LOJA B" }),
      makeRawEntry({ sourceIndex: 2, rawDate: "15/02", merchantRaw: "LOJA VALIDA" }),
    ];

    const txs2026 = normalizeRawEntries(entries, {
      cardId: "card-1",
      competenceMonth: "2026-02",
    });
    expect(txs2026).toHaveLength(1);
    expect(txs2026[0]?.cleanDescription).toBe("LOJA VALIDA");
    expect(txs2026[0]?.date).toBe("2026-02-15");

    const txs2028 = normalizeRawEntries(
      [makeRawEntry({ sourceIndex: 0, rawDate: "29/02", merchantRaw: "LOJA BISSEXTO" })],
      { cardId: "card-1", competenceMonth: "2028-02" },
    );
    expect(txs2028).toHaveLength(1);
    expect(txs2028[0]?.date).toBe("2028-02-29");
  });

  it("ancora janela circular de ano DD/MM no ciclo do cartão (G2: 15/12 em 2026-11 vira 2025-12-15)", () => {
    const entries: RawExtractedEntry[] = [
      makeRawEntry({
        sourceIndex: 0,
        rawDate: "15/12",
        merchantRaw: "NOTEBOOK PRO 12/12",
        amountCents: 30000,
      }),
      makeRawEntry({
        sourceIndex: 1,
        rawDate: "15/05",
        merchantRaw: "GELADEIRA 12/12",
        amountCents: 20000,
      }),
    ];

    // Parcelas 12/12 compradas 1 mês após compMonth no ano anterior
    const novCycle = normalizeRawEntries([entries[0]!], {
      cardId: "card-1",
      competenceMonth: "2026-11",
      closingDay: 10,
    });
    expect(novCycle).toHaveLength(1);
    // D13 alinha effectiveDate para 2026-11 mantendo originalDate = 2025-12-15!
    expect(novCycle[0]?.originalDate).toBe("2025-12-15");
    expect(novCycle[0]?.date).toBe("2026-11-15");

    const aprCycle = normalizeRawEntries([entries[1]!], {
      cardId: "card-1",
      competenceMonth: "2026-04",
      closingDay: 10,
    });
    expect(aprCycle).toHaveLength(1);
    expect(aprCycle[0]?.originalDate).toBe("2025-05-15");
    expect(aprCycle[0]?.date).toBe("2026-04-15");
  });

  it("preserva domínio exclusivo de cartão (G3) sem converter verbos de receita em crédito e trata estorno explícito", () => {
    const entries: RawExtractedEntry[] = [
      makeRawEntry({ sourceIndex: 0, merchantRaw: "PIX RECEBIDO CLIENTE", amountCents: 15000 }),
      makeRawEntry({ sourceIndex: 1, merchantRaw: "SALARIO MENSAL", amountCents: 20000 }),
      makeRawEntry({
        sourceIndex: 2,
        merchantRaw: "ESTORNO LOJA CENTRO",
        amountCents: 5000,
        isNegative: true,
      }),
      makeRawEntry({
        sourceIndex: 3,
        merchantRaw: "PAGAMENTO DE FATURA",
        amountCents: 90000,
        isNegative: true,
      }),
    ];

    const txs = normalizeRawEntries(entries, {
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(4);
    expect(txs[0]?.isRefund).toBe(false);
    expect(txs[0]?.isPayment).toBe(false);
    expect(txs[1]?.isRefund).toBe(false);
    expect(txs[2]?.isRefund).toBe(true);
    expect(txs[2]?.nature).toBe("refund");
    expect(txs[3]?.isPayment).toBe(true);
    expect(txs[3]?.isRefund).toBe(false);
  });

  it("infere polaridade invertida (negative_purchase) quando compras vêm negativas e pagamento positivo", () => {
    const entries: RawExtractedEntry[] = [
      makeRawEntry({ sourceIndex: 0, merchantRaw: "MERCADO A", amountCents: 5000, isNegative: true }),
      makeRawEntry({ sourceIndex: 1, merchantRaw: "FARMACIA B", amountCents: 3000, isNegative: true }),
      makeRawEntry({
        sourceIndex: 2,
        merchantRaw: "PAGAMENTO DE FATURA",
        amountCents: 8000,
        isNegative: false,
      }),
    ];

    const txs = normalizeRawEntries(entries, {
      cardId: "card-1",
      competenceMonth: "2026-11",
      defaultSignHint: "auto",
    });

    expect(txs).toHaveLength(3);
    expect(txs[0]?.isRefund).toBe(false);
    expect(txs[1]?.isRefund).toBe(false);
    expect(txs[2]?.isPayment).toBe(true);
  });

  it("preserva sourceIndex após descartes (G4), sanitiza merchantCleanRaw (G14) e desambigua occurrenceIndex", () => {
    const entries: RawExtractedEntry[] = [
      makeRawEntry({ sourceIndex: 0, merchantRaw: "SUBTOTAL FATURA", amountCents: 99900 }), // ruído descartado
      makeRawEntry({ sourceIndex: 1, rawDate: "31/02", merchantRaw: "DATA INVALIDA", amountCents: 1000 }), // descartada
      makeRawEntry({
        sourceIndex: 4,
        rawDate: "10/11",
        merchantRaw: "PAG*Cafeteria Central R$ 24,50 10/11/2026",
        amountCents: 2450,
      }),
      makeRawEntry({
        sourceIndex: 5,
        rawDate: "10/11",
        merchantRaw: "PAG*Cafeteria Central R$ 24,50 10/11/2026",
        amountCents: 2450,
      }),
    ];

    const txs = normalizeRawEntries(entries, {
      cardId: "card-1",
      competenceMonth: "2026-11",
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]?.sourceIndex).toBe(4);
    expect(txs[1]?.sourceIndex).toBe(5);
    expect(txs[0]?.occurrenceIndex).toBe(0);
    expect(txs[1]?.occurrenceIndex).toBe(1);
    expect(txs[0]?.statementHash).not.toBe(txs[1]?.statementHash);
    expect(txs[0]?.merchantCleanRaw).not.toMatch(/24,50|10\/11\/2026|R\$/);
    expect(sanitizeMerchantRawForLearning("UBER *TRIP R$ 35,90 12/11")).toBe("UBER *TRIP");
  });
});
