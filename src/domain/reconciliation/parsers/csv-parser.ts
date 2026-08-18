import type { RawParsedRow } from "../types";

/**
 * Detecta o delimitador do CSV por contagem de ocorrências consistentes nas primeiras linhas.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);

  if (lines.length === 0) return ",";

  const delimiters = [",", ";", "\t", "|"];
  let bestDelimiter = ",";
  let maxConsistentCount = -1;

  for (const delim of delimiters) {
    const counts = lines.map((line) => line.split(delim).length - 1);
    const firstCount = counts[0] ?? 0;
    if (firstCount > 0 && counts.every((c) => c === firstCount)) {
      if (firstCount > maxConsistentCount) {
        maxConsistentCount = firstCount;
        bestDelimiter = delim;
      }
    }
  }

  // Fallback para contagem total simples se nenhuma consistência perfeita for encontrada
  if (maxConsistentCount <= 0) {
    let maxTotal = -1;
    for (const delim of delimiters) {
      let total = 0;
      for (const line of lines) {
        total += line.split(delim).length - 1;
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
 * Divide uma linha de CSV em células respeitando aspas duplas.
 */
export function parseCsvLine(line: string, delimiter: string): string[] {
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
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

/**
 * Decodifica um buffer binário ou texto tentando UTF-8 e fazendo fallback para Latin-1 (ISO-8859-1).
 */
export function decodeBufferToString(buffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(buffer);
  } catch {
    const latinDecoder = new TextDecoder("iso-8859-1");
    return latinDecoder.decode(buffer);
  }
}

/**
 * Converte o texto CSV em matriz de linhas parseadas `RawParsedRow[]`.
 */
export function parseCsvToRows(text: string, customDelimiter?: string): RawParsedRow[] {
  const delimiter = customDelimiter || detectDelimiter(text);
  const lines = text.split(/\r?\n/);
  const rows: RawParsedRow[] = [];

  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells = parseCsvLine(trimmed, delimiter);
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells,
      });
    }
  }

  return rows;
}
