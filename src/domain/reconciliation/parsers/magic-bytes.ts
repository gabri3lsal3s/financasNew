/**
 * Sniffer de Magic Bytes e Cabeçalho de Conteúdo (Camada 0).
 * Identifica o formato real do arquivo antes de confiar na extensão ou MIME type,
 * protegendo arquivos baixados sem extensão (Android/WhatsApp) ou .xls disfarçados.
 */

export type DetectedFileKind =
  | "pdf"
  | "xlsx"
  | "xls_biff8"
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

  // 2. ZIP / XLSX: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return "xlsx";
  }

  // 3. OLE2 / BIFF8 (.xls legado Excel 97-2003): D0 CF 11 E0
  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0])) {
    return "xls_biff8";
  }

  // 4. Imagens rasterizadas (PNG, JPEG, WEBP)
  const isPng = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]);
  const isJpeg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  const isWebp =
    bytes.length >= 12 &&
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isPng || isJpeg || isWebp) {
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
    lower.startsWith("image/")
  ) {
    return "image";
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.includes("spreadsheetml") ||
    lower.includes("ms-excel")
  ) {
    return lower.endsWith(".xlsx") ? "xlsx" : "html_or_xml_sheet";
  }

  return "text_or_csv";
}
