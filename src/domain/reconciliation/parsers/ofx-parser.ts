import type { StatementTransaction } from "../types";
import { cleanDescription, isPaymentOrSettlement } from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";

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

    const rawDate = extractTag("DTPOSTED");
    const date = normalizeOfxDate(rawDate);
    const rawAmt = extractTag("TRNAMT");
    const memo = extractTag("MEMO") || extractTag("NAME") || extractTag("CHECKNUM") || "Despesa";

    if (!date || !rawAmt) continue;

    const numAmt = Number.parseFloat(rawAmt.replace(",", "."));
    if (Number.isNaN(numAmt) || numAmt === 0) continue;

    // Em extratos de cartão de crédito no padrão OFX:
    // Valores negativos (< 0) costumam representar compras/débitos.
    // Valores positivos (> 0) costumam representar pagamentos ou estornos.
    const isRefund = numAmt > 0 && !isPaymentOrSettlement(memo);
    const isPayment = isPaymentOrSettlement(memo);
    const amountCents = Math.round(Math.abs(numAmt) * 100);

    const cleanDesc = cleanDescription(memo);
    const installment = extractInstallmentInfo(memo);

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
      rawDescription: memo,
      cleanDescription: cleanDesc,
      amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
    });
  }

  return transactions;
}
