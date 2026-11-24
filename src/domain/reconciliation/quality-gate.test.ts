import { describe, expect, it } from "vitest";
import { evaluateStatementExtractionQuality } from "./quality-gate";
import {
  extractTransactionsFromSpatialLines,
  parseTextToRows,
  sniffColumnMapping,
  type SpatialPdfLine,
} from "./parsers";
import {
  extractPrintedStatementTotalCents,
  extractStatementSummaryAmounts,
} from "./statement-preprocessor";
import { detectStatementMetadata } from "./statement-metadata";
import type { StatementTransaction } from "./types";

function makeTx(overrides: Partial<StatementTransaction> = {}): StatementTransaction {
  return {
    id: "tx-1",
    index: 0,
    occurrenceIndex: 0,
    date: "2026-10-15",
    rawDescription: "MERCADO CENTRAL",
    cleanDescription: "MERCADO CENTRAL",
    amountCents: 10000,
    isRefund: false,
    isPayment: false,
    statementHash: "hash-1",
    nature: "purchase",
    ...overrides,
  };
}

function makeSpatialLine(pageNumber: number, y: number, text: string): SpatialPdfLine {
  return {
    pageNumber,
    y,
    xStart: 40,
    xEnd: 500,
    fontSize: 10,
    column: 1,
    text,
    tokens: [],
  };
}

