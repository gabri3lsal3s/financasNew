import type { RawParsedRow } from "../types";
import { addDaysISO, todayISO } from "@/domain/debts";
import { isStatementNoiseOrSummary } from "../clean";

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  janeiro: "01",
  jan: "01",
  fevereiro: "02",
  fev: "02",
  feb: "02",
  marco: "03",
  março: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  apr: "04",
  maio: "05",
  mai: "05",
  may: "05",
  junho: "06",
  jun: "06",
  julho: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  aug: "08",
  setembro: "09",
  set: "09",
  sep: "09",
  outubro: "10",
  out: "10",
  oct: "10",
  novembro: "11",
  nov: "11",
  dezembro: "12",
  dez: "12",
  dec: "12",
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

  // 2. YYYY-MM-DD ou YYYY/MM/DD ou YYYY.MM.DD
  const isoMatch = /\b(\d{4})[/.-](\d{2})[/.-](\d{2})\b/.exec(text);
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

  // 4. DD de [Mês] (de [Ano])? ou DD-[Mês]-[Ano] ou DD [Mês] [Ano] -> ex: 15 de agosto de 2026, 15 ago 2026, 15-ago-2026, 15/ago/2026, 15 AGO
  const namedMonthMatch =
    /\b(\d{1,2})(?:º|o)?\s*(?:de\s+|[/-])?\s*(janeiro|jan|fevereiro|fev|feb|março|marco|mar|abril|abr|apr|maio|mai|may|junho|jun|julho|jul|agosto|ago|aug|setembro|set|sep|outubro|out|oct|novembro|nov|dezembro|dez|dec)(?:(?:\s*(?:de\s+|[/-])?\s*|\s+)(\d{2,4}))?\b/i.exec(
      text,
    );
  if (namedMonthMatch && namedMonthMatch[1] && namedMonthMatch[2]) {
    const day = namedMonthMatch[1].padStart(2, "0");
    const monthKey = namedMonthMatch[2].toLowerCase();
    const month = MONTH_NAME_TO_NUMBER[monthKey] ?? "01";
    let rawYear = namedMonthMatch[3];
    if (rawYear && rawYear.length === 2) {
      rawYear = `20${rawYear}`;
    }
    const year = rawYear ?? defaultYear.toString();
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(namedMonthMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 5. DD/MM/YY ou DD-MM-YY
  const dmyShortMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/.exec(text);
  if (dmyShortMatch && dmyShortMatch[1] && dmyShortMatch[2] && dmyShortMatch[3]) {
    const day = dmyShortMatch[1].padStart(2, "0");
    const month = dmyShortMatch[2].padStart(2, "0");
    const year = `20${dmyShortMatch[3]}`;
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(dmyShortMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  // 6. DD/MM ou DD-MM ou DD.MM (sem ano)
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
  // 1. Valores entre parênteses: (R$ 150,00) ou (150,00) ou (2.500,00) -> negativo contábil
  const parenRegex = /\(\s*(?:R\$|BRL|\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?|\d+)\s*\)/i;
  const parenMatch = parenRegex.exec(text);
  if (parenMatch && parenMatch[1]) {
    const rawVal = `-${parenMatch[1]}`;
    const remainingText = text.replace(parenMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 2. Valores com sinal e moeda: [+-]? R$ [+-]? ... com sufixo opcional D/C/+/-
  // ex: "+ R$ 1.250,75", "- R$ 45,90", "R$ -50,00", "R$ 150,00 D", "R$ 2.000,00 C"
  const prefixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de|total\s*:?)\s+)?([+-]?\s*(?:R\$|BRL|\$)\s*[+-]?\s*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?|\d+)(?:\s*(?:[dDcC]|\([dDcC]\)|[+-]))?)/i;
  const prefixMatch = prefixRegex.exec(text);
  if (prefixMatch && prefixMatch[1]) {
    const matchedStr = prefixMatch[1].trim();
    let sign = "";
    if (matchedStr.startsWith("-") || matchedStr.includes(" -")) sign = "-";
    else if (matchedStr.startsWith("+") || matchedStr.includes(" +")) sign = "+";

    const cleanNum = matchedStr
      .replace(/^[+-]\s*/, "")
      .replace(/(?:R\$|BRL|\$)\s*/i, "")
      .replace(/^[+-]\s*/, "")
      .trim();

    const rawVal = sign ? `${sign}${cleanNum}` : cleanNum;
    const remainingText = text.replace(prefixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 3. Valores com sufixo "reais", "real", "conto": 50 reais, -120,50 reais, +200 reais
  const suffixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:[.,]\d{1,2})?|[+-]?\s*\d+)\s*(?:reais|real|conto)\b/i;
  const suffixMatch = suffixRegex.exec(text);
  if (suffixMatch && suffixMatch[1]) {
    const rawVal = suffixMatch[1].replace(/\s+/g, "");
    const remainingText = text.replace(suffixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 4. Padrão monetário com sufixo D/C ou sinal: 150,00 D, 2.000,00 C, 150,00D, 2.000,00+, 150,00-
  const dcSuffixRegex =
    /\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+(?:[.,]\d{1,2})?)\s*([dDcC]|\([dDcC]\)|[+-])\b/i;
  const dcMatch = dcSuffixRegex.exec(text);
  if (dcMatch && dcMatch[1] && dcMatch[2]) {
    const rawVal = `${dcMatch[1].trim()} ${dcMatch[2].trim()}`;
    const remainingText = text.replace(dcMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 5. Padrão monetário brasileiro com vírgula decimal (ex: 1.250,75 ou -45,90 ou +250,00)
  const brlDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2})\b/i;
  const brlDecimalMatch = brlDecimalRegex.exec(text);
  if (brlDecimalMatch && brlDecimalMatch[1]) {
    const rawVal = brlDecimalMatch[1];
    const remainingText = text.replace(brlDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 6. Padrão com ponto decimal monetário (ex: 45.90 ou -1234.56)
  const dotDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b([+-]?\d+\.\d{2})\b/i;
  const dotDecimalMatch = dotDecimalRegex.exec(text);
  if (dotDecimalMatch && dotDecimalMatch[1]) {
    const rawVal = dotDecimalMatch[1];
    const remainingText = text.replace(dotDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 7. Palavras-chave indicando valor inteiro ou decimal (ex: "valor 150", "por 250", "de 80")
  const kwRegex = /(?:valor|por|paguei|gastei)\s*:?\s*(?:de\s+)?([+-]?\d+(?:[.,]\d{1,2})?)\b/i;
  const kwMatch = kwRegex.exec(text);
  if (kwMatch && kwMatch[1]) {
    const rawVal = kwMatch[1];
    const remainingText = text.replace(kwMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  // 8. Número isolado no fim da linha que não seja parte de data
  const trailingNumRegex = /(?<![/.-])\b([+-]?\d+(?:[.,]\d{1,2})?)\s*$/;
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
 * Verifica se um conjunto de células tabulares representa uma linha de cabeçalho.
 */
function isHeaderCells(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const headerKeywords = [
    "data", "date", "dt", "dia",
    "descrição", "descricao", "desc", "histórico", "historico", "detalhe", "lançamento", "lancamento", "estabelecimento", "transação", "transacao", "title", "memo",
    "valor", "amount", "total", "preço", "preco", "saída", "saida", "entrada",
    "saldo", "saldo (r$)", "saldo atual", "saldo anterior",
    "tipo", "d/c", "debito", "débito", "credito", "crédito",
    "docto", "documento", "num doc", "nº doc", "doc",
    "titular", "portador", "cartão", "cartao", "card", "conta",
    "categoria", "status"
  ];

  const nonBlank = cells.filter((c) => c.trim().length > 0);
  if (nonBlank.length === 0) return true;

  // Se tem qualquer célula que é claramente uma data formatada ou valor monetário com dígitos, não é cabeçalho
  const hasDateOrAmount = nonBlank.some((c) => {
    const t = c.trim();
    return /^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?$/.test(t) || /^\d{4}-\d{2}-\d{2}$/.test(t) || /(?:R\$|\$)?\s*\d+[.,]\d{2}/.test(t);
  });
  if (hasDateOrAmount) return false;

  const matchCount = nonBlank.filter((c) => {
    const lower = c.trim().toLowerCase();
    return headerKeywords.some((kw) => lower === kw || lower.startsWith(kw) || lower.endsWith(kw));
  }).length;

  return matchCount / nonBlank.length >= 0.6;
}

/**
 * Tenta analisar uma linha única de texto livre em linguagem natural.
 */
function parseNaturalLanguageLine(
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

  let amountStr = amountEntity.amountStr;

  // 4. Se a frase tiver verbos explícitos de entrada/receita e o valor não tiver sinal nem sufixo, prefixa '+'
  const isExplicitIncomePhrase =
    /\b(recebi|recebimento|ganhei|entrou|sal[aá]rio|folha|pro-labore|pro labore|rendimento|dividendo|dividendos|jcp|provento|proventos|estorno|dep[oó]sito|reembolso)\b/i.test(line);
  if (isExplicitIncomePhrase && !/^[+-]/.test(amountStr) && !/[dDcC+-]$/.test(amountStr)) {
    amountStr = `+${amountStr}`;
  }

  return {
    date: dateStr,
    description,
    amount: amountStr,
  };
}

/**
 * Detecta se uma linha isolada é exclusivamente uma data.
 */
function isDateOnlyLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  // Se for explicitamente parcela (ex: "1/3", "02/10", "Parcela 1 de 3"), NÃO é linha de data
  if (/^(?:parcela\s+)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}$/i.test(t)) {
    const slashParts = t.split("/").map((p) => parseInt(p.trim(), 10));
    if (slashParts.length === 2 && slashParts[0] && slashParts[1]) {
      if (slashParts[0] <= 12 && slashParts[1] <= 12) {
        return false;
      }
    }
  }

  // Data ISO: YYYY-MM-DD
  if (/^\d{4}[/.-]\d{2}[/.-]\d{2}$/.test(t)) return true;
  // DD/MM/YYYY ou DD/MM/YY
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) return true;
  // DD/MM com dia > 12 e mês <= 12
  if (/^\d{1,2}[/.-]\d{1,2}$/.test(t)) {
    const parts = t.split(/[/.-]/).map((p) => parseInt(p.trim(), 10));
    if (parts[0] && parts[1] && parts[0] > 12 && parts[0] <= 31 && parts[1] <= 12) {
      return true;
    }
  }
  // 14 OUT, 14 de Outubro, 14 de out de 2026, 14/ago/2026
  if (/^\d{1,2}(?:º|o)?\s*(?:de\s+|[/-])?\s*[a-zç]{3,9}(?:\s*(?:de\s+|[/-])?\s*\d{2,4})?$/i.test(t)) return true;
  // Relativos: hoje, ontem, anteontem
  if (/^(?:hoje|ontem|anteontem)$/i.test(t)) return true;

  return false;
}

/**
 * Detecta se uma linha isolada é exclusivamente um valor financeiro.
 */
function isAmountOnlyLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /^(?:[+-]|R\$|\$)?\s*-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*(?:[dDcC+-])?$/i.test(t) ||
    /^(?:[+-]|R\$|\$)?\s*-?\d+(?:\.\d{1,2})?\s*(?:[dDcC+-])?$/i.test(t)
  );
}

/**
 * Agrupa sequências de linhas consecutivas que formam uma transação multilinha
 * (comum ao copiar de apps de bancos como Nubank, Itaú e Inter).
 */
function groupMultilineBlocks(lines: string[]): string[] {
  const nonBlank = lines.map((l) => l.trim()).filter((l) => l.length > 0 && !isStatementNoiseOrSummary(l));
  const grouped: string[] = [];
  let i = 0;

  while (i < nonBlank.length) {
    const current = nonBlank[i]!;

    // Padrão 1: Linha de data seguida por descrição e valor (opcionalmente com parcela intermediária)
    if (isDateOnlyLine(current) && i + 1 < nonBlank.length) {
      const next1 = nonBlank[i + 1]!;

      // Data + Valor
      if (isAmountOnlyLine(next1)) {
        grouped.push(`${current} Transação ${next1}`);
        i += 2;
        continue;
      }

      // Data + Descrição
      if (!isDateOnlyLine(next1) && !isAmountOnlyLine(next1)) {
        // Data + Descrição + Valor
        if (i + 2 < nonBlank.length && isAmountOnlyLine(nonBlank[i + 2]!)) {
          const amountLine = nonBlank[i + 2]!;
          grouped.push(`${current} ${next1} ${amountLine}`);
          i += 3;
          continue;
        }

        // Data + Descrição + Parcela + Valor (ex.: Nubank/Itaú parcelado)
        if (
          i + 3 < nonBlank.length &&
          /^(?:parcela\s+)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}$/i.test(nonBlank[i + 2]!) &&
          isAmountOnlyLine(nonBlank[i + 3]!)
        ) {
          const installmentLine = nonBlank[i + 2]!;
          const amountLine = nonBlank[i + 3]!;
          grouped.push(`${current} ${next1} ${installmentLine} ${amountLine}`);
          i += 4;
          continue;
        }
      }
    }

    // Padrão 2: Descrição primeiro, depois data e valor
    if (!isDateOnlyLine(current) && !isAmountOnlyLine(current) && i + 2 < nonBlank.length) {
      const next1 = nonBlank[i + 1]!;
      const next2 = nonBlank[i + 2]!;
      if (isDateOnlyLine(next1) && isAmountOnlyLine(next2)) {
        grouped.push(`${next1} ${current} ${next2}`);
        i += 3;
        continue;
      }
    }

    grouped.push(current);
    i += 1;
  }

  return grouped;
}

/**
 * Parser de texto livre copiado da web / internet banking / linguagem natural (Quick-Paste).
 * Analisa tanto dados tabulares quanto frases em linguagem natural e blocos multilinhas,
 * ignorando automaticamente cabeçalhos e linhas ruidosas.
 */
export function parseTextToRows(rawText: string, defaultYear = new Date().getFullYear()): RawParsedRow[] {
  const rawLines = rawText.split(/\r?\n/);
  const lines = groupMultilineBlocks(rawLines);
  const rows: RawParsedRow[] = [];

  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filtra ruídos, separadores, metadados de relatório e somatórios/saldos contábeis
    if (isStatementNoiseOrSummary(trimmed)) continue;

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

    // Se as células tabulares formam um cabeçalho de colunas (ex: Data | Descrição | Valor), ignora
    if (cells.length > 0 && isHeaderCells(cells)) {
      continue;
    }

    // Se alguma célula individual da linha representa ruído de extrato ou saldo contábil, ignora
    if (cells.length > 0 && cells.some((c) => isStatementNoiseOrSummary(c))) {
      continue;
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
      // Ignora se a descrição resultante for ruído de extrato
      if (isStatementNoiseOrSummary(natural.description)) {
        continue;
      }

      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells: [natural.date, natural.description, natural.amount],
      });
      continue;
    }

    // 7. Fallback: se houver células parciais e não forem ruído, armazena
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


