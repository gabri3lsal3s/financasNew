import { describe, expect, it } from "vitest";
import {
  AiAssistantRequestSchema,
  AiSingleReceiptOutputSchema,
  AiStatementPdfRowsOutputSchema,
  evaluateAiQuotaAllowance,
  getBrtQuotaPeriods,
  isAiCacheEntryFresh,
  maskSensitivePiiForAi,
  MAX_AI_CATEGORIZE_BATCH_ITEMS,
  MAX_AI_CATEGORIZE_DESCRIPTION_CHARS,
  MAX_AI_IMAGE_BYTES,
  MAX_AI_SINGLE_RECEIPT_TEXT_CHARS,
  MAX_AI_STATEMENT_PDF_TEXT_CHARS,
  sanitizeBatchDescriptionForAi,
  stripJsonMarkdownFences,
  validateCategorizeBatchOutput,
} from "../../supabase/functions/_shared/ai-schemas";

const VALID_SHA = "a".repeat(64);

describe("ai-schemas (Trava 3 Hard Caps, Trava 5 Whitelist & Ajuste #3 BRT)", () => {
  it("aplica Hard Caps de payload (Trava 3): imagem > 500 KB, texto > 8k/25k e batch > 40", () => {
    const oversizedBase64 = "A".repeat(Math.ceil(((MAX_AI_IMAGE_BYTES + 1024) * 4) / 3));
    const oversizedReq = AiAssistantRequestSchema.safeParse({
      mode: "single_receipt",
      sha256: VALID_SHA,
      imageBase64: oversizedBase64,
      imageMimeType: "image/jpeg",
    });
    expect(oversizedReq.success).toBe(false);

    const validImageBase64 = "A".repeat(Math.floor(((MAX_AI_IMAGE_BYTES - 1024) * 4) / 3));
    const validImageReq = AiAssistantRequestSchema.safeParse({
      mode: "single_receipt",
      sha256: VALID_SHA,
      imageBase64: `data:image/jpeg;base64,${validImageBase64}`,
      imageMimeType: "image/jpeg",
    });
    expect(validImageReq.success).toBe(true);

    const oversizedReceiptText = AiAssistantRequestSchema.safeParse({
      mode: "single_receipt",
      sha256: VALID_SHA,
      text: "x".repeat(MAX_AI_SINGLE_RECEIPT_TEXT_CHARS + 1),
    });
    expect(oversizedReceiptText.success).toBe(false);

    const oversizedStatementText = AiAssistantRequestSchema.safeParse({
      mode: "statement_pdf_rows",
      sha256: VALID_SHA,
      text: "y".repeat(MAX_AI_STATEMENT_PDF_TEXT_CHARS + 1),
    });
    expect(oversizedStatementText.success).toBe(false);

    const oversizedBatch = AiAssistantRequestSchema.safeParse({
      mode: "categorize_batch",
      sha256: VALID_SHA,
      descriptions: Array.from(
        { length: MAX_AI_CATEGORIZE_BATCH_ITEMS + 1 },
        (_, idx) => `Item ${idx}`,
      ),
      categories: [{ id: "cat-1", name: "Alimentacao" }],
    });
    expect(oversizedBatch.success).toBe(false);

    const oversizedDesc = AiAssistantRequestSchema.safeParse({
      mode: "categorize_batch",
      sha256: VALID_SHA,
      descriptions: ["z".repeat(121)],
      categories: [{ id: "cat-1", name: "Alimentacao" }],
    });
    expect(oversizedDesc.success).toBe(false);
  });

  it("mascara CPF, agência e conta sem corromper CNPJ nem código de barras (LGPD Trava 5)", () => {
    const raw = [
      "Pagador: Gabriel Silva",
      "CPF: 529.982.247-25",
      "CPF limpo: 52998224725",
      "Recebedor CNPJ: 11222333000181",
      "Agencia: 0001 Conta: 123456-7",
      "Ag. 1234-5 / C/C 998877-0",
      "Cartao 4532 1188 7766 4821",
    ].join("\n");

    const masked = maskSensitivePiiForAi(raw);

    expect(masked).not.toContain("529.982.247-25");
    expect(masked).not.toContain("52998224725");
    expect(masked).toContain("[CPF_OCULTO]");
    expect(masked).toContain("11222333000181"); // CNPJ mantido
    expect(masked).not.toContain("123456-7");
    expect(masked).not.toContain("998877-0");
    expect(masked).toContain("[CONTA_OCULTA]");
    expect(masked).not.toContain("4532 1188 7766 4821");
    expect(masked).toContain("**** 4821");
  });

  it("rejeita saída de comprovante com amountCents float ou paymentMethod inválido", () => {
    expect(
      AiSingleReceiptOutputSchema.safeParse({
        amountCents: 45.5,
        nature: "expense",
        paymentMethod: "pix",
        receiptKind: "pix",
        description: "Padaria Central",
        confidence: "high",
      }).success,
    ).toBe(false);

    expect(
      AiSingleReceiptOutputSchema.safeParse({
        amountCents: 4550,
        date: "2026-11-23",
        nature: "expense",
        paymentMethod: "credit_card",
        receiptKind: "card_slip",
        description: "Padaria Central",
        cardLastDigits: "4821",
        installmentsCount: 3,
        confidence: "high",
      }).success,
    ).toBe(true);
  });

  it("rejeita categoryId inventado fora da whitelist no categorize_batch (Trava 5 / G6)", () => {
    const allowed = new Set(["cat-food", "cat-trans"]);

    const valid = validateCategorizeBatchOutput(
      {
        items: [
          { index: 0, friendlyName: "Padaria", categoryId: "cat-food" },
          { index: 1, friendlyName: "Desconhecido", categoryId: null },
        ],
      },
      allowed,
    );
    expect(valid.success).toBe(true);

    const hallucinated = validateCategorizeBatchOutput(
      {
        items: [{ index: 0, friendlyName: "Padaria", categoryId: "cat-invented-by-llm" }],
      },
      allowed,
    );
    expect(hallucinated.success).toBe(false);
  });

  it("zera uso diário na pré-checagem quando period_day !== todayBrt e aplica limites Trial/Pro (Ajuste #3)", () => {
    const periods = getBrtQuotaPeriods(new Date("2026-11-23T18:00:00Z"));
    expect(periods.periodMonth).toBe("2026-11");
    expect(periods.periodDay).toBe("2026-11-23");
    expect(periods.nextDayResetAtIso).toBe("2026-11-24T00:00:00-03:00");
    expect(periods.nextMonthResetAtIso).toBe("2026-12-01T00:00:00-03:00");

    // Ontem estourou o limite diário do Trial (5/5), hoje deve resetar para 0/5!
    const rolloverEval = evaluateAiQuotaAllowance({
      planGroup: "trial",
      bucket: "receipt_calls",
      row: {
        period_day: "2026-11-22",
        receipt_calls_month: 5,
        receipt_calls_day: 5,
        batch_calls_month: 2,
        batch_calls_day: 2,
      },
      todayBrt: periods.periodDay,
      nextDayResetAtIso: periods.nextDayResetAtIso,
      nextMonthResetAtIso: periods.nextMonthResetAtIso,
    });
    expect(rolloverEval.allowed).toBe(true);
    if (rolloverEval.allowed) {
      expect(rolloverEval.usedDay).toBe(0);
      expect(rolloverEval.remainingDay).toBe(5);
      expect(rolloverEval.remainingMonth).toBe(10);
    }

    // Hoje atingiu limite diário Trial (5/5) -> bloqueado com resetAt diário
    const dayExceeded = evaluateAiQuotaAllowance({
      planGroup: "trial",
      bucket: "receipt_calls",
      row: {
        period_day: "2026-11-23",
        receipt_calls_month: 10,
        receipt_calls_day: 5,
        batch_calls_month: 0,
        batch_calls_day: 0,
      },
      todayBrt: periods.periodDay,
      nextDayResetAtIso: periods.nextDayResetAtIso,
      nextMonthResetAtIso: periods.nextMonthResetAtIso,
    });
    expect(dayExceeded).toEqual({
      allowed: false,
      limitScope: "day",
      usedDay: 5,
      usedMonth: 10,
      resetAt: "2026-11-24T00:00:00-03:00",
    });

    // Pro no limite mensal -> resetAt mensal
    const monthExceeded = evaluateAiQuotaAllowance({
      planGroup: "pro",
      bucket: "receipt_calls",
      row: {
        period_day: "2026-11-23",
        receipt_calls_month: 100,
        receipt_calls_day: 1,
        batch_calls_month: 0,
        batch_calls_day: 0,
      },
      todayBrt: periods.periodDay,
      nextDayResetAtIso: periods.nextDayResetAtIso,
      nextMonthResetAtIso: periods.nextMonthResetAtIso,
    });
    expect(monthExceeded).toEqual({
      allowed: false,
      limitScope: "month",
      usedDay: 1,
      usedMonth: 100,
      resetAt: "2026-12-01T00:00:00-03:00",
    });
  });

  it("higieniza descrições de batch (Trava 5: remove R$, datas, CPFs/contas e limita a 120 chars) e valida saída statement_pdf_rows", () => {
    const dirty =
      "PAG*LOJA XYZ 15/08/2026 R$ 199,90 CPF 529.982.247-25 Agencia 0001 Conta 12345-6 " +
      "A".repeat(140);
    const cleaned = sanitizeBatchDescriptionForAi(dirty);

    expect(cleaned).not.toContain("199,90");
    expect(cleaned).not.toContain("15/08/2026");
    expect(cleaned).not.toContain("529.982.247-25");
    expect(cleaned).not.toContain("12345-6");
    expect(cleaned.length).toBeLessThanOrEqual(MAX_AI_CATEGORIZE_DESCRIPTION_CHARS);
    expect(cleaned).toContain("PAG*LOJA XYZ");

    expect(
      AiStatementPdfRowsOutputSchema.safeParse({
        rows: [
          {
            date: "2026-08-15",
            description: "Padaria Central",
            amountCents: 3500,
            installmentCurrent: null,
            installmentTotal: null,
          },
          {
            date: "2026-08-16",
            description: "Estorno Compra",
            amountCents: -1200,
          },
        ],
      }).success,
    ).toBe(true);

    // Rejeita amountCents = 0
    expect(
      AiStatementPdfRowsOutputSchema.safeParse({
        rows: [{ date: "2026-08-15", description: "Invalido", amountCents: 0 }],
      }).success,
    ).toBe(false);
  });

  it("remove cercas Markdown, valida TTL por modo no cache e rejeita índices duplicados/out-of-bounds em categorize_batch", () => {
    expect(stripJsonMarkdownFences('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(stripJsonMarkdownFences('{"ok":true}')).toBe('{"ok":true}');

    const nowMs = Date.parse("2026-11-23T12:00:00Z");
    const fresh10d = "2026-11-13T12:00:00Z";
    const expired20d = "2026-11-03T12:00:00Z";
    const expired35d = "2026-10-19T12:00:00Z";

    expect(isAiCacheEntryFresh(fresh10d, "categorize_batch", nowMs)).toBe(true);
    expect(isAiCacheEntryFresh(expired20d, "categorize_batch", nowMs)).toBe(false);
    expect(isAiCacheEntryFresh(expired20d, "single_receipt", nowMs)).toBe(true);
    expect(isAiCacheEntryFresh(expired35d, "statement_pdf_rows", nowMs)).toBe(false);
    expect(isAiCacheEntryFresh(null, "single_receipt", nowMs)).toBe(false);

    const allowed = new Set(["cat-food"]);
    expect(
      validateCategorizeBatchOutput(
        { items: [{ index: 0, friendlyName: "Padaria", categoryId: "cat-food" }] },
        allowed,
        0,
      ).success,
    ).toBe(true);

    // Rejeita índice fora do intervalo [0, maxIndex]
    expect(
      validateCategorizeBatchOutput(
        { items: [{ index: 2, friendlyName: "Padaria", categoryId: "cat-food" }] },
        allowed,
        1,
      ).success,
    ).toBe(false);

    // Rejeita índices duplicados
    expect(
      validateCategorizeBatchOutput(
        {
          items: [
            { index: 0, friendlyName: "Padaria", categoryId: "cat-food" },
            { index: 0, friendlyName: "Outro", categoryId: null },
          ],
        },
        allowed,
        1,
      ).success,
    ).toBe(false);
  });
});
