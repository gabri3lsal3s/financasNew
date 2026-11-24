import type { RawParsedRow } from "../types";
import { decodeBufferToString, parseCsvToRows } from "./csv-parser";
import { normalizeDateToISO, parseAmountToCents } from "./type-sniffer";

interface ZipCentralEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
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

function isZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/**
 * Detecta se o arquivo é um arquivo binário OLE2/CFBF (Excel 97-2003 .xls no formato BIFF8).
 * Magic bytes canônicos: 0xD0, 0xCF, 0x11, 0xE0.
 */
export function isBiff8Excel(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  );
}

function parseZipCentralDirectory(bytes: Uint8Array): ZipCentralEntry[] {
  const minEocdSize = 22;
  if (bytes.length < minEocdSize) return [];

  const maxCommentScan = Math.max(0, bytes.length - 65_557);
  let eocdOffset = -1;
  for (let i = bytes.length - minEocdSize; i >= maxCommentScan; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const totalEntries = readUint16LE(bytes, eocdOffset + 10);
  const centralDirOffset = readUint32LE(bytes, eocdOffset + 16);
  const decoder = new TextDecoder("utf-8");
  const entries: ZipCentralEntry[] = [];

  let cursor = centralDirOffset;
  for (let idx = 0; idx < totalEntries && cursor + 46 <= bytes.length; idx++) {
    if (
      bytes[cursor] !== 0x50 ||
      bytes[cursor + 1] !== 0x4b ||
      bytes[cursor + 2] !== 0x01 ||
      bytes[cursor + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = readUint16LE(bytes, cursor + 10);
    const compressedSize = readUint32LE(bytes, cursor + 20);
    const uncompressedSize = readUint32LE(bytes, cursor + 24);
    const fileNameLen = readUint16LE(bytes, cursor + 28);
    const extraLen = readUint16LE(bytes, cursor + 30);
    const commentLen = readUint16LE(bytes, cursor + 32);
    const localHeaderOffset = readUint32LE(bytes, cursor + 42);

    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLen;
    if (nameEnd > bytes.length) break;

    const name = decoder.decode(bytes.subarray(nameStart, nameEnd));
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    cursor = nameEnd + extraLen + commentLen;
  }

  return entries;
}

async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Ambiente sem suporte a descompactação nativa para arquivo XLSX.");
  }
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  void writer.write(copy).then(() => writer.close());

  const response = new Response(stream.readable);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function extractZipEntryText(
  archiveBytes: Uint8Array,
  entry: ZipCentralEntry,
): Promise<string> {
  const localOffset = entry.localHeaderOffset;
  if (
    localOffset + 30 > archiveBytes.length ||
    archiveBytes[localOffset] !== 0x50 ||
    archiveBytes[localOffset + 1] !== 0x4b
  ) {
    return "";
  }

  const fileNameLen = readUint16LE(archiveBytes, localOffset + 26);
  const extraLen = readUint16LE(archiveBytes, localOffset + 28);
  const dataStart = localOffset + 30 + fileNameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > archiveBytes.length) return "";

  const slice = archiveBytes.subarray(dataStart, dataEnd);
  const decoder = new TextDecoder("utf-8");

  if (entry.compressionMethod === 0) {
    return decoder.decode(slice);
  }
  if (entry.compressionMethod === 8) {
    const decompressed = await inflateRawBytes(slice);
    return decoder.decode(decompressed);
  }
  return "";
}

function columnLettersToIndex(cellRef: string): number {
  const match = /^([A-Z]+)/i.exec(cellRef.trim());
  if (!match?.[1]) return -1;
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function excelSerialToIsoDate(serial: number): string | null {
  // Intervalo plausível de datas bancárias: 1995 (34700) a 2065 (60265)
  if (!Number.isFinite(serial) || serial < 34_700 || serial > 60_265) {
    return null;
  }
  // Base Excel 1899-12-30 UTC (corrige o bug histórico de 1900-02-29 do Lotus/Excel)
  const wholeDays = Math.floor(serial);
  const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86_400_000;
  const dt = new Date(utcMs);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Normaliza valores numéricos crus extraídos do XML de planilhas `.xlsx`:
 * - Expande notação científica (ex.: `2.5E+3` -> `2500`).
 * - NÃO aplica `.toFixed(2)` em inteiros (preserva datas seriais não estilizadas e finais de cartão).
 * - Corrige ruído de ponto flutuante IEEE-754 (ex.: `140.49999999999997` -> `140.50`)
 *   exclusivamente em floats não-inteiros com desvio `< 1e-6` para 2 casas decimais.
 */
export function normalizeSpreadsheetNumericCellValue(vText: string): string {
  const trimmed = vText.trim();
  if (!trimmed) return "";
  if (!/^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return trimmed;
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num)) return trimmed;

  const isScientific = /[eE][+-]?\d+$/.test(trimmed);
  if (isScientific) {
    if (Number.isInteger(num)) {
      return String(num);
    }
    const rounded2 = Math.round(num * 100) / 100;
    if (Math.abs(num - rounded2) < 1e-6) {
      return rounded2.toFixed(2);
    }
    return String(num);
  }

  // Preserva estritamente inteiros sem forçar casas decimais
  if (Number.isInteger(num)) {
    return trimmed;
  }

  // Corrige apenas ruído IEEE-754 em floats não-inteiros com mais de 2 dígitos decimais
  const dotIdx = trimmed.indexOf(".");
  const decimalDigits = dotIdx >= 0 ? trimmed.length - dotIdx - 1 : 0;
  if (decimalDigits > 2) {
    const rounded2 = Math.round(num * 100) / 100;
    if (Math.abs(num - rounded2) < 1e-6) {
      return rounded2.toFixed(2);
    }
  }

  return trimmed;
}

/**
 * Pontua uma aba de planilha pela quantidade de linhas que possuem
 * simultaneamente ao menos uma célula de data válida e uma célula monetária válida distinta.
 */
export function scoreWorksheetRows(rows: readonly RawParsedRow[]): number {
  let validDataRows = 0;
  for (const row of rows) {
    let dateCellIdx = -1;
    let hasAmountOnOtherCell = false;

    for (let i = 0; i < row.cells.length; i++) {
      const cell = (row.cells[i] ?? "").trim();
      if (!cell) continue;
      if (dateCellIdx === -1 && normalizeDateToISO(cell) !== null) {
        dateCellIdx = i;
        continue;
      }
      if (parseAmountToCents(cell, { preferDotDecimal: true }) !== null) {
        hasAmountOnOtherCell = true;
      }
    }

    // Reavalia se uma célula monetária apareceu antes da célula de data
    if (dateCellIdx > 0 && !hasAmountOnOtherCell) {
      for (let i = 0; i < dateCellIdx; i++) {
        const cell = (row.cells[i] ?? "").trim();
        if (cell && parseAmountToCents(cell, { preferDotDecimal: true }) !== null) {
          hasAmountOnOtherCell = true;
          break;
        }
      }
    }

    if (dateCellIdx !== -1 && hasAmountOnOtherCell) {
      validDataRows++;
    }
  }
  return validDataRows;
}

function parseDateStyleIndicesFromStylesXml(stylesXml: string): Set<number> {
  const dateStyles = new Set<number>();
  if (!stylesXml || typeof DOMParser === "undefined") return dateStyles;

  const doc = new DOMParser().parseFromString(stylesXml, "application/xml");
  const customDateFmtIds = new Set<number>();

  const numFmts = Array.from(doc.getElementsByTagName("numFmt"));
  for (const fmt of numFmts) {
    const id = Number.parseInt(fmt.getAttribute("numFmtId") ?? "", 10);
    const code = (fmt.getAttribute("formatCode") ?? "").toLowerCase();
    // Remove seções entre colchetes ([Red], [$-416]), literais entre aspas e escapes
    const cleanCode = code
      .replace(/\[[^\]]*\]/g, "")
      .replace(/"[^"]*"/g, "")
      .replace(/\\./g, "");
    const hasDateTokens =
      /(?:d+.*m+|m+.*d+|y+.*m+|m+.*y+)/i.test(cleanCode);
    const isNumericOrCurrencyMask =
      /[#%]|r\$|\$|\b0+[.,]0+\b/i.test(cleanCode);
    if (Number.isFinite(id) && hasDateTokens && !isNumericOrCurrencyMask) {
      customDateFmtIds.add(id);
    }
  }

  const cellXfs = doc.getElementsByTagName("cellXfs")[0];
  if (!cellXfs) return dateStyles;

  const xfNodes = Array.from(cellXfs.getElementsByTagName("xf"));
  xfNodes.forEach((xf, styleIdx) => {
    const numFmtId = Number.parseInt(xf.getAttribute("numFmtId") ?? "", 10);
    const isBuiltInDate =
      (numFmtId >= 14 && numFmtId <= 22) ||
      (numFmtId >= 27 && numFmtId <= 36) ||
      (numFmtId >= 45 && numFmtId <= 47);
    if (isBuiltInDate || customDateFmtIds.has(numFmtId)) {
      dateStyles.add(styleIdx);
    }
  });

  return dateStyles;
}

function parseSharedStringsXml(xml: string): string[] {
  if (!xml || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const siNodes = Array.from(doc.getElementsByTagName("si"));
  return siNodes.map((si) => {
    const tNodes = Array.from(si.getElementsByTagName("t"));
    return tNodes.map((t) => t.textContent ?? "").join("").trim();
  });
}

function parseWorksheetXmlToRows(
  sheetXml: string,
  sharedStrings: readonly string[],
  dateStyleIndices: ReadonlySet<number>,
): RawParsedRow[] {
  if (!sheetXml || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(sheetXml, "application/xml");
  const rowNodes = Array.from(doc.getElementsByTagName("row"));
  const rows: RawParsedRow[] = [];
  let rowIndex = 0;

  for (const rowNode of rowNodes) {
    const cellNodes = Array.from(rowNode.getElementsByTagName("c"));
    if (cellNodes.length === 0) continue;

    const cells: string[] = [];
    cellNodes.forEach((cNode, fallbackIdx) => {
      const ref = cNode.getAttribute("r") ?? "";
      const colIdx = ref ? columnLettersToIndex(ref) : fallbackIdx;
      const targetIdx = colIdx >= 0 ? colIdx : fallbackIdx;
      const cellType = cNode.getAttribute("t") ?? "";
      const styleIdx = Number.parseInt(cNode.getAttribute("s") ?? "", 10);

      let value: string;
      if (cellType === "inlineStr") {
        const tNodes = Array.from(cNode.getElementsByTagName("t"));
        value = tNodes.map((t) => t.textContent ?? "").join("").trim();
      } else {
        const vText = (cNode.getElementsByTagName("v")[0]?.textContent ?? "").trim();
        if (cellType === "s") {
          const sIdx = Number.parseInt(vText, 10);
          value = Number.isFinite(sIdx) ? (sharedStrings[sIdx] ?? "") : "";
        } else if (cellType === "d") {
          // Células nativas ISO-8601 do OOXML (t="d"), ex.: "2026-11-15T14:30:00Z" -> "2026-11-15"
          const isoDateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(vText);
          value = isoDateMatch?.[1] ?? vText;
        } else if (cellType === "" || cellType === "n") {
          if (Number.isFinite(styleIdx) && dateStyleIndices.has(styleIdx)) {
            const serial = Number.parseFloat(vText);
            value = excelSerialToIsoDate(serial) ?? vText;
          } else {
            value = normalizeSpreadsheetNumericCellValue(vText);
          }
        } else {
          value = vText;
        }
      }

      while (cells.length <= targetIdx) {
        cells.push("");
      }
      cells[targetIdx] = value;
    });

    while (cells.length > 0 && !(cells[cells.length - 1] ?? "").trim()) {
      cells.pop();
    }

    if (cells.some((c) => c.trim().length > 0)) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: cells.join("\t"),
        cells,
      });
    }
  }

  return rows;
}

function parseHtmlTableToRows(html: string): RawParsedRow[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const trNodes = Array.from(doc.querySelectorAll("tr"));
  const rows: RawParsedRow[] = [];
  let rowIndex = 0;

  for (const tr of trNodes) {
    const cellNodes = Array.from(tr.querySelectorAll("th, td"));
    if (cellNodes.length < 2) continue;
    const cells = cellNodes.map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim());
    if (cells.filter((c) => c.length > 0).length < 2) continue;

    rows.push({
      rowIndex: rowIndex++,
      rawText: cells.join("\t"),
      cells,
    });
  }

  return rows;
}

