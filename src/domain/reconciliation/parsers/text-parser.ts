import type { RawParsedRow } from "../types";

/**
 * Parser de texto livre copiado da web / internet banking (Quick-Paste).
 * Divide por quebras de linha e detecta separação por múltiplos espaços ou tabulações.
 */
export function parseTextToRows(rawText: string): RawParsedRow[] {
  const lines = rawText.split(/\r?\n/);
  const rows: RawParsedRow[] = [];

  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Se tiver tabulação, divide por tab
    let cells: string[];
    if (trimmed.includes("\t")) {
      cells = trimmed.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (trimmed.includes(";") || trimmed.includes(",")) {
      // Tenta delimitador de lista comum
      const delim = trimmed.includes(";") ? ";" : ",";
      cells = trimmed.split(delim).map((c) => c.trim()).filter((c) => c.length > 0);
    } else {
      // Divide por 2 ou mais espaços
      cells = trimmed.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
    }

    if (cells.length > 0) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells,
      });
    }
  }

  return rows;
}
