import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLocalReceiptScanCache,
  computeFileSha256,
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
  resolveReceiptTransaction,
} from "./receipt-resolution";
import type { MerchantLearningMemory, UniversalReceiptData } from "@/domain/notifications";
import { setActiveUserId } from "@/services/user-storage";
import type { CreditCard } from "@/types/schema";

const mockExtractReceiptTextFromFile = vi.fn();
const mockProcessPixShare = vi.fn();
const mockExtractSingleReceiptWithAi = vi.fn();

vi.mock("@/services/ai-assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/ai-assistant")>();
  return {
    ...actual,
    extractSingleReceiptWithAi: (...args: unknown[]) =>
      mockExtractSingleReceiptWithAi(...args),
  };
});

vi.mock("@/services/native/receipt-extractor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/native/receipt-extractor")>();
  return {
    ...actual,
    MAX_RECEIPT_FILE_SIZE_BYTES: 15 * 1024 * 1024,
    extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
  };
});

vi.mock("@/services/native/platform", () => ({
  isNativePlatform: () => false,
}));

vi.mock("@/services/native/bank-listener", () => ({
  processPixShare: (...args: unknown[]) => mockProcessPixShare(...args),
}));

vi.mock("@/services/native", () => ({
  MAX_RECEIPT_FILE_SIZE_BYTES: 15 * 1024 * 1024,
  isNativePlatform: () => false,
  extractReceiptTextFromFile: (...args: unknown[]) => mockExtractReceiptTextFromFile(...args),
  processPixShare: (...args: unknown[]) => mockProcessPixShare(...args),
}));

vi.mock("@/services/merchant-learning", () => ({
  getMerchantLearningMemory: () => ({}),
  getCardDigitsMapping: () => ({ "4821": "card-itau-uuid" }),
  getBankCardMapping: () => ({}),
}));

function makeCard(overrides: Partial<CreditCard> & { id: string; name: string }): CreditCard {
  return {
    user_id: "user-1",
    brand: "mastercard",
    credit_limit: 500000,
    closing_day: 10,
    due_day: 17,
    color: null,
    is_active: true,
    ...overrides,
  };
}

