import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  categorizeDescriptionsBatchWithAi,
  CLIENT_AI_TIMEOUT_MS,
  convertAiReceiptToUniversalData,
  extractSingleReceiptWithAi,
  extractStatementPdfRowsWithAi,
  formatAiQuotaResetHint,
  resetAiAssistantInFlightForTests,
} from "./ai-assistant";

const VALID_SHA = "b".repeat(64);
const VALID_SHA_2 = "c".repeat(64);

const mockGetSession = vi.fn();

vi.mock("@/lib/env", () => ({
  getSupabaseEnv: () => ({
    url: "https://test-project.supabase.co",
    anonKey: "test-anon-key",
  }),
}));

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    auth: {
      getSession: () => mockGetSession(),
    },
  }),
}));

describe("ai-assistant (Resiliência FinOps G6, Lock inFlightBySha256 & LGPD)", () => {
  const originalFetch = globalThis.fetch;
  const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "onLine");

  beforeEach(() => {
    vi.clearAllMocks();
    resetAiAssistantInFlightForTests();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "jwt-token-123" } },
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    if (originalOnLineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnLineDescriptor);
    }
  });

  it("1. Cota esgotada: retorna fallback estruturado com quotaResetAt sem lançar erro", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          reason: "quota_exceeded",
          fallbackToLocal: true,
          quotaResetAt: "2026-11-24T00:00:00-03:00",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const result = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto longo suficiente para análise financeira de comprovante Pix",
      userId: "user-1",
    });

    expect(result).toEqual({
      ok: false,
      reason: "quota_exceeded",
      fallbackToLocal: true,
      quotaResetAt: "2026-11-24T00:00:00-03:00",
    });
    expect(formatAiQuotaResetHint("2026-11-24T00:00:00-03:00")).toMatch(/24\/11/);
  });

  it("2. Usuário read_only: aborta antes da rede no cliente e mapeia HTTP 403 no servidor", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const clientBlocked = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto suficiente para testar bloqueio em read_only no cliente",
      isReadOnlyMode: true,
    });

    expect(clientBlocked).toEqual({
      ok: false,
      reason: "read_only",
      fallbackToLocal: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, reason: "read_only", fallbackToLocal: true }), {
        status: 403,
      }),
    );

    const serverBlocked = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto suficiente para testar resposta 403 do servidor",
      isReadOnlyMode: false,
    });

    expect(serverBlocked).toEqual({
      ok: false,
      reason: "read_only",
      fallbackToLocal: true,
    });
  });

  it("3. Offline: falha em 0 ms com reason offline sem tocar sessão nem rede", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Comprovante Pix offline de teste longo o bastante",
    });

    expect(result).toEqual({
      ok: false,
      reason: "offline",
      fallbackToLocal: true,
    });
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("4. Timeout do cliente: aborta requisição lenta via AbortController e retorna reason timeout", async () => {
    vi.useFakeTimers();

    globalThis.fetch = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const pendingPromise = extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Comprovante lento que excede o timeout estrito do cliente",
    });

    await vi.advanceTimersByTimeAsync(CLIENT_AI_TIMEOUT_MS + 50);
    const result = await pendingPromise;

    expect(result).toEqual({
      ok: false,
      reason: "timeout",
      fallbackToLocal: true,
    });
  });

  it("5. Falhas externas (HTTP 429, 500, JSON malformado e Zod inválido) degradam com segurança", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("Too Many Requests", { status: 429 }))
      .mockResolvedValueOnce(new Response("Internal Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("{invalid json", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            source: "ai_text",
            data: {
              amountCents: 45.75, // Float proibido
              nature: "expense",
              paymentMethod: "pix",
              receiptKind: "pix",
              description: "Padaria",
              confidence: "high",
            },
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;

    const payload = {
      sha256: VALID_SHA,
      text: "Comprovante para testar múltiplas falhas de rede/upstream",
    };

    const r429 = await extractSingleReceiptWithAi(payload);
    expect(r429).toEqual({ ok: false, reason: "upstream_unavailable", fallbackToLocal: true });

    const r500 = await extractSingleReceiptWithAi(payload);
    expect(r500).toEqual({ ok: false, reason: "upstream_unavailable", fallbackToLocal: true });

    const rJson = await extractSingleReceiptWithAi(payload);
    expect(rJson).toEqual({ ok: false, reason: "invalid_ai_output", fallbackToLocal: true });

    const rZod = await extractSingleReceiptWithAi(payload);
    expect(rZod).toEqual({ ok: false, reason: "invalid_ai_output", fallbackToLocal: true });
  });

  it("6. Kill-switch desligado (feature flag false ou resposta disabled do servidor)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const clientDisabled = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto suficiente com feature flag desligada",
      featureEnabled: false,
    });

    expect(clientDisabled).toEqual({
      ok: false,
      reason: "disabled",
      fallbackToLocal: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, reason: "disabled", fallbackToLocal: true }), {
        status: 200,
      }),
    );

    const serverDisabled = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto suficiente quando env AI_EXTRACTION_ENABLED=false no servidor",
      featureEnabled: true,
    });

    expect(serverDisabled).toEqual({
      ok: false,
      reason: "disabled",
      fallbackToLocal: true,
    });
  });

  it("7. Lock inFlightBySha256 (Trava 4 / Ajuste #4): deduplica chamadas concorrentes idênticas", async () => {
    let resolveFetch!: (res: Response) => void;
    const fetchSpy = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const req = {
      sha256: VALID_SHA,
      text: "Comprovante concorrente duplicado no mesmo segundo para testar lock",
      userId: "user-1",
    };

    const p1 = extractSingleReceiptWithAi(req);
    const p2 = extractSingleReceiptWithAi(req);

    // Aguarda a microtask de getSession resolver até o fetch iniciar
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    resolveFetch(
      new Response(
        JSON.stringify({
          ok: true,
          cached: false,
          source: "ai_text",
          data: {
            amountCents: 9900,
            date: "2026-11-23",
            nature: "expense",
            paymentMethod: "pix",
            receiptKind: "pix",
            description: "Mercado Bom Preco",
            confidence: "high",
          },
        }),
        { status: 200 },
      ),
    );

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.ok).toBe(true);
    expect(res2).toEqual(res1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("8. Trava 5 LGPD: mascara CPF e agência/conta antes de enviar ao backend e preserva CNPJ", async () => {
    let capturedBodyText = "";
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      capturedBodyText = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          ok: true,
          cached: true,
          source: "cache_remote",
          data: {
            amountCents: 15000,
            date: "2026-11-23",
            nature: "expense",
            paymentMethod: "pix",
            receiptKind: "pix",
            description: "Clinica Saude",
            merchantOrBeneficiary: "Clinica Saude Ltda",
            installmentsCount: 3,
            confidence: "high",
            fieldConfidence: {
              amount: "high",
              counterparty: "high",
              nature: "high",
              date: "high",
            },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await extractSingleReceiptWithAi({
      sha256: VALID_SHA_2,
      text: "Comprovante Pix\nValor: R$ 150,00\nPagador CPF: 529.982.247-25\nAgencia: 0001 Conta: 123456-7\nCNPJ Loja: 11222333000181",
      userId: "user-1",
      userFullName: "Gabriel Sales",
    });

    expect(capturedBodyText).not.toContain("529.982.247-25");
    expect(capturedBodyText).not.toContain("123456-7");
    expect(capturedBodyText).toContain("[CPF_OCULTO]");
    expect(capturedBodyText).toContain("[CONTA_OCULTA]");
    expect(capturedBodyText).toContain("11222333000181");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe("cache_remote");
      const universal = convertAiReceiptToUniversalData(res.data, res.source);
      expect(universal.amountCents).toBe(15000);
      expect(universal.rawCleanText).toBe("");
      expect(universal.extractionSource).toBe("cache_remote");
      expect(universal.installments?.count).toBe(3);
    }
  });

  it("9. categorizeDescriptionsBatchWithAi (Fase E): higieniza payload (Trava 5), valida whitelist e rejeita categoryId inventado", async () => {
    let capturedBody = "";
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async (_url, init?: RequestInit) => {
        capturedBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            ok: true,
            mode: "categorize_batch",
            cached: false,
            source: "ai_text",
            data: {
              items: [{ index: 0, friendlyName: "Loja XPTZ", categoryId: "cat-tech" }],
            },
          }),
          { status: 200 },
        );
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            mode: "categorize_batch",
            cached: false,
            source: "ai_text",
            data: {
              items: [
                { index: 0, friendlyName: "Loja Hallucinada", categoryId: "cat-invented" },
              ],
            },
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;

    const validRes = await categorizeDescriptionsBatchWithAi({
      userId: "user-1",
      descriptions: ["PAG*LOJA XPTZ 15/08/2026 R$ 250,00 CPF 529.982.247-25"],
      categories: [
        { id: "cat-food", name: "Alimentacao" },
        { id: "cat-tech", name: "Tecnologia" },
      ],
    });

    // Garante Trava 5: nenhum valor monetario, data ou CPF enviado em categorize_batch
    expect(capturedBody).not.toContain("250,00");
    expect(capturedBody).not.toContain("15/08/2026");
    expect(capturedBody).not.toContain("529.982.247-25");
    expect(capturedBody).toContain("PAG*LOJA XPTZ");
    expect(validRes).toEqual({
      ok: true,
      cached: false,
      source: "ai_text",
      data: { items: [{ index: 0, friendlyName: "Loja XPTZ", categoryId: "cat-tech" }] },
    });

    // Segunda chamada com categoryId inventado pelo backend deve ser rejeitada pelo cliente
    const rejectedHallucination = await categorizeDescriptionsBatchWithAi({
      userId: "user-1",
      descriptions: ["OUTRO ESTABELECIMENTO"],
      categories: [
        { id: "cat-food", name: "Alimentacao" },
        { id: "cat-tech", name: "Tecnologia" },
      ],
    });
    expect(rejectedHallucination).toEqual({
      ok: false,
      reason: "invalid_ai_output",
      fallbackToLocal: true,
    });
  });

  it("10. extractStatementPdfRowsWithAi (Fase E): mascara PII em PDF multi-coluna e trata quota_exceeded", async () => {
    let capturedBody = "";
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async (_url, init?: RequestInit) => {
        capturedBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            ok: true,
            mode: "statement_pdf_rows",
            cached: false,
            source: "ai_text",
            data: {
              rows: [
                {
                  date: "2026-08-15",
                  description: "Loja Multi Coluna",
                  amountCents: 19900,
                  installmentCurrent: 2,
                  installmentTotal: 6,
                },
              ],
            },
          }),
          { status: 200 },
        );
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            reason: "quota_exceeded",
            fallbackToLocal: true,
            quotaResetAt: "2026-12-01T00:00:00-03:00",
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;

    const okRes = await extractStatementPdfRowsWithAi({
      userId: "user-1",
      text: "Fatura Titular CPF 529.982.247-25 Agencia 0001 Conta 123456-7\n15/08 Loja Multi Coluna 2/6 199,00",
      referenceYear: 2026,
    });

    expect(capturedBody).not.toContain("529.982.247-25");
    expect(capturedBody).not.toContain("123456-7");
    expect(capturedBody).toContain("[CPF_OCULTO]");
    expect(okRes.ok).toBe(true);

    const quotaRes = await extractStatementPdfRowsWithAi({
      userId: "user-1",
      text: "Outra fatura desalinhada sem cache",
    });
    expect(quotaRes).toEqual({
      ok: false,
      reason: "quota_exceeded",
      fallbackToLocal: true,
      quotaResetAt: "2026-12-01T00:00:00-03:00",
    });
  });

  it("11. categorizeDescriptionsBatchWithAi invalida sha256 quando nome da categoria muda e rejeita índice fora do lote", async () => {
    const capturedShas: string[] = [];
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as { sha256?: string };
      if (parsed.sha256) capturedShas.push(parsed.sha256);
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "categorize_batch",
          cached: false,
          source: "ai_text",
          data: {
            items: [
              { index: 0, friendlyName: "Cafe Centro", categoryId: "cat-1" },
            ],
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await categorizeDescriptionsBatchWithAi({
      userId: "user-1",
      descriptions: ["CAFE CENTRO"],
      categories: [{ id: "cat-1", name: "Alimentacao" }],
    });
    await categorizeDescriptionsBatchWithAi({
      userId: "user-1",
      descriptions: ["CAFE CENTRO"],
      categories: [{ id: "cat-1", name: "Restaurantes" }],
    });

    expect(capturedShas).toHaveLength(2);
    expect(capturedShas[0]).not.toBe(capturedShas[1]);

    // Índice 3 para lote de tamanho 1 -> invalid_ai_output
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          mode: "categorize_batch",
          cached: false,
          source: "ai_text",
          data: {
            items: [{ index: 3, friendlyName: "Alucinacao", categoryId: "cat-1" }],
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const outOfBounds = await categorizeDescriptionsBatchWithAi({
      userId: "user-1",
      descriptions: ["PADARIA"],
      categories: [{ id: "cat-1", name: "Alimentacao" }],
    });
    expect(outOfBounds).toEqual({
      ok: false,
      reason: "invalid_ai_output",
      fallbackToLocal: true,
    });
  });

  it("12. preferVision = true anexa imageBase64 mesmo quando text possui >= 20 caracteres (multimodal)", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "single_receipt",
          cached: false,
          source: "ai_vision",
          data: {
            amountCents: 4990,
            date: "2026-11-23",
            nature: "expense",
            paymentMethod: "pix",
            receiptKind: "pix",
            description: "Mercado Bom Dia",
            confidence: "high",
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const fakeImg = new Blob(["small-jpeg-bytes"], { type: "image/jpeg" });
    const res = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      text: "Texto parcial de OCR acima de vinte caracteres com ruido",
      imageBlob: fakeImg,
      preferVision: true,
      userId: "user-1",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.source).toBe("ai_vision");
    }
    expect(typeof capturedBody.imageBase64).toBe("string");
    expect((capturedBody.imageBase64 as string).length).toBeGreaterThan(0);
    expect(typeof capturedBody.text).toBe("string");
  });

  it("13. aceita resposta com isSameTitularity e fieldConfidence null e converte para isSameTitularity undefined", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          mode: "single_receipt",
          cached: false,
          source: "ai_vision",
          data: {
            amountCents: 27000,
            date: "2024-05-09",
            nature: "expense",
            paymentMethod: "cash",
            receiptKind: "invoice_danfe",
            description: "REDE MOLEZA",
            merchantOrBeneficiary: "REDE MOLEZA",
            isSameTitularity: null,
            fieldConfidence: null,
            confidence: "high",
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const img = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    const res = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      imageBlob: img,
      preferVision: true,
      userId: "user-1",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.isSameTitularity).toBeNull();
      expect(res.data.fieldConfidence).toBeNull();
      const universal = convertAiReceiptToUniversalData(res.data, res.source);
      expect(universal.amountCents).toBe(27000);
      expect(universal.isSameTitularity).toBeUndefined();
    }
  });

  it("14. envia categories em single_receipt, filtra categoryId fora da whitelist e mapeia merchantCnpj -> taxId e categoryId -> aiCategoryId", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            ok: true,
            mode: "single_receipt",
            cached: false,
            source: "ai_vision",
            data: {
              amountCents: 27000,
              date: "2024-05-09",
              nature: "expense",
              paymentMethod: "cash",
              receiptKind: "invoice_danfe",
              description: "REDE MOLEZA",
              merchantOrBeneficiary: "REDE MOLEZA",
              merchantCnpj: "88709563000102",
              categoryId: "cat-casa",
              confidence: "high",
            },
          }),
          { status: 200 },
        );
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            mode: "single_receipt",
            cached: false,
            source: "ai_text",
            data: {
              amountCents: 9900,
              date: "2024-05-10",
              nature: "expense",
              paymentMethod: "pix",
              receiptKind: "pix",
              description: "LOJA TESTE",
              merchantOrBeneficiary: "LOJA TESTE",
              merchantCnpj: "12345678000199",
              categoryId: "cat-nao-existe",
              confidence: "high",
            },
          }),
          { status: 200 },
        );
      }) as unknown as typeof fetch;

    const img = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    const categories = [
      { id: "cat-casa", name: "Casa", type: "expense" as const },
      { id: "cat-lazer", name: "Lazer", type: "expense" as const },
    ];

    const validRes = await extractSingleReceiptWithAi({
      sha256: VALID_SHA,
      imageBlob: img,
      preferVision: true,
      userId: "user-1",
      categories,
    });

    expect(Array.isArray(capturedBody.categories)).toBe(true);
    expect(capturedBody.categories).toHaveLength(2);
    expect(validRes.ok).toBe(true);
    if (validRes.ok) {
      expect(validRes.data.categoryId).toBe("cat-casa");
      expect(validRes.data.merchantCnpj).toBe("88709563000102");
      const universal = convertAiReceiptToUniversalData(validRes.data, validRes.source);
      expect(universal.taxId).toBe("88709563000102");
      expect(universal.aiCategoryId).toBe("cat-casa");
    }

    const hallucinatedRes = await extractSingleReceiptWithAi({
      sha256: VALID_SHA_2,
      text: "COMPROVANTE PIX LOJA TESTE LTDA VALOR R$ 99,00 DATA 10/05/2024",
      userId: "user-1",
      categories,
    });
    expect(hallucinatedRes.ok).toBe(true);
    if (hallucinatedRes.ok) {
      expect(hallucinatedRes.data.categoryId).toBeNull();
      const universal = convertAiReceiptToUniversalData(
        hallucinatedRes.data,
        hallucinatedRes.source,
      );
      expect(universal.aiCategoryId).toBeUndefined();
    }
  });

  it("15. extractStatementPdfRowsWithAi suporta print/imagem (ai_vision), competenceMonth e normaliza entryType/linhas R$ 0,00", async () => {
    let capturedBody: Record<string, unknown> = {};
    globalThis.fetch = vi.fn().mockImplementationOnce(async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "statement_pdf_rows",
          cached: false,
          source: "ai_vision",
          data: {
            rows: [
              {
                date: "2026-08-14",
                description: "IOF Compra Internacional",
                amountCents: 450,
                entryType: "charge",
              },
              {
                date: "2026-08-14",
                description: "Isencao Tarifa",
                amountCents: 0,
              },
            ],
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const printBlob = new Blob(["fake-print-jpeg"], { type: "image/jpeg" });
    const res = await extractStatementPdfRowsWithAi({
      sha256: VALID_SHA,
      imageBlob: printBlob,
      competenceMonth: "2026-08",
      referenceYear: 2026,
      userId: "user-1",
    });

    expect(res.ok).toBe(true);
    expect(capturedBody.competenceMonth).toBe("2026-08");
    expect(typeof capturedBody.imageBase64).toBe("string");
    if (res.ok) {
      expect(res.source).toBe("ai_vision");
      expect(res.data.rows).toHaveLength(1);
      expect(res.data.rows[0]?.entryType).toBe("charge");
    }
  });
});
