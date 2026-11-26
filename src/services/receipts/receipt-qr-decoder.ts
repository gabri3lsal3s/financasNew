import { toISODate } from "@/domain/money/parcelar";
import { parseClipboardTransactionCandidate } from "@/domain/notifications/pix-clipboard";
import { parseNfceQrCodeUrl } from "@/domain/notifications/danfe-nfc-parser";
import { type UniversalReceiptData } from "@/domain/notifications/receipt-types";

interface BarcodeDetectorHit {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<BarcodeDetectorHit[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

export interface DecodedReceiptQrResult {
  rawPayload: string;
  /** Preenchido quando o QR já entrega valor + contraparte suficientes (ex.: Pix Copia e Cola ou NFC-e com vNF). */
  directUniversal?: UniversalReceiptData;
  /** Metadados parciais (ex.: CNPJ e chave fiscal da NFC-e) para enriquecer OCR/Vision quando vNF não vem na URL. */
  partialMetadata?: {
    taxId?: string;
    nfeAccessKey?: string;
    merchantOrBeneficiary?: string;
  };
}

/**
 * Tenta ler QR Code nativamente no navegador via `BarcodeDetector` (custo zero, < 20ms)
 * para resolver instantaneamente Pix Copia e Cola ou metadados fiscais de NFC-e.
 */
export async function tryDecodeReceiptQrFromBlob(
  blob: Blob,
): Promise<DecodedReceiptQrResult | null> {
  const DetectorCtor = (
    globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
  ).BarcodeDetector;
  if (typeof DetectorCtor !== "function" || typeof createImageBitmap !== "function") {
    return null;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const detector = new DetectorCtor({ formats: ["qr_code"] });
    const hits = await detector.detect(bitmap);
    const rawPayload = hits.find((h) => typeof h.rawValue === "string" && h.rawValue.trim())?.rawValue?.trim();
    if (!rawPayload) return null;

    const clip = parseClipboardTransactionCandidate(rawPayload);
    if (clip && clip.kind === "PIX_BRCODE" && clip.valueCents > 0) {
      return {
        rawPayload,
        directUniversal: {
          id: `qr_pix_${Date.now()}`,
          kind: "pix",
          nature: clip.nature,
          amountCents: clip.valueCents,
          date: clip.date || toISODate(new Date()),
          description: clip.description,
          paymentMethod: "pix",
          merchantOrBeneficiary: clip.merchant || clip.recipientName,
          pixKey: clip.pixKey,
          txId: clip.txId,
          taxId: clip.taxId,
          rawCleanText: rawPayload,
          confidence: "high",
          confidenceScore: 0.96,
          fieldConfidence: {
            amount: "high",
            counterparty: clip.recipientName || clip.merchant ? "high" : "medium",
            nature: "high",
            date: clip.date ? "high" : "low",
          },
          extractionSource: "local_deterministic",
        },
      };
    }

    const nfce = parseNfceQrCodeUrl(rawPayload);
    if (nfce) {
      if (nfce.amountCents > 0) {
        return { rawPayload, directUniversal: nfce };
      }
      return {
        rawPayload,
        partialMetadata: {
          taxId: nfce.taxId,
          nfeAccessKey: nfce.nfeAccessKey,
          merchantOrBeneficiary: nfce.merchantOrBeneficiary,
        },
      };
    }

    return { rawPayload };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
