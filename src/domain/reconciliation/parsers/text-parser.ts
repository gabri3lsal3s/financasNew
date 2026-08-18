import type { RawParsedRow } from "../types";
import { addDaysISO, todayISO } from "@/domain/debts";

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  janeiro: "01",
  jan: "01",
  fevereiro: "02",
  fev: "02",
  marco: "03",
  março: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  maio: "05",
  mai: "05",
  junho: "06",
  jun: "06",
  julho: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  setembro: "09",
  set: "09",
  outubro: "10",
  out: "10",
  novembro: "11",
  nov: "11",
  dezembro: "12",
  dez: "12",
};

/**
 * Converte data relativa ("hoje", "ontem", "anteontem") ou dia nomeado em data ISO.
 */
function resolveRelativeDate(keyword: string, referenceToday: string = todayISO()): string {
  const lower = keyword.toLowerCase().trim();
  if (lower === "hoje") return referenceToday;
  if (lower === "ontem") return addDaysISO(referenceToday, -1);
  if (lower === "anteontem") return addDaysISO(referenceToday, -2);
  return referenceToday;
}

/**
 * Extrai data e sua posição no texto, retornando a data formatada e o texto restante.
 */
function extractDateEntity(
  text: string,
  defaultYear: number,
): { dateStr: string; remainingText: string } | null {
  // 1. Relativos: hoje, ontem, anteontem
  const relMatch = /\b(hoje|ontem|anteontem)\b/i.exec(text);
  if (relMatch && relMatch[1]) {
    const dateStr = resolveRelativeDate(relMatch[1]);
    const remainingText = text.replace(relMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 2. YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = /\b(\d{4})[/-](\d{2})[/-](\d{2})\b/.exec(text);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const remainingText = text.replace(isoMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 3. DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmyMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(dmyMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 4. DD de [Mês] (de [Ano])? -> ex: 15 de agosto de 2026, 10 de maio, 1º de junho
  const namedMonthMatch =
    /\b(\d{1,2})(?:º|o)?\s*(?:de\s+)?(janeiro|jan|fevereiro|fev|março|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)(?:\s*(?:de\s+)?(\d{4}))?\b/i.exec(
      text,
    );
  if (namedMonthMatch && namedMonthMatch[1] && namedMonthMatch[2]) {
    const day = namedMonthMatch[1].padStart(2, "0");
    const monthKey = namedMonthMatch[2].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[monthKey] ?? "01";
    const year = namedMonthMatch[3] ?? defaultYear.toString();
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(namedMonthMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 5. DD/MM/YY
  const dmyShortMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/.exec(text);
  if (dmyShortMatch && dmyShortMatch[1] && dmyShortMatch[2] && dmyShortMatch[3]) {
    const day = dmyShortMatch[1].padStart(2, "0");
    const month = dmyShortMatch[2].padStart(2, "0");
    const year = `20${dmyShortMatch[3]}`;
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(dmyShortMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 6. DD/MM ou DD-MM (sem ano)
  const dmMatch = /\b(\d{1,2})[/.-](\d{1,2})\b/.exec(text);
  if (dmMatch && dmMatch[1] && dmMatch[2]) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    const dateStr = `${day}/${month}`;
    const remainingText = text.replace(dmMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 7. "dia 15", "no dia 15"
  const dayOnlyMatch = /\b(?:no\s+)?dia\s+(\d{1,2})\b/i.exec(text);
  if (dayOnlyMatch && dayOnlyMatch[1]) {
    const day = dayOnlyMatch[1].padStart(2, "0");
    const currentMonth = todayISO().slice(5, 7);
    const dateStr = `${defaultYear}-${currentMonth}-${day}`;
    const remainingText = text.replace(dayOnlyMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  return null;
}

/**
 * Extrai valor monetário e seu sinal do texto, retornando o valor formatado e o texto restante.
 */
function extractAmountEntity(text: string): { amountStr: string; remainingText: string } | null {
  // 1. Valores com prefixo R$ ou $ ou BRL (ex: R$ 1.250,75, R$ 45,90, R$ 50)
  const prefixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?(?:R\$|BRL|\$)\s*(-?\s*\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*\d+(?:[.,]\d{1,2})?|-?\s*\d+)/i;
  const prefixMatch = prefixRegex.exec(text);
  if (prefixMatch && prefixMatch[1]) {
    const rawVal = prefixMatch[1].replace(/\s+/g, "");
    const remainingText = text.replace(prefixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 2. Valores com sufixo "reais" ou "real" (ex: 50 reais, 120,50 reais)
  const suffixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?(-?\s*\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*\d+(?:[.,]\d{1,2})?|-?\s*\d+)\s*(?:reais|real|conto)\b/i;
  const suffixMatch = suffixRegex.exec(text);
  if (suffixMatch && suffixMatch[1]) {
    const rawVal = suffixMatch[1].replace(/\s+/g, "");
    const remainingText = text.replace(suffixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 3. Padrão monetário brasileiro com vírgula decimal (ex: 1.250,75 ou 45,90 ou 250,00)
  const brlDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b(-?\d{1,3}(?:\.\d{3})*,\d{2})\b/i;
  const brlDecimalMatch = brlDecimalRegex.exec(text);
  if (brlDecimalMatch && brlDecimalMatch[1]) {
    const rawVal = brlDecimalMatch[1];
    const remainingText = text.replace(brlDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 4. Padrão com ponto decimal monetário (ex: 45.90 ou 1234.56)
  const dotDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b(-?\d+\.\d{2})\b/i;
  const dotDecimalMatch = dotDecimalRegex.exec(text);
  if (dotDecimalMatch && dotDecimalMatch[1]) {
    const rawVal = dotDecimalMatch[1];
    const remainingText = text.replace(dotDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 5. Palavras-chave indicando valor inteiro ou decimal (ex: "valor 150", "por 250", "de 80")
  const kwRegex = /(?:valor|por|paguei|gastei)\s*:?\s*(?:de\s+)?(-?\d+(?:[.,]\d{1,2})?)\b/i;
  const kwMatch = kwRegex.exec(text);
  if (kwMatch && kwMatch[1]) {
    const rawVal = kwMatch[1];
    const remainingText = text.replace(kwMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 6. Número isolado no fim da linha que não seja parte de data
  const trailingNumRegex = /(?<![/.-])\b(-?\d+(?:[.,]\d{1,2})?)\s*$/;
  const trailingMatch = trailingNumRegex.exec(text);
  if (trailingMatch && trailingMatch[1]) {
    const rawVal = trailingMatch[1];
    const remainingText = text.replace(trailingMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  return null;
}

/**
 * Limpa palavras de preenchimento e conectivos de linguagem natural da descrição.
 * Retorna string vazia se nada restar (o chamador define o fallback contextual).
 */
function sanitizeNaturalDescription(desc: string): string {
  let cleaned = desc.trim();

  // Remove verbos introdutórios de despesa e de renda
  cleaned = cleaned
    .replace(/^(?:gastei|comprei|paguei|fiz uma compra|compra|despesa|lançamento|recebi(?:\s+de)?(?:\s+via)?|recebimento(?:\s+de)?|ganhei|entrou(?:\s+na\s+conta)?|creditado(?:\s+em\s+conta)?)\s+(?:de\s+|em\s+|no\s+|na\s+|via\s+)?/i, "")
    .replace(/\b(?:no\s+valor\s+de|pelo\s+valor\s+de|no\s+total\s+de|valor)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove preposições soltas nos extremos ou conectivos residuais
  cleaned = cleaned
    .replace(/^[-–—:;,|./\s]+/, "")
    .replace(/[-–—:;,|./\s]+$/, "")
    .replace(/^(?:no|na|em|de|por|com|para|via)\s+/i, "")
    .replace(/\s+(?:por|de|no|na|em|via)\s*$/i, "")
    .trim();

  return cleaned;
}

/**
 * Tenta analisar uma linha única de texto livre em linguagem natural.
 */
export function parseNaturalLanguageLine(
  line: string,
  defaultYear = new Date().getFullYear(),
): { date: string; description: string; amount: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Extrai data PRIMEIRO (para evitar que números de dia/mês sejam confundidos com valor monetário)
  const dateEntity = extractDateEntity(trimmed, defaultYear);
  const textAfterDate = dateEntity ? dateEntity.remainingText : trimmed;

  // 2. Extrai valor monetário do texto restante
  let amountEntity = extractAmountEntity(textAfterDate);

  let dateStr = dateEntity ? dateEntity.dateStr : todayISO();
  let descCandidate: string;

  if (amountEntity) {
    descCandidate = amountEntity.remainingText;
  } else {
    // Tenta extrair valor do texto completo e depois data
    amountEntity = extractAmountEntity(trimmed);
    if (!amountEntity) return null;

    const secondDateEntity = extractDateEntity(amountEntity.remainingText, defaultYear);
    if (secondDateEntity) {
      dateStr = secondDateEntity.dateStr;
      descCandidate = secondDateEntity.remainingText;
    } else {
      descCandidate = amountEntity.remainingText;
    }
  }

  // 3. Sanitiza a descrição
  const description = sanitizeNaturalDescription(descCandidate) || descCandidate.trim() || "Transação";

  return {
    date: dateStr,
    description,
    amount: amountEntity.amountStr,
  };
}

/**
 * Parser de texto livre copiado da web / internet banking / linguagem natural (Quick-Paste).
 * Analisa tanto dados tabulares quanto frases em linguagem natural.
 */
export function parseTextToRows(rawText: string, defaultYear = new Date().getFullYear()): RawParsedRow[] {
  const lines = rawText.split(/\r?\n/);
  const rows: RawParsedRow[] = [];

  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let cells: string[] = [];

    // 1. Tenta delimitador de tabulação
    if (trimmed.includes("\t")) {
      cells = trimmed.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
    }
    // 2. Tenta delimitador de pipe '|'
    else if (trimmed.includes("|")) {
      cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    }
    // 3. Tenta delimitador de ponto e vírgula ';'
    else if (trimmed.includes(";")) {
      cells = trimmed.split(";").map((c) => c.trim()).filter((c) => c.length > 0);
    }
    // 4. Tenta delimitador de traço com espaços ' - ' (ex: 15/08 - Mercado - 50,00)
    else if (/\s+-\s+/.test(trimmed)) {
      const parts = trimmed.split(/\s+-\s+/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (parts.length >= 2) {
        cells = parts;
      }
    }
    // 5. Tenta delimitador de múltiplos espaços (2 ou mais)
    else if (/\s{2,}/.test(trimmed)) {
      const parts = trimmed.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (parts.length >= 2) {
        cells = parts;
      }
    }

    // Se encontrou 3+ células ou 2 células com data/valor identificáveis, usa a divisão tabular
    if (cells.length >= 3) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells,
      });
      continue;
    }

    // 6. Caso não seja tabular delimitado, processa como linguagem natural
    const natural = parseNaturalLanguageLine(trimmed, defaultYear);
    if (natural) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells: [natural.date, natural.description, natural.amount],
      });
      continue;
    }

    // 7. Fallback: se houver células parciais, armazena
    if (cells.length > 0) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells,
      });
    } else {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells: [trimmed],
      });
    }
  }

  return rows;
}

