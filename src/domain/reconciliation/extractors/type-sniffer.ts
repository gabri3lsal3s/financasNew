import { addDaysISO, todayISO } from "@/domain/debts/index";
import { APP_START_DATE } from "@/types/schema";
import type { ColumnMapping, RawParsedRow } from "../contracts";

const MONTH_NAMES_DICT: Record<string, string> = {
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

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // 2026-08-15
  /^\d{2}\/\d{2}\/\d{4}$/, // 15/08/2026
  /^\d{2}\/\d{2}\/\d{2}$/, // 15/08/26
  /^\d{2}\/\d{2}$/, // 15/08 (sem ano)
  /^\d{2}-\d{2}-\d{4}$/, // 15-08-2026
];

/**
 * Valida estritamente se (year, month, day) forma uma data real no calendário gregoriano (G1).
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function formatIsoUtc(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface ResolveDateForCycleParams {
  competenceMonth: string;
  closingDay?: number | null;
  marginDays?: number;
  dateFormatHint?: "dmy" | "d_mmm" | "ymd" | "auto";
}

function stripDateTimeSuffix(rawDate: string): string {
  return rawDate
    .trim()
    .toLowerCase()
    .replace(/(?:t|\s+(?:[àa]s\s+)?)\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d{1,6})?)?(?:\s*(?:z|[+-]\d{2}:?\d{2}))?$/i, "")
    .trim();
}

function hasExplicitYearInDateToken(rawDate: string): boolean {
  const t = stripDateTimeSuffix(rawDate);
  if (t === "hoje" || t === "ontem" || t === "anteontem") return true;
  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(t)) return true;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(t)) return true;
  if (/[a-zç]{3,9}\.?(?:\s*(?:de\s+|[/-])?\s*|\s+)\d{2,4}$/i.test(t)) return true;
  return false;
}

/**
 * Converte diferentes formatos de data textual para ISO YYYY-MM-DD (G1).
 */
export function normalizeDateToISO(
  rawDate: string,
  defaultYear = new Date().getFullYear(),
  referenceMonth?: number,
): string | null {
  const trimmed = stripDateTimeSuffix(rawDate);
  if (!trimmed) return null;

  if (trimmed === "hoje") return todayISO();
  if (trimmed === "ontem") return addDaysISO(todayISO(), -1);
  if (trimmed === "anteontem") return addDaysISO(todayISO(), -2);

  // YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(trimmed);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    return isValidCalendarDate(year, month, day) ? formatIsoUtc(year, month, day) : null;
  }

  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  const dmyMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmed);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10);
    const year = Number.parseInt(dmyMatch[3], 10);
    return isValidCalendarDate(year, month, day) ? formatIsoUtc(year, month, day) : null;
  }

  // DD de [Mês] (de [Ano])? ou DD-[Mês]-[Ano] ou DD [Mês] [Ano]
  const namedMatch =
    /^(\d{1,2})(?:º|o)?\s*(?:de\s+|[/-])?\s*(janeiro|jan|fevereiro|fev|feb|março|marco|mar|abril|abr|apr|maio|mai|may|junho|jun|julho|jul|agosto|ago|aug|setembro|set|sep|outubro|out|oct|novembro|nov|dezembro|dez|dec)\.?(?:(?:\s*(?:de\s+|[/-])?\s*|\s+)(\d{2,4}))?$/i.exec(
      trimmed,
    );
  if (namedMatch && namedMatch[1] && namedMatch[2]) {
    const day = Number.parseInt(namedMatch[1], 10);
    const monthStr = MONTH_NAMES_DICT[namedMatch[2].toLowerCase()];
    if (!monthStr) return null;
    const month = Number.parseInt(monthStr, 10);
    let rawYear = namedMatch[3];
    if (rawYear && rawYear.length === 2) {
      rawYear = `20${rawYear}`;
    }
    const inferredYear = rawYear
      ? Number.parseInt(rawYear, 10)
      : referenceMonth !== undefined && month - referenceMonth >= 2
        ? defaultYear - 1
        : referenceMonth === 12 && month === 1
          ? defaultYear + 1
          : defaultYear;
    return isValidCalendarDate(inferredYear, month, day)
      ? formatIsoUtc(inferredYear, month, day)
      : null;
  }

  // DD/MM/YY ou DD-MM-YY
  const dmyShortMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(trimmed);
  if (dmyShortMatch && dmyShortMatch[1] && dmyShortMatch[2] && dmyShortMatch[3]) {
    const day = Number.parseInt(dmyShortMatch[1], 10);
    const month = Number.parseInt(dmyShortMatch[2], 10);
    const year = Number.parseInt(`20${dmyShortMatch[3]}`, 10);
    return isValidCalendarDate(year, month, day) ? formatIsoUtc(year, month, day) : null;
  }

  // DD/MM ou DD-MM (sem ano)
  const dmMatch = /^(\d{1,2})[/.-](\d{1,2})$/.exec(trimmed);
  if (dmMatch && dmMatch[1] && dmMatch[2]) {
    const day = Number.parseInt(dmMatch[1], 10);
    const month = Number.parseInt(dmMatch[2], 10);
    const inferredYear =
      referenceMonth !== undefined && month - referenceMonth >= 2
        ? defaultYear - 1
        : referenceMonth === 12 && month === 1
          ? defaultYear + 1
          : defaultYear;
    return isValidCalendarDate(inferredYear, month, day)
      ? formatIsoUtc(inferredYear, month, day)
      : null;
  }

  return null;
}

