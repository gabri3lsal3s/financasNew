import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllColumnMappingCache } from "@/services/statement-mapping-cache";
import * as aiAssistant from "@/services/ai-assistant";
import {
  MAX_STATEMENT_VISION_PAGES_OR_IMAGES,
  deduplicateConsecutiveVisionRows,
  deriveSaltedSha256Hex,
  parseStatementVisionBlobsWithAi,
  parseStatementWithPdfAiFallback,
  readStatementFileContent,
  selectCandidatePdfVisionPages,
} from "./statement-import-helpers";
import type { AiStatementPdfRow } from "../../../../supabase/functions/_shared/ai-schemas";

const mockExtractText = vi.fn();

vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: vi.fn(),
}));

describe("statement-import-helpers — Blindagens Fase 1B (#12, #15, #19, #23, #24 e #25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllColumnMappingCache();
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

  describe("Item #15 — Cache de Colunas Estável entre Meses com Preâmbulo", () => {
    it("reaproveita cache no mês seguinte mesmo quando a linha 0 tem o nome do mês diferente", async () => {
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
      expect(first.isCacheHit).toBe(false);
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
      expect(second.isCacheHit).toBe(true);
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

      const blobs = Array.from({ length: MAX_STATEMENT_VISION_PAGES_OR_IMAGES + 2 }, (_, idx) => ({
        blob: new Blob([`img-${idx}`], { type: "image/png" }),
        sha256: `sha-${idx}`,
      }));

      const res = await parseStatementVisionBlobsWithAi({
        blobs,
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      // Limita chamadas ao teto (3) e avisa sobre truncamento
      expect(spy).toHaveBeenCalledTimes(MAX_STATEMENT_VISION_PAGES_OR_IMAGES);
      expect(res.visionTruncationWarning).toContain("5 imagens");
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

    it("gera SHA-256 hex válido de 64 chars e aplica salt determinístico na reanálise (#8)", async () => {
      const baseSha = "a".repeat(64);
      const plain = await deriveSaltedSha256Hex(baseSha);
      const salted1 = await deriveSaltedSha256Hex(baseSha, "reanalyze:1");
      const salted2 = await deriveSaltedSha256Hex(baseSha, "reanalyze:2");
      const salted1Repeat = await deriveSaltedSha256Hex(baseSha, "reanalyze:1");

      expect(plain).toBe(baseSha);
      expect(salted1).toMatch(/^[a-f0-9]{64}$/);
      expect(salted2).toMatch(/^[a-f0-9]{64}$/);
      expect(salted1).not.toBe(baseSha);
      expect(salted1).not.toBe(salted2);
      expect(salted1).toBe(salted1Repeat);
    });

    it("aborta imediatamente lotes Vision em quota_exceeded sem disparar chamadas restantes (#10)", async () => {
      const spy = vi
        .spyOn(aiAssistant, "extractStatementPdfRowsWithAi")
        .mockResolvedValueOnce({
          ok: false,
          reason: "quota_exceeded",
          fallbackToLocal: true,
          quotaResetAt: "2026-11-25T03:00:00.000Z",
        });

      const blobs = [
        { blob: new Blob(["img-1"], { type: "image/png" }), sha256: "b".repeat(64) },
        { blob: new Blob(["img-2"], { type: "image/png" }), sha256: "c".repeat(64) },
        { blob: new Blob(["img-3"], { type: "image/png" }), sha256: "d".repeat(64) },
      ];

      const res = await parseStatementVisionBlobsWithAi({
        blobs,
        cardId: "card-1",
        competenceMonth: "2026-11",
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.transactions).toHaveLength(0);
      expect(res.aiStatusNotice?.kind).toBe("quota_exceeded");
      expect(res.aiStatusNotice?.message).toMatch(/Limite de IA atingido/i);
    });

    it("seleciona páginas candidatas e aplica micro-trava fallback [1..min(3, totalPages)] para fontes CID corrompidas (#10)", () => {
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

      // Caso 2: 2 páginas com compras -> retorna [2, 3] (> 1 página -> exigirá confirmação inline)
      const twoPages = selectCandidatePdfVisionPages(
        [
          "Capa da fatura sem lancamentos",
          "10/11/2026 Mercado Central 120,00",
          "15/11/2026 Farmacia Popular 55,90",
        ],
        3,
      );
      expect(twoPages).toEqual([2, 3]);

      // Caso 3 (Micro-trava CID): fontes corrompidas com 0 candidatas em PDF de 5 páginas -> [1, 2, 3]
      const cidCorrupted = selectCandidatePdfVisionPages(
        ["### ??? $$$", "@@@ %%%", "&&& ***", "^^^", "~~~"],
        5,
      );
      expect(cidCorrupted).toEqual([1, 2, 3]);

      // Caso 4 (Micro-trava CID): PDF de 2 páginas corrompido -> [1, 2]
      const cidTwoPages = selectCandidatePdfVisionPages(["???", "###"], 2);
      expect(cidTwoPages).toEqual([1, 2]);
    });
  });
});
