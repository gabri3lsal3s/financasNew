import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiAssistant from "@/services/ai-assistant";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
} from "./statement-import-types";
import {
  computeDeterministicSha256Hex,
  readStatementFileContent,
} from "./statement-file-loader";
import { parseStatementWithPdfAiFallback } from "./statement-import-pipeline";
import {
  buildTransactionsFromAiRows,
  deduplicateConsecutiveVisionRows,
  parseStatementVisionBlobsWithAi,
  selectCandidatePdfVisionPages,
} from "./statement-vision-runner";
import type { AiStatementPdfRow } from "../../../../../supabase/functions/_shared/ai-schemas";

const mockExtractText = vi.fn();

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: vi.fn(),
}));

describe("statement-import-helpers — Extratores, SHA-256 Determinístico e Qualidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Item #12 e #23 — Magic Bytes e PDF Híbrido em readStatementFileContent", () => {
    it("classifica PDF híbrido com marca d'água (< 100 chars) como pdf_scanned mesmo sem extensão .pdf", async () => {
      mockExtractText.mockResolvedValueOnce({
        text: "Documento digitalizado - Banco XYZ - Pagina 1 de 2",
        totalPages: 2,
      });

      const pdfBytes = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj");
      const file = new File([pdfBytes], "fatura_sem_extensao", { type: "" });

      const loaded = await readStatementFileContent(file);
      expect(loaded.kind).toBe("pdf_scanned");
    });

    it("classifica PDF com texto longo porém sem nenhum token monetário como pdf_scanned", async () => {
      mockExtractText.mockResolvedValueOnce({
        text: "ESTE DOCUMENTO FOI DIGITALIZADO ELETRONICAMENTE PELO BANCO DIGITAL PARA CONFERENCIA DO TITULAR. AS IMAGENS DAS COMPRAS ESTAO ANEXADAS NESTE ARQUIVO.",
        totalPages: 1,
      });

      const pdfBytes = new TextEncoder().encode("%PDF-1.7\nbody");
      const file = new File([pdfBytes], "fatura-hibrida.pdf", { type: "application/pdf" });

      const loaded = await readStatementFileContent(file);
      expect(loaded.kind).toBe("pdf_scanned");
    });

    it("identifica imagem PNG sem extensão pelos magic bytes em readStatementFileContent (#12)", async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const file = new File([pngBytes], "print_whatsapp_1234", { type: "" });

      const loaded = await readStatementFileContent(file);
      expect(loaded.kind).toBe("image");
    });

    it("identifica planilha HTML sem extensão como spreadsheet pelos magic bytes/cabeçalho (#12)", async () => {
      const html = "<html><body><table><tr><th>Data</th><th>Valor</th></tr><tr><td>10/11/2026</td><td>50,00</td></tr></table></body></html>";
      const file = new File([html], "extrato_banco", { type: "application/octet-stream" });

      const loaded = await readStatementFileContent(file);
      expect(loaded.kind).toBe("spreadsheet");
    });
  });

  describe("D1 — Detecção Determinística de Cabeçalho Real com Preâmbulo entre Meses", () => {
    it("identifica headerRowIndex real mesmo quando a linha 0 tem o nome do mês diferente (0 cache local legado)", async () => {
      const novCsv = [
        "Banco Digital - Fatura de Novembro/2026",
        "Data;Estabelecimento;Valor",
        "10/11/2026;Padaria Estrela;25,00",
        "12/11/2026;Mercado Central;120,00",
      ].join("\n");

      const first = await parseStatementWithPdfAiFallback({
        content: novCsv,
        fileNameOrType: "fatura-nov.csv",
        cardId: "card-1",
        competenceMonth: "2026-11",
      });
      expect(first.extractionOrigin).toBe("local_verified");
      expect(first.mappingConfidence).toBe(100);
      expect(first.mapping.headerRowIndex).toBe(1);
      expect(first.transactions).toHaveLength(2);

      const decCsv = [
        "Banco Digital - Fatura de Dezembro/2026",
        "Data;Estabelecimento;Valor",
        "05/12/2026;Farmacia Popular;48,50",
        "08/12/2026;Restaurante Centro;95,00",
      ].join("\n");

      const second = await parseStatementWithPdfAiFallback({
        content: decCsv,
        fileNameOrType: "fatura-dez.csv",
        cardId: "card-1",
        competenceMonth: "2026-12",
      });
      expect(second.extractionOrigin).toBe("local_verified");
      expect(second.mappingConfidence).toBe(100);
      expect(second.mapping.headerRowIndex).toBe(1);
      expect(second.transactions).toHaveLength(2);
    });
  });

  describe("Item #19 — Metadados Informativos OFX (<LEDGERBAL>, <ORG>, <ACCTID>)", () => {
    it("expõe <LEDGERBAL> como printedTotalCents informativo e identifica final do cartão via <ACCTID>", async () => {
      const ofx = `
OFXHEADER:100
<OFX>
  <SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Teste</FI></SONRS></SIGNONMSGSRSV1>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <CCACCTFROM><ACCTID>4111222233332107</CCACCTFROM>
    <BANKTRANLIST>
      <STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110<TRNAMT>-100.00<MEMO>LOJA A</STMTTRN>
    </BANKTRANLIST>
    <LEDGERBAL><BALAMT>-450.00</LEDGERBAL>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

      const res = await parseStatementWithPdfAiFallback({
        content: ofx,
        fileNameOrType: "fatura.ofx",
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      expect(res.isOfx).toBe(true);
      expect(res.printedTotalCents).toBe(45000);
      expect(res.detectedMeta?.detectedCardLast4).toBe("2107");
    });
  });

  describe("Guarda G4 — Alinhamento estrito via sourceIndex em buildTransactionsFromAiRows", () => {
    it("preserva entryType de linhas subsequentes mesmo quando o parser descarta linhas intermediárias", async () => {
      const { buildTransactionsFromAiRows: buildRows } = await import("./statement-vision-runner");

      const res = buildRows(
        [
          { date: "01/11/2026", description: "SALDO ANTERIOR", amountCents: 50000, entryType: "charge" },
          { date: "05/11/2026", description: "LOJA ALPHA", amountCents: 8990, entryType: "refund" },
          { date: "10/11/2026", description: "PAGAMENTO EFETUADO", amountCents: 50000, entryType: "payment" },
        ],
        {
          cardId: "card-g4",
          competenceMonth: "2026-11",
          closingDay: 15,
        },
      );

      // SALDO ANTERIOR é filtrado pelo pipeline de parser, reduzindo de 3 para 2 linhas
      expect(res.transactions).toHaveLength(2);
      expect(res.transactions[0]?.cleanDescription).toContain("LOJA ALPHA");
      expect(res.transactions[0]?.isRefund).toBe(true);
      expect(res.transactions[0]?.isPayment).toBe(false);
      expect(res.transactions[1]?.cleanDescription).toContain("PAGAMENTO");
      expect(res.transactions[1]?.isPayment).toBe(true);
    });
  });

  describe("Itens #24 e #25 — Deduplicação de Fronteira, Mesclagem de Metadados e Aviso de Truncamento em Prints Vision", () => {
    it("remove duplicatas na fronteira de rolagem entre prints N e N+1 preservando duplicatas genuínas no mesmo print (#24)", () => {
      const makeRow = (
        date: string,
        description: string,
        amountCents: number,
      ): AiStatementPdfRow => ({
        date,
        description,
        amountCents,
        installmentCurrent: null,
        installmentTotal: null,
        entryType: "purchase",
      });

      const page1: AiStatementPdfRow[] = [
        makeRow("2026-11-01", "Café Expresso", 1200),
        makeRow("2026-11-01", "Café Expresso", 1200), // compra genuinamente repetida no mesmo print
        makeRow("2026-11-02", "Padaria Estrela", 2500),
        makeRow("2026-11-03", "Supermercado Dia", 14050),
      ];

      // Print 2 rolou parcialmente e repetiu os 2 últimos lançamentos do print 1 (mesmo sem acento)
      const page2: AiStatementPdfRow[] = [
        makeRow("2026-11-02", "Padaria Estrela", 2500),
        makeRow("2026-11-03", "Supermercado Dia", 14050),
        makeRow("2026-11-04", "Drogaria Raia", 5990),
      ];

      const merged = deduplicateConsecutiveVisionRows([page1, page2]);
      expect(merged).toHaveLength(5);
      expect(merged.map((r) => r.description)).toEqual([
        "Café Expresso",
        "Café Expresso",
        "Padaria Estrela",
        "Supermercado Dia",
        "Drogaria Raia",
      ]);
    });

    it("mescla metadados campo a campo entre prints e emite visionTruncationWarning quando excede o limite (#24 e #25)", async () => {
      const spy = vi.spyOn(aiAssistant, "extractStatementPdfRowsWithAi");
      // Print 1: cabeçalho/resumo com banco e final do cartão, sem linhas de compra
      spy.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_vision",
        data: {
          rows: [],
          detectedCardBrandOrBank: "Nomad",
          detectedCardLast4: "2107",
          detectedCompetenceMonth: "2026-11",
          detectedDueDate: null,
          detectedTotalInvoiceCents: null,
        },
      });
      // Print 2: compras 1 e 2 + vencimento
      spy.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_vision",
        data: {
          rows: [
            {
              date: "2026-11-10",
              description: "Amazon Brasil",
              amountCents: 15000,
              installmentCurrent: null,
              installmentTotal: null,
              entryType: "purchase",
            },
            {
              date: "2026-11-11",
              description: "Uber Trip",
              amountCents: 3500,
              installmentCurrent: null,
              installmentTotal: null,
              entryType: "purchase",
            },
          ],
          detectedCardBrandOrBank: null,
          detectedCardLast4: null,
          detectedCompetenceMonth: null,
          detectedDueDate: "2026-11-20",
          detectedTotalInvoiceCents: null,
        },
      });
      // Print 3: repete Uber Trip (overlap) + adiciona Restaurante + total da fatura no rodapé
      spy.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_vision",
        data: {
          rows: [
            {
              date: "2026-11-11",
              description: "Uber Trip",
              amountCents: 3500,
              installmentCurrent: null,
              installmentTotal: null,
              entryType: "purchase",
            },
            {
              date: "2026-11-12",
              description: "Restaurante Sabor",
              amountCents: 8000,
              installmentCurrent: null,
              installmentTotal: null,
              entryType: "purchase",
            },
          ],
          detectedCardBrandOrBank: null,
          detectedCardLast4: null,
          detectedCompetenceMonth: null,
          detectedDueDate: null,
          detectedTotalInvoiceCents: 26500,
        },
      });
      // Onda 2 (páginas 4..6 até MAX_STATEMENT_VISION_PAGES_OR_IMAGES = 6): vazias no restante do lote
      for (let extra = 0; extra < 3; extra++) {
        spy.mockResolvedValueOnce({
          ok: true,
          cached: false,
          source: "ai_vision",
          data: { rows: [] },
        });
      }

      const blobs = Array.from({ length: MAX_STATEMENT_VISION_PAGES_OR_IMAGES + 2 }, (_, idx) => ({
        blob: new Blob([`img-${idx}`], { type: "image/png" }),
        sha256: `sha-${idx}`,
      }));

      const res = await parseStatementVisionBlobsWithAi({
        blobs,
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      // Limita chamadas ao teto (6 = 2 ondas de 3) e avisa sobre truncamento de 8 enviados
      expect(spy).toHaveBeenCalledTimes(MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
      expect(res.visionTruncationWarning).toContain("8 imagens");
      expect(res.visionTruncationWarning).toContain(String(MAX_STATEMENT_VISION_PAGES_OR_IMAGES));

      // Overlap "Uber Trip" deduplicado: exatamente 3 transações
      expect(res.transactions).toHaveLength(3);
      expect(res.transactions.map((t) => t.cleanDescription)).toEqual([
        "Amazon Brasil",
        "Uber Trip",
        "Restaurante Sabor",
      ]);

      // Metadados mesclados campo a campo dos 3 prints
      expect(res.printedTotalCents).toBe(26500);
      expect(res.detectedMeta?.detectedCardLast4).toBe("2107");
      expect(res.detectedMeta?.detectedDueDate).toBe("2026-11-20");
      expect(res.detectedMeta?.detectedBankBrand).toBe("Nomad");
    });
  });

  describe("Fase 2 — Desempate Contábil (#7), SHA-256 64-hex (#8) e Governança Vision/Cota (#10)", () => {
    it("vence por qualityScore contábil: 11 compras limpas da Nomad (R$ 1.528,54) superam 74 linhas locais degradadas (#7)", async () => {
      // Simula texto degradado que gera 74 linhas locais inválidas (CET, juros, datas sintéticas, outliers)
      const degradedLines = [
        "Despesas e creditos do mes: R$ 1.528,54",
        "Valor da fatura: R$ 1.528,54",
        ...Array.from(
          { length: 74 },
          (_, i) => `10/11/2026\tCET (ano): ${400 + i},50%\t${(1000 + i * 50).toFixed(2).replace(".", ",")}`,
        ),
      ].join("\n");

      const nomadRows: AiStatementPdfRow[] = [
        { date: "2026-10-10", description: "Loja A", amountCents: 54000, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-10", description: "Loja B", amountCents: 33300, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-14", description: "Loja C", amountCents: 15000, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-17", description: "Loja D", amountCents: 1189, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-18", description: "Loja E", amountCents: 26070, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-18", description: "Loja F", amountCents: 4070, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-25", description: "Loja G", amountCents: 2715, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-10-31", description: "Loja H", amountCents: 880, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-11-01", description: "Loja I", amountCents: 8300, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-11-02", description: "Loja J", amountCents: 1600, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
        { date: "2026-11-03", description: "Loja K", amountCents: 5730, installmentCurrent: null, installmentTotal: null, entryType: "purchase" },
      ];
      // Soma exata: 54000+33300+15000+1189+26070+4070+2715+880+8300+1600+5730 = 152854 (R$ 1.528,54)

      const spy = vi
        .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
        .mockResolvedValueOnce({
          ok: true,
          cached: false,
          source: "ai_text",
          data: {
            rows: nomadRows,
            detectedTotalInvoiceCents: 152854,
            detectedCardBrandOrBank: "Nomad",
            detectedCardLast4: "2107",
          },
        });

      const res = await parseStatementWithPdfAiFallback({
        content: degradedLines,
        fileNameOrType: "Nomad_2026-11.pdf",
        cardId: "card-nomad",
        competenceMonth: "2026-11",
        rawFullText: degradedLines,
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.usedAiFallback).toBe(true);
      expect(res.extractionOrigin).toBe("ai_text");
      expect(res.transactions).toHaveLength(11);
      expect(res.qualityGate?.passed).toBe(true);
      expect(res.qualityGate?.score).toBe(100);
      expect(res.qualityGate?.cycleNetCents).toBe(152854);
    });

    it("gera SHA-256 determinístico idêntico em reenvios (custo zero em cache LGPD — D6)", async () => {
      const baseSha = "a".repeat(64);
      const plain1 = await computeDeterministicSha256Hex(baseSha);
      const plain2 = await computeDeterministicSha256Hex(baseSha);
      const scoped1 = await computeDeterministicSha256Hex(baseSha, "spatial-rescue");
      const scoped1Repeat = await computeDeterministicSha256Hex(baseSha, "spatial-rescue");

      expect(plain1).toBe(baseSha);
      expect(plain2).toBe(baseSha);
      expect(scoped1).toMatch(/^[a-f0-9]{64}$/);
      expect(scoped1).not.toBe(baseSha);
      expect(scoped1).toBe(scoped1Repeat);
    });

    it("normaliza linhas de IA via Normalizador Canônico Único preservando sourceIndex (G4), D13 e merchantCleanRaw (G14)", () => {
      const built = buildTransactionsFromAiRows(
        [
          {
            date: "2026-02-31", // data inválida descartada no Estágio 1
            description: "LINHA INVALIDA",
            amountCents: 1000,
            installmentCurrent: null,
            installmentTotal: null,
            entryType: "purchase",
          },
          {
            date: "2026-08-15",
            description: "PAG*Cafeteria Central R$ 45,90",
            amountCents: 4590,
            installmentCurrent: 2,
            installmentTotal: 4,
            entryType: "purchase",
          },
          {
            date: "2026-11-12",
            description: "IOF INTERNACIONAL",
            amountCents: 1200,
            installmentCurrent: null,
            installmentTotal: null,
            entryType: "charge",
          },
        ],
        { cardId: "card-1", competenceMonth: "2026-11", closingDay: 10 },
      );

      expect(built.transactions).toHaveLength(2);
      expect(built.transactions[0]?.sourceIndex).toBe(1);
      expect(built.transactions[0]?.date).toBe("2026-11-15"); // D13
      expect(built.transactions[0]?.originalDate).toBe("2026-08-15");
      expect(built.transactions[0]?.merchantCleanRaw).not.toMatch(/45,90|R\$/);
      expect(built.transactions[1]?.sourceIndex).toBe(2);
      expect(built.transactions[1]?.nature).toBe("fee_or_tax");
    });

    it("rejeita arquivo ZIP comum ou DOCX renomeado sem planilhas OOXML em readStatementFileContent", async () => {
      const fakeZipHeader = new Uint8Array(64);
      fakeZipHeader[0] = 0x50;
      fakeZipHeader[1] = 0x4b;
      fakeZipHeader[2] = 0x03;
      fakeZipHeader[3] = 0x04;
      const entry = new TextEncoder().encode("word/document.xml");
      fakeZipHeader[26] = entry.length;
      fakeZipHeader.set(entry, 30);

      const file = new File([fakeZipHeader], "contrato.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await expect(readStatementFileContent(file)).rejects.toThrow(/Formato compactado/i);
    });

    it("aborta imediatamente lotes Vision em quota_exceeded sem disparar onda 2 nem chamadas sem saldo (#10)", async () => {
      const spy = vi
        .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
        .mockResolvedValue({
          ok: false,
          reason: "quota_exceeded",
          fallbackToLocal: true,
          quotaResetAt: "2026-11-25T03:00:00.000Z",
        });

      const blobs = Array.from({ length: 6 }, (_, idx) => ({
        blob: new Blob([`img-${idx + 1}`], { type: "image/png" }),
        sha256: String.fromCharCode(98 + idx).repeat(64),
      }));

      const res = await parseStatementVisionBlobsWithAi({
        blobs,
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      // Onda 1 (<= 3 chamadas) aborta antes da Onda 2 (0 chamadas na Onda 2)
      expect(spy.mock.calls.length).toBeLessThanOrEqual(3);
      expect(res.transactions).toHaveLength(0);
      expect(res.aiStatusNotice?.kind).toBe("quota_exceeded");
      expect(res.aiStatusNotice?.message).toMatch(/Limite de IA atingido/i);

      spy.mockClear();
      const blockedByPrecheck = await parseStatementVisionBlobsWithAi({
        blobs,
        cardId: "card-1",
        competenceMonth: "2026-11",
        availableBatchCalls: 0,
      });
      expect(spy).not.toHaveBeenCalled();
      expect(blockedByPrecheck.aiStatusNotice?.kind).toBe("quota_exceeded");
    });

    it("seleciona páginas candidatas e aplica fallback até MAX_STATEMENT_VISION_PAGES_OR_IMAGES (6) para fontes CID corrompidas (#10)", () => {
      // Caso 1: Capa na página 1 + tabela de compras apenas na página 2 -> retorna [2] (1 página)
      const onePage = selectCandidatePdfVisionPages(
        [
          "Resumo institucional e codigo de barras sem datas de compra",
          "Extrato Referente ao mes\n10/11/2026 Padaria Estrela 45,00",
          "Informacoes contratuais e canais de atendimento",
        ],
        3,
      );
      expect(onePage).toEqual([2]);

      // Caso 2: 2 páginas com compras -> retorna [2, 3]
      const twoPages = selectCandidatePdfVisionPages(
        [
          "Capa da fatura sem lancamentos",
          "10/11/2026 Mercado Central 120,00",
          "15/11/2026 Farmacia Popular 55,90",
        ],
        3,
      );
      expect(twoPages).toEqual([2, 3]);

      // Caso 3 (Micro-trava CID): 5 páginas corrompidas -> retorna todas [1..5] (<= 6)
      const cidCorrupted5 = selectCandidatePdfVisionPages(
        ["### ??? $$$", "@@@ %%%", "&&& ***", "^^^", "~~~"],
        5,
      );
      expect(cidCorrupted5).toEqual([1, 2, 3, 4, 5]);

      // Caso 4 (Teto 6 páginas D15): 8 páginas corrompidas -> limita a [1..6]
      const cidCorrupted8 = selectCandidatePdfVisionPages(
        ["###", "@@@", "&&&", "^^^", "~~~", "***", "!!!", "???"],
        8,
      );
      expect(cidCorrupted8).toEqual([1, 2, 3, 4, 5, 6]);

      // Caso 5 (Micro-trava CID): PDF de 2 páginas corrompido -> [1, 2]
      const cidTwoPages = selectCandidatePdfVisionPages(["???", "###"], 2);
      expect(cidTwoPages).toEqual([1, 2]);
    });
  });
});
