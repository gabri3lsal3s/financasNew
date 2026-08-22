/**
 * Parser puro e ultra-leve de planilhas Excel (.xlsx) sem dependências externas pesadas.
 *
 * Utiliza o padrão OpenXML e a API nativa DecompressionStream ("deflate-raw")
 * suportada em todos os navegadores modernos e Node 20+.
 */

/**
 * Descompacta as entradas de um arquivo ZIP (.xlsx) em memória.
 */
export async function parseZipEntries(buffer: ArrayBuffer): Promise<Map<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = new Map<string, string>();

  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const filenameLength = view.getUint16(offset + 26, true);
    const extraFieldLength = view.getUint16(offset + 28, true);

    const filenameBytes = bytes.subarray(offset + 30, offset + 30 + filenameLength);
    const filename = new TextDecoder("utf-8").decode(filenameBytes);

    const dataStart = offset + 30 + filenameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd <= bytes.length && (compressedSize > 0 || uncompressedSize > 0)) {
      const rawData = bytes.subarray(dataStart, dataEnd);
      let content = "";
      if (compressionMethod === 0) {
        content = new TextDecoder("utf-8").decode(rawData);
      } else if (compressionMethod === 8) {
        try {
          const ds = new DecompressionStream("deflate-raw");
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(rawData);
              controller.close();
            },
          }).pipeThrough(ds);
          content = await new Response(stream).text();
        } catch {
          // Ignora entrada corrompida
        }
      }
      if (content) {
        entries.set(filename, content);
      }
    }

    if (compressedSize > 0) {
      offset = dataEnd;
    } else {
      let nextPk = offset + 30 + filenameLength + extraFieldLength;
      while (nextPk + 4 < bytes.length) {
        if (view.getUint32(nextPk, true) === 0x04034b50 || view.getUint32(nextPk, true) === 0x02014b50) {
          break;
        }
        nextPk++;
      }
      offset = nextPk;
    }
  }

  return entries;
}

/**
 * Converte coluna de Excel ("A", "B", "AA", etc.) em índice 0-based.
 */
function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Decodifica entidades XML comuns.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extrai a tabela de strings compartilhadas (`xl/sharedStrings.xml`).
 */
export function parseSharedStringsXml(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>(.*?)<\/si>/gs;
  let siMatch: RegExpExecArray | null;

  while ((siMatch = siRegex.exec(xml)) !== null) {
    const siContent = siMatch[1] ?? "";
    const tRegex = /<t\b[^>]*>(.*?)<\/t>/gs;
    let fullText = "";
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      fullText += tMatch[1] ?? "";
    }
    strings.push(decodeXmlEntities(fullText));
  }

  return strings;
}

/**
 * Converte o XML de uma planilha do Excel (`sheet1.xml`) e sua tabela de strings em CSV pt-BR (;).
 */
export function parseWorksheetXmlToCsv(sheetXml: string, sharedStrings: string[]): string {
  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>(.*?)<\/row>/gs;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowContent = rowMatch[1] ?? "";
    const cellRegex = /<c\b([^>]*)>(.*?)<\/c>/gs;
    let cellMatch: RegExpExecArray | null;
    const cellsByCol: Record<number, string> = {};
    let maxCol = -1;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1] ?? "";
      const inner = cellMatch[2] ?? "";

      const rMatch = /\br="([A-Z]+)\d+"/i.exec(attrs);
      if (!rMatch || !rMatch[1]) continue;

      const colIdx = colLetterToIndex(rMatch[1].toUpperCase());
      maxCol = Math.max(maxCol, colIdx);

      const isSharedString = /\bt="s"/i.test(attrs);
      const isInlineString = /\bt="inlineStr"/i.test(attrs);

      let val = "";
      if (isSharedString) {
        const vMatch = /<v\b[^>]*>(.*?)<\/v>/i.exec(inner);
        if (vMatch && vMatch[1]) {
          const strIdx = Number.parseInt(vMatch[1], 10);
          val = sharedStrings[strIdx] ?? "";
        }
      } else if (isInlineString) {
        const tMatch = /<t\b[^>]*>(.*?)<\/t>/i.exec(inner);
        if (tMatch && tMatch[1]) {
          val = decodeXmlEntities(tMatch[1]);
        }
      } else {
        const vMatch = /<v\b[^>]*>(.*?)<\/v>/i.exec(inner);
        if (vMatch && vMatch[1]) {
          val = decodeXmlEntities(vMatch[1]);
        }
      }

      cellsByCol[colIdx] = val.trim();
    }

    if (maxCol >= 0) {
      const rowArr: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        rowArr.push(cellsByCol[c] ?? "");
      }
      rows.push(rowArr);
    }
  }

  return rows.map((r) => r.map((cell) => (cell.includes(";") ? `"${cell}"` : cell)).join(";")).join("\n");
}

/**
 * Converte um buffer de arquivo .xlsx em texto CSV compatível com nosso motor de parsing.
 */
export async function parseXlsxToCsv(buffer: ArrayBuffer): Promise<string> {
  const entries = await parseZipEntries(buffer);
  if (entries.size === 0) return "";

  // 1. Tabela de strings compartilhadas
  const sharedStringsXml = entries.get("xl/sharedStrings.xml") ?? entries.get("xl/SharedStrings.xml") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStringsXml(sharedStringsXml) : [];

  // 2. Localiza a primeira planilha (sheet1.xml ou similar)
  let sheetXml = entries.get("xl/worksheets/sheet1.xml") ?? entries.get("xl/worksheets/Sheet1.xml") ?? "";
  if (!sheetXml) {
    for (const [name, content] of entries.entries()) {
      if (name.startsWith("xl/worksheets/") && name.endsWith(".xml")) {
        sheetXml = content;
        break;
      }
    }
  }

  if (!sheetXml) return "";

  return parseWorksheetXmlToCsv(sheetXml, sharedStrings);
}
