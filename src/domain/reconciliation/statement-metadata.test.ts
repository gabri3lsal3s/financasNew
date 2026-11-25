import { describe, expect, it } from "vitest";
import { detectStatementMetadata } from "./statement-metadata";
import type { StatementTransaction } from "./contracts";

function mockTx(date: string, amountCents = 5000, isPayment = false): StatementTransaction {
  return {
    id: `stmt-${date}-${Math.random()}`,
    index: 0,
    occurrenceIndex: 0,
    date,
    rawDescription: "Compra Exemplo",
    cleanDescription: "Compra Exemplo",
    amountCents,
    isRefund: false,
    isPayment,
    statementHash: "hash-mock",
  };
}

describe("detectStatementMetadata", () => {
  it("detecta competência explícita e vencimento a partir do texto do cabeçalho da fatura", () => {
    const rawText = `
      Nubank Pagamentos S.A.
      Fatura de Novembro de 2026
      Vencimento: 10/11/2026
      Cartão final: 4821
      Total a pagar: R$ 1.540,20
    `;

    const meta = detectStatementMetadata({
      rawText,
      activeCompetenceMonth: "2026-11",
      card: {
        name: "Nubank Ultravioleta",
        last_four_digits: "4821",
        closing_day: 3,
        due_day: 10,
      },
    });

    expect(meta.detectedCompetenceMonth).toBe("2026-11");
    expect(meta.competenceInferenceSource).toBe("explicit_header");
    expect(meta.competenceConfidence).toBe("high");
    expect(meta.detectedDueDate).toBe("2026-11-10");
    expect(meta.detectedCardLast4).toBe("4821");
    expect(meta.detectedBankBrand).toBe("Nubank");
    expect(meta.hasCompetenceMismatch).toBe(false);
    expect(meta.hasCardMismatch).toBe(false);
  });

  it("identifica discrepância de competência quando o arquivo é de outro mês", () => {
    const rawText = `
      Banco Itaú S.A.
      Fatura 10/2026
      Data de vencimento: 15/10/2026
      Cartão: **** **** **** 9012
    `;

    const meta = detectStatementMetadata({
      rawText,
      activeCompetenceMonth: "2026-12", // Usuário abriu em Dezembro
      card: {
        name: "Itaú Click",
        last_four_digits: "9012",
        closing_day: 8,
        due_day: 15,
      },
    });

    expect(meta.detectedCompetenceMonth).toBe("2026-10");
    expect(meta.hasCompetenceMismatch).toBe(true);
    expect(meta.competenceMismatchWarning).toContain("2026-10");
    expect(meta.competenceMismatchWarning).toContain("2026-12");
  });

  it("infere a competência estatisticamente pelas datas das transações e dia de fechamento do cartão", () => {
    // Fatura sem cabeçalho explícito (ex.: CSV simples)
    // Com closing_day = 25:
    // Compras em 2026-10-26 a 2026-11-24 pertencem à competência 2026-11
    const txs: StatementTransaction[] = [
      mockTx("2026-10-26"),
      mockTx("2026-10-28"),
      mockTx("2026-11-05"),
      mockTx("2026-11-12"),
      mockTx("2026-11-20"),
      mockTx("2026-10-15"), // 1 compra atrasada da competência anterior
    ];

    const meta = detectStatementMetadata({
      rawText: "",
      transactions: txs,
      activeCompetenceMonth: "2026-12", // Usuário abriu em Dezembro por engano
      card: {
        name: "C6 Carbon",
        closing_day: 25,
        due_day: 5,
      },
    });

    expect(meta.detectedCompetenceMonth).toBe("2026-11");
    expect(meta.competenceInferenceSource).toBe("transactions_distribution");
    expect(meta.competenceConfidence).toBe("high");
    expect(meta.hasCompetenceMismatch).toBe(true);
  });

  it("detecta divergência quando os 4 últimos dígitos do cartão impresso diferem do cartão selecionado", () => {
    const rawText = `
      Cartão final 7788
      Fatura de Dezembro/2026
    `;

    const meta = detectStatementMetadata({
      rawText,
      activeCompetenceMonth: "2026-12",
      card: {
        name: "XP Visa Infinite",
        last_four_digits: "1234",
      },
    });

    expect(meta.hasCardMismatch).toBe(true);
    expect(meta.cardMismatchWarning).toContain("7788");
    expect(meta.cardMismatchWarning).toContain("1234");
  });

  it("detecta divergência quando o emissor da fatura é de outro banco incompatível com o cartão", () => {
    const rawText = `
      Santander Brasil S.A.
      Extrato de Cartão de Crédito
      Fatura Novembro/2026
    `;

    const meta = detectStatementMetadata({
      rawText,
      activeCompetenceMonth: "2026-11",
      card: {
        name: "Nubank PJ",
      },
    });

    expect(meta.hasCardMismatch).toBe(true);
    expect(meta.cardMismatchWarning).toContain("Santander");
    expect(meta.cardMismatchWarning).toContain("Nubank PJ");
  });

  it("mescla metadados enriquecidos vindos da Micro-IA", () => {
    const meta = detectStatementMetadata({
      rawText: "",
      activeCompetenceMonth: "2026-11",
      aiDetectedMeta: {
        detectedCompetenceMonth: "2026-11",
        detectedDueDate: "2026-11-25",
        detectedCardLast4: "5544",
        detectedCardBrandOrBank: "Inter",
        detectedTotalInvoiceCents: 450000,
      },
      card: {
        name: "Banco Inter Gold",
        last_four_digits: "5544",
      },
    });

    expect(meta.detectedCompetenceMonth).toBe("2026-11");
    expect(meta.detectedDueDate).toBe("2026-11-25");
    expect(meta.detectedCardLast4).toBe("5544");
    expect(meta.detectedBankBrand).toBe("Inter");
    expect(meta.detectedTotalCents).toBe(450000);
    expect(meta.hasCompetenceMismatch).toBe(false);
    expect(meta.hasCardMismatch).toBe(false);
  });

  it("não dispara falso conflito de competência quando due_day < closing_day e compras pertencem ao mês ativo", () => {
    const rawText = `
      Banco Rico
      Fatura de Dezembro 2026
      Vencimento: 05/12/2026
    `;
    const txs: StatementTransaction[] = [
      mockTx("2026-11-05"),
      mockTx("2026-11-12"),
      mockTx("2026-11-18"),
    ];

    const meta = detectStatementMetadata({
      rawText,
      transactions: txs,
      activeCompetenceMonth: "2026-11",
      card: {
        name: "Rico Visa",
        closing_day: 25,
        due_day: 5,
      },
    });

    expect(meta.hasCompetenceMismatch).toBe(false);
    expect(meta.detectedCompetenceMonth).toBe("2026-11");
  });

  it("não dispara falso alerta de cartão diferente quando há múltiplos finais no extrato (físico + virtual)", () => {
    const rawText = `
      Cartão: **** **** **** 1111 VISA
      Cartão Virtual: **** **** **** 2107 VISA
    `;

    const meta = detectStatementMetadata({
      rawText,
      activeCompetenceMonth: "2026-11",
      card: {
        name: "Rico Visa",
        last_four_digits: "2107",
      },
    });

    expect(meta.hasCardMismatch).toBe(false);
  });
});
