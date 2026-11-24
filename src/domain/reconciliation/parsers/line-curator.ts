import type { StatementTransaction } from "../types";
import { evaluateChecksumGate, type ChecksumGateResult } from "./spatial-pdf-parser";
import type { AiLineCuratorOutput } from "../../../../supabase/functions/_shared/ai-schemas";

export interface CandidateCuratorLine {
  id: number;
  text: string;
  transaction: StatementTransaction;
}

export interface CurateLinesWithClientValidationResult {
  keptTransactions: StatementTransaction[];
  ignoredTransactions: StatementTransaction[];
  checksumGate: ChecksumGateResult;
  wasCurated: boolean;
  divergenceResolved: boolean;
}

/**
 * Converte StatementTransaction[] em linhas candidatas para o line_curator:
 * Cria ID sequencial estável (0..N-1) e texto higienizado.
 */
export function buildCandidateCuratorLines(
  transactions: StatementTransaction[],
): CandidateCuratorLine[] {
  return transactions.map((tx, idx) => {
    const formattedAmount = (tx.amountCents / 100).toFixed(2).replace(".", ",");
    const sign = tx.isRefund ? "-" : "";
    const installmentText = tx.installment
      ? ` (${tx.installment.current}/${tx.installment.total})`
      : "";
    const text = `${tx.date} ${tx.cleanDescription}${installmentText} R$ ${sign}${formattedAmount}`;
    return {
      id: idx,
      text,
      transaction: tx,
    };
  });
}

/**
 * Aplica o resultado do line_curator com validação estrita no cliente:
 * - Valida se todos os IDs pertencem ao conjunto de candidatos (descarta IDs inexistentes);
 * - Deduplica IDs;
 * - Se algum ID do candidato não for classificado, preserva em keep (fail-safe defensivo);
 * - Recalcula o Checksum Gate sobre as linhas mantidas;
 * - Sinaliza se a divergência foi resolvida (checksumGate.passed === true).
 */
export function curateLinesWithClientValidation(params: {
  candidateLines: CandidateCuratorLine[];
  officialTotalCents: number | null;
  curatorOutput: AiLineCuratorOutput;
}): CurateLinesWithClientValidationResult {
  const { candidateLines, officialTotalCents, curatorOutput } = params;

  const validIdMap = new Map<number, StatementTransaction>();
  for (const item of candidateLines) {
    validIdMap.set(item.id, item.transaction);
  }

  // Descarta IDs que não existiam no conjunto original
  const keepIds = new Set(curatorOutput.keep.filter((id) => validIdMap.has(id)));
  const ignoreIds = new Set(curatorOutput.ignore.filter((id) => validIdMap.has(id)));

  // Fail-safe defensivo: qualquer ID original que não esteja nem no keep nem no ignore vai para keep
  for (const id of validIdMap.keys()) {
    if (!keepIds.has(id) && !ignoreIds.has(id)) {
      keepIds.add(id);
    }
  }

  const keptTransactions: StatementTransaction[] = [];
  const ignoredTransactions: StatementTransaction[] = [];

  for (const item of candidateLines) {
    if (keepIds.has(item.id) && !ignoreIds.has(item.id)) {
      keptTransactions.push(item.transaction);
    } else {
      ignoredTransactions.push({
        ...item.transaction,
        isPayment: item.transaction.isPayment || true, // Marcar como ignorada
      });
    }
  }

  const newChecksumGate = evaluateChecksumGate(keptTransactions, officialTotalCents);

  return {
    keptTransactions,
    ignoredTransactions,
    checksumGate: newChecksumGate,
    wasCurated: true,
    divergenceResolved: newChecksumGate.passed,
  };
}
