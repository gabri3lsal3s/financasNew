import { addDaysISO, todayISO } from "@/domain/debts";
import { isStatementNoiseOrSummary } from "../clean";
import type { RawParsedRow } from "../contracts";

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

function resolveRelativeDate(keyword: string, referenceToday: string = todayISO()): string {
  const lower = keyword.toLowerCase().trim();
  if (lower === "hoje") return referenceToday;
  if (lower === "ontem") return addDaysISO(referenceToday, -1);
  if (lower === "anteontem") return addDaysISO(referenceToday, -2);
  return referenceToday;
}

function extractDateEntity(
  text: string,
  defaultYear: number,
): { dateStr: string; remainingText: string } | null {
  const relMatch = /\b(hoje|ontem|anteontem)\b/i.exec(text);
  if (relMatch && relMatch[1]) {
    const dateStr = resolveRelativeDate(relMatch[1]);
    const remainingText = text.replace(relMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  const isoMatch = /\b(\d{4})[/.-](\d{2})[/.-](\d{2})\b/.exec(text);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const remainingText = text.replace(isoMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  const dmyMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(dmyMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

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

  const dmyShortMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/.exec(text);
  if (dmyShortMatch && dmyShortMatch[1] && dmyShortMatch[2] && dmyShortMatch[3]) {
    const day = dmyShortMatch[1].padStart(2, "0");
    const month = dmyShortMatch[2].padStart(2, "0");
    const year = `20${dmyShortMatch[3]}`;
    const dateStr = `${year}-${month}-${day}`;
    const remainingText = text.replace(dmyShortMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

  const dmMatch = /\b(\d{1,2})[/.-](\d{1,2})\b/.exec(text);
  if (dmMatch && dmMatch[1] && dmMatch[2]) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    const dateStr = `${day}/${month}`;
    const remainingText = text.replace(dmMatch[0], " ").trim();
    return { dateStr, remainingText };
  }

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

export type TextParserMode = "auto" | "strict_statement" | "quick_paste_nl";

const STRICT_STATEMENT_NOISE_REGEX =
  /(?:\bcet\b|\btaxa\s+(?:ao\s+m[eê]s|ao\s+ano|m[aá]x|\(m[eê]s\)|\(ano\))|\bjuros\s+de\s+atraso\b|\bmora\s+de\s+atraso\b|\b\d{1,2}\s*x\s*(?:de\s+)?r?\$|\b\d{5}-\d{3}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\/\d{7,10}-\d\b|\bcpf\/cnpj\b|\bnosso\s+n[uú]mero\b|\bsimula[çc][aã]o\b|\bparcelamento\s+compuls[oó]rio\b|\bvalor\s+de\s+entrada\b|\bvalor\s+n[aã]o\s+pago\b)/i;

function extractAmountEntity(
  text: string,
  strictMode = false,
): { amountStr: string; remainingText: string } | null {
  const workingText = strictMode ? text.replace(/\b\d+(?:[.,]\d+)?\s*%/g, " ") : text;

  if (
    !strictMode ||
    /^\s*\(\s*(?:R\$|BRL|\$)?\s*\d/.test(workingText) ||
    /\s+\(\s*(?:R\$|BRL|\$)?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*\)\s*$/i.test(workingText)
  ) {
    const parenRegex = /\(\s*(?:R\$|BRL|\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?|\d+)\s*\)/i;
    const parenMatch = parenRegex.exec(workingText);
    if (parenMatch && parenMatch[1]) {
      const rawVal = `-${parenMatch[1]}`;
      const remainingText = workingText.replace(parenMatch[0], " ").trim();
      return { amountStr: rawVal, remainingText };
    }
  }

  const prefixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de|total\s*:?)\s+)?([+-]?\s*(?:R\$|BRL|\$)\s*[+-]?\s*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?|\d+)(?:\s*(?:[dDcC]|\([dDcC]\)|[+-]))?)/i;
  const prefixMatch = prefixRegex.exec(workingText);
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
    const remainingText = workingText.replace(prefixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  const suffixRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*\d+(?:[.,]\d{1,2})?|[+-]?\s*\d+)\s*(?:reais|real|conto)\b/i;
  const suffixMatch = suffixRegex.exec(workingText);
  if (suffixMatch && suffixMatch[1]) {
    const rawVal = suffixMatch[1].replace(/\s+/g, "");
    const remainingText = workingText.replace(suffixMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  const dcSuffixRegex =
    /\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\d+(?:[.,]\d{1,2})?)\s*([dDcC]|\([dDcC]\)|[+-])\b/i;
  const dcMatch = dcSuffixRegex.exec(workingText);
  if (dcMatch && dcMatch[1] && dcMatch[2]) {
    const rawVal = `${dcMatch[1].trim()} ${dcMatch[2].trim()}`;
    const remainingText = workingText.replace(dcMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  const brlDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b([+-]?\d{1,3}(?:\.\d{3})*,\d{2})(?!\s*%)\b/i;
  const brlDecimalMatch = brlDecimalRegex.exec(workingText);
  if (brlDecimalMatch && brlDecimalMatch[1]) {
    const rawVal = brlDecimalMatch[1];
    const remainingText = workingText.replace(brlDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  const dotDecimalRegex =
    /(?:\b(?:por|paguei|gastei|valor\s*:?|de)\s+)?\b([+-]?\d+\.\d{2})(?!\s*%)\b/i;
  const dotDecimalMatch = dotDecimalRegex.exec(workingText);
  if (dotDecimalMatch && dotDecimalMatch[1]) {
    const rawVal = dotDecimalMatch[1];
    const remainingText = workingText.replace(dotDecimalMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  if (strictMode) {
    return null;
  }

  const kwRegex = /(?:valor|por|paguei|gastei)\s*:?\s*(?:de\s+)?([+-]?\d+(?:[.,]\d{1,2})?)\b/i;
  const kwMatch = kwRegex.exec(workingText);
  if (kwMatch && kwMatch[1]) {
    const rawVal = kwMatch[1];
    const remainingText = workingText.replace(kwMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  const trailingNumRegex = /(?<![/.-])\b([+-]?\d+(?:[.,]\d{1,2})?)\s*$/;
  const trailingMatch = trailingNumRegex.exec(workingText);
  if (trailingMatch && trailingMatch[1]) {
    const rawVal = trailingMatch[1];
    const remainingText = workingText.replace(trailingMatch[0], " ").trim();
    return { amountStr: rawVal, remainingText };
  }

  return null;
}

function sanitizeNaturalDescription(desc: string): string {
  let cleaned = desc
    .trim()
    .replace(
      /^(?:gastei|comprei|paguei|fiz uma compra|compra|despesa|lançamento)\s+(?:de\s+|em\s+|no\s+|na\s+|via\s+)?/i,
      "",
    )
    .replace(/\b(?:no\s+valor\s+de|pelo\s+valor\s+de|no\s+total\s+de|valor)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned
    .replace(/^[-–—:;,|./\s]+/, "")
    .replace(/[-–—:;,|./\s]+$/, "")
    .replace(/^(?:no|na|em|de|por|com|para|via)\s+/i, "")
    .replace(/\s+(?:por|de|no|na|em|via)\s*$/i, "")
    .trim();

  return cleaned;
}

function isHeaderCells(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const headerKeywords = [
    "data",
    "date",
    "dt",
    "dia",
    "descrição",
    "descricao",
    "desc",
    "histórico",
    "historico",
    "detalhe",
    "lançamento",
    "lancamento",
    "estabelecimento",
    "transação",
    "transacao",
    "title",
    "memo",
    "valor",
    "amount",
    "total",
    "preço",
    "preco",
    "saída",
    "saida",
    "entrada",
    "saldo",
    "saldo (r$)",
    "saldo atual",
    "saldo anterior",
    "tipo",
    "d/c",
    "debito",
    "débito",
    "credito",
    "crédito",
    "docto",
    "documento",
    "num doc",
    "nº doc",
    "doc",
    "titular",
    "portador",
    "cartão",
    "cartao",
    "card",
    "conta",
    "categoria",
    "status",
  ];

  const nonBlank = cells.filter((c) => c.trim().length > 0);
  if (nonBlank.length === 0) return true;

  const hasDateOrAmount = nonBlank.some((c) => {
    const t = c.trim();
    return (
      /^\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?$/.test(t) ||
      /^\d{4}-\d{2}-\d{2}$/.test(t) ||
      /(?:R\$|\$)?\s*\d+[.,]\d{2}/.test(t)
    );
  });
  if (hasDateOrAmount) return false;

  const matchCount = nonBlank.filter((c) => {
    const lower = c.trim().toLowerCase();
    return headerKeywords.some(
      (kw) => lower === kw || lower.startsWith(kw) || lower.endsWith(kw),
    );
  }).length;

  return matchCount / nonBlank.length >= 0.6;
}

function parseNaturalLanguageLine(
  line: string,
  defaultYear = new Date().getFullYear(),
  strictMode = false,
): { date: string; description: string; amount: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (strictMode && STRICT_STATEMENT_NOISE_REGEX.test(trimmed)) {
    return null;
  }

  const dateEntity = extractDateEntity(trimmed, defaultYear);
  if (strictMode && !dateEntity) {
    return null;
  }

  const textAfterDate = dateEntity ? dateEntity.remainingText : trimmed;
  let amountEntity = extractAmountEntity(textAfterDate, strictMode);
  let dateStr = dateEntity ? dateEntity.dateStr : todayISO();
  let descCandidate: string;

  if (amountEntity) {
    descCandidate = amountEntity.remainingText;
  } else {
    if (strictMode) return null;
    amountEntity = extractAmountEntity(trimmed, false);
    if (!amountEntity) return null;

    const secondDateEntity = extractDateEntity(amountEntity.remainingText, defaultYear);
    if (secondDateEntity) {
      dateStr = secondDateEntity.dateStr;
      descCandidate = secondDateEntity.remainingText;
    } else {
      descCandidate = amountEntity.remainingText;
    }
  }

  const description =
    sanitizeNaturalDescription(descCandidate) || descCandidate.trim() || "Transação";
  if (
    strictMode &&
    (!description || description === "Transação" || /^[\d\s/.,+-]+$/.test(description))
  ) {
    return null;
  }

  let amountStr = amountEntity.amountStr;

  // Domínio estrito de cartão (G3): nunca converte palavras como "depósito" ou verbos de conta corrente em estorno.
  // Apenas marcadores explícitos de estorno/devolução em cartão viram negativo sem sinal prévio.
  const isExplicitCardRefund = /\b(?:estorno|estornad[oa]|devolu[çc][aã]o|reembolso)\b/i.test(line);
  if (
    isExplicitCardRefund &&
    !/^[+-]/.test(amountStr) &&
    !/[dDcC+-]$/.test(amountStr)
  ) {
    amountStr = `-${amountStr}`;
  }

  return {
    date: dateStr,
    description,
    amount: amountStr,
  };
}

function isDateOnlyLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (/^(?:parcela\s+)?\d{1,2}\s*(?:\/|de)\s*\d{1,2}$/i.test(t)) {
    const slashParts = t.split("/").map((p) => parseInt(p.trim(), 10));
    if (slashParts.length === 2 && slashParts[0] && slashParts[1]) {
      if (slashParts[0] <= 12 && slashParts[1] <= 12) {
        return false;
      }
    }
  }

  if (/^\d{4}[/.-]\d{2}[/.-]\d{2}$/.test(t)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}$/.test(t)) {
    const parts = t.split(/[/.-]/).map((p) => parseInt(p.trim(), 10));
    if (parts[0] && parts[1] && parts[0] > 12 && parts[0] <= 31 && parts[1] <= 12) {
      return true;
    }
  }
  if (/^\d{1,2}(?:º|o)?\s*(?:de\s+|[/-])?\s*[a-zç]{3,9}(?:\s*(?:de\s+|[/-])?\s*\d{2,4})?$/i.test(t))
    return true;
  if (/^(?:hoje|ontem|anteontem)$/i.test(t)) return true;

  return false;
}

function isAmountOnlyLine(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /^(?:[+-]|R\$|\$)?\s*-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?\s*(?:[dDcC+-])?$/i.test(t) ||
    /^(?:[+-]|R\$|\$)?\s*-?\d+(?:\.\d{1,2})?\s*(?:[dDcC+-])?$/i.test(t)
  );
}

function groupMultilineBlocks(lines: string[]): string[] {
  const nonBlank = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isStatementNoiseOrSummary(l));
  const grouped: string[] = [];
  let i = 0;

  while (i < nonBlank.length) {
    const current = nonBlank[i]!;

    if (isDateOnlyLine(current) && i + 1 < nonBlank.length) {
      const next1 = nonBlank[i + 1]!;
      if (isAmountOnlyLine(next1)) {
        grouped.push(`${current} Transação ${next1}`);
        i += 2;
        continue;
      }

      if (!isDateOnlyLine(next1) && !isAmountOnlyLine(next1)) {
        if (i + 2 < nonBlank.length && isAmountOnlyLine(nonBlank[i + 2]!)) {
          const amountLine = nonBlank[i + 2]!;
          grouped.push(`${current} ${next1} ${amountLine}`);
          i += 3;
          continue;
        }

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
 * Extrator "burro" de texto colado / blocos multilinhas para `RawParsedRow[]`.
 */
export function parseTextToRows(
  rawText: string,
  defaultYear = new Date().getFullYear(),
  options?: { mode?: TextParserMode },
): RawParsedRow[] {
  const rawLines = rawText.split(/\r?\n/);
  const lines = groupMultilineBlocks(rawLines);
  const rows: RawParsedRow[] = [];

  const nonEmptyCount = lines.filter((l) => l.trim().length > 0).length;
  const mode = options?.mode ?? "auto";
  const isStrict =
    mode === "strict_statement" || (mode !== "quick_paste_nl" && nonEmptyCount > 15);

  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isStatementNoiseOrSummary(trimmed)) continue;
    if (isStrict && STRICT_STATEMENT_NOISE_REGEX.test(trimmed)) continue;

    let cells: string[] = [];

    if (trimmed.includes("\t")) {
      cells = trimmed.split("\t").map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (trimmed.includes("|")) {
      cells = trimmed.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (trimmed.includes(";")) {
      cells = trimmed.split(";").map((c) => c.trim()).filter((c) => c.length > 0);
    } else if (/\s+-\s+/.test(trimmed)) {
      const parts = trimmed.split(/\s+-\s+/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (parts.length >= 2) {
        cells = parts;
      }
    } else if (/\s{2,}/.test(trimmed)) {
      const parts = trimmed.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
      if (parts.length >= 2) {
        cells = parts;
      }
    }

    if (cells.length > 0 && isHeaderCells(cells)) {
      continue;
    }

    if (cells.length > 0 && cells.some((c) => isStatementNoiseOrSummary(c))) {
      continue;
    }

    if (cells.length >= 3) {
      if (!isStrict || extractDateEntity(trimmed, defaultYear) !== null) {
        rows.push({
          rowIndex: rowIndex++,
          rawText: trimmed,
          cells,
        });
      }
      continue;
    }

    const natural = parseNaturalLanguageLine(trimmed, defaultYear, isStrict);
    if (natural) {
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

    if (!isStrict && cells.length > 0) {
      rows.push({
        rowIndex: rowIndex++,
        rawText: trimmed,
        cells,
      });
    }
  }

  return rows;
}
