import type { StatementTransaction } from "../types";
import { cleanDescription, isPaymentOrSettlement } from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";

/**
 * Desescapa entidades XML/SGML e remove artefatos de tags em strings OFX.
 */
export function unescapeOfxString(str: string): string {
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
export function normalizeOfxDate(rawDate: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(rawDate.trim());
  if (match && match[1] && match[2] && match[3]) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

/**
 * Parser de arquivos OFX (Open Financial Exchange) nos formatos SGML e XML.
 */
export function parseOfxToTransactions(
  ofxText: string,
  params: { cardId: string; competenceMonth: string },
): StatementTransaction[] {
  const transactions: StatementTransaction[] = [];

  // Isola blocos <STMTTRN>...</STMTTRN> ou <STMTTRN> até o próximo <STMTTRN> (SGML sem tag de fechamento)
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let trnMatch: RegExpExecArray | null;

  const occurrenceCounter = new Map<string, number>();
  let index = 0;

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

    const numAmt = Number.parseFloat(rawAmt.replace(",", "."));
    if (Number.isNaN(numAmt) || numAmt === 0) continue;

    const isDebitType = ["DEBIT", "POS", "FEE", "SRVCHG", "REPEATPMT", "HOLD", "CHECK"].includes(trnType);
    const isCreditType = ["CREDIT", "DEP", "INTEREST", "DIV"].includes(trnType);

    // Em extratos de cartão de crédito no padrão OFX:
    // Valores negativos (< 0) costumam representar compras/débitos.
    // Valores positivos (> 0) costumam representar pagamentos ou estornos.
    let isRefund = false;
    let isPayment = false;

    if (isPaymentOrSettlement(combinedDesc)) {
      isPayment = true;
    } else if (isCreditType) {
      isRefund = true;
    } else if (isDebitType) {
      isRefund = false;
    } else {
      isRefund = numAmt > 0 && !isPaymentOrSettlement(combinedDesc);
      isPayment = isPaymentOrSettlement(combinedDesc);
    }

    const amountCents = Math.round(Math.abs(numAmt) * 100);

    const cleanDesc = cleanDescription(combinedDesc);
    const installment = extractInstallmentInfo(combinedDesc);

    // Chave para contagem de repetições no mesmo dia
    const occKey = `${date}|${amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      date,
      amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      occurrenceIndex: occIndex,
      date,
      rawDescription: combinedDesc,
      cleanDescription: cleanDesc,
      amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
      fitid,
    });
  }

  return transactions;
}