function parseSpreadsheetMlXmlToRows(xml: string): RawParsedRow[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const rowNodes = Array.from(doc.getElementsByTagName("Row"));
  const rows: RawParsedRow[] = [];
  let rowIndex = 0;

  for (const rowNode of rowNodes) {
    const cellNodes = Array.from(rowNode.getElementsByTagName("Cell"));
    if (cellNodes.length === 0) continue;

    const cells: string[] = [];
    let currentCol = 0;
    for (const cellNode of cellNodes) {
      const ssIndex =
        cellNode.getAttribute("ss:Index") ?? cellNode.getAttribute("Index");
      if (ssIndex) {
        const parsedIdx = Number.parseInt(ssIndex, 10) - 1;
        if (Number.isFinite(parsedIdx) && parsedIdx >= currentCol) {
          currentCol = parsedIdx;
        }
      }
      const dataText = (
        cellNode.getElementsByTagName("Data")[0]?.textContent ??
        cellNode.textContent ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

      while (cells.length <= currentCol) {
        cells.push("");
      }
      cells[currentCol] = dataText;
      currentCol += 1;
    }

    if (cells.filter((c) => c.length > 0).length >= 2) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: cells.join("\t"),
        cells,
      });
    }
  }

  return rows;
}

export function isSpreadsheetOrHtmlFileName(fileNameOrType: string): boolean {
  const lower = fileNameOrType.trim().toLowerCase();
  return (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.includes("spreadsheetml") ||
    lower.includes("ms-excel")
  );
}