/**
 * Resolve data textual de fatura ancorando a janela de ano no teto superior
 * do ciclo da fatura (`closing_day - 1 + margem`), cobrindo virada Dez/Jan e
 * parcelas `12/12` cujo mês original coincide com `competenceMonth + 1` (G1 + G2).
 */
export function resolveDateForStatementCycle(
  rawDate: string,
  params: ResolveDateForCycleParams,
): string | null {
  const compYear = Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const compMonth = Number.parseInt(params.competenceMonth.slice(5, 7), 10);
  const hasExplicitYear = hasExplicitYearInDateToken(rawDate);

  if (hasExplicitYear || !Number.isFinite(compMonth) || compMonth < 1 || compMonth > 12) {
    return normalizeDateToISO(
      rawDate,
      compYear,
      !hasExplicitYear && Number.isFinite(compMonth) ? compMonth : undefined,
    );
  }

  const probed = normalizeDateToISO(rawDate, compYear);
  if (!probed) {
    return normalizeDateToISO(rawDate, compYear - 1);
  }

  const txMonth = Number.parseInt(probed.slice(5, 7), 10);
  const txDay = Number.parseInt(probed.slice(8, 10), 10);
  const marginDays = params.marginDays ?? 5;

  const lastDayCompMonth = new Date(Date.UTC(compYear, compMonth, 0)).getUTCDate();
  const closingDay = params.closingDay;
  const cycleEndDay =
    typeof closingDay === "number" && Number.isInteger(closingDay) && closingDay > 1
      ? Math.max(1, Math.min(closingDay, lastDayCompMonth) - 1)
      : lastDayCompMonth;

  const cycleCeilingMs =
    Date.UTC(compYear, compMonth - 1, cycleEndDay) + marginDays * 86_400_000;

  let resolvedYear = compYear;
  if (compMonth === 12 && txMonth === 1) {
    const janNextYearMs = Date.UTC(compYear + 1, 0, txDay);
    resolvedYear = janNextYearMs <= cycleCeilingMs ? compYear + 1 : compYear;
  } else {
    const sameYearMs = Date.UTC(compYear, txMonth - 1, txDay);
    if (sameYearMs > cycleCeilingMs) {
      resolvedYear = compYear - 1;
    }
  }

  return isValidCalendarDate(resolvedYear, txMonth, txDay)
    ? formatIsoUtc(resolvedYear, txMonth, txDay)
    : null;
}

/**
 * Alinha a data de parcelas `K >= 2` para o mês da competência da fatura mantendo o dia clampado (D13).
 */
