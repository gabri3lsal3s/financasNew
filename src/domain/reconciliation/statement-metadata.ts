import { shiftMonth } from "@/domain/cards";
import { resolveBillCompetence } from "@/domain/competence";
import { normalizeDateToISO } from "./parsers/type-sniffer";
import type { StatementTransaction } from "./types";

export interface CardContextForMetadata {
  id?: string;
  name?: string | null;
  brand?: string | null;
  closing_day?: number | null;
  due_day?: number | null;
  last_four_digits?: string | null;
}

export interface DetectedStatementMetadata {
  /** Competência dominante da fatura (YYYY-MM), inferida por texto explícito ou distribuição de compras. */
  detectedCompetenceMonth: string | null;
  /** Motivo ou método de inferência da competência. */
  competenceInferenceSource: "explicit_header" | "due_date" | "transactions_distribution" | null;
  /** Nível de confiança da detecção de competência: "high" | "medium" | "low". */
  competenceConfidence: "high" | "medium" | "low";
  /** Data de vencimento da fatura (YYYY-MM-DD), se encontrada textualmente. */
  detectedDueDate: string | null;
  /** Quatro últimos dígitos do cartão impressos na fatura. */
  detectedCardLast4: string | null;
  /** Nome ou marca do banco emissor detectado (ex.: "Nubank", "Itaú", "Bradesco", "Santander", "Inter", "C6"). */
  detectedBankBrand: string | null;
  /** Valor total impresso da fatura em centavos (checksum de fechamento). */
  detectedTotalCents: number | null;
  /** Se há divergência entre a competência detectada e a competência ativa no app. */
  hasCompetenceMismatch: boolean;
  /** Se há divergência entre os dígitos/banco detectados e o cartão selecionado no app. */
  hasCardMismatch: boolean;
  /** Mensagem explicativa amigável de advertência caso haja discrepância de competência. */
  competenceMismatchWarning?: string;
  /** Mensagem explicativa amigável de advertência caso haja discrepância de cartão. */
  cardMismatchWarning?: string;
}

