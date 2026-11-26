import { addMonthsClamped, toISODate } from "@/domain/money/parcelar";
import { shiftMonth } from "@/domain/cards/index";
import { jaccardTokens, tokenize } from "@/domain/predictions/index";
import { generateStatementHash } from "./hash";
import { alignInstallmentDateToCompetence } from "./extractors/type-sniffer";
import type {
  ExistingExpenseForReconciliation,
  StatementTransaction,
} from "./contracts";

export type InstallmentSeriesState =
  | "state_1_new_series" // 1/N inédita
  | "state_2_orphan_series" // K/N (K >= 2) sem série prévia
  | "state_3_continuation_without_projection" // K-1 existe sem K+1..N
  | "state_4_already_projected"; // K ou K+1..N já cadastradas

export interface InstallmentSeriesAnalysis {
  state: InstallmentSeriesState;
  installment: {
    current: number;
    total: number;
  };
  currentAlreadyExists: boolean;
  existingCurrentExpenseId?: string;
  previousExists: boolean;
  previousExpenseId?: string;
  /** Grupo de parcelamento existente encontrado na série para reutilização contínua (G9). */
  existingInstallmentGroupId?: string | null;
  futureProjectedCount: number;
  missingFutureInstallments: number[];
  badgeLabel: string;
  suggestedActionLabel: string;
}

export interface ProjectedFutureInstallment {
  installmentNumber: number;
  installmentsTotal: number;
  date: string;
  billCompetence: string;
  valueCents: number;
  description: string;
  categoryId: string;
  installmentGroupId?: string;
  statementHash?: string;
  scope?: "personal" | "business";
  isTaxDeductible?: boolean;
}

function areDescriptionsSimilar(descA: string, descB: string): boolean {
  if (!descA || !descB) return false;
  const tokensA = tokenize(descA);
  const tokensB = tokenize(descB);
  return jaccardTokens(tokensA, tokensB) >= 0.3;
}

function isCompatibleCompetence(
  expenseBillCompetence: string | undefined,
  expectedCompetence: string,
): boolean {
  if (!expenseBillCompetence) return true;
  return expenseBillCompetence === expectedCompetence;
}

/**
 * Classificador puro dos 4 Estados de Séries de Parcelamento.
 *
 * Opera sobre todo o histórico de despesas do cartão (todas as competências — D3 / G9),
 * classificando a necessidade de projeção exclusiva de parcelas futuras (K+1..N).
 */
export function detectInstallmentSeriesState(params: {
  transaction: StatementTransaction;
  competenceMonth: string;
  existingExpenses: ExistingExpenseForReconciliation[];
  cardScope?: "personal" | "business" | "mixed";
}): InstallmentSeriesAnalysis | null {
  const { transaction, competenceMonth, existingExpenses, cardScope } = params;
  const inst = transaction.installment;

  if (!inst || inst.total <= 1) {
    return null;
  }

  const K = inst.current;
  const N = inst.total;

  // Filtra despesas compatíveis com o escopo do cartão se fornecido (mixed aceita ambos)
  const scopedExpenses =
    cardScope && cardScope !== "mixed"
      ? existingExpenses.filter((e) => !e.scope || e.scope === cardScope)
      : existingExpenses;

  let existingInstallmentGroupId: string | null = null;

  // 1. Verifica se a parcela K já existe no banco na competência correspondente
  let currentAlreadyExists = false;
  let existingCurrentExpenseId: string | undefined;

  for (const exp of scopedExpenses) {
    const isSameInstallment = exp.installmentNumber === K && exp.installmentsTotal === N;
    const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
    const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);
    const isCompOk = isCompatibleCompetence(exp.billCompetence, competenceMonth);

    if (isSameInstallment && isDiffCentsTolerable && isDescMatch && isCompOk) {
      currentAlreadyExists = true;
      existingCurrentExpenseId = exp.id;
      if (exp.installmentGroupId) {
        existingInstallmentGroupId = exp.installmentGroupId;
      }
      break;
    }
  }

  // 2. Verifica se a parcela anterior K-1 existe (na competência anterior M-1 quando disponível)
  let previousExists = false;
  let previousExpenseId: string | undefined;

  if (K > 1) {
    const prevCompetence = shiftMonth(competenceMonth, -1);
    for (const exp of scopedExpenses) {
      const isPrev = exp.installmentNumber === K - 1;
      const isTotalCompatible = exp.installmentsTotal === null || exp.installmentsTotal === N;
      const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
      const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);
      const isCompOk = isCompatibleCompetence(exp.billCompetence, prevCompetence);

      if (isPrev && isTotalCompatible && isDiffCentsTolerable && isDescMatch && isCompOk) {
        previousExists = true;
        previousExpenseId = exp.id;
        if (!existingInstallmentGroupId && exp.installmentGroupId) {
          existingInstallmentGroupId = exp.installmentGroupId;
        }
        break;
      }
    }
  }

  // 3. Verifica exclusivamente quantas parcelas futuras (K+1 .. N) já estão cadastradas
  let futureProjectedCount = 0;
  const missingFutureInstallments: number[] = [];

  for (let m = K + 1; m <= N; m++) {
    const expectedFutureCompetence = shiftMonth(competenceMonth, m - K);
    const matchedFuture = scopedExpenses.find((exp) => {
      const isFutureNumber = exp.installmentNumber === m && exp.installmentsTotal === N;
      const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
      const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);
      const isGroupOrCompOk = existingInstallmentGroupId && exp.installmentGroupId
        ? exp.installmentGroupId === existingInstallmentGroupId
        : isCompatibleCompetence(exp.billCompetence, expectedFutureCompetence);
      return isFutureNumber && isDiffCentsTolerable && isDescMatch && isGroupOrCompOk;
    });

    if (matchedFuture) {
      futureProjectedCount++;
      if (!existingInstallmentGroupId && matchedFuture.installmentGroupId) {
        existingInstallmentGroupId = matchedFuture.installmentGroupId;
      }
    } else {
      missingFutureInstallments.push(m);
    }
  }

  // 4. Determinação do Estado da Série
  let state: InstallmentSeriesState;
  let badgeLabel: string;
  let suggestedActionLabel: string;

  if (currentAlreadyExists || futureProjectedCount > 0) {
    state = "state_4_already_projected";
    badgeLabel = currentAlreadyExists
      ? `Parcela ${K}/${N} já cadastrada`
      : `Série ${K}/${N} já projetada (${futureProjectedCount} futuras)`;
    suggestedActionLabel = "Conciliar e manter projeção existente";
  } else if (previousExists) {
    state = "state_3_continuation_without_projection";
    badgeLabel = `Continuação de série (${K - 1}/${N} encontrada)`;
    suggestedActionLabel = `Importar ${K}/${N} e projetar restantes (${K + 1}..${N})`;
  } else if (K === 1) {
    state = "state_1_new_series";
    badgeLabel = `Nova compra parcelada (1/${N})`;
    suggestedActionLabel = `Importar 1/${N} e projetar 2..${N} automaticamente`;
  } else {
    state = "state_2_orphan_series";
    badgeLabel = `Parcela avulsa (${K}/${N} sem histórico)`;
    suggestedActionLabel = `Importar ${K}/${N} e projetar restantes (${K + 1}..${N})`;
  }

  return {
    state,
    installment: { current: K, total: N },
    currentAlreadyExists,
    existingCurrentExpenseId,
    previousExists,
    previousExpenseId,
    existingInstallmentGroupId,
    futureProjectedCount,
    missingFutureInstallments,
    badgeLabel,
    suggestedActionLabel,
  };
}

