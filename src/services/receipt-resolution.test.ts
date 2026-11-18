import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFileSha256,
  resolveAndScanReceiptFile,
  resolveReceiptFromText,
} from "./receipt-resolution";
import * as nativeService from "@/services/native";
import type { CreditCard } from "@/types/schema";

const mockExtractReceiptTextFromFile = vi.fn();
const mockProcessPixShare = vi.fn();

vi.mock("@/services/native", () => ({
  MAX_RECEIPT_FILE_SIZE_BYTES: 15 * 1024 * 1024,
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
    mockProcessPixShare.mockReturnValue(null);
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
    vi.spyOn(nativeService, "processPixShare").mockReturnValueOnce({
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
});