/**
 * Converte localmente planilhas bancárias (.xlsx, .xls HTML/XML/TSV e .html)
 * em `RawParsedRow[]` sem depender de bibliotecas pesadas e com custo zero de IA.
 */
export async function parseSpreadsheetOrHtmlToRows(
  input: ArrayBuffer | string,
): Promise<RawParsedRow[]> {
  if (typeof input !== "string") {
    const bytes = new Uint8Array(input);
    if (isBiff8Excel(bytes)) {
      throw new Error(
        "Planilhas no formato binário legado (.xls / Excel 97-2003) não são suportadas diretamente. Exporte ou salve o arquivo como .xlsx ou .csv para importar.",
      );
    }
    if (isZipArchive(bytes)) {
      const entries = parseZipCentralDirectory(bytes);
      const sharedEntry = entries.find(
        (e) => e.name.toLowerCase() === "xl/sharedstrings.xml",
      );
      const stylesEntry = entries.find(
        (e) => e.name.toLowerCase() === "xl/styles.xml",
      );
      const sheetEntries = entries
        .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.name))
        .sort((a, b) => {
          const numA = Number.parseInt(/sheet(\d+)\.xml$/i.exec(a.name)?.[1] ?? "0", 10);
          const numB = Number.parseInt(/sheet(\d+)\.xml$/i.exec(b.name)?.[1] ?? "0", 10);
          return numA - numB;
        });

      if (sheetEntries.length === 0) return [];

      const [sharedXml, stylesXml, ...sheetXmls] = await Promise.all([
        sharedEntry ? extractZipEntryText(bytes, sharedEntry) : Promise.resolve(""),
        stylesEntry ? extractZipEntryText(bytes, stylesEntry) : Promise.resolve(""),
        ...sheetEntries.map((entry) => extractZipEntryText(bytes, entry)),
      ]);

      const sharedStrings = parseSharedStringsXml(sharedXml);
      const dateStyleIndices = parseDateStyleIndicesFromStylesXml(stylesXml);

      let bestRows: RawParsedRow[] = [];
      let bestScore = -1;

      for (const sheetXml of sheetXmls) {
        const candidateRows = parseWorksheetXmlToRows(
          sheetXml,
          sharedStrings,
          dateStyleIndices,
        );
        const score = scoreWorksheetRows(candidateRows);
        if (score > bestScore || (bestRows.length === 0 && candidateRows.length > 0)) {
          bestScore = score;
          bestRows = candidateRows;
        }
      }

      return bestRows;
    }
  }

  const text = typeof input === "string" ? input : decodeBufferToString(input);
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/<table[\s>]/i.test(trimmed) || /<tr[\s>]/i.test(trimmed)) {
    const htmlRows = parseHtmlTableToRows(trimmed);
    if (htmlRows.length > 0) return htmlRows;
  }

  if (/<Workbook[\s>]/i.test(trimmed) && /<Row[\s>]/i.test(trimmed)) {
    const xmlRows = parseSpreadsheetMlXmlToRows(trimmed);
    if (xmlRows.length > 0) return xmlRows;
  }

  return parseCsvToRows(trimmed);
}