describe("Fase 1A — Quality Gate Duplo, Blindagens #1–#6/#11 e Regressão Nomad", () => {
  describe("evaluateStatementExtractionQuality (Equação Contábil Dupla + Micro-trava)", () => {
    it("aprova extração íntegra fechando no centavo contra Despesas e créditos do mês (cycle_net)", () => {
      const result = evaluateStatementExtractionQuality({
        transactions: [
          makeTx({ amountCents: 100000 }),
          makeTx({ id: "tx-2", amountCents: 52854 }),
        ],
        officialTotalCents: 152854,
        cycleNetTargetCents: 152854,
        previousBalanceCents: 0,
        paymentsCents: 0,
      });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.checksumEquation).toBe("cycle_net");
      expect(result.diffCents).toBe(0);
    });

    it("aplica (saldoAnterior - pagamentosFatura) somente quando saldoAnterior > 0 (micro-trava)", () => {
      // Caso 1: saldoAnterior = 500,00, pagamentos = 200,00 -> carryOver = +300,00
      // Compras do mês = 1.000,00 -> Valor da fatura = 1.300,00
      const partialPaid = evaluateStatementExtractionQuality({
        transactions: [makeTx({ amountCents: 100000 })],
        officialTotalCents: 130000,
        previousBalanceCents: 50000,
        paymentsCents: 20000,
      });
      expect(partialPaid.passed).toBe(true);
      expect(partialPaid.statementBalanceCents).toBe(130000);
      expect(partialPaid.diffCents).toBe(0);

      // Caso 2: pagamento a maior sobre saldoAnterior > 0 (saldoAnterior = 500,00, pagamentos = 700,00 -> crédito de -200,00)
      // Compras do mês = 1.000,00 -> Valor da fatura = 800,00
      const overpaidCredit = evaluateStatementExtractionQuality({
        transactions: [makeTx({ amountCents: 100000 })],
        officialTotalCents: 80000,
        previousBalanceCents: 50000,
        paymentsCents: 70000,
      });
      expect(overpaidCredit.passed).toBe(true);
      expect(overpaidCredit.statementBalanceCents).toBe(80000);
      expect(overpaidCredit.diffCents).toBe(0);

      // Caso 3: saldoAnterior === 0 -> carryOver DEVE ser 0 mesmo que pagamentosCents > 0
      const zeroPrev = evaluateStatementExtractionQuality({
        transactions: [makeTx({ amountCents: 100000 })],
        officialTotalCents: 100000,
        previousBalanceCents: 0,
        paymentsCents: 150000,
      });
      expect(zeroPrev.passed).toBe(true);
      expect(zeroPrev.statementBalanceCents).toBe(100000);
    });

    it("reprova excesso absurdo (checksum_overflow + outlier_amount), descrições degradadas e datas sintéticas", () => {
      const result = evaluateStatementExtractionQuality({
        transactions: [
          makeTx({ date: "2026-11-24", cleanDescription: "2026-11-24", amountCents: 4769230200 }),
          makeTx({ id: "tx-2", date: "2026-11-24", cleanDescription: "Transação", amountCents: 4968000 }),
          makeTx({ id: "tx-3", date: "2026-11-24", cleanDescription: "CET (mês): 14,83%", amountCents: 1483 }),
        ],
        officialTotalCents: 152854,
        referenceTodayIso: "2026-11-24",
      });

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(30);
      expect(result.reasons).toContain("checksum_overflow");
      expect(result.reasons).toContain("degraded_descriptions");
      expect(result.reasons).toContain("synthetic_dates");
      expect(result.reasons).toContain("outlier_amount");
    });

    it("não reprova OFX estruturado por divergência em <LEDGERBAL> (informativo)", () => {
      const result = evaluateStatementExtractionQuality({
        transactions: [makeTx({ amountCents: 50000 })],
        officialTotalCents: 150000,
        isOfx: true,
      });

      expect(result.passed).toBe(true);
      expect(result.reasons).not.toContain("checksum_underflow");
    });
  });

  describe("Item #4 — sniffColumnMapping não colide descriptionColIndex com dateColIndex", () => {
    it("mantém descriptionColIndex distinto de dateColIndex em tabela de 3 colunas com ruído na coluna 2", () => {
      const rows = [
        { rowIndex: 0, rawText: "2026-11-24\tD\t76,43", cells: ["2026-11-24", "D", "76,43"] },
        { rowIndex: 1, rawText: "2026-11-24\tD\t14,83", cells: ["2026-11-24", "D", "14,83"] },
        { rowIndex: 2, rawText: "2026-11-24\tD\t13,99", cells: ["2026-11-24", "D", "13,99"] },
        { rowIndex: 3, rawText: "2026-11-24\tD\t1.667,45", cells: ["2026-11-24", "D", "1.667,45"] },
      ];
      const mapping = sniffColumnMapping(rows);
      expect(mapping.dateColIndex).toBe(0);
      expect(mapping.amountColIndex).toBe(2);
      expect(mapping.descriptionColIndex).toBe(1);
      expect(mapping.descriptionColIndex).not.toBe(mapping.dateColIndex);
      expect(mapping.typeColIndex).toBeUndefined();
    });
  });

  describe("Regressão Real — Fatura Nomad (3 páginas, 11 compras = R$ 1.528,54)", () => {
    const nomadLines: SpatialPdfLine[] = [
      // Página 1 — Topo com simulações e parcelamentos (armadilha de pause_zone e Total a pagar)
      makeSpatialLine(1, 800, "NOMAD"),
      makeSpatialLine(1, 790, "Nome: Titular Teste"),
      makeSpatialLine(1, 780, "Cartão: **** **** **** 2107 VISA"),
      makeSpatialLine(1, 770, "Limite de crédito total: R$ 11.000,00"),
      makeSpatialLine(1, 760, "Data de vencimento 15/11/2026"),
      makeSpatialLine(1, 750, "Mês de referência: Novembro"),
      makeSpatialLine(1, 740, "Valor da fatura R$ 1.528,54"),
      makeSpatialLine(1, 710, "Outras formas de pagar sua fatura"),
      makeSpatialLine(1, 700, "Pagamento mínimo do período: R$ 76,43"),
      makeSpatialLine(1, 690, "CET (mês): 14,83% | CET (ano): 425,72%"),
      makeSpatialLine(1, 680, "Taxa (mês): 13,99% | Taxa (ano): 391,90%"),
      makeSpatialLine(1, 670, "Valor não pago (R$ 1.452,11) + encargos (R$ 215,35)"),
      makeSpatialLine(1, 660, "*Este valor é uma simulação caso seja feito apenas o pagamento mínimo."),
      makeSpatialLine(1, 640, "Parcelamentos para aliviar seu bolso"),
      makeSpatialLine(1, 630, "Valor de entrada: R$ 811,52 +"),
      makeSpatialLine(1, 620, "1x R$ 811,52"),
      makeSpatialLine(1, 610, "Total a pagar: R$ 1.623,04"),
      makeSpatialLine(1, 600, "CET do período: 351,00%"),
      makeSpatialLine(1, 560, "Resumo da sua fatura"),
      makeSpatialLine(1, 550, "Saldo da fatura anterior R$ 0,00"),
      makeSpatialLine(1, 540, "Pagamentos efetuados R$ 0,00"),
      makeSpatialLine(1, 530, "Despesas e créditos do mês R$ 1.528,54"),
      makeSpatialLine(1, 520, "Valor da fatura R$ 1.528,54"),
      makeSpatialLine(1, 480, "Extrato Referente ao mês de Novembro de 2026"),
      makeSpatialLine(1, 460, "Cartão - Titular Teste **** **** **** 7756"),
      makeSpatialLine(1, 440, "Data Descrição Valor"),
      makeSpatialLine(1, 420, "10/10/2026 AlexandraNunesDa NOSSA SENHORA BR R$ 540,00"),
      makeSpatialLine(1, 400, "10/10/2026 MERCADINHO JCOSTA NOSSA SENHORA BR R$ 333,00"),
      makeSpatialLine(1, 380, "14/10/2026 COMERCIALNUNESLTD NOSSA SENHORA BR R$ 35,00"),
      makeSpatialLine(1, 360, "15/10/2026 COMERCIALNUNESLTD NOSSA SENHORA BR R$ 179,99"),
      makeSpatialLine(1, 100, "Canais de contato (11) 4200-0204 - support@nomadglobal.com"),
      // Página 2 — Continuação das 7 compras + tabela de Taxas
      makeSpatialLine(2, 760, "Data Descrição Valor"),
      makeSpatialLine(2, 740, "17/10/2026 DeliciasDaVovo ARACAJU BR R$ 11,00"),
      makeSpatialLine(2, 720, "18/10/2026 BOLICHE ARACAJU Aracaju BR R$ 260,70"),
      makeSpatialLine(2, 700, "18/10/2026 ADJ ARACAJU DRIVE JARD ARACAJU BR R$ 40,70"),
      makeSpatialLine(2, 680, "25/10/2026 EMPORIO DO PAES NOSSA SENHORA BR R$ 27,15"),
      makeSpatialLine(2, 660, "31/10/2026 BarbaraConceicao RECIFE BR R$ 8,00"),
      makeSpatialLine(2, 640, "01/11/2026 JIM.COM VINICOLA TANGA BONITO BR R$ 83,00"),
      makeSpatialLine(2, 620, "02/11/2026 POLO COMERCIAL ESTACIO CARUARU BR R$ 10,00"),
      makeSpatialLine(2, 540, "Taxas Taxa ao mês (%) Taxa ao ano (%) CET ao mês (%)"),
      makeSpatialLine(2, 520, "Parcelamento de Fatura 11,99 296,60 12,63 316,82 11,99"),
      makeSpatialLine(2, 500, "Juros de atraso 13,99 391,90 14,83 425,72 13,99"),
      makeSpatialLine(2, 480, "Mora de atraso 1,00 12,87 1,00"),
      // Página 3 — Boleto bancário com Nosso Número e CEP
      makeSpatialLine(3, 760, "Pagamento da fatura"),
      makeSpatialLine(3, 740, "341-7 34191094796923022854118195640000916320000000000"),
      makeSpatialLine(3, 720, "Data Documento 06/11/2026 Vencimento 15/11/2026"),
      makeSpatialLine(3, 700, "Nosso número 109/47692302-6 Valor do documento 1.528,54"),
      makeSpatialLine(3, 660, "49680-000 Nossa Senhora da Gloria - SE"),
      makeSpatialLine(3, 640, "CPF/CNPJ 06956356546"),
    ];

    const nomadRawText = nomadLines.map((l) => l.text).join("\n");

    it("extrai exatamente as 11 compras somando R$ 1.528,54 com Quality Gate Score 100 e 0 ruído", () => {
      const { transactions } = extractTransactionsFromSpatialLines(nomadLines, {
        cardId: "card-nomad",
        competenceMonth: "2026-11",
      });

      expect(transactions).toHaveLength(11);
      const totalCents = transactions.reduce((acc, tx) => acc + tx.amountCents, 0);
      expect(totalCents).toBe(152854);

      // Nenhuma linha de CET, simulação, CEP ou Nosso Número
      expect(transactions.some((t) => /cet|taxa|mora|juros|47692302|49680/i.test(t.rawDescription))).toBe(false);

      // Hierarquia de total oficial: captura R$ 1.528,54 (NÃO R$ 1.623,04 do parcelamento)
      const printedTotal = extractPrintedStatementTotalCents(nomadRawText);
      expect(printedTotal).toBe(152854);

      const summary = extractStatementSummaryAmounts(nomadRawText);
      expect(summary.invoiceTotalCents).toBe(152854);
      expect(summary.cycleNetTargetCents).toBe(152854);
      expect(summary.previousBalanceCents).toBe(0);
      expect(summary.paymentsCents).toBe(0);

      // Quality Gate aprova com nota máxima
      const quality = evaluateStatementExtractionQuality({
        transactions,
        officialTotalCents: summary.invoiceTotalCents,
        cycleNetTargetCents: summary.cycleNetTargetCents,
        previousBalanceCents: summary.previousBalanceCents,
        paymentsCents: summary.paymentsCents,
      });
      expect(quality.passed).toBe(true);
      expect(quality.score).toBe(100);
      expect(quality.diffCents).toBe(0);

      // Metadados reconhecem Nomad, 2026-11 e ambos os cartões (2107 titular e 7756 virtual)
      const metaTitular = detectStatementMetadata({
        rawText: nomadRawText,
        transactions,
        activeCompetenceMonth: "2026-11",
        card: { name: "Nomad", last_four_digits: "2107", closing_day: 8, due_day: 15 },
        printedTotalCents: printedTotal,
      });
      expect(metaTitular.detectedBankBrand).toBe("Nomad");
      expect(metaTitular.detectedCompetenceMonth).toBe("2026-11");
      expect(metaTitular.hasCompetenceMismatch).toBe(false);
      expect(metaTitular.hasCardMismatch).toBe(false);

      const metaVirtual = detectStatementMetadata({
        rawText: nomadRawText,
        transactions,
        activeCompetenceMonth: "2026-11",
        card: { name: "Nomad", last_four_digits: "7756", closing_day: 8, due_day: 15 },
        printedTotalCents: printedTotal,
      });
      expect(metaVirtual.hasCardMismatch).toBe(false);
    });

    it("em modo strict_statement, text-parser não inventa todayISO nem lê CET/CEP/Nosso Número", () => {
      const rows = parseTextToRows(nomadRawText, 2026, { mode: "strict_statement" });
      const rawJoined = rows.map((r) => r.rawText).join("\n");
      expect(rawJoined).not.toMatch(/cet|47692302|49680|1\.623,04|1\.452,11/i);
      expect(rows.length).toBeGreaterThanOrEqual(11);
    });
  });
});