describe("receipt-resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActiveUserId("user-1");
    clearLocalReceiptScanCache("user-1");
    mockProcessPixShare.mockReturnValue(null);
    mockExtractSingleReceiptWithAi.mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
      fallbackToLocal: true,
    });
  });

  it("rejeita arquivo acima do limite de 15 MB antes de executar OCR", async () => {
    const oversized = new File([new Uint8Array(1024)], "grande.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(oversized, "size", { value: 16 * 1024 * 1024 });

    const result = await resolveAndScanReceiptFile(oversized);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("file_too_large");
    expect(result.errorMessage).toContain("15 MB");
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
  });

  it("rejeita arquivos SVG não suportados", async () => {
    const svg = new File(["<svg></svg>"], "comprovante.svg", {
      type: "image/svg+xml",
    });

    const result = await resolveAndScanReceiptFile(svg);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unsupported_format");
    expect(result.errorMessage).toContain("SVG");
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
  });

  it("calcula SHA-256 e resolve comprovante Pix via OCR e motor universal", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Comprovante Pix Nubank\nValor: R$ 120,00\nPara: Supermercado Dia\nData: 22/10/2026",
    );

    const file = new File(["conteudo-comprovante-pix"], "pix.pdf", {
      type: "application/pdf",
    });

    const result = await resolveAndScanReceiptFile(file);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.kindLabel).toBe("Comprovante Pix");
    expect(result.parsed).toMatchObject({
      amountCents: 12000,
      bankName: "Nubank",
      paymentMethod: "pix",
      receiptKind: "pix",
      type: "expense",
    });
    expect(result.parsed?.description).toMatch(/Dia/i);
  });

  it("auto-resolve cartão parcelado pelo cardDigitsMapping e calcula rótulo com parcelas", async () => {
    const rawSlip = `
      CIELO
      VIA CLIENTE
      CREDITO PARCELADO
      PARC: 03
      VALOR DA PARCELA: R$ 50,00
      VALOR TOTAL: R$ 150,00
      MASTERCARD
      FINAL 4821
      AUTORIZACAO: 987654
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawSlip);

    const cards = [
      makeCard({ id: "card-itau-uuid", name: "Itaú Personnalité" }),
      makeCard({ id: "card-nubank-uuid", name: "Nubank Roxinho" }),
    ];

    const file = new File(["slip-bytes"], "slip.jpg", { type: "image/jpeg" });
    const result = await resolveAndScanReceiptFile(file, { cards });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.matchedCard?.id).toBe("card-itau-uuid");
    expect(result.parsed).toMatchObject({
      amountCents: 15000,
      installments: 3,
      installmentAmountCents: 5000,
      paymentMethod: "credit_card",
      cardId: "card-itau-uuid",
      cardLastDigits: "4821",
      receiptKind: "card_slip",
    });
    expect(result.kindLabel).toBe("Comprovante de Cartão de Crédito (3x)");
  });

  it("retorna status empty_text quando OCR não extrai conteúdo legível", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("   \n  ");
    const file = new File(["blank"], "vazio.jpg", { type: "image/jpeg" });

    const result = await resolveAndScanReceiptFile(file);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("empty_text");
    expect(result.parsed).toBeNull();
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retorna status unrecognized quando o texto não contém dados financeiros válidos", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("Texto aleatório sem valor nem data");
    const file = new File(["noise"], "ruido.png", { type: "image/png" });

    const result = await resolveAndScanReceiptFile(file);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("unrecognized");
    expect(result.parsed).toBeNull();
  });

  it("retorna status error quando extractReceiptTextFromFile lança exceção", async () => {
    mockExtractReceiptTextFromFile.mockRejectedValueOnce(new Error("Falha de OCR"));
    const file = new File(["broken"], "erro.pdf", { type: "application/pdf" });

    const result = await resolveAndScanReceiptFile(file);

    expect(result.ok).toBe(false);
    expect(result.status).toBe("error");
    expect(result.errorMessage).toContain("falha inesperada");
  });

  it("resolveReceiptFromText aciona fallback legado via processPixShare quando universal retorna null", () => {
    mockProcessPixShare.mockReturnValueOnce({
      id: "legacy-1",
      bankName: "Banco Teste",
      nature: "expense",
      type: "expense",
      amountCents: 4590,
      description: "Padaria Central",
      date: "2026-10-22",
      paymentMethod: "pix",
      rawText: "texto legado",
      timestamp: 1000,
    });

    const resolved = resolveReceiptFromText("texto legado não reconhecido pelo universal");

    expect(resolved).not.toBeNull();
    expect(resolved?.parsed.amountCents).toBe(4590);
    expect(resolved?.parsed.bankName).toBe("Banco Teste");
  });

  it("computeFileSha256 retorna hash determinístico para o mesmo conteúdo", async () => {
    const fileA = new File(["axir-receipt-1"], "a.pdf", { type: "application/pdf" });
    const fileB = new File(["axir-receipt-1"], "b.pdf", { type: "application/pdf" });
    const fileC = new File(["axir-receipt-2"], "c.pdf", { type: "application/pdf" });

    const [hashA, hashB, hashC] = await Promise.all([
      computeFileSha256(fileA),
      computeFileSha256(fileB),
      computeFileSha256(fileC),
    ]);

    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it("reaproveita cache local por SHA-256 sem re-executar OCR e sem persistir rawText (LGPD)", async () => {
    const rawReceipt =
      "Nubank\nComprovante Pix\nValor Pago: R$ 199,90\nData: 21/11/2026\nDestino\nPADARIA MODELO";
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawReceipt);

    const file = new File(["same-binary-receipt"], "comprovante.pdf", {
      type: "application/pdf",
    });

    const first = await resolveAndScanReceiptFile(file, { userId: "user-1" });
    expect(first.ok).toBe(true);
    expect(first.parsed?.extractionSource).toBe("local_deterministic");
    expect(mockExtractReceiptTextFromFile).toHaveBeenCalledTimes(1);

    // Garante que o cache no localStorage não guarda rawText nem imagem/base64
    const storedRaw = localStorage.getItem("financas_user-1_receipt_scan_cache_v1") ?? "";
    expect(storedRaw).toContain(first.sha256!);
    expect(storedRaw).not.toContain(rawReceipt);
    expect(storedRaw).not.toContain('"rawText"');

    // Segunda leitura do mesmo arquivo não aciona OCR novamente
    const second = await resolveAndScanReceiptFile(file, { userId: "user-1" });
    expect(second.ok).toBe(true);
    expect(second.status).toBe("success");
    expect(second.parsed?.amountCents).toBe(19990);
    expect(second.parsed?.extractionSource).toBe("cache_local");
    expect(mockExtractReceiptTextFromFile).toHaveBeenCalledTimes(1);

    // Usuário distinto não compartilha o cache
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawReceipt);
    const otherUser = await resolveAndScanReceiptFile(file, { userId: "user-2" });
    expect(otherUser.ok).toBe(true);
    expect(otherUser.parsed?.extractionSource).toBe("local_deterministic");
    expect(mockExtractReceiptTextFromFile).toHaveBeenCalledTimes(2);
  });

  it("expira entradas de cache local após TTL de 7 dias", async () => {
    const baseNow = 1_795_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseNow);
    const rawReceipt =
      "Nubank\nComprovante Pix\nValor Pago: R$ 75,00\nData: 21/11/2026\nDestino\nCAFETERIA";

    try {
      mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawReceipt);
      const file = new File(["ttl-receipt"], "ttl.pdf", { type: "application/pdf" });

      const first = await resolveAndScanReceiptFile(file, { userId: "user-1" });
      expect(first.parsed?.extractionSource).toBe("local_deterministic");

      // Avança 8 dias além do TTL (7 dias)
      nowSpy.mockReturnValue(baseNow + 8 * 24 * 60 * 60 * 1000);
      mockExtractReceiptTextFromFile.mockResolvedValueOnce(rawReceipt);

      const expiredReload = await resolveAndScanReceiptFile(file, { userId: "user-1" });
      expect(expiredReload.ok).toBe(true);
      expect(expiredReload.parsed?.extractionSource).toBe("local_deterministic");
      expect(mockExtractReceiptTextFromFile).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("retorna status multi_statement para extratos bancários com múltiplas linhas datadas sem gravar no cache", async () => {
    const statementText = `
      Extrato de Conta Corrente
      01/11/2026 SUPERMERCADO A R$ 120,00
      03/11/2026 FARMACIA B R$ 45,90
      05/11/2026 POSTO C R$ 210,00
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(statementText);

    const file = new File(["statement-bytes"], "extrato.pdf", {
      type: "application/pdf",
    });

    const result = await resolveAndScanReceiptFile(file, { userId: "user-1" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("multi_statement");
    expect(result.multiplicity).toBe("multi_statement");
    expect(localStorage.getItem("financas_user-1_receipt_scan_cache_v1")).toBeNull();
  });

  it("propaga userContext para classificar entrada (income) via titularidade e preencher confidenceScore", async () => {
    const raw = `
      Comprovante de transferência Pix
      Valor Pago: R$ 850,00
      Data: 22/11/2026
      Destino
      GABRIEL SALES
      CPF: ***.456.789-**
      Origem
      ANA PAULA FERREIRA
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(raw);

    const file = new File(["incoming-pix"], "pix-recebido.pdf", {
      type: "application/pdf",
    });

    const result = await resolveAndScanReceiptFile(file, {
      userId: "user-1",
      userContext: { userFullName: "Gabriel Sales" },
    });

    expect(result.ok).toBe(true);
    expect(result.parsed?.nature).toBe("income");
    expect(result.parsed?.type).toBe("income");
    expect(result.parsed?.amountCents).toBe(85000);
    expect(result.parsed?.description).toMatch(/Ana Paula/i);
    expect(result.parsed?.confidence).toBe("high");
    expect(result.parsed?.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(result.parsed?.isSameTitularity).toBe(false);
    expect(mockExtractSingleReceiptWithAi).not.toHaveBeenCalled();
  });

  it("não aciona Micro-IA em documento multi_statement nem quando isReadOnlyMode = true", async () => {
    const statementText = `
      Fatura Mensal
      01/11/2026 MERCADO X R$ 100,00
      02/11/2026 FARMACIA Y R$ 50,00
      03/11/2026 UBER Z R$ 25,00
    `;
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(statementText);
    const statementFile = new File(["stmt"], "fatura.pdf", { type: "application/pdf" });
    const resStmt = await resolveAndScanReceiptFile(statementFile, { userId: "user-1" });
    expect(resStmt.status).toBe("multi_statement");
    expect(mockExtractSingleReceiptWithAi).not.toHaveBeenCalled();

    mockExtractReceiptTextFromFile.mockResolvedValueOnce("   ");
    const emptyImg = new File(["blank-ro"], "ro.jpg", { type: "image/jpeg" });
    const resReadOnly = await resolveAndScanReceiptFile(emptyImg, {
      userId: "user-1",
      isReadOnlyMode: true,
    });
    expect(resReadOnly.status).toBe("empty_text");
    expect(mockExtractSingleReceiptWithAi).not.toHaveBeenCalled();
  });

  it("aciona fallback Vision em empty_text e exibe aviso calmo se cota estiver esgotada", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("");
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: true,
      cached: false,
      source: "ai_vision",
      data: {
        amountCents: 6450,
        date: "2026-11-23",
        nature: "expense",
        paymentMethod: "pix",
        receiptKind: "pix",
        description: "Restaurante Sabor",
        merchantOrBeneficiary: "Restaurante Sabor",
        confidence: "high",
      },
    });

    const imgFile = new File(["scan-image-1"], "comprovante.jpg", { type: "image/jpeg" });
    const aiRecovered = await resolveAndScanReceiptFile(imgFile, { userId: "user-1" });

    expect(aiRecovered.ok).toBe(true);
    expect(aiRecovered.parsed?.amountCents).toBe(6450);
    expect(aiRecovered.parsed?.extractionSource).toBe("ai_vision");
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledTimes(1);

    mockExtractReceiptTextFromFile.mockResolvedValueOnce("");
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: false,
      reason: "quota_exceeded",
      fallbackToLocal: true,
      quotaResetAt: "2026-11-24T00:00:00-03:00",
    });

    const quotaImg = new File(["scan-image-2"], "sem-cota.jpg", { type: "image/jpeg" });
    const quotaRes = await resolveAndScanReceiptFile(quotaImg, { userId: "user-1" });

    expect(quotaRes.ok).toBe(false);
    expect(quotaRes.status).toBe("empty_text");
    expect(quotaRes.aiFallbackReason).toBe("quota_exceeded");
    expect(quotaRes.errorMessage).not.toMatch(/cota|renova/i);
    expect(quotaRes.errorMessage).toMatch(/PDF digital|nítido/i);
  });

  it("quando confiança local < 0.85 e Micro-IA falha/esgota, degrada silenciosamente para resultado local", async () => {
    // Recibo mínimo ambíguo (confidenceScore < 0.85 no parser local)
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("Pagamento R$ 42,00");
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: false,
      reason: "timeout",
      fallbackToLocal: true,
    });

    const lowConfFile = new File(["low-conf"], "ambiguo.png", { type: "image/png" });
    const res = await resolveAndScanReceiptFile(lowConfFile, { userId: "user-1" });

    expect(res.ok).toBe(true);
    expect(res.parsed?.amountCents).toBe(4200);
    expect(res.parsed?.extractionSource).toBe("local_deterministic");
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledTimes(1);
  });

  it("preserva resultado local quando IA retorna confiança inferior (Never-Degrade) e preserva data local quando IA omite data", async () => {
    // 1. Parser local retorna score médio (~0.5-0.75) e IA retorna low (0.45) -> mantém local
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Pagamento\nValor: R$ 88,00\nData: 20/11/2026",
    );
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: true,
      cached: false,
      source: "ai_text",
      data: {
        amountCents: 8800,
        date: null,
        nature: "expense",
        paymentMethod: "pix",
        receiptKind: "pix",
        description: "Chute IA",
        confidence: "low",
      },
    });

    const lowAiFile = new File(["low-ai"], "never-degrade.png", { type: "image/png" });
    const preserved = await resolveAndScanReceiptFile(lowAiFile, { userId: "user-1" });

    expect(preserved.ok).toBe(true);
    expect(preserved.parsed?.extractionSource).toBe("local_deterministic");
    expect(preserved.parsed?.amountCents).toBe(8800);

    // 2. Quando IA tem confiança >= local (medium/high), aceita e herda data determinística local se date=null
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Comprovante\nR$ 134,50\n19/11/2026",
    );
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: true,
      cached: false,
      source: "ai_text",
      data: {
        amountCents: 13450,
        date: null,
        nature: "expense",
        paymentMethod: "pix",
        receiptKind: "pix",
        description: "Mercadinho Central",
        merchantOrBeneficiary: "Mercadinho Central",
        confidence: "high",
      },
    });

    const fallbackDateFile = new File(["keep-date"], "keep-date.png", { type: "image/png" });
    const upgraded = await resolveAndScanReceiptFile(fallbackDateFile, { userId: "user-1" });

    expect(upgraded.ok).toBe(true);
    expect(upgraded.parsed?.extractionSource).toBe("ai_text");
    expect(upgraded.parsed?.date).toBe("2026-11-19");
    expect(upgraded.parsed?.fieldConfidence?.date).toBe("medium");
  });

  it("calcula SHA-256 canônico mesmo sem crypto.subtle e aciona IA com preferVision em imagem não reconhecida", async () => {
    const subtleDesc = Object.getOwnPropertyDescriptor(globalThis.crypto, "subtle");
    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: undefined,
    });

    try {
      const abcBlob = new Blob(["abc"], { type: "text/plain" });
      const hash = await computeFileSha256(abcBlob);
      // SHA-256 canônico FIPS 180-4 de "abc"
      expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

      mockExtractReceiptTextFromFile.mockResolvedValueOnce(
        "Texto ruidoso de OCR sem valores ou banco identificaveis na foto",
      );
      mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
        ok: true,
        cached: false,
        source: "ai_vision",
        data: {
          amountCents: 3750,
          date: "2026-11-23",
          nature: "expense",
          paymentMethod: "pix",
          receiptKind: "pix",
          description: "Cafe Esquina",
          merchantOrBeneficiary: "Cafe Esquina",
          confidence: "high",
        },
      });

      const img = new File(["image-payload"], "foto-pix.jpg", { type: "image/jpeg" });
      const res = await resolveAndScanReceiptFile(img, { userId: "user-1" });

      expect(res.ok).toBe(true);
      expect(res.parsed?.amountCents).toBe(3750);
      expect(res.parsed?.extractionSource).toBe("ai_vision");
      expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledWith(
        expect.objectContaining({
          preferVision: true,
          imageBlob: expect.any(File),
        }),
      );
    } finally {
      if (subtleDesc) {
        Object.defineProperty(globalThis.crypto, "subtle", subtleDesc);
      }
    }
  });

  it("reconhece arquivo .avif com MIME application/octet-stream como imagem raster para IA Vision e informa instabilidade quando upstream falha", async () => {
    mockExtractReceiptTextFromFile.mockResolvedValueOnce("");
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: true,
      cached: false,
      source: "ai_vision",
      data: {
        amountCents: 1330,
        date: "2024-04-04",
        nature: "expense",
        paymentMethod: "cash",
        receiptKind: "generic",
        description: "Nextar",
        merchantOrBeneficiary: "Nextar",
        isSameTitularity: false,
        confidence: "high",
      },
    });

    const avifOctetFile = new File(["avif-payload"], "comprovante.avif", {
      type: "application/octet-stream",
    });
    const okRes = await resolveAndScanReceiptFile(avifOctetFile, { userId: "user-1" });

    expect(okRes.ok).toBe(true);
    expect(okRes.parsed?.amountCents).toBe(1330);
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        preferVision: true,
        imageBlob: expect.any(File),
      }),
    );

    mockExtractReceiptTextFromFile.mockResolvedValueOnce("");
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: false,
      reason: "upstream_unavailable",
      fallbackToLocal: true,
    });

    const unstableFile = new File(["jpg-payload"], "foto-pendente.jpg", {
      type: "image/jpeg",
    });
    const unstableRes = await resolveAndScanReceiptFile(unstableFile, { userId: "user-1" });

    expect(unstableRes.ok).toBe(false);
    expect(unstableRes.status).toBe("empty_text");
    expect(unstableRes.aiFallbackReason).toBe("upstream_unavailable");
    expect(unstableRes.errorMessage).toMatch(/temporariamente instável/i);
  });

  it("usa fast-path AI Vision direto em imagem Web sem chamar OCR local quando IA retorna categoria/CNPJ, e faz fallback local sem rechamar IA na cota", async () => {
    const categories = [
      { id: "cat-casa", name: "Casa", type: "expense" as const },
      { id: "cat-lazer", name: "Lazer", type: "expense" as const },
    ];
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: true,
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
        isSameTitularity: null,
        confidence: "high",
      },
    });

    const jpgFile = new File(["jpg-fast-path"], "moleza-fast.jpg", {
      type: "image/jpeg",
    });
    const fastRes = await resolveAndScanReceiptFile(jpgFile, {
      userId: "user-1",
      categories,
      preferFastAiVisionForWebImages: true,
    });

    expect(fastRes.ok).toBe(true);
    expect(mockExtractReceiptTextFromFile).not.toHaveBeenCalled();
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledTimes(1);
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        preferVision: true,
        categories,
      }),
    );
    expect(fastRes.parsed?.aiCategoryId).toBe("cat-casa");
    expect(fastRes.parsed?.taxId).toBe("88709563000102");

    // Se fast-path falhar por cota excedida, cai para OCR local sem rechamar IA uma 2a vez
    mockExtractSingleReceiptWithAi.mockResolvedValueOnce({
      ok: false,
      reason: "quota_exceeded",
      fallbackToLocal: true,
    });
    mockExtractReceiptTextFromFile.mockResolvedValueOnce(
      "Comprovante Pix Nubank\nValor: R$ 85,00\nPara: Padaria Central\nData: 22/10/2026",
    );

    const quotaFallbackFile = new File(["jpg-quota-fallback"], "quota-fallback.jpg", {
      type: "image/jpeg",
    });
    const fallbackRes = await resolveAndScanReceiptFile(quotaFallbackFile, {
      userId: "user-1",
      categories,
      preferFastAiVisionForWebImages: true,
    });

    expect(fallbackRes.ok).toBe(true);
    expect(fallbackRes.parsed?.amountCents).toBe(8500);
    expect(mockExtractReceiptTextFromFile).toHaveBeenCalledTimes(1);
    expect(mockExtractSingleReceiptWithAi).toHaveBeenCalledTimes(2);
  });

  it("prioriza memória aprendida do usuário sobre aiCategoryId no resolveReceiptTransaction e preserva aiCategoryId quando não há memória", () => {
    const learnedMemory: MerchantLearningMemory = {
      "88709563000102": {
        friendlyName: "Rede Moleza Favorita",
        categorySlug: "uuid-cat-aprendida",
        cnpjOrCpf: "88709563000102",
        rawAliases: ["REDE MOLEZA"],
        usageCount: 3,
        lastUsedAt: "2026-11-23T12:00:00.000Z",
      },
    };

    const baseReceipt: UniversalReceiptData = {
      id: "ai-test-1",
      kind: "invoice_danfe",
      nature: "expense",
      amountCents: 27000,
      date: "2024-05-09",
      description: "REDE MOLEZA",
      merchantOrBeneficiary: "REDE MOLEZA",
      taxId: "88709563000102",
      paymentMethod: "cash",
      rawCleanText: "",
      aiCategoryId: "cat-casa",
      confidence: "high",
      extractionSource: "ai_vision",
    };

    const withMemory = resolveReceiptTransaction(baseReceipt, {
      userMemory: learnedMemory,
    });

    expect(withMemory.identity.isLearned).toBe(true);
    expect(withMemory.identity.categorySlug).toBe("uuid-cat-aprendida");
    expect(withMemory.parsed.aiCategoryId).toBe("cat-casa");

    const withoutMemory = resolveReceiptTransaction(baseReceipt, {
      userMemory: {},
    });

    expect(withoutMemory.identity.isLearned).toBe(false);
    expect(withoutMemory.parsed.aiCategoryId).toBe("cat-casa");
  });
});
