import type { StatementTransaction } from "../types";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  classifyTransactionNature,
  cleanDescription,
  isInvoicePayment,
  isPaymentOrSettlement,
  isStatementNoiseOrSummary,
  isSubcardHeader,
} from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";
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

/**
 * Desescapa entidades XML/SGML e remove artefatos de tags em strings OFX.
 */
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

/**
 * Normaliza datas do formato OFX (`YYYYMMDD` ou `YYYYMMDDHHMMSS[...]`) para `YYYY-MM-DD`.
 */
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
 * Nota: `<LEDGERBAL>` é estritamente informativo e nunca deve reprovar OFX no Quality Gate.
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
      ledgerBalanceCents = parsedBal.amountCents;
    }
  }

  return {
    org,
    acctId,
    acctLast4,
    ledgerBalanceCents,
  };
}

interface RawOfxEntry {
  date: string;
  amountCents: number;
  isNegative: boolean;
  fitid?: string;
  trnType: string;
  combinedDesc: string;
}

/**
 * Parser de arquivos OFX (Open Financial Exchange) nos formatos SGML e XML.
 */
export function parseOfxToTransactions(
  ofxText: string,
  params: { cardId: string; competenceMonth: string },
): StatementTransaction[] {
  const rawEntries: RawOfxEntry[] = [];

  // Isola blocos <STMTTRN>...</STMTTRN> ou <STMTTRN> até o próximo <STMTTRN> (SGML sem tag de fechamento)
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let trnMatch: RegExpExecArray | null;

  while ((trnMatch = trnRegex.exec(ofxText)) !== null) {
    const block = trnMatch[1];
    if (!block || !block.trim()) continue;

    // Extrai tags comuns do bloco
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

    if (!date || !rawAmt) continue;

    // Descarte estrutural de linhas de resumo/saldo (ex.: SALDO ANTERIOR, TOTAL DA FATURA)
    if (isStatementNoiseOrSummary(combinedDesc) || isSubcardHeader(combinedDesc)) {
      continue;
    }

    const parsedAmt = parseAmountToCents(rawAmt, { preferDotDecimal: true });
    if (!parsedAmt || parsedAmt.amountCents === 0) continue;

    rawEntries.push({
      date,
      amountCents: parsedAmt.amountCents,
      isNegative: parsedAmt.isNegative,
      fitid,
      trnType,
      combinedDesc,
    });
  }

  // Inferência automática de polaridade quando o banco emite TRNTYPE genérico (OTHER / PAYMENT / vazio)
  let posGenericPurchases = 0;
  let negGenericPurchases = 0;
  let posGenericPayments = 0;
  let negGenericPayments = 0;

  for (const entry of rawEntries) {
    if (EXPLICIT_DEBIT_TYPES.has(entry.trnType) || EXPLICIT_CREDIT_TYPES.has(entry.trnType)) {
      continue;
    }
    const isUnconditionalPay = isInvoicePayment(entry.combinedDesc, false);
    if (isUnconditionalPay) {
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

  const transactions: StatementTransaction[] = [];
  const occurrenceCounter = new Map<string, number>();
  let index = 0;

  for (const entry of rawEntries) {
    const isDebitType = EXPLICIT_DEBIT_TYPES.has(entry.trnType);
    const isCreditType = EXPLICIT_CREDIT_TYPES.has(entry.trnType);

    // Em extratos OFX padrão: negativos (< 0) = compras, positivos (> 0) = pagamentos/estornos.
    // Quando o emissor usa TRNTYPE genérico (OTHER/PAYMENT) com compras positivas e pagamentos negativos,
    // `positiveMeansPurchaseForGeneric` inverte a interpretação de sinal automaticamente.
    let isCredit: boolean;
    if (isCreditType) {
      isCredit = true;
    } else if (isDebitType) {
      isCredit = false;
    } else if (positiveMeansPurchaseForGeneric) {
      isCredit = entry.isNegative;
    } else {
      isCredit = !entry.isNegative;
    }

    const isPayment = isPaymentOrSettlement(entry.combinedDesc, isCredit);
    const isRefund = isCredit && !isPayment;

    const cleanDesc = cleanDescription(entry.combinedDesc);
    const installment = extractInstallmentInfo(entry.combinedDesc, entry.date);

    // Clamping de datas anteriores a 2026-01-01 preservando a data original no hash
    const APP_START_DATE = "2026-01-01";
    let effectiveDate = entry.date;
    let originalDate: string | undefined;
    if (entry.date < APP_START_DATE) {
      originalDate = entry.date;
      effectiveDate = APP_START_DATE;
    }

    const hashDate = originalDate || effectiveDate;
    const occKey = `${hashDate}|${entry.amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      date: hashDate,
      amountCents: entry.amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    const inferredChargeKind = inferChargeKindFromDescription(entry.combinedDesc);
    const nature = classifyTransactionNature({
      rawDescription: entry.combinedDesc,
      isCredit,
      isPayment,
      isRefund,
      hasChargeKind: inferredChargeKind != null && inferredChargeKind !== "regular",
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      occurrenceIndex: occIndex,
      date: effectiveDate,
      originalDate,
      nature,
      rawDescription: entry.combinedDesc,
      cleanDescription: cleanDesc,
      amountCents: entry.amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
      fitid: entry.fitid,
      inferredChargeKind,
    });
  }

  return transactions;
}