/**
 * Gera exclusivamente as parcelas futuras (K+1..N) a partir de uma parcela do extrato (D3, D13, G9).
 *
 * REGRA CANÔNICA DE ENGENHARIA FINANCEIRA:
 * - Utiliza o valor exato da parcela lida no extrato (zero inflação/redivisão de centavos);
 * - Alinha `baseDate` para `baseCompetence` via regra D13 antes de avançar meses com `addMonthsClamped`;
 * - Propaga `installmentGroupId` e `statementHash` determinístico por parcela futura quando `cardId` informado.
 */
export function projectFutureInstallments(params: {
  currentInstallment: number;
  totalInstallments: number;
  installmentValueCents: number;
  baseDate: string;
  baseCompetence: string;
  description: string;
  categoryId: string;
  installmentGroupId?: string;
  cardId?: string;
  missingInstallments?: readonly number[];
  scope?: "personal" | "business";
  isTaxDeductible?: boolean;
}): ProjectedFutureInstallment[] {
  const {
    currentInstallment: K,
    totalInstallments: N,
    installmentValueCents,
    baseDate,
    baseCompetence,
    description,
    categoryId,
    installmentGroupId,
    cardId,
    missingInstallments,
    scope,
    isTaxDeductible,
  } = params;

  if (K >= N) {
    return [];
  }

  // Alinhamento D13: garante que parcelas K >= 2 com data original de mês anterior projetem
  // datas mensais coerentes a partir da competência da fatura atual (igual ao parcelar() manual).
  const { effectiveDate: alignedBaseDate } = alignInstallmentDateToCompetence(
    baseDate,
    baseCompetence,
    { current: K, total: N },
  );

  const targetNumbers =
    missingInstallments && missingInstallments.length > 0
      ? missingInstallments.filter((m) => m > K && m <= N)
      : Array.from({ length: N - K }, (_, idx) => K + 1 + idx);

  const projected: ProjectedFutureInstallment[] = [];
  const baseDateObj = new Date(`${alignedBaseDate}T00:00:00`);

  for (const i of targetNumbers) {
    const deltaMonths = i - K;
    const futureDate = toISODate(addMonthsClamped(baseDateObj, deltaMonths));
    const futureCompetence = shiftMonth(baseCompetence, deltaMonths);
    const statementHash = cardId
      ? generateStatementHash({
          cardId,
          competenceMonth: futureCompetence,
          date: futureDate,
          amountCents: installmentValueCents,
          cleanDescription: `${description} [${i}/${N}]`,
          occurrenceIndex: 0,
        })
      : undefined;

    projected.push({
      installmentNumber: i,
      installmentsTotal: N,
      date: futureDate,
      billCompetence: futureCompetence,
      valueCents: installmentValueCents,
      description,
      categoryId,
      installmentGroupId,
      statementHash,
      scope,
      isTaxDeductible,
    });
  }

  return projected;
}
