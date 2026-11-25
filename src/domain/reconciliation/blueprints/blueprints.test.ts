import { describe, expect, it } from "vitest";
import {
  BUILTIN_STATEMENT_BLUEPRINTS,
  SHADOW_REPLAY_MIN_SCORE,
  StructuralMarkerSchema,
  computeStatementFingerprint,
  distillStatementBlueprintDraft,
  findBestStatementBlueprint,
  fromCloudBlueprintRow,
  sanitizeMarkerPhrase,
  toCloudBlueprintRules,
  validateBlueprintWithShadowReplay,
  type StatementLayoutBlueprint,
} from "./index";
import type { SpatialPdfLine } from "../extractors/spatial-pdf-extractor";
import type { StatementTransaction } from "../contracts";

function makeTx(
  id: string,
  date: string,
  desc: string,
  amountCents: number,
  overrides?: Partial<StatementTransaction>,
): StatementTransaction {
  return {
    id,
    index: 0,
    occurrenceIndex: 0,
    date,
    rawDescription: desc,
    cleanDescription: desc,
    amountCents,
    isRefund: false,
    isPayment: false,
    statementHash: `hash-${id}`,
    ...overrides,
  };
}

describe("blueprints — Fingerprint Estável, Catálogo Nativo, Learner e Shadow Replay (Fase 3)", () => {
  describe("1. Fingerprint Estável e Zero PII", () => {
    it("gera o mesmo fingerprint entre meses diferentes removendo PII, dígitos, meses, anos, moedas e nomes próprios", () => {
      const invoiceNov = [
        "Banco Horizonte S.A.",
        "Fatura Mensal - Novembro de 2026",
        "Titular: JOAO CARLOS DA SILVA",
        "CPF: 123.456.789-00 | E-mail: joao@exemplo.com",
        "Cartao final 9876",
        "Valor da fatura: R$ 420,50",
        "Movimento Exclusivo do Cartao",
        "10/11/2026 Padaria Estrela 120,50",
        "15/11/2026 Mercado Central 300,00",
      ].join("\n");

      const invoiceDec = [
        "Banco Horizonte S.A.",
        "Fatura Mensal - Dezembro de 2026",
        "Titular: MARIA OLIVEIRA SOUZA",
        "CPF: 987.654.321-11 | E-mail: maria@outro.com",
        "Cartao final 4321",
        "Valor da fatura: R$ 1.890,00",
        "Movimento Exclusivo do Cartao",
        "05/12/2026 Farmacia Popular 890,00",
        "12/12/2026 Supermercado Dia 1.000,00",
      ].join("\n");

      const fpNov = computeStatementFingerprint({
        rawText: invoiceNov,
        fileKind: "pdf_text",
        fileName: "BancoHorizonte_Nov_2026.pdf",
      });
      const fpDec = computeStatementFingerprint({
        rawText: invoiceDec,
        fileKind: "pdf_text",
        fileName: "BancoHorizonte_Dez_2026.pdf",
      });

      expect(fpNov.issuerKey).toBe("banco_horizonte");
      expect(fpDec.issuerKey).toBe("banco_horizonte");
      expect(fpNov.exactFingerprint).toBe(fpDec.exactFingerprint);
      expect(fpNov.fallbackFingerprint).toBe("pdf:banco_horizonte");
      expect(fpDec.fallbackFingerprint).toBe("pdf:banco_horizonte");

      // Zero PII ou datas/meses vazando no fingerprint ou nos tokens estruturais
      const joined = `${fpNov.exactFingerprint} ${fpNov.structuralTokens.join(" ")}`;
      expect(joined).not.toMatch(/joao|silva|maria|oliveira|123|987|9876|novembro|dezembro|2026|exemplo/i);
    });

    it("sanitiza marcadores para 2–6 tokens estruturais sem PII, números ou meses", () => {
      expect(sanitizeMarkerPhrase("Titular: João da Silva CPF 123.456.789-00")).toBeNull();
      expect(sanitizeMarkerPhrase("10/11/2026 Padaria Estrela 45,00")).toBeNull();
      expect(sanitizeMarkerPhrase("Extrato Referente ao mês de Novembro/2026")).toBe(
        "extrato referente mes",
      );
      expect(sanitizeMarkerPhrase("Movimento Exclusivo do Cartão - Ciclo 11/2026")).toBe(
        "movimento exclusivo cartao ciclo",
      );
    });
    it("rejeita dígitos, e-mails (@) e URLs no StructuralMarkerSchema (paridade SQL 0156)", () => {
      expect(StructuralMarkerSchema.safeParse("lancamentos compras").success).toBe(true);
      expect(StructuralMarkerSchema.safeParse("cpf 123456").success).toBe(false);
      expect(StructuralMarkerSchema.safeParse("contato@banco.com").success).toBe(false);
      expect(StructuralMarkerSchema.safeParse("https://banco.com").success).toBe(false);
    });

    it("converte ida e volta entre row da nuvem (StatementLayoutBlueprintRow) e StatementLayoutBlueprint", () => {
      const bp = fromCloudBlueprintRow({
        id: "cloud-uuid-1",
        fingerprint: "pdf:sicredi:abc12345",
        issuer_key: "sicredi",
        issuer_name: "Sicredi",
        file_kind: "pdf_text",
        scope: "global",
        status: "active",
        rules_json: {
          startMarkers: ["lancamentos do cartao"],
          pauseMarkers: ["resumo de encargos"],
          boletoMarkers: ["ficha de compensacao"],
          totalLabels: ["total da fatura"],
          ignoredTotalLabels: ["pagamento minimo"],
          columnMode: "single",
          strictStartZone: true,
          polarity: "positive_purchase",
          dateFormatHint: "dmy",
        },
        exact_checksum_hits: 5,
        distinct_users_verified: 3,
        distinct_users_failed: 0,
        consecutive_failures: 0,
        updated_at: "2026-11-24T12:00:00.000Z",
      });

      expect(bp).not.toBeNull();
      expect(bp?.origin).toBe("global_active");
      expect(bp?.cloudId).toBe("cloud-uuid-1");
      expect(bp?.dateFormatHint).toBe("dmy");
      expect(toCloudBlueprintRules(bp!)).toMatchObject({
        startMarkers: ["lancamentos do cartao"],
        dateFormatHint: "dmy",
        strictStartZone: true,
      });

      const suspendedBp = fromCloudBlueprintRow({
        id: "cloud-uuid-2",
        fingerprint: "pdf:sicredi:abc12345",
        issuer_key: "sicredi",
        issuer_name: "Sicredi",
        file_kind: "pdf_text",
        scope: "user",
        status: "suspended",
        rules_json: {},
        exact_checksum_hits: 1,
        distinct_users_verified: 1,
        distinct_users_failed: 1,
        consecutive_failures: 2,
        updated_at: "2026-11-24T12:00:00.000Z",
      });
      const fp = computeStatementFingerprint({
        rawText: "Sicredi\nFatura\nlancamentos",
        fileKind: "pdf_text",
      });
      // Suspended blueprint must NOT be selected
      expect(
        findBestStatementBlueprint({
          fingerprint: fp,
          learnedBlueprints: suspendedBp ? [suspendedBp] : [],
          fileKind: "pdf_text",
        }),
      ).toBeNull();
    });
  });

  describe("2. Catálogo Nativo e Precedência no Matcher", () => {
    it("contém blueprints nativos válidos para os 13 emissores obrigatórios", () => {
      const keys = new Set(BUILTIN_STATEMENT_BLUEPRINTS.map((bp) => bp.issuerKey));
      for (const expected of [
        "nomad",
        "xp",
        "rico",
        "clear",
        "nubank",
        "itau",
        "bradesco",
        "santander",
        "inter",
        "c6",
        "btg",
        "bb",
        "caixa",
      ]) {
        expect(keys.has(expected)).toBe(true);
      }
    });

    it("aplica precedência estrita user_verified -> global_active -> builtin e fallback em 2 níveis", () => {
      const fp = computeStatementFingerprint({
        rawText: "Nomad Cartao de Credito\nExtrato Referente ao mes\nValor da fatura: R$ 100,00",
        fileKind: "pdf_text",
      });

      const base: StatementLayoutBlueprint = {
        version: 1,
        fingerprint: fp.exactFingerprint,
        issuerKey: "nomad",
        issuerName: "Nomad",
        fileKind: "pdf_text",
        origin: "global_active",
        pdfRules: {
          startMarkers: ["extrato referente"],
          pauseMarkers: [],
          boletoMarkers: [],
          totalLabels: [],
          ignoredTotalLabels: [],
          columnMode: "single",
          strictStartZone: false,
          requireExplicitDatePerLine: true,
        },
        polarity: "positive_purchase",
        dateFormatHint: "dmy",
        currencyStrategy: "brl_rightmost",
        stats: {
          uses: 2,
          exactChecksumHits: 2,
          consecutiveFailures: 0,
          updatedAt: "2026-11-15T10:00:00.000Z",
        },
      };

      const userBp: StatementLayoutBlueprint = {
        ...base,
        fingerprint: "pdf:nomad:differenthash",
        origin: "user_verified",
      };

      // user_verified (mesmo por fallback de emissor) vence global_active e builtin
      const matchUser = findBestStatementBlueprint({
        fingerprint: fp,
        learnedBlueprints: [base, userBp],
        fileKind: "pdf_text",
      });
      expect(matchUser?.blueprint.origin).toBe("user_verified");
      expect(matchUser?.matchLevel).toBe("issuer_fallback");

      // Se global_active tiver consecutiveFailures >= 2, é ignorado (self-healing) e cai para builtin
      const failingGlobalBp: StatementLayoutBlueprint = {
        ...base,
        stats: { ...base.stats, consecutiveFailures: 2 },
      };
      const matchFallbackBuiltin = findBestStatementBlueprint({
        fingerprint: fp,
        learnedBlueprints: [failingGlobalBp],
        fileKind: "pdf_text",
      });
      expect(matchFallbackBuiltin?.blueprint.origin).toBe("builtin");
    });
  });

  describe("3. BlueprintLearner, Bloqueio Vision Frágil e Shadow Replay", () => {
    it("bloqueia destilação de pdfRules quando a extração veio de Vision pura com anchorMatchRate < 0.8", () => {
      const rawLines = [
        "Banco Digital Inedito",
        "Documento digitalizado sem camada de texto alinhada",
      ];
      const txs = [
        makeTx("1", "2026-11-10", "Padaria Estrela", 5000),
        makeTx("2", "2026-11-12", "Supermercado Dia", 12000),
      ];

      const result = distillStatementBlueprintDraft({
        rawText: rawLines.join("\n"),
        rawLines,
        extractedTransactions: txs,
        fileKind: "pdf_text",
        extractionSource: "ai_vision",
        officialTotalCents: 17000,
      });

      expect(result.blueprint).toBeNull();
      expect(result.anchorMatchRate).toBeLessThan(0.8);
      expect(result.skippedReason).toBe("fragile_vision_low_anchor_rate");
    });

    it("destila blueprint limpo de banco inédito e aprova no Shadow Replay com score 100", () => {
      const rawLines = [
        "Banco Horizonte S.A.",
        "Titular: JOAO CARLOS DA SILVA",
        "CPF: 123.456.789-00",
        "01/11/2026 Limite pre aprovado vigente 15.000,00",
        "Valor da fatura: R$ 420,50",
        "Movimento Exclusivo Cartao Titular",
        "10/11/2026 Padaria Estrela 120,50",
        "12/11/2026 Mercado Central 200,00",
        "15/11/2026 Farmacia Popular 100,00",
        "Resumo Programa Fidelidade Bonus",
        "30/11/2026 Pontos acumulados ciclo 250,00",
      ];

      const aiExtracted = [
        makeTx("1", "2026-11-10", "Padaria Estrela", 12050),
        makeTx("2", "2026-11-12", "Mercado Central", 20000),
        makeTx("3", "2026-11-15", "Farmacia Popular", 10000),
      ];

      const distilled = distillStatementBlueprintDraft({
        rawText: rawLines.join("\n"),
        rawLines,
        extractedTransactions: aiExtracted,
        fileKind: "pdf_text",
        extractionSource: "ai_text",
        officialTotalCents: 42050,
      });

      expect(distilled.blueprint).not.toBeNull();
      expect(distilled.anchorMatchRate).toBe(1);
      expect(distilled.blueprint?.pdfRules?.strictStartZone).toBe(true);
      expect(distilled.blueprint?.pdfRules?.startMarkers).toContain(
        "movimento exclusivo cartao titular",
      );
      expect(distilled.blueprint?.pdfRules?.pauseMarkers).toContain(
        "resumo programa fidelidade bonus",
      );

      // Zero PII nos marcadores destilados
      const bpJson = JSON.stringify(distilled.blueprint);
      expect(bpJson).not.toMatch(/joao|silva|123\.456|15\.000/i);

      // Shadow Replay determinístico deve reproduzir exatamente as 3 compras = R$ 420,50 (score 100)
      const replay = validateBlueprintWithShadowReplay({
        blueprint: distilled.blueprint!,
        rawLines,
        cardId: "card-horizonte",
        competenceMonth: "2026-11",
        officialTotalCents: 42050,
      });

      expect(replay.passed).toBe(true);
      expect(replay.qualityGate.score).toBe(100);
      expect(replay.qualityGate.diffCents).toBe(0);
      expect(replay.transactions).toHaveLength(3);
    });

    it("Shadow Replay bloqueia blueprint inválido que vaza ruído e estoura o Checksum", () => {
      const rawLines = [
        "Banco Horizonte S.A.",
        "01/11/2026 Limite pre aprovado vigente 15.000,00",
        "Valor da fatura: R$ 420,50",
        "10/11/2026 Padaria Estrela 120,50",
        "12/11/2026 Mercado Central 300,00",
      ];

      const badBlueprint: StatementLayoutBlueprint = {
        version: 1,
        fingerprint: "pdf:banco_horizonte:bad12345",
        issuerKey: "banco_horizonte",
        issuerName: "Banco Horizonte",
        fileKind: "pdf_text",
        origin: "ai_learned",
        pdfRules: {
          startMarkers: [],
          pauseMarkers: [],
          boletoMarkers: [],
          totalLabels: [],
          ignoredTotalLabels: [],
          columnMode: "single",
          strictStartZone: false,
          requireExplicitDatePerLine: true,
        },
        polarity: "positive_purchase",
        dateFormatHint: "dmy",
        currencyStrategy: "brl_rightmost",
        stats: {
          uses: 1,
          exactChecksumHits: 0,
          consecutiveFailures: 0,
          updatedAt: "2026-11-15T10:00:00.000Z",
        },
      };

      const replay = validateBlueprintWithShadowReplay({
        blueprint: badBlueprint,
        rawLines,
        cardId: "card-horizonte",
        competenceMonth: "2026-11",
        officialTotalCents: 42050,
      });

      // Vazou a linha de 15.000,00 -> checksum_overflow + outlier -> bloqueado!
      expect(replay.passed).toBe(false);
      expect(replay.qualityGate.score).toBeLessThan(SHADOW_REPLAY_MIN_SCORE);
    });

    it("executa Shadow Replay REAL sobre SpatialPdfLine[] preservando pageNumber/fontSize e exige score >= 90", () => {
      expect(SHADOW_REPLAY_MIN_SCORE).toBe(90);

      const spatialLines: SpatialPdfLine[] = [
        { y: 780, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "Banco Horizonte S.A.", tokens: [] },
        { y: 760, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "Movimento Exclusivo Cartao Titular", tokens: [] },
        { y: 740, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "10/11/2026 Padaria Estrela 120,50", tokens: [] },
        { y: 720, xStart: 40, xEnd: 300, fontSize: 10, column: 1, pageNumber: 1, text: "12/11/2026 Mercado Central 300,00", tokens: [] },
        { y: 40, xStart: 40, xEnd: 300, fontSize: 5.5, column: 1, pageNumber: 1, text: "15/11/2026 Nota Rodape Pequena 99,00", tokens: [] },
      ];

      const distilled = distillStatementBlueprintDraft({
        rawText: spatialLines.map((l) => l.text).join("\n"),
        rawLines: spatialLines.map((l) => l.text),
        extractedTransactions: [
          makeTx("1", "2026-11-10", "Padaria Estrela", 12050),
          makeTx("2", "2026-11-12", "Mercado Central", 30000),
        ],
        fileKind: "pdf_text",
        extractionSource: "ai_text",
        officialTotalCents: 42050,
      });

      expect(distilled.blueprint).not.toBeNull();
      const replay = validateBlueprintWithShadowReplay({
        blueprint: distilled.blueprint!,
        spatialLines,
        cardId: "card-horizonte",
        competenceMonth: "2026-11",
        officialTotalCents: 42050,
      });

      // Nota de rodapé (5.5pt) descartada corretamente nas linhas espaciais reais -> score 100 >= 90!
      expect(replay.passed).toBe(true);
      expect(replay.qualityGate.score).toBe(100);
      expect(replay.transactions).toHaveLength(2);
    });
  });
});
