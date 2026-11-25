/**
 * Sniffer de Magic Bytes e Cabeçalho de Conteúdo (Estágio 0).
 * Identifica o formato real do arquivo antes de confiar na extensão ou MIME type,
 * validando ZIP OOXML/ODS, diferenciando `.xls` BIFF8 de `.xlsx` criptografado (MS-OFFCRYPTO)
 * e suportando imagens rasterizadas (incl. HEIC/HEIF/AVIF).
 */

import { isEncryptedOle2OfficeFile } from "./ole2-crypto";

export type DetectedFileKind =
  | "pdf"
  | "xlsx"
  | "encrypted_xlsx"
  | "ods"
  | "xls_biff8"
  | "unsupported_archive"
  | "ofx"
  | "html_or_xml_sheet"
  | "image"
  | "text_or_csv";

function startsWithBytes(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function isXlsxEntryName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower === "xl/workbook.xml" || lower.startsWith("xl/worksheets/");
}

function collectZipEntryNames(bytes: Uint8Array): Set<string> {
  const decoder = new TextDecoder("utf-8");
  const names = new Set<string>();

  const minEocd = 22;
  if (bytes.length >= minEocd) {
    const maxScan = Math.max(0, bytes.length - 65_557);
    for (let i = bytes.length - minEocd; i >= maxScan; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        const totalEntries = readUint16LE(bytes, i + 10);
        const centralOffset = readUint32LE(bytes, i + 16);
        let cursor = centralOffset;
        for (let idx = 0; idx < totalEntries && cursor + 46 <= bytes.length; idx++) {
          if (
            bytes[cursor] !== 0x50 ||
            bytes[cursor + 1] !== 0x4b ||
            bytes[cursor + 2] !== 0x01 ||
            bytes[cursor + 3] !== 0x02
          ) {
            break;
          }
          const nameLen = readUint16LE(bytes, cursor + 28);
          const extraLen = readUint16LE(bytes, cursor + 30);
          const commentLen = readUint16LE(bytes, cursor + 32);
          const nameStart = cursor + 46;
          const nameEnd = nameStart + nameLen;
          if (nameEnd > bytes.length) break;
          names.add(decoder.decode(bytes.subarray(nameStart, nameEnd)).trim().toLowerCase());
          cursor = nameEnd + extraLen + commentLen;
        }
        break;
      }
    }
  }

  if (names.size > 0) return names;

  let localCursor = 0;
  let checkedHeaders = 0;
  while (localCursor + 30 <= bytes.length && checkedHeaders < 128) {
    if (
      bytes[localCursor] !== 0x50 ||
      bytes[localCursor + 1] !== 0x4b ||
      bytes[localCursor + 2] !== 0x03 ||
      bytes[localCursor + 3] !== 0x04
    ) {
      break;
    }
    const compSize = readUint32LE(bytes, localCursor + 18);
    const nameLen = readUint16LE(bytes, localCursor + 26);
    const extraLen = readUint16LE(bytes, localCursor + 28);
    const nameStart = localCursor + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.length) break;
    names.add(decoder.decode(bytes.subarray(nameStart, nameEnd)).trim().toLowerCase());
    checkedHeaders += 1;
    localCursor = nameEnd + extraLen + compSize;
  }

  return names;
}

function classifyZipArchiveKind(bytes: Uint8Array, fileNameOrType: string): "xlsx" | "ods" | "unsupported_archive" {
  const names = collectZipEntryNames(bytes);
  for (const name of names) {
    if (isXlsxEntryName(name)) return "xlsx";
  }

  const hasContentXml = names.has("content.xml");
  if (hasContentXml) {
    const headText = new TextDecoder("iso-8859-1").decode(
      bytes.subarray(0, Math.min(bytes.length, 512)),
    );
    const lowerName = fileNameOrType.trim().toLowerCase();
    if (
      headText.includes("oasis.opendocument.spreadsheet") ||
      lowerName.endsWith(".ods") ||
      lowerName.includes("opendocument.spreadsheet") ||
      (names.has("mimetype") && names.has("meta-inf/manifest.xml") && !headText.includes("opendocument.text") && !headText.includes("opendocument.presentation"))
    ) {
      return "ods";
    }
  }

  return "unsupported_archive";
}