export function alignInstallmentDateToCompetence(
  resolvedIso: string,
  competenceMonth: string,
  installment?: { current: number; total: number },
): { effectiveDate: string; originalDate?: string } {
  const isSubsequentInstallment =
    Boolean(installment && installment.total > 1 && installment.current >= 2);
  const resolvedMonth = resolvedIso.slice(0, 7);

  if (isSubsequentInstallment && resolvedMonth < competenceMonth) {
    const compYear = Number.parseInt(competenceMonth.slice(0, 4), 10);
    const compMonth = Number.parseInt(competenceMonth.slice(5, 7), 10);
    const origDay = Number.parseInt(resolvedIso.slice(8, 10), 10);
    if (Number.isInteger(compYear) && Number.isInteger(compMonth) && Number.isInteger(origDay)) {
      const maxDay = new Date(Date.UTC(compYear, compMonth, 0)).getUTCDate();
      const aligned = formatIsoUtc(compYear, compMonth, Math.max(1, Math.min(origDay, maxDay)));
      if (aligned < APP_START_DATE) {
        return { effectiveDate: APP_START_DATE, originalDate: resolvedIso };
      }
      return { effectiveDate: aligned, originalDate: resolvedIso };
    }
  }

  if (resolvedIso < APP_START_DATE) {
    return { effectiveDate: APP_START_DATE, originalDate: resolvedIso };
  }

  return { effectiveDate: resolvedIso };
}

export interface ParseAmountOptions {
  preferDotDecimal?: boolean;
}

/**
 * Extrai o valor monetário em centavos (inteiro).
 */
export function parseAmountToCents(
  raw: string,
  options?: ParseAmountOptions,
): {
  amountCents: number;
  isNegative: boolean;
  isCreditSuffix?: boolean;
  isDebitSuffix?: boolean;
} | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  if (!/\d/.test(trimmed) || DATE_PATTERNS.some((p) => p.test(trimmed))) {
    return null;
  }

  const hasExplicitBrlMarker = /(?:R\$|\bBRL\b|\breais\b|\breal\b)/i.test(trimmed);

  const hasCreditPrefix = /^\+\s*(?:R\$|BRL|\$)?/i.test(trimmed);
  const hasDebitPrefix = /^-\s*(?:R\$|BRL|\$)?/i.test(trimmed);
  const hasDebitSuffix =
    /(?:^|\s|\d|\))(?:[dD]|\([dD]\)|-)$/.test(trimmed) && !/card|id|feed/i.test(trimmed);
  const hasCreditSuffix =
    /(?:^|\s|\d|\))(?:[cC]|\([cC]\)|\+)$/.test(trimmed) && !/doc|pix/i.test(trimmed);

  const isCredit = hasCreditSuffix || hasCreditPrefix;

  const isNegative =
    (hasDebitSuffix ||
      hasDebitPrefix ||
      trimmed.startsWith("-") ||
      trimmed.endsWith("-") ||
      (trimmed.startsWith("(") && trimmed.endsWith(")")) ||
      /\b(estorno|devolução|devolucao|reembolso)\b/i.test(trimmed)) &&
    !isCredit;

  const sanitized = trimmed
    .replace(/^[+-]\s*/, "")
    .replace(/^(?:R\$|BRL|\$)\s*/i, "")
    .replace(/^[+-]\s*/, "")
    .replace(/\s*(?:reais|real|conto)\b/i, "")
    .replace(/\s*\([dDcC]\)\s*$/, "")
    .replace(/\s+[dDcC]\s*$/, "")
    .replace(/([0-9,.]+)[dDcC]\s*$/, "$1")
    .replace(/\s*[+-]\s*$/, "")
    .trim();

  const sciCandidate = sanitized.replace(/^\((.+)\)$/, "$1").trim();
  if (/^[+-]?\d+(?:[.,]\d+)?[eE][+-]?\d+$/.test(sciCandidate)) {
    const parsedSci = Number(sciCandidate.replace(",", "."));
    if (!Number.isFinite(parsedSci)) return null;
    const amountCents = Math.round(Math.abs(parsedSci) * 100);
    if (amountCents === 0) return null;
    return {
      amountCents,
      isNegative: isCredit ? false : isNegative || parsedSci < 0,
      isCreditSuffix: hasCreditSuffix || undefined,
      isDebitSuffix: hasDebitSuffix || undefined,
    };
  }

  const clean = sanitized.replace(/[^\d,.-]/g, "");
  if (!clean) return null;

  let normalized = clean.replace(/[-()]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    if (/^\d{1,3}(?:,\d{3}){2,}$/.test(normalized)) {
      normalized = normalized.replace(/,/g, "");
    } else {
      normalized = normalized.replace(",", ".");
    }
  } else if (normalized.includes(".")) {
    if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    } else if (
      /^\d{1,3}\.\d{3}$/.test(normalized) &&
      (hasExplicitBrlMarker || !options?.preferDotDecimal)
    ) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return null;

  const amountCents = Math.round(parsed * 100);
  if (amountCents === 0) return null;

  return {
    amountCents: Math.abs(amountCents),
    isNegative: isCredit ? false : isNegative,
    isCreditSuffix: hasCreditSuffix || undefined,
    isDebitSuffix: hasDebitSuffix || undefined,
  };
}

