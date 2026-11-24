import { describe, expect, it } from "vitest";
import {
  evaluateDeterministicStatementQuality,
  extractPrintedStatementTotalCents,
  preprocessStatementTextForAi,
} from "./statement-preprocessor";
import type { StatementTransaction } from "./types";

function makeTx(overrides: Partial<StatementTransaction> & { id: string; amountCents: number }): StatementTransaction {
  return {
    index: 0,
    occurrenceIndex: 0,
    date: "2026-08-15",
    rawDescription: "Mercado Central",
    cleanDescription: "Mercado Central",
    isRefund: false,
    isPayment: false,
    statementHash: `hash-${overrides.id}`,
    ...overrides,
  };
}

describe("statement-preprocessor (Poda FinOps & Qualidade de Extração)", () => {
  it("extrai o Total da Fatura impresso (mesma linha ou linha seguinte) ignorando mínimo, limite e parcelamento", () => {
    const rawHeader = [
      "Fatura anterior: R$ 1.890,00",
      "Limite disponível: R$ 9.500,00",
      "Pagamento mínimo: R$ 310,00",
      "Valor total desta fatura",
      "R$ 2.450,80",
      "Opções de parcelamento: 12x de R$ 265,00",
    ].join("\n");

    expect(extractPrintedStatementTotalCents(rawHeader)).toBe(245_080);

    const inlineTotal = "Resumo · Total a pagar: R$ 789,45 · Vencimento 12/09/2026";
    expect(extractPrintedStatementTotalCents(inlineTotal)).toBe(78_945);
  });

  it("remove blocos jurídicos, CET, código de barras e simulações de parcelamento preservando compras multilinhas", () => {
    const verboseLegalParagraph =
      "Informacoes regulatorias sobre utilizacao consciente do cartao de credito conforme normas vigentes do Banco Central do Brasil para consumidores pessoa fisica.";
    const rawPdf = [
      "Página 1 de 5",
      "Central de Atendimento 0800 123 4567",
      "23793.38128 60083.013528 56000.063305 9 98760000245080",
      verboseLegalParagraph,
      verboseLegalParagraph,
      "Custo Efetivo Total",
      "Juros do rotativo 14,90% a.m. CET 412,50% a.a.",
      "Opções de parcelamento da fatura: 2x de R$ 1.250,00 | 6x de R$ 450,00 | 12x de R$ 260,00",
      "Lançamentos: Compras nacionais",
      "12 AGO",
      "PADARIA ESTRELA",
      "R$ 42,90",
      "15 AGO",
      "LIVRARIA CULTURA 02/04",
      "R$ 120,00",
      "SAC 0800 999 8888",
      "https://bancoexemplo.com.br/contrato",
    ].join("\n");

    const res = preprocessStatementTextForAi(rawPdf);

    expect(res.compactedChars).toBeLessThan(res.originalChars * 0.45);
    expect(res.compactedText).toContain("PADARIA ESTRELA");
    expect(res.compactedText).toContain("42,90");
    expect(res.compactedText).toContain("LIVRARIA CULTURA 02/04");
    expect(res.compactedText).not.toContain("412,50%");
    expect(res.compactedText).not.toContain("12x de R$");
    expect(res.compactedText).not.toContain("23793.38128");
    expect(res.candidateAmountLineCount).toBe(2);
  });

  it("divide faturas extensas em chunks alinhados por quebra de linha sem truncar lançamentos no meio", () => {
    const lines: string[] = [];
    for (let i = 1; i <= 40; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      lines.push(`${day}/08/2026 | ESTABELECIMENTO COMERCIAL NUMERO ${i} | R$ 100,00`);
    }

    const res = preprocessStatementTextForAi(lines.join("\n"), 800);
    expect(res.chunks.length).toBeGreaterThan(1);
    expect(res.chunks.every((chunk) => chunk.length <= 800)).toBe(true);
    const rejoined = res.chunks.join("\n");
    expect(rejoined).toContain("ESTABELECIMENTO COMERCIAL NUMERO 1");
    expect(rejoined).toContain("ESTABELECIMENTO COMERCIAL NUMERO 40");
  });

  it("reprova falso positivo parcial em PDF multi-coluna (low_line_coverage / scrambled_columns) e aprova CSV limpo", () => {
    const partialPdfQuality = evaluateDeterministicStatementQuality({
      rawText: "multi coluna",
      transactions: [makeTx({ id: "1", amountCents: 3500 }), makeTx({ id: "2", amountCents: 4900 })],
      candidateAmountLineCount: 9,
      printedTotalCents: 98_000,
      isStructuredTabularFile: false,
    });
    expect(partialPdfQuality.isSufficient).toBe(false);
    expect(partialPdfQuality.reason).toBe("low_line_coverage");

    const scrambledQuality = evaluateDeterministicStatementQuality({
      rawText: "colunas trocadas",
      transactions: [
        makeTx({ id: "1", amountCents: 5000, cleanDescription: "Transação" }),
        makeTx({ id: "2", amountCents: 7000, cleanDescription: "Transação" }),
      ],
      candidateAmountLineCount: 2,
      printedTotalCents: null,
      isStructuredTabularFile: false,
    });
    expect(scrambledQuality.isSufficient).toBe(false);
    expect(scrambledQuality.reason).toBe("scrambled_columns");

    const cleanCsvQuality = evaluateDeterministicStatementQuality({
      rawText: "csv",
      transactions: [makeTx({ id: "1", amountCents: 3500 })],
      candidateAmountLineCount: 10,
      printedTotalCents: null,
      isStructuredTabularFile: true,
    });
    expect(cleanCsvQuality.isSufficient).toBe(true);
  });
});
