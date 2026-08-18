import type { ColumnMapping, RawParsedRow } from "../types";

/**
 * Expressões regulares para detecção de datas no padrão brasileiro e internacional.
 */
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // 2026-08-15
  /^\d{2}\/\d{2}\/\d{4}$/, // 15/08/2026
  /^\d{2}\/\d{2}\/\d{2}$/, // 15/08/26
  /^\d{2}\/\d{2}$/, // 15/08 (sem ano)
  /^\d{2}-\d{2}-\d{4}$/, // 15-08-2026
];

/**
 * Converte diferentes formatos de data textual para ISO YYYY-MM-DD.
 * Se a data não tiver ano (ex.: "15/08"), usa o ano da competência ou o ano atual.
 */
export function normalizeDateToISO(rawDate: string, defaultYear = new Date().getFullYear()): string | null {
  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY ou DD-MM-YYYY
  const dmyMatch = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(trimmed);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1];
    const month = dmyMatch[2];
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD/MM/YY
  const dmyShortMatch = /^(\d{2})[/.-](\d{2})[/.-](\d{2})$/.exec(trimmed);
  if (dmyShortMatch && dmyShortMatch[1] && dmyShortMatch[2] && dmyShortMatch[3]) {
    const day = dmyShortMatch[1];
    const month = dmyShortMatch[2];
    const year = `20${dmyShortMatch[3]}`;
    return `${year}-${month}-${day}`;
  }

  // DD/MM (sem ano)
  const dmMatch = /^(\d{2})[/.-](\d{2})$/.exec(trimmed);
  if (dmMatch && dmMatch[1] && dmMatch[2]) {
    const day = dmMatch[1];
    const month = dmMatch[2];
    return `${defaultYear}-${month}-${day}`;
  }

  return null;
}

/**
 * Extrai o valor monetário em centavos (inteiro).
 * Retorna null se não for um número válido.
 */
export function parseAmountToCents(raw: string): { amountCents: number; isNegative: boolean } | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Ignora se for claramente uma data ou texto sem dígitos
  if (!/\d/.test(trimmed) || DATE_PATTERNS.some((p) => p.test(trimmed))) {
    return null;
  }

  // Detecta sinal negativo
  const isNegative = trimmed.startsWith("-") || trimmed.endsWith("-") || (trimmed.startsWith("(") && trimmed.endsWith(")"));

  // Remove caracteres que não sejam dígitos, vírgula ou ponto
  const clean = trimmed.replace(/[^\d,.-]/g, "");
  if (!clean) return null;

  let normalized = clean.replace(/[-()]/g, "");

  // Trata formato brasileiro: "1.234,56" -> "1234.56"
  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 1.234,56
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    // 1234,56
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return null;

  const amountCents = Math.round(parsed * 100);
  if (amountCents === 0) return null;

  return {
    amountCents: Math.abs(amountCents),
    isNegative,
  };
}

/**
 * Analisa uma matriz de linhas tabulares e infere a posição das colunas
 * de Data, Descrição e Valor por amostragem estatística do conteúdo.
 */
