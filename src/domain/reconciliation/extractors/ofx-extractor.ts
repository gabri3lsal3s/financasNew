import type { RawExtractedEntry, StatementTransaction } from "../contracts";
import { cleanDescription, isInvoicePayment, isStatementNoiseOrSummary, isSubcardHeader } from "../clean";
import { normalizeRawEntries } from "../normalize-entries";
import { parseAmountToCents } from "./type-sniffer";

export interface OfxStatementMetadata {
  org: string | null;
  acctId: string | null;
  acctLast4: string | null;
  ledgerBalanceCents: number | null;
}

const EXPLICIT_DEBIT_TYPES = new Set([
  "DEBIT",
  "POS",
  "FEE",
  "SRVCHG",
  "REPEATPMT",
  "HOLD",
  "CHECK",
]);
const EXPLICIT_CREDIT_TYPES = new Set(["CREDIT", "DEP", "INTEREST", "DIV"]);

function unescapeOfxString(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function normalizeOfxDate(rawDate: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(rawDate.trim());
  if (match && match[1] && match[2] && match[3]) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

function extractFirstTagValue(source: string, tagName: string): string {
  const tagRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i");
  const match = tagRegex.exec(source);
  return match && match[1] ? unescapeOfxString(match[1]) : "";
}

/**
 * Extrai metadados informativos do cabeçalho/rodapé de arquivos OFX/QFX
 * (`<ORG>`, `<ACCTID>` e `<LEDGERBAL><BALAMT>`).
 */
export function extractOfxMetadata(ofxText: string): OfxStatementMetadata {
  const org = extractFirstTagValue(ofxText, "ORG") || null;
  const acctId = extractFirstTagValue(ofxText, "ACCTID") || null;
  const digitsOnly = acctId ? acctId.replace(/\D/g, "") : "";
  const acctLast4 = digitsOnly.length >= 4 ? digitsOnly.slice(-4) : null;

  let ledgerBalanceCents: number | null = null;
  const ledgerBlockMatch = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>|<\/CCSTMTRS>|$)/i.exec(
    ofxText,
  );
  if (ledgerBlockMatch?.[1]) {
    const rawBal = extractFirstTagValue(ledgerBlockMatch[1], "BALAMT");
    const parsedBal = parseAmountToCents(rawBal, { preferDotDecimal: true });
    if (parsedBal && parsedBal.amountCents > 0) {
      const isCreditCardStatement = /<CCSTMTRS>/i.test(ofxText);
      ledgerBalanceCents =
        !isCreditCardStatement && parsedBal.isNegative
          ? -parsedBal.amountCents
          : parsedBal.amountCents;
    }
  }

  return {
    org,
    acctId,
    acctLast4,
    ledgerBalanceCents,
  };
}

interface ParsedOfxRawBlock {
  sourceIndex: number;
  date: string;
  amountCents: number;
  isNegative: boolean;
  fitid?: string;
  trnType: string;
  combinedDesc: string;
}

/**
 * Extrator "burro" de OFX (SGML e XML): devolve `RawExtractedEntry[]`
 * mantendo polaridade e tipos OFX para normalização no Estágio 1.
 */
export function extractRawEntriesFromOfx(ofxText: string): RawExtractedEntry[] {
  const parsedBlocks: ParsedOfxRawBlock[] = [];
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let trnMatch: RegExpExecArray | null;
  let blockIndex = 0;

  while ((trnMatch = trnRegex.exec(ofxText)) !== null) {
    const block = trnMatch[1];
    if (!block || !block.trim()) continue;

    const extractTag = (tagName: string): string => {
      const tagRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i");
      const match = tagRegex.exec(block);
      return match && match[1] ? match[1].trim() : "";
    };

    const rawDate = extractTag("DTPOSTED") || extractTag("DTUSER");
    const date = normalizeOfxDate(rawDate);
    const rawAmt = extractTag("TRNAMT");
    const fitid = extractTag("FITID") || undefined;
    const trnType = extractTag("TRNTYPE").toUpperCase();

    const rawName = unescapeOfxString(extractTag("NAME"));
    const rawMemo = unescapeOfxString(extractTag("MEMO"));
    const rawCheckNum = unescapeOfxString(extractTag("CHECKNUM"));

    let combinedDesc: string;
    if (rawName && rawMemo) {
      if (rawName.toLowerCase() === rawMemo.toLowerCase()) {
        combinedDesc = rawName;
      } else if (rawMemo.toLowerCase().includes(rawName.toLowerCase())) {
        combinedDesc = rawMemo;
      } else if (rawName.toLowerCase().includes(rawMemo.toLowerCase())) {
        combinedDesc = rawName;
      } else {
        combinedDesc = `${rawName} - ${rawMemo}`;
      }
    } else {
      combinedDesc = rawMemo || rawName || rawCheckNum || "Despesa";
    }

    const currentIdx = blockIndex++;
    if (!date || !rawAmt) continue;
    if (isStatementNoiseOrSummary(combinedDesc) || isSubcardHeader(combinedDesc)) {
      continue;
    }

    const parsedAmt = parseAmountToCents(rawAmt, { preferDotDecimal: true });
    if (!parsedAmt || parsedAmt.amountCents === 0) continue;

    parsedBlocks.push({
      sourceIndex: currentIdx,
      date,
      amountCents: parsedAmt.amountCents,
      isNegative: parsedAmt.isNegative,
      fitid,
      trnType,
      combinedDesc,
    });
  }

  let posGenericPurchases = 0;
  let negGenericPurchases = 0;
  let posGenericPayments = 0;
  let negGenericPayments = 0;

  for (const entry of parsedBlocks) {
    if (EXPLICIT_DEBIT_TYPES.has(entry.trnType) || EXPLICIT_CREDIT_TYPES.has(entry.trnType)) {
      continue;
    }
    if (isInvoicePayment(entry.combinedDesc, false)) {
      if (entry.isNegative) negGenericPayments++;
      else posGenericPayments++;
    } else {
      if (entry.isNegative) negGenericPurchases++;
      else posGenericPurchases++;
    }
  }

  const positiveMeansPurchaseForGeneric =
    posGenericPurchases > negGenericPurchases &&
    posGenericPurchases >= 1 &&
    negGenericPayments >= posGenericPayments;

  return parsedBlocks.map((entry) => {
    const isDebitType = EXPLICIT_DEBIT_TYPES.has(entry.trnType);
    const isCreditType = EXPLICIT_CREDIT_TYPES.has(entry.trnType);

    let explicitEntryType: "purchase" | "refund" | undefined;
    if (isCreditType) {
      explicitEntryType = "refund";
    } else if (isDebitType) {
      explicitEntryType = "purchase";
    }

    return {
      sourceIndex: entry.sourceIndex,
      rawDate: entry.date,
      merchantRaw: entry.combinedDesc,
      rawLine: entry.combinedDesc,
      amountCents: entry.amountCents,
      isNegative: entry.isNegative,
      signHint: positiveMeansPurchaseForGeneric ? "positive_purchase" : "negative_purchase",
      explicitEntryType,
      dateFormatHint: "ymd",
      fitid: entry.fitid,
      sourceKind: "ofx",
    };
  });
}

/**
 * Converte arquivo OFX em transações normalizadas via Normalizador Canônico Único.
 */
export function parseOfxToTransactions(
  ofxText: string,
  params: { cardId: string; competenceMonth: string; closingDay?: number | null },
): StatementTransaction[] {
  const rawEntries = extractRawEntriesFromOfx(ofxText);
  const normalized = normalizeRawEntries(rawEntries, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.closingDay,
    defaultSignHint: "negative_purchase",
  });

  // Garante compatibilidade quando NAME/MEMO resulta em descrição limpa vazia
  return normalized.map((tx) =>
    tx.cleanDescription
      ? tx
      : { ...tx, cleanDescription: cleanDescription(tx.rawDescription) },
  );
}
