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
  normalizeCategorizeBatchAiPayload,
  normalizeSingleReceiptAiPayload,
  normalizeStatementPdfRowsAiPayload,
  PASSIVE_AI_DAILY_RESERVE,
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

  it("aceita isSameTitularity/fieldConfidence null (cupom NFC-e real do Gemini) e normaliza opcionais sem arredondar float", () => {
    const geminiDanfePayload = {
      amountCents: 27000,
      nature: "expense",
      paymentMethod: "cash",
      receiptKind: "invoice_danfe",
      description: "REDE MOLEZA",
      confidence: "high",
      bankName: null,
      cardBrand: null,
      cardLastDigits: null,
      date: "2024-05-09",
      fieldConfidence: {
        amount: "high",
        counterparty: "high",
        nature: "high",
        date: "high",
      },
      installmentsCount: null,
      isSameTitularity: null,
      merchantOrBeneficiary: "REDE MOLEZA",
      payerOrSource: null,
    };

    const parsedDanfe = AiSingleReceiptOutputSchema.safeParse(
      normalizeSingleReceiptAiPayload(geminiDanfePayload),
    );
    expect(parsedDanfe.success).toBe(true);

    const normalizedMixed = normalizeSingleReceiptAiPayload({
      amountCents: 1330,
      nature: "expense",
      paymentMethod: "credit_card",
      receiptKind: "card_slip",
      description: "  Nextar Comercio  ",
      date: "2024-04-04T10:15:00",
      cardLastDigits: "**** 4321",
      installmentsCount: 0,
      isSameTitularity: null,
      fieldConfidence: null,
      confidence: "high",
    });

    const parsedMixed = AiSingleReceiptOutputSchema.safeParse(normalizedMixed);
    expect(parsedMixed.success).toBe(true);
    if (parsedMixed.success) {
      expect(parsedMixed.data.description).toBe("Nextar Comercio");
      expect(parsedMixed.data.date).toBe("2024-04-04");
      expect(parsedMixed.data.cardLastDigits).toBe("4321");
      expect(parsedMixed.data.installmentsCount).toBeNull();
      expect(parsedMixed.data.isSameTitularity).toBeNull();
      expect(parsedMixed.data.fieldConfidence).toBeNull();
    }

    // Nunca arredonda amountCents float
    expect(
      AiSingleReceiptOutputSchema.safeParse(
        normalizeSingleReceiptAiPayload({
          amountCents: 270.5,
          nature: "expense",
          paymentMethod: "cash",
          receiptKind: "invoice_danfe",
          description: "REDE MOLEZA",
          confidence: "high",
        }),
      ).success,
    ).toBe(false);
  });

  it("valida categories no single_receipt, extrai merchantCnpj (14 dígitos), descarta CPF e aplica whitelist em categoryId", () => {
    const reqParsed = AiAssistantRequestSchema.safeParse({
      mode: "single_receipt",
      sha256: VALID_SHA,
      text: "REDE MOLEZA\nFILTRO LINHA\nVALOR 270,00",
      categories: [
        { id: "cat-casa", name: "Casa", type: "expense" },
        { id: "cat-mercado", name: "Supermercado", type: "expense" },
      ],
    });
    expect(reqParsed.success).toBe(true);

    const allowed = new Set(["cat-casa", "cat-mercado"]);

    const normalizedValid = normalizeSingleReceiptAiPayload(
      {
        amountCents: 27000,
        nature: "expense",
        paymentMethod: "cash",
        receiptKind: "invoice_danfe",
        description: "REDE MOLEZA",
        merchantCnpj: "88.709.563/0001-02",
        categoryId: "cat-casa",
        confidence: "high",
      },
      allowed,
    );
    const parsedValid = AiSingleReceiptOutputSchema.safeParse(normalizedValid);
    expect(parsedValid.success).toBe(true);
    if (parsedValid.success) {
      expect(parsedValid.data.merchantCnpj).toBe("88709563000102");
      expect(parsedValid.data.categoryId).toBe("cat-casa");
    }

    const normalizedCpfAndHallucinated = normalizeSingleReceiptAiPayload(
      {
        amountCents: 5000,
        nature: "expense",
        paymentMethod: "pix",
        receiptKind: "pix",
        description: "JOAO SILVA",
        merchantCnpj: "123.456.789-01",
        categoryId: "cat-inventada-pela-ia",
        confidence: "high",
      },
      allowed,
    );
    const parsedBlocked = AiSingleReceiptOutputSchema.safeParse(normalizedCpfAndHallucinated);
    expect(parsedBlocked.success).toBe(true);
    if (parsedBlocked.success) {
      expect(parsedBlocked.data.merchantCnpj).toBeNull();
      expect(parsedBlocked.data.categoryId).toBeNull();
    }
  });

  it("aceita imageBase64/competenceMonth em statement_pdf_rows e normaliza isenções R$ 0,00, parcelas 1/1 e entryType", () => {
    const visionStatementReq = AiAssistantRequestSchema.safeParse({
      mode: "statement_pdf_rows",
      sha256: VALID_SHA,
      imageBase64: "data:image/jpeg;base64,AAAA",
      imageMimeType: "image/jpeg",
      competenceMonth: "2027-01",
    });
    expect(visionStatementReq.success).toBe(true);

    const normalized = normalizeStatementPdfRowsAiPayload({
      rows: [
        {
          date: "2026-12-22T00:00:00",
          description: "  Mercado Central  ",
          amountCents: 18500,
          installmentCurrent: 1,
          installmentTotal: 1,
          entryType: "purchase",
        },
        {
          date: "2026-12-23",
          description: "Isencao Anuidade",
          amountCents: 0,
          entryType: "charge",
        },
        {
          date: "2026-12-24",
          description: "Pagamento Fatura Anterior",
          amountCents: 95000,
          entryType: "payment",
        },
      ],
      detectedCompetenceMonth: "11/2026",
      detectedDueDate: "10/11/2026",
      detectedCardLast4: "•••• 4821",
      detectedCardBrandOrBank: "  Nubank  ",
      detectedTotalInvoiceCents: 154020,
    });

    const parsed = AiStatementPdfRowsOutputSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rows).toHaveLength(2);
      expect(parsed.data.rows[0]?.date).toBe("2026-12-22");
      expect(parsed.data.rows[0]?.installmentCurrent).toBeNull();
      expect(parsed.data.rows[0]?.installmentTotal).toBeNull();
      expect(parsed.data.rows[1]?.amountCents).toBe(-95000);
      expect(parsed.data.rows[1]?.entryType).toBe("payment");
      expect(parsed.data.detectedCompetenceMonth).toBe("2026-11");
      expect(parsed.data.detectedDueDate).toBe("2026-11-10");
      expect(parsed.data.detectedCardLast4).toBe("4821");
      expect(parsed.data.detectedCardBrandOrBank).toBe("Nubank");
      expect(parsed.data.detectedTotalInvoiceCents).toBe(154020);
    }
  });

  it("reserva PASSIVE_AI_DAILY_RESERVE créditos para chamadas ativas e higieniza metadados semânticos em categorize_batch e single_receipt", () => {
    const periods = getBrtQuotaPeriods(new Date("2026-11-23T18:00:00Z"));
    const proRowWith3BatchCallsToday = {
      period_day: "2026-11-23",
      receipt_calls_month: 0,
      receipt_calls_day: 0,
      batch_calls_month: 3,
      batch_calls_day: 5 - PASSIVE_AI_DAILY_RESERVE, // 3 de 5 usados no Pro
    };

    const passiveEval = evaluateAiQuotaAllowance({
      planGroup: "pro",
      bucket: "batch_calls",
      row: proRowWith3BatchCallsToday,
      todayBrt: periods.periodDay,
      nextDayResetAtIso: periods.nextDayResetAtIso,
      nextMonthResetAtIso: periods.nextMonthResetAtIso,
      priority: "passive",
    });
    expect(passiveEval.allowed).toBe(false);

    const activeEval = evaluateAiQuotaAllowance({
      planGroup: "pro",
      bucket: "batch_calls",
      row: proRowWith3BatchCallsToday,
      todayBrt: periods.periodDay,
      nextDayResetAtIso: periods.nextDayResetAtIso,
      nextMonthResetAtIso: periods.nextMonthResetAtIso,
      priority: "active",
    });
    expect(activeEval.allowed).toBe(true);

    const normalizedBatch = normalizeCategorizeBatchAiPayload({
      items: [
        {
          index: 0,
          friendlyName: "YouTube Premium",
          categoryId: "cat-1",
          canonicalMerchant: "YouTube",
          serviceSegment: "streaming",
          cutTier: "can_cut",
          isSubscription: true,
          semanticTags: ["Streaming", "Musica", "streaming"],
        },
        {
          index: 1,
          friendlyName: "Loja Aleatoria",
          categoryId: null,
          serviceSegment: "inventado",
          cutTier: "invalid_tier",
        },
      ],
    });
    const batchValidation = validateCategorizeBatchOutput(
      normalizedBatch,
      new Set(["cat-1"]),
      1,
    );
    expect(batchValidation.success).toBe(true);
    if (batchValidation.success) {
      expect(batchValidation.data.items[0]?.semanticTags).toEqual(["streaming", "musica"]);
      expect(batchValidation.data.items[0]?.isSubscription).toBe(true);
      expect(batchValidation.data.items[1]?.serviceSegment).toBeNull();
      expect(batchValidation.data.items[1]?.cutTier).toBeNull();
    }

    const intlReceipt = normalizeSingleReceiptAiPayload({
      amountCents: 2500,
      nature: "expense",
      paymentMethod: "credit_card",
      receiptKind: "card_slip",
      description: "Boulangerie Paris",
      originalCurrency: "eur",
      originalAmountCents: 2500,
      semanticTags: ["Viagem", "Padaria"],
      confidence: "high",
    });
    const parsedIntl = AiSingleReceiptOutputSchema.safeParse(intlReceipt);
    expect(parsedIntl.success).toBe(true);
    if (parsedIntl.success) {
      expect(parsedIntl.data.originalCurrency).toBe("EUR");
      expect(parsedIntl.data.originalAmountCents).toBe(2500);
      expect(parsedIntl.data.semanticTags).toEqual(["viagem", "padaria"]);
    }
  });

  it("12. normaliza e valida inferredScope ('business'/'personal') e isTaxDeductible booleano no single_receipt", () => {
    const bizReceipt = normalizeSingleReceiptAiPayload({
      amountCents: 45000,
      nature: "expense",
      paymentMethod: "pix",
      receiptKind: "invoice_danfe",
      description: "Hospedagem AWS Cloud",
      inferredScope: "BUSINESS",
      isTaxDeductible: "true",
      confidence: "high",
    });

    const parsed = AiSingleReceiptOutputSchema.safeParse(bizReceipt);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.inferredScope).toBe("business");
      expect(parsed.data.isTaxDeductible).toBe(true);
    }

    const invalidScope = normalizeSingleReceiptAiPayload({
      amountCents: 1000,
      nature: "expense",
      paymentMethod: "pix",
      receiptKind: "pix",
      description: "Transferência",
      inferredScope: "unknown_scope",
      isTaxDeductible: "invalid",
      confidence: "low",
    });
    const parsedInvalid = AiSingleReceiptOutputSchema.safeParse(invalidScope);
    expect(parsedInvalid.success).toBe(true);
    if (parsedInvalid.success) {
      expect(parsedInvalid.data.inferredScope).toBeNull();
      expect(parsedInvalid.data.isTaxDeductible).toBeNull();
    }
  });
});