const MONTH_NAMES_MAP: Record<string, string> = {
  janeiro: "01",
  jan: "01",
  fevereiro: "02",
  fev: "02",
  feb: "02",
  março: "03",
  marco: "03",
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

const BANK_BRAND_PATTERNS: Array<{ pattern: RegExp; canonicalName: string }> = [
  { pattern: /\bnubank\b|\bnu\s+pagamentos\b/i, canonicalName: "Nubank" },
  { pattern: /\bita[uú]\b|\bitaucard\b/i, canonicalName: "Itaú" },
  { pattern: /\bbradesco\b|\bbradescard\b/i, canonicalName: "Bradesco" },
  { pattern: /\bsantander\b/i, canonicalName: "Santander" },
  { pattern: /\bbanco\s+inter\b|\binter\b/i, canonicalName: "Inter" },
  { pattern: /\bc6\s*bank\b|\bc6\b/i, canonicalName: "C6 Bank" },
  { pattern: /\bbtg\s*pactual\b|\bbtg\b/i, canonicalName: "BTG Pactual" },
  { pattern: /\bxp\s*investimentos\b|\bxp\b/i, canonicalName: "XP" },
  { pattern: /\bbanco\s+do\s+brasil\b|\bourocard\b|\bbb\b/i, canonicalName: "Banco do Brasil" },
  { pattern: /\bcaixa\s*econ[oô]mica\b|\bcaixa\b/i, canonicalName: "Caixa" },
  { pattern: /\bsicredi\b/i, canonicalName: "Sicredi" },
  { pattern: /\bsicoob\b/i, canonicalName: "Sicoob" },
  { pattern: /\bbanco\s+pan\b|\bpan\b/i, canonicalName: "Banco Pan" },
  { pattern: /\bporto\s*seguro\b|\bporto\s*bank\b/i, canonicalName: "Porto Bank" },
  { pattern: /\bcredicard\b/i, canonicalName: "Credicard" },
  { pattern: /\bwill\s*bank\b/i, canonicalName: "Will Bank" },
  { pattern: /\bpicpay\b/i, canonicalName: "PicPay" },
  { pattern: /\bmercadopago\b|\bmercado\s*pago\b/i, canonicalName: "Mercado Pago" },
  { pattern: /\bnomad\b|\bnomadglobal\b/i, canonicalName: "Nomad" },
  { pattern: /\brico\b/i, canonicalName: "Rico" },
];

function extractExplicitCompetenceFromText(rawText: string, fallbackYear?: number): string | null {
  if (!rawText) return null;
  const headerSlice = rawText.slice(0, 15_000);

  // 1. "Fatura de Novembro de 2026", "Extrato Referente ao mês de Novembro de 2026", "Competência: Dezembro 2026"
  const namedMatch =
    /(?:(?:fatura|extrato\s+referente\s+ao\s+m[eê]s|m[eê]s\s+de\s+refer[eê]ncia)\s*(?:[:#]\s*|de\s+|do\s+m[eê]s\s+de\s+)?|compet[eê]ncia\s*[:#]?\s*)(janeiro|jan|fevereiro|fev|feb|março|marco|mar|abril|abr|apr|maio|mai|may|junho|jun|julho|jul|agosto|ago|aug|setembro|set|sep|outubro|out|oct|novembro|nov|dezembro|dez|dec)[a-zç]*\s*(?:de\s+|[/-])?\s*(\d{2,4})/i.exec(
      headerSlice,
    );
  if (namedMatch?.[1] && namedMatch?.[2]) {
    const monthNum = MONTH_NAMES_MAP[namedMatch[1].toLowerCase()];
    let year = namedMatch[2];
    if (year.length === 2) year = `20${year}`;
    if (monthNum && year.length === 4) {
      return `${year}-${monthNum}`;
    }
  }

  // 2. "Mês de referência: Novembro" (sem ano explícito — usa ano do vencimento ou fallbackYear)
  if (fallbackYear) {
    const refMonthOnly =
      /m[eê]s\s+de\s+refer[eê]ncia\s*[:#]?\s*(janeiro|jan|fevereiro|fev|feb|março|marco|mar|abril|abr|apr|maio|mai|may|junho|jun|julho|jul|agosto|ago|aug|setembro|set|sep|outubro|out|oct|novembro|nov|dezembro|dez|dec)\b/i.exec(
        headerSlice,
      );
    if (refMonthOnly?.[1]) {
      const monthNum = MONTH_NAMES_MAP[refMonthOnly[1].toLowerCase()];
      if (monthNum) return `${fallbackYear}-${monthNum}`;
    }
  }

  // 3. "Competência: 11/2026" ou "Fatura 11/2026"
  const numericMatch =
    /(?:fatura|compet[eê]ncia)\s*[:#]?\s*(0[1-9]|1[0-2])[/-](\d{4})/i.exec(headerSlice);
  if (numericMatch?.[1] && numericMatch?.[2]) {
    return `${numericMatch[2]}-${numericMatch[1]}`;
  }

  // 4. "Competência 2026-11"
  const isoMatch =
    /(?:fatura|compet[eê]ncia)\s*[:#]?\s*(\d{4})[/-](0[1-9]|1[0-2])/i.exec(headerSlice);
  if (isoMatch?.[1] && isoMatch?.[2]) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  return null;
}

function extractDueDateFromText(rawText: string, referenceYear?: number): string | null {
  if (!rawText) return null;
  const headerSlice = rawText.slice(0, 10_000);

  const dueMatch =
    /(?:vencimento|vence\s+em|data\s+de\s+vencimento|pagar\s+at[eé]|venc\b)\s*[:#]?\s*(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+(?:de\s+)?[a-zç]{3,9}(?:\s+(?:de\s+)?\d{2,4})?)/i.exec(
      headerSlice,
    );
  if (dueMatch?.[1]) {
    return normalizeDateToISO(dueMatch[1], referenceYear ?? new Date().getFullYear());
  }

  return null;
}

function extractAllCardLast4FromText(rawText: string): string[] {
  if (!rawText) return [];
  const headerSlice = rawText.slice(0, 20_000);
  const found = new Set<string>();

  // 1. "cartão final 1234", "final: 1234", "cartão: **** **** **** 1234"
  const labeledRegex =
    /(?:cart[aã]o|final|cart[aã]o\s+final|card|conta)\s*[:#]?\s*(?:(?:[•*xX.-]{3,4}\s*){1,4})?(\d{4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = labeledRegex.exec(headerSlice)) !== null) {
    if (m[1]) found.add(m[1]);
  }

  // 2. Formato mascarado clássico: "•••• •••• •••• 1234" ou "**** **** **** 1234"
  const maskedRegex = /(?:[•*xX]{3,4}\s*){2,4}(\d{4})\b/g;
  while ((m = maskedRegex.exec(headerSlice)) !== null) {
    if (m[1]) found.add(m[1]);
  }

  return Array.from(found);
}

function extractBankBrandFromText(rawText: string): string | null {
  if (!rawText) return null;
  const headerSlice = rawText.slice(0, 10_000);

  for (const item of BANK_BRAND_PATTERNS) {
    if (item.pattern.test(headerSlice)) {
      return item.canonicalName;
    }
  }

  return null;
}

function inferDominantCompetenceFromTransactions(
  transactions: readonly StatementTransaction[],
  closingDay?: number | null,
): { competence: string; confidence: "high" | "medium" | "low" } | null {
  const purchaseTxs = transactions.filter((tx) => !tx.isPayment && tx.date);
  if (purchaseTxs.length === 0) return null;

  const counts = new Map<string, number>();
  const effectiveClosingDay =
    typeof closingDay === "number" && closingDay >= 1 && closingDay <= 31 ? closingDay : null;

  for (const tx of purchaseTxs) {
    const comp = effectiveClosingDay !== null
      ? resolveBillCompetence(tx.date, effectiveClosingDay)
      : tx.date.slice(0, 7);

    counts.set(comp, (counts.get(comp) ?? 0) + 1);
  }

  let topComp = "";
  let topCount = 0;
  for (const [comp, count] of counts.entries()) {
    if (count > topCount) {
      topCount = count;
      topComp = comp;
    }
  }

  if (!topComp) return null;

  const ratio = topCount / purchaseTxs.length;
  let confidence: "high" | "medium" | "low" = "low";
  if (purchaseTxs.length >= 3 && ratio >= 0.7) {
    confidence = "high";
  } else if (purchaseTxs.length >= 2 && ratio >= 0.5) {
    confidence = "medium";
  }

  return { competence: topComp, confidence };
}

export interface DetectStatementMetadataParams {
  rawText?: string | null;
  transactions?: readonly StatementTransaction[];
  activeCompetenceMonth: string;
  card?: CardContextForMetadata | null;
  printedTotalCents?: number | null;
  aiDetectedMeta?: {
    detectedCompetenceMonth?: string | null;
    detectedDueDate?: string | null;
    detectedCardLast4?: string | null;
    detectedCardBrandOrBank?: string | null;
    detectedTotalInvoiceCents?: number | null;
  } | null;
}

/**
 * Motor central determinístico de auditoria e validação de metadados da fatura.
 * Confronta a fatura importada com o cartão e a competência ativa no app.
 */
export function detectStatementMetadata(
  params: DetectStatementMetadataParams,
): DetectedStatementMetadata {
  const {
    rawText = "",
    transactions = [],
    activeCompetenceMonth,
    card,
    printedTotalCents,
    aiDetectedMeta,
  } = params;

  const text = rawText ?? "";
  const refYear = Number.parseInt(activeCompetenceMonth.slice(0, 4), 10) || new Date().getFullYear();

  // 1. Extrações textuais locais
  const localDueDate = extractDueDateFromText(text, refYear);
  const dueYear = localDueDate ? Number.parseInt(localDueDate.slice(0, 4), 10) : refYear;
  const explicitComp = extractExplicitCompetenceFromText(text, Number.isFinite(dueYear) ? dueYear : refYear);
  const allLocalLast4 = extractAllCardLast4FromText(text);
  const localLast4 = allLocalLast4[0] ?? null;
  const localBank = extractBankBrandFromText(text);

  // 2. Mescla com extração da Micro-IA (quando disponível)
  const detectedDueDate = aiDetectedMeta?.detectedDueDate || localDueDate;
  const detectedCardLast4 = aiDetectedMeta?.detectedCardLast4 || localLast4;
  const detectedBankBrand = aiDetectedMeta?.detectedCardBrandOrBank || localBank;
  const detectedTotalCents =
    aiDetectedMeta?.detectedTotalInvoiceCents ?? printedTotalCents ?? null;

  // 3. Resolução da competência
  const fromTxs = inferDominantCompetenceFromTransactions(transactions, card?.closing_day);
  let detectedCompetenceMonth: string | null = null;
  let competenceInferenceSource:
    | "explicit_header"
    | "due_date"
    | "transactions_distribution"
    | null = null;
  let competenceConfidence: "high" | "medium" | "low" = "low";

  if (explicitComp) {
    detectedCompetenceMonth = explicitComp;
    competenceInferenceSource = "explicit_header";
    competenceConfidence = "high";
  } else if (aiDetectedMeta?.detectedCompetenceMonth) {
    detectedCompetenceMonth = aiDetectedMeta.detectedCompetenceMonth;
    competenceInferenceSource = "explicit_header";
    competenceConfidence = "high";
  } else if (fromTxs) {
    detectedCompetenceMonth = fromTxs.competence;
    competenceInferenceSource = "transactions_distribution";
    competenceConfidence = fromTxs.confidence;
  } else if (detectedDueDate) {
    // Se não houver transações nem texto de competência, usa o mês de vencimento
    detectedCompetenceMonth = detectedDueDate.slice(0, 7);
    competenceInferenceSource = "due_date";
    competenceConfidence = "medium";
  }

  // Tolerância de vencimento no mês seguinte (due_day < closing_day):
  // Se o cabeçalho cita M+1 (mês de vencimento), mas as compras com closing_day pertencem
  // com alta confiança à competência ativa, evita falso conflito recorrente todo mês.
  if (
    detectedCompetenceMonth === shiftMonth(activeCompetenceMonth, 1) &&
    typeof card?.due_day === "number" &&
    typeof card?.closing_day === "number" &&
    card.due_day < card.closing_day &&
    fromTxs?.competence === activeCompetenceMonth &&
    fromTxs.confidence === "high"
  ) {
    detectedCompetenceMonth = activeCompetenceMonth;
    competenceInferenceSource = "transactions_distribution";
  }

  // 4. Verificação de discrepância de competência
  const hasCompetenceMismatch = Boolean(
    detectedCompetenceMonth &&
      detectedCompetenceMonth !== activeCompetenceMonth &&
      (competenceConfidence === "high" || competenceConfidence === "medium"),
  );

  let competenceMismatchWarning: string | undefined;
  if (hasCompetenceMismatch && detectedCompetenceMonth) {
    const dueInfo = detectedDueDate
      ? ` (Vencimento detectado: ${detectedDueDate.split("-").reverse().join("/")})`
      : "";
    competenceMismatchWarning = `Esta fatura aparenta ser da competência ${detectedCompetenceMonth}${dueInfo}, mas a importação atual está aberta em ${activeCompetenceMonth}.`;
  }

  // 5. Verificação de discrepância de cartão (suporta múltiplos finais no mesmo extrato: físico + virtual/adicional)
  let hasCardMismatch = false;
  let cardMismatchWarning: string | undefined;

  const cardDigits = card?.last_four_digits?.trim();
  const cardMatchesAnyDetected = Boolean(
    cardDigits &&
      (cardDigits === detectedCardLast4 || allLocalLast4.includes(cardDigits)),
  );
  if (cardDigits && detectedCardLast4 && !cardMatchesAnyDetected) {
    hasCardMismatch = true;
    cardMismatchWarning = `A fatura menciona o cartão com final ${detectedCardLast4}, mas o cartão selecionado termina em ${cardDigits}.`;
  } else if (detectedBankBrand && card?.name) {
    const cardNameLower = card.name.toLowerCase();
    const cardBrandLower = (card.brand ?? "").toLowerCase();
    const detectedLower = detectedBankBrand.toLowerCase();

    // Se o banco detectado na fatura não tem relação com o nome nem a bandeira do cartão
    const isRelated =
      cardNameLower.includes(detectedLower) ||
      cardBrandLower.includes(detectedLower) ||
      (detectedLower === "nubank" && cardNameLower.includes("roxinho")) ||
      (detectedLower === "itaú" && (cardNameLower.includes("itau") || cardNameLower.includes("click"))) ||
      (detectedLower === "bradesco" && cardNameLower.includes("elo")) ||
      (detectedLower === "banco do brasil" && cardNameLower.includes("bb"));

    // Se for claramente de outro banco de grande porte conhecido e o cartão tem nome de outro banco
    const cardHasOtherBankName = BANK_BRAND_PATTERNS.some(
      (b) =>
        b.canonicalName.toLowerCase() !== detectedLower &&
        (cardNameLower.includes(b.canonicalName.toLowerCase()) ||
          (b.canonicalName === "Itaú" && cardNameLower.includes("itau")) ||
          (b.canonicalName === "Banco do Brasil" && cardNameLower.includes("bb"))),
    );

    if (!isRelated && cardHasOtherBankName) {
      hasCardMismatch = true;
      cardMismatchWarning = `A fatura indica o emissor ${detectedBankBrand}, enquanto o cartão selecionado é "${card.name}".`;
    }
  }

  return {
    detectedCompetenceMonth,
    competenceInferenceSource,
    competenceConfidence,
    detectedDueDate,
    detectedCardLast4,
    detectedBankBrand,
    detectedTotalCents,
    hasCompetenceMismatch,
    hasCardMismatch,
    competenceMismatchWarning,
    cardMismatchWarning,
  };
}