const ISO_BMFF_IMAGE_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
  "avif",
  "avis",
]);

function isHeicOrAvifBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (
    bytes[4] !== 0x66 ||
    bytes[5] !== 0x74 ||
    bytes[6] !== 0x79 ||
    bytes[7] !== 0x70
  ) {
    return false;
  }
  const brand = String.fromCharCode(
    bytes[8] ?? 0,
    bytes[9] ?? 0,
    bytes[10] ?? 0,
    bytes[11] ?? 0,
  ).toLowerCase();
  if (ISO_BMFF_IMAGE_BRANDS.has(brand)) {
    return true;
  }

  const boxSize = Math.min(bytes.length, readUint32LE(bytes, 0) || 32);
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    const compatBrand = String.fromCharCode(
      bytes[offset] ?? 0,
      bytes[offset + 1] ?? 0,
      bytes[offset + 2] ?? 0,
      bytes[offset + 3] ?? 0,
    ).toLowerCase();
    if (ISO_BMFF_IMAGE_BRANDS.has(compatBrand)) {
      return true;
    }
  }
  return false;
}

/**
 * Inspeciona magic bytes binários e, quando aplicável, o preâmbulo textual (primeiros 4 KB).
 */
export function detectFileKindFromBytes(
  bytes: Uint8Array,
  fileNameOrType = "",
): DetectedFileKind {
  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return "pdf";
  }

  // 2. ZIP OOXML (.xlsx/.xlsm) ou OpenDocument Spreadsheet (.ods)
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return classifyZipArchiveKind(bytes, fileNameOrType);
  }

  // 3. OLE2 / CFBF: distingue OOXML criptografado (MS-OFFCRYPTO) de Excel BIFF8 legado (.xls)
  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    return isEncryptedOle2OfficeFile(bytes) ? "encrypted_xlsx" : "xls_biff8";
  }

  // 4. Imagens rasterizadas (PNG, JPEG, WEBP, HEIC/HEIF/AVIF)
  const isPng = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]);
  const isJpeg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  const isWebp =
    bytes.length >= 12 &&
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isPng || isJpeg || isWebp || isHeicOrAvifBytes(bytes)) {
    return "image";
  }

  // 5. Inspeção textual dos primeiros 4 KB (OFX, HTML/SpreadsheetML)
  const headSlice = bytes.subarray(0, Math.min(bytes.length, 4096));
  let headText: string;
  try {
    headText = new TextDecoder("iso-8859-1").decode(headSlice);
  } catch {
    headText = "";
  }

  const trimmedHead = headText.replace(/^[\uFEFF\uFFFE\s]+/, "");
  if (
    /^OFXHEADER\s*:/i.test(trimmedHead) ||
    /<OFX[\s>]/i.test(trimmedHead) ||
    /<STMTTRN[\s>]/i.test(trimmedHead)
  ) {
    return "ofx";
  }

  if (
    /<table[\s>]/i.test(trimmedHead) ||
    /<tr[\s>]/i.test(trimmedHead) ||
    (/<Workbook[\s>]/i.test(trimmedHead) && /<Row[\s>]/i.test(trimmedHead))
  ) {
    return "html_or_xml_sheet";
  }

  // 6. Fallback por extensão/MIME apenas quando os bytes não entregaram assinatura binária
  const lower = fileNameOrType.trim().toLowerCase();
  if (lower.endsWith(".pdf") || lower.includes("application/pdf")) return "pdf";
  if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) return "ofx";
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif") ||
    lower.endsWith(".avif") ||
    lower.startsWith("image/")
  ) {
    return "image";
  }
  if (lower.endsWith(".ods") || lower.includes("opendocument.spreadsheet")) {
    return "ods";
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xlsm") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.includes("spreadsheetml") ||
    lower.includes("ms-excel")
  ) {
    return lower.endsWith(".xlsx") || lower.endsWith(".xlsm")
      ? "xlsx"
      : "html_or_xml_sheet";
  }

  return "text_or_csv";
}