/**
 * Analisa uma matriz de linhas tabulares e infere as colunas Data, Descrição e Valor
 * preservando `headerRowIndex` real quando há preâmbulo (D1).
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

  const maxCols = Math.max(...rows.map((r) => r.cells.length), 3);

  const dateScores = new Array(maxCols).fill(0);
  const amountScores = new Array(maxCols).fill(0);
  const debitScores = new Array(maxCols).fill(0);
  const creditScores = new Array(maxCols).fill(0);
  const textScores = new Array(maxCols).fill(0);
  const typeScores = new Array(maxCols).fill(0);

  let hasHeader = false;
  let headerRowIndex = 0;
  let maxHeaderSignal = 0;

  const candidateHeaderRows = rows.slice(0, 50);
  for (let r = 0; r < candidateHeaderRows.length; r++) {
    const row = candidateHeaderRows[r];
    if (!row || row.cells.length === 0) continue;

    let rowSignal = 0;
    let matchedRoleCols = 0;
    for (const cell of row.cells) {
      const lower = (cell ?? "").trim().toLowerCase();
      if (!lower || lower.length > 48) continue;
      let cellHit = false;
      if (lower.includes("data") || lower.includes("date") || lower === "dt") {
        rowSignal += 2;
        cellHit = true;
      } else if (
        lower.includes("valor") ||
        lower.includes("amount") ||
        lower.includes("montante") ||
        lower.includes("quantia") ||
        lower.includes("total") ||
        lower.includes("preço") ||
        lower.includes("preco") ||
        lower.includes("débito") ||
        lower.includes("debito") ||
        lower.includes("crédito") ||
        lower.includes("credito")
      ) {
        rowSignal += 2;
        cellHit = true;
      } else if (
        lower.includes("desc") ||
        lower.includes("estabelecimento") ||
        lower.includes("histórico") ||
        lower.includes("historico") ||
        lower.includes("lançamento") ||
        lower.includes("lancamento") ||
        lower.includes("transação") ||
        lower.includes("transacao") ||
        lower.includes("detalhe") ||
        lower.includes("compra") ||
        lower.includes("movimenta") ||
        lower.includes("merchant") ||
        lower.includes("comércio") ||
        lower.includes("comercio") ||
        lower.includes("memo")
      ) {
        rowSignal += 2;
        cellHit = true;
      } else if (lower === "d/c" || lower === "tipo" || lower === "sinal") {
        rowSignal += 1;
        cellHit = true;
      }
      if (cellHit) matchedRoleCols += 1;
    }
    if (matchedRoleCols < 2) rowSignal = Math.min(rowSignal, 2);

    if (rowSignal > maxHeaderSignal) {
      maxHeaderSignal = rowSignal;
      headerRowIndex = r;
    }
  }

  const detectedHeaderRow = rows[headerRowIndex];
  if (detectedHeaderRow && detectedHeaderRow.cells.length > 0 && maxHeaderSignal >= 3) {
    hasHeader = true;

    for (let c = 0; c < detectedHeaderRow.cells.length; c++) {
      const headerCell = (detectedHeaderRow.cells[c] ?? "").trim().toLowerCase();
      if (!headerCell) continue;

      if (headerCell.includes("data") || headerCell.includes("date") || headerCell === "dt") {
        dateScores[c] = (dateScores[c] ?? 0) + 100;
      }

      if (
        headerCell.includes("valor") ||
        headerCell.includes("amount") ||
        headerCell.includes("montante") ||
        headerCell.includes("quantia") ||
        headerCell.includes("total") ||
        headerCell.includes("preço") ||
        headerCell.includes("preco")
      ) {
        amountScores[c] = (amountScores[c] ?? 0) + 100;
      }

      if (
        headerCell.includes("r$") ||
        /\bbrl\b/i.test(headerCell) ||
        headerCell.includes("reais") ||
        headerCell.includes("valor nacional") ||
        headerCell.includes("valor fatura") ||
        headerCell.includes("valor em real")
      ) {
        amountScores[c] = (amountScores[c] ?? 0) + 65;
      }

      if (
        headerCell.includes("us$") ||
        /\b(?:usd|eur|gbp)\b/i.test(headerCell) ||
        headerCell.includes("€") ||
        headerCell.includes("dólar") ||
        headerCell.includes("dolar") ||
        headerCell.includes("moeda original") ||
        headerCell.includes("valor original") ||
        headerCell.includes("valor estrangeiro") ||
        headerCell.includes("valor moeda")
      ) {
        amountScores[c] = (amountScores[c] ?? 0) - 130;
      }

      if (
        headerCell.includes("cotação") ||
        headerCell.includes("cotacao") ||
        headerCell.includes("câmbio") ||
        headerCell.includes("cambio") ||
        headerCell.includes("ptax") ||
        headerCell.includes("spread") ||
        headerCell === "taxa" ||
        headerCell.includes("taxa de") ||
        headerCell.includes("taxa câmbio") ||
        headerCell.includes("taxa cambio") ||
        headerCell === "parcela" ||
        headerCell === "parcelas" ||
        headerCell === "parc." ||
        headerCell === "parc"
      ) {
        amountScores[c] = (amountScores[c] ?? 0) - 180;
      }

      if (
        headerCell === "débito" ||
        headerCell === "debito" ||
        headerCell.includes("débito (r$)") ||
        headerCell.includes("debito (r$)") ||
        headerCell.includes("valor débito") ||
        headerCell.includes("valor debito") ||
        headerCell === "saída" ||
        headerCell === "saida" ||
        headerCell.includes("saída (r$)") ||
        headerCell.includes("saida (r$)")
      ) {
        debitScores[c] = (debitScores[c] ?? 0) + 120;
        amountScores[c] = (amountScores[c] ?? 0) + 100;
      }

      if (
        headerCell === "crédito" ||
        headerCell === "credito" ||
        headerCell.includes("crédito (r$)") ||
        headerCell.includes("credito (r$)") ||
        headerCell.includes("valor crédito") ||
        headerCell.includes("valor credito") ||
        headerCell === "entrada" ||
        headerCell === "entradas" ||
        headerCell.includes("entrada (r$)")
      ) {
        creditScores[c] = (creditScores[c] ?? 0) + 120;
        amountScores[c] = (amountScores[c] ?? 0) + 100;
      }

      if (headerCell.includes("saldo")) {
        amountScores[c] = (amountScores[c] ?? 0) - 200;
        debitScores[c] = (debitScores[c] ?? 0) - 200;
        creditScores[c] = (creditScores[c] ?? 0) - 200;
        textScores[c] = (textScores[c] ?? 0) - 200;
      }

      if (
        headerCell.includes("docto") ||
        headerCell.includes("documento") ||
        headerCell.includes("num doc") ||
        headerCell.includes("nº doc") ||
        headerCell === "doc" ||
        headerCell === "doc." ||
        headerCell.includes("nsu") ||
        headerCell.includes("autorização") ||
        headerCell.includes("autorizacao") ||
        headerCell.includes("código") ||
        headerCell.includes("codigo") ||
        headerCell.includes("final cartão") ||
        headerCell.includes("final cartao") ||
        headerCell.includes("últimos dígitos") ||
        headerCell.includes("ultimos digitos")
      ) {
        amountScores[c] = (amountScores[c] ?? 0) - 150;
        textScores[c] = (textScores[c] ?? 0) - 50;
      }

      if (
        headerCell === "d/c" ||
        headerCell === "tipo" ||
        headerCell === "tipo transação" ||
        headerCell === "tipo transacao" ||
        headerCell === "debito/credito" ||
        headerCell === "débito/crédito" ||
        headerCell === "sinal"
      ) {
        typeScores[c] = (typeScores[c] ?? 0) + 100;
      }

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
        headerCell.includes("compra") ||
        headerCell.includes("movimenta") ||
        headerCell.includes("merchant") ||
        headerCell.includes("comércio") ||
        headerCell.includes("comercio") ||
        headerCell.includes("origem")
      ) {
        textScores[c] = (textScores[c] ?? 0) + 100;
      }

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

  let startRowIndex = hasHeader ? headerRowIndex + 1 : 0;
  if (!hasHeader && rows.length >= 2) {
    const scanLimit = Math.min(rows.length, 60);
    const isTabularDataRow = (row: RawParsedRow): boolean => {
      let hasDate = false;
      let hasAmt = false;
      for (const cell of row.cells) {
        const trimmedCell = (cell ?? "").trim();
        if (!trimmedCell) continue;
        if (!hasDate && (DATE_PATTERNS.some((p) => p.test(trimmedCell)) || normalizeDateToISO(trimmedCell) !== null)) {
          hasDate = true;
        } else if (!hasAmt && parseAmountToCents(trimmedCell) !== null) {
          hasAmt = true;
        }
      }
      return hasDate && hasAmt;
    };
    for (let r = 0; r < scanLimit; r++) {
      const cur = rows[r];
      const next = rows[r + 1];
      if (cur && isTabularDataRow(cur) && (!next || isTabularDataRow(next) || r === scanLimit - 1)) {
        startRowIndex = r;
        break;
      }
    }
  }
  const sampleRows = rows.slice(startRowIndex, startRowIndex + 30);
  const columnValues: Array<Set<string>> = Array.from({ length: maxCols }, () => new Set<string>());

  for (const row of sampleRows) {
    for (let c = 0; c < row.cells.length; c++) {
      const cell = (row.cells[c] ?? "").trim();
      if (!cell) continue;

      const lowerCell = cell.toLowerCase();
      columnValues[c]?.add(lowerCell);

      if (DATE_PATTERNS.some((p) => p.test(cell)) || normalizeDateToISO(cell) !== null) {
        dateScores[c] = (dateScores[c] ?? 0) + 3;
      }

      if (parseAmountToCents(cell) !== null) {
        amountScores[c] = (amountScores[c] ?? 0) + 3;
        if (/(?:R\$|\bBRL\b)/i.test(cell)) {
          amountScores[c] = (amountScores[c] ?? 0) + 2;
        } else if (/(?:US\$|\b(?:USD|EUR|GBP)\b|€|£)/i.test(cell)) {
          amountScores[c] = (amountScores[c] ?? 0) - 4;
        }
      }

      if (
        lowerCell === "d" ||
        lowerCell === "c" ||
        lowerCell === "debito" ||
        lowerCell === "débito" ||
        lowerCell === "credito" ||
        lowerCell === "crédito" ||
        lowerCell === "entrada" ||
        lowerCell === "saida" ||
        lowerCell === "saída"
      ) {
        typeScores[c] = (typeScores[c] ?? 0) + 5;
      }

      if (
        cell.length >= 3 &&
        !DATE_PATTERNS.some((p) => p.test(cell)) &&
        parseAmountToCents(cell) === null
      ) {
        textScores[c] = (textScores[c] ?? 0) + 2;
      }
    }
  }

  if (sampleRows.length >= 3) {
    for (let c = 0; c < maxCols; c++) {
      const uniqueCount = columnValues[c]?.size ?? 0;
      const diversityRatio = uniqueCount / sampleRows.length;
      if (diversityRatio > 0.4) {
        textScores[c] = (textScores[c] ?? 0) + Math.round(diversityRatio * 15);
      } else if (diversityRatio <= 0.2 && uniqueCount <= 2) {
        textScores[c] = (textScores[c] ?? 0) - 50;
      }
    }
  }

  let bestDateCol = 0;
  let maxDateScore = -1;
  for (let i = 0; i < maxCols; i++) {
    if ((dateScores[i] ?? 0) > maxDateScore) {
      maxDateScore = dateScores[i] ?? 0;
      bestDateCol = i;
    }
  }

  let bestDebitCol: number | undefined;
  let bestCreditCol: number | undefined;
  let maxDebit = 100;
  let maxCredit = 100;

  for (let i = 0; i < maxCols; i++) {
    if (i === bestDateCol) continue;
    if ((debitScores[i] ?? 0) >= maxDebit) {
      maxDebit = debitScores[i] ?? 0;
      bestDebitCol = i;
    }
  }

  for (let i = 0; i < maxCols; i++) {
    if (i === bestDateCol || i === bestDebitCol) continue;
    if ((creditScores[i] ?? 0) >= maxCredit) {
      maxCredit = creditScores[i] ?? 0;
      bestCreditCol = i;
    }
  }

  const hasDualAmountCols = bestDebitCol !== undefined && bestCreditCol !== undefined;

  let bestAmountCol = (bestDateCol + 1) % maxCols;
  if (hasDualAmountCols && bestDebitCol !== undefined) {
    bestAmountCol = bestDebitCol;
  } else {
    let maxAmountScore = -1;
    for (let i = 0; i < maxCols; i++) {
      if (i === bestDateCol) continue;
      if ((amountScores[i] ?? 0) > maxAmountScore) {
        maxAmountScore = amountScores[i] ?? 0;
        bestAmountCol = i;
      }
    }
  }

  let bestDescCol = -1;
  let maxTextScore = -Infinity;
  for (let i = 0; i < maxCols; i++) {
    if (
      i === bestDateCol ||
      i === bestAmountCol ||
      i === bestDebitCol ||
      i === bestCreditCol
    ) {
      continue;
    }
    if ((textScores[i] ?? 0) > maxTextScore) {
      maxTextScore = textScores[i] ?? 0;
      bestDescCol = i;
    }
  }

  if (bestDescCol === -1) {
    for (let i = 0; i < maxCols; i++) {
      if (i !== bestDateCol) {
        bestDescCol = i;
        break;
      }
    }
    if (bestDescCol === -1) bestDescCol = 0;
  }

  let bestTypeCol: number | undefined;
  if (maxCols >= 4) {
    let maxTypeScore = 10;
    for (let i = 0; i < maxCols; i++) {
      if (
        i === bestDateCol ||
        i === bestAmountCol ||
        i === bestDescCol ||
        i === bestDebitCol ||
        i === bestCreditCol
      ) {
        continue;
      }
      if ((typeScores[i] ?? 0) > maxTypeScore) {
        maxTypeScore = typeScores[i] ?? 0;
        bestTypeCol = i;
      }
    }
  }

  return {
    dateColIndex: bestDateCol,
    descriptionColIndex: bestDescCol,
    amountColIndex: bestAmountCol,
    typeColIndex: bestTypeCol,
    debitColIndex: hasDualAmountCols ? bestDebitCol : undefined,
    creditColIndex: hasDualAmountCols ? bestCreditCol : undefined,
    hasHeader,
    startRowIndex,
    ...(hasHeader ? { headerRowIndex } : {}),
  };
}

/**
 * Avalia o nível de confiança (0 a 100) de um mapeamento de colunas inferido.
 */
