import type { RawParsedRow } from "../types";

/**
 * Remove a diretiva `sep=;` / `sep=,` / `sep=\t` que o Excel e alguns bancos inserem na linha 1.
 */
function stripExcelSepDirective(text: string): {
  cleanedText: string;
  declaredDelimiter?: string;
} {
  const withoutBom = text.replace(/^[\uFEFF\uFFFE]/, "");
  const match = /^\s*sep\s*=\s*([;,\t|])\s*(?:\r?\n|$)/i.exec(withoutBom);
  if (match && match[1]) {
    return {
      cleanedText: withoutBom.slice(match[0].length),
      declaredDelimiter: match[1],
    };
  }
  return { cleanedText: withoutBom };
}

/**
 * Divide o texto CSV em registros RFC-4180 preservando quebras de linha (\n / \r\n)
 * dentro de campos envolvidos por aspas duplas.
 */
export function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      current += ch;
      if (insideQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((ch === "\n" || ch === "\r") && !insideQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    records.push(current);
  }

  return records;
}

/**
 * Conta ocorrências de um delimitador estritamente FORA de aspas duplas.
 * Para vírgula (`,`), desconta vírgulas decimais brasileiras (ex.: `120,50`).
 */
function countDelimiterOutsideQuotes(record: string, delim: string): number {
  let count = 0;
  let insideQuotes = false;

  for (let i = 0; i < record.length; i++) {
    const ch = record[i]!;
    if (ch === '"') {
      if (insideQuotes && record[i + 1] === '"') {
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (!insideQuotes && ch === delim) {
      if (delim === ",") {
        // Desconta vírgula decimal brasileira (dígito antes e exatamente 2 dígitos depois, ex.: 120,50)
        const prev = i > 0 ? record[i - 1]! : "";
        const nextTwo = record.slice(i + 1, i + 3);
        const afterNextTwo = record[i + 3] ?? "";
        if (/\d/.test(prev) && /^\d{2}$/.test(nextTwo) && !/\d/.test(afterNextTwo)) {
          continue;
        }
      }
      count++;
    }
  }

  return count;
}

/**
 * Detecta o delimitador do CSV por consistência e frequência fora de aspas nas linhas da amostra,
 * imune a preâmbulos institucionais, vírgulas em descrições entre aspas e decimais brasileiros.
 */
export function detectDelimiter(text: string): string {
  const { cleanedText, declaredDelimiter } = stripExcelSepDirective(text);
  if (declaredDelimiter) return declaredDelimiter;

  const allRecords = splitCsvRecords(cleanedText);
  if (allRecords.length === 0) return ",";

  const delimiters = [";", "\t", ",", "|"];
  const sample = allRecords.slice(0, 30);

  // Verifica se o documento utiliza vírgula como separador decimal brasileiro (ex.: 120,50)
  const hasBrlCommaDecimals = sample.some((line) => /\b\d+,\d{2}\b/.test(line));

  let bestDelimiter = ",";
  let bestScore = -1;

  for (const delim of delimiters) {
    const counts = sample
      .map((line) => countDelimiterOutsideQuotes(line, delim))
      .filter((c) => c > 0);
    if (counts.length === 0) continue;

    const freq = new Map<number, number>();
    for (const c of counts) {
      freq.set(c, (freq.get(c) ?? 0) + 1);
    }

    let dominantCount = 0;
    let dominantFreq = 0;
    for (const [colCount, times] of freq.entries()) {
      if (colCount >= 2 && times > dominantFreq) {
        dominantFreq = times;
        dominantCount = colCount;
      }
    }

    if (dominantFreq === 0) continue;

    // Pondera consistência de colunas e aplica prioridade estrutural para ; e \t com decimais BRL
    let score = dominantFreq * (dominantCount + 1);
    if (hasBrlCommaDecimals && (delim === ";" || delim === "\t")) {
      score *= 1.35;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  // Fallback caso nenhuma linha tenha >= 2 delimitadores consistentes
  if (bestScore <= 0) {
    let maxTotal = -1;
    for (const delim of delimiters) {
      let total = 0;
      for (const line of sample) {
        total += countDelimiterOutsideQuotes(line, delim);
      }
      if (total > maxTotal) {
        maxTotal = total;
        bestDelimiter = delim;
      }
    }
  }

  return bestDelimiter;
}

/**
 * Divide um registro CSV em células respeitando aspas duplas (RFC-4180).
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        // Aspas escapadas: "" -> "
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      cells.push(current.replace(/\r?\n/g, " ").trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.replace(/\r?\n/g, " ").trim());
  return cells;
}

/**
 * Decodifica um buffer binário ou texto tentando UTF-8 e fazendo fallback para Latin-1 (ISO-8859-1).
 */
export function decodeBufferToString(buffer: ArrayBuffer): string {
  let decoded: string;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoded = decoder.decode(buffer);
  } catch {
    const latinDecoder = new TextDecoder("iso-8859-1");
    decoded = latinDecoder.decode(buffer);
  }
  return decoded.replace(/^[\uFEFF\uFFFE]/, "");
}

/**
 * Converte o texto CSV em matriz de linhas parseadas `RawParsedRow[]` (RFC-4180).
 */
export function parseCsvToRows(text: string, customDelimiter?: string): RawParsedRow[] {
  const { cleanedText, declaredDelimiter } = stripExcelSepDirective(text);
  const delimiter = customDelimiter || declaredDelimiter || detectDelimiter(cleanedText);
  const records = splitCsvRecords(cleanedText);
  const rows: RawParsedRow[] = [];

  let rowIndex = 0;
  for (const record of records) {
    const trimmed = record.trim();
    if (!trimmed) continue;

    const cells = parseCsvLine(trimmed, delimiter);
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed.replace(/\r?\n/g, " "),
        cells,
      });
    }
  }

  return rows;
}