export function sniffColumnMapping(rows: RawParsedRow[]): ColumnMapping {
  if (rows.length === 0) {
    return {
      dateColIndex: 0,
      descriptionColIndex: 1,
      amountColIndex: 2,
      hasHeader: false,
      startRowIndex: 0,
    };
  }

  // Identifica a largura máxima de colunas
  const maxCols = Math.max(...rows.map((r) => r.cells.length), 3);

  // Scores para cada coluna
  const dateScores = new Array(maxCols).fill(0);
  const amountScores = new Array(maxCols).fill(0);
  const textScores = new Array(maxCols).fill(0);

  // Determina se a primeira linha é cabeçalho e aplica boost pelos nomes das colunas
  let hasHeader = false;
  const firstRow = rows[0];
  if (firstRow && firstRow.cells.length > 0) {
    const firstRowText = firstRow.cells.join(" ").toLowerCase();
    const hasHeaderKeywords =
      firstRowText.includes("data") ||
      firstRowText.includes("date") ||
      firstRowText.includes("valor") ||
      firstRowText.includes("amount") ||
      firstRowText.includes("desc") ||
      firstRowText.includes("lançamento") ||
      firstRowText.includes("lancamento") ||
      firstRowText.includes("estabelecimento") ||
      firstRowText.includes("titular");

    if (hasHeaderKeywords) {
      hasHeader = true;

      for (let c = 0; c < firstRow.cells.length; c++) {
        const headerCell = (firstRow.cells[c] ?? "").trim().toLowerCase();
        if (!headerCell) continue;

        // Cabeçalho de data
        if (headerCell.includes("data") || headerCell.includes("date") || headerCell === "dt") {
          dateScores[c] = (dateScores[c] ?? 0) + 100;
        }

        // Cabeçalho de valor
        if (
          headerCell.includes("valor") ||
          headerCell.includes("amount") ||
          headerCell.includes("total") ||
          headerCell.includes("preço") ||
          headerCell.includes("preco")
        ) {
          amountScores[c] = (amountScores[c] ?? 0) + 100;
        }

        // Cabeçalho de descrição/estabelecimento
        if (
          headerCell.includes("desc") ||
          headerCell.includes("estabelecimento") ||
          headerCell.includes("histórico") ||
          headerCell.includes("historico") ||
          headerCell.includes("detalhe") ||
          headerCell.includes("lançamento") ||
          headerCell.includes("lancamento") ||
          headerCell.includes("transação") ||
          headerCell.includes("transacao") ||
          headerCell.includes("title") ||
          headerCell.includes("memo") ||
          headerCell.includes("origem")
        ) {
          textScores[c] = (textScores[c] ?? 0) + 100;
        }

        // Cabeçalho de titular/portador/cartão/conta (não é descrição da compra)
        if (
          headerCell.includes("titular") ||
          headerCell.includes("portador") ||
          headerCell.includes("cartão") ||
          headerCell.includes("cartao") ||
          headerCell.includes("card") ||
          headerCell.includes("conta") ||
          headerCell.includes("cpf") ||
          headerCell.includes("usuário") ||
          headerCell.includes("usuario")
        ) {
          textScores[c] = (textScores[c] ?? 0) - 100;
        }
      }
    }
  }

  const sampleRows = rows.slice(hasHeader ? 1 : 0, 30);
  const columnValues: Array<Set<string>> = Array.from({ length: maxCols }, () => new Set<string>());

  for (const row of sampleRows) {
    for (let c = 0; c < row.cells.length; c++) {
      const cell = (row.cells[c] ?? "").trim();
      if (!cell) continue;

      // Armazena valores únicos para checagem de diversidade/cardinalidade
      columnValues[c]?.add(cell.toLowerCase());

      // Testa Data
      if (DATE_PATTERNS.some((p) => p.test(cell)) || normalizeDateToISO(cell) !== null) {
        dateScores[c] = (dateScores[c] ?? 0) + 3;
      }

      // Testa Valor
      if (parseAmountToCents(cell) !== null) {
        amountScores[c] = (amountScores[c] ?? 0) + 3;
      }

      // Testa Texto descritivo
      if (cell.length >= 3 && !DATE_PATTERNS.some((p) => p.test(cell)) && parseAmountToCents(cell) === null) {
        textScores[c] = (textScores[c] ?? 0) + 2;
      }
    }
  }

  // Ajuste por cardinalidade (colunas com valores repetitivos como nome fixo do titular
  // têm diversidade baixa; descrições de compras reais têm alta cardinalidade de valores distintos)
  if (sampleRows.length >= 3) {
    for (let c = 0; c < maxCols; c++) {
      const uniqueCount = columnValues[c]?.size ?? 0;
      const diversityRatio = uniqueCount / sampleRows.length;
      if (diversityRatio > 0.4) {
        textScores[c] = (textScores[c] ?? 0) + Math.round(diversityRatio * 15);
      } else if (diversityRatio <= 0.2 && uniqueCount <= 2) {
        // Coluna com valor constante (ex.: nome de titular repetido em toda linha)
        textScores[c] = (textScores[c] ?? 0) - 50;
      }
    }
  }

  // Encontra a melhor coluna de data
  let bestDateCol = 0;
  let maxDateScore = -1;
  for (let i = 0; i < maxCols; i++) {
    if ((dateScores[i] ?? 0) > maxDateScore) {
      maxDateScore = dateScores[i] ?? 0;
      bestDateCol = i;
    }
  }

  // Encontra a melhor coluna de valor (diferente da de data)
  let bestAmountCol = (bestDateCol + 1) % maxCols;
  let maxAmountScore = -1;
  for (let i = 0; i < maxCols; i++) {
    if (i === bestDateCol) continue;
    if ((amountScores[i] ?? 0) > maxAmountScore) {
      maxAmountScore = amountScores[i] ?? 0;
      bestAmountCol = i;
    }
  }

  // Encontra a melhor coluna de descrição (diferente de data e valor)
  let bestDescCol = 0;
  let maxTextScore = -Infinity;
  for (let i = 0; i < maxCols; i++) {
    if (i === bestDateCol || i === bestAmountCol) continue;
    if ((textScores[i] ?? 0) > maxTextScore) {
      maxTextScore = textScores[i] ?? 0;
      bestDescCol = i;
    }
  }

  return {
    dateColIndex: bestDateCol,
    descriptionColIndex: bestDescCol,
    amountColIndex: bestAmountCol,
    hasHeader,
    startRowIndex: hasHeader ? 1 : 0,
  };
}