export function evaluateMappingConfidence(params: {
  rows: RawParsedRow[];
  mapping: ColumnMapping;
  isCacheHit?: boolean;
}): number {
  const { rows, mapping, isCacheHit } = params;
  if (isCacheHit) return 100;
  if (rows.length === 0) return 0;

  const sample = rows.slice(mapping.startRowIndex, mapping.startRowIndex + 20);
  if (sample.length === 0) return 0;

  let validDates = 0;
  let validAmounts = 0;
  let validTexts = 0;

  const hasDualAmountCols =
    mapping.debitColIndex !== undefined && mapping.creditColIndex !== undefined;

  for (const row of sample) {
    const dateCell = (row.cells[mapping.dateColIndex] ?? "").trim();
    const textCell = (row.cells[mapping.descriptionColIndex] ?? "").trim();

    if (normalizeDateToISO(dateCell) !== null || DATE_PATTERNS.some((p) => p.test(dateCell))) {
      validDates++;
    }
    if (hasDualAmountCols) {
      const debitCell = (row.cells[mapping.debitColIndex!] ?? "").trim();
      const creditCell = (row.cells[mapping.creditColIndex!] ?? "").trim();
      if (parseAmountToCents(debitCell) !== null || parseAmountToCents(creditCell) !== null) {
        validAmounts++;
      }
    } else {
      const amountCell = (row.cells[mapping.amountColIndex] ?? "").trim();
      if (parseAmountToCents(amountCell) !== null) {
        validAmounts++;
      }
    }
    if (textCell.length >= 2 && parseAmountToCents(textCell) === null) {
      validTexts++;
    }
  }

  const dateRatio = validDates / sample.length;
  const amountRatio = validAmounts / sample.length;
  const textRatio = validTexts / sample.length;

  let score = Math.round((dateRatio * 0.45 + amountRatio * 0.45 + textRatio * 0.1) * 100);
  if (mapping.hasHeader && score >= 70) {
    score = Math.min(100, score + 10);
  }
  return score;
}
