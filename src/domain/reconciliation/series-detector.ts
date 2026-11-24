import { addMonthsClamped, toISODate } from "@/domain/money/parcelar";
import { shiftMonth } from "@/domain/cards";
import { jaccardTokens, tokenize } from "@/domain/predictions";
import type {
  ExistingExpenseForReconciliation,
  StatementTransaction,
} from "./types";

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
  scope?: "personal" | "business";
  isTaxDeductible?: boolean;
}

function areDescriptionsSimilar(descA: string, descB: string): boolean {
  if (!descA || !descB) return false;
  const tokensA = tokenize(descA);
  const tokensB = tokenize(descB);
  return jaccardTokens(tokensA, tokensB) >= 0.3;
}

/**
 * Classificador puro dos 4 Estados de Séries de Parcelamento.
 *
 * Avalia a transação da fatura contra o universo de despesas conhecidas do cartão,
 * classificando a necessidade e segurança de projeção para competências futuras.
 */
export function detectInstallmentSeriesState(params: {
  transaction: StatementTransaction;
  competenceMonth: string;
  existingExpenses: ExistingExpenseForReconciliation[];
  cardScope?: "personal" | "business";
}): InstallmentSeriesAnalysis | null {
  const { transaction, existingExpenses, cardScope } = params;
  const inst = transaction.installment;

  if (!inst || inst.total <= 1) {
    return null;
  }

  const K = inst.current;
  const N = inst.total;

  // Filtra despesas compatíveis com o escopo do cartão se fornecido
  const scopedExpenses = cardScope
    ? existingExpenses.filter((e) => !e.scope || e.scope === cardScope)
    : existingExpenses;

  // 1. Verifica se a parcela K já existe no banco
  let currentAlreadyExists = false;
  let existingCurrentExpenseId: string | undefined;

  for (const exp of scopedExpenses) {
    const isSameInstallment = exp.installmentNumber === K && exp.installmentsTotal === N;
    const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
    const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);

    if (isSameInstallment && isDiffCentsTolerable && isDescMatch) {
      currentAlreadyExists = true;
      existingCurrentExpenseId = exp.id;
      break;
    }
  }

  // 2. Verifica se a parcela anterior K-1 existe
  let previousExists = false;
  let previousExpenseId: string | undefined;

  if (K > 1) {
    for (const exp of scopedExpenses) {
      const isPrev = exp.installmentNumber === K - 1;
      const isTotalCompatible = exp.installmentsTotal === null || exp.installmentsTotal === N;
      const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
      const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);

      if (isPrev && isTotalCompatible && isDiffCentsTolerable && isDescMatch) {
        previousExists = true;
        previousExpenseId = exp.id;
        break;
      }
    }
  }

  // 3. Verifica quantas parcelas futuras (K+1 .. N) já estão cadastradas
  let futureProjectedCount = 0;
  const missingFutureInstallments: number[] = [];

  for (let m = K + 1; m <= N; m++) {
    const foundFuture = scopedExpenses.some((exp) => {
      const isFutureNumber = exp.installmentNumber === m && exp.installmentsTotal === N;
      const isDiffCentsTolerable = Math.abs(exp.valueCents - transaction.amountCents) <= 5;
      const isDescMatch = areDescriptionsSimilar(exp.description, transaction.cleanDescription);
      return isFutureNumber && isDiffCentsTolerable && isDescMatch;
    });

    if (foundFuture) {
      futureProjectedCount++;
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
    futureProjectedCount,
    missingFutureInstallments,
    badgeLabel,
    suggestedActionLabel,
  };
}

/**
 * Gera as parcelas futuras a partir de uma parcela do extrato.
 *
 * REGRA CANÔNICA DE ENGENHARIA FINANCEIRA:
 * Utiliza o valor exato da parcela lida no extrato (zero inflação ou distorção de centavos),
 * sem multiplicar e redividir para prevenir erros de arredondamento.
 */
export function projectFutureInstallments(params: {
  currentInstallment: number;
  totalInstallments: number;
  installmentValueCents: number;
  baseDate: string;
  baseCompetence: string;
  description: string;
  categoryId: string;
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
    scope,
    isTaxDeductible,
  } = params;

  if (K >= N) {
    return [];
  }

  const projected: ProjectedFutureInstallment[] = [];
  const baseDateObj = new Date(`${baseDate}T00:00:00`);

  for (let i = K + 1; i <= N; i++) {
    const deltaMonths = i - K;
    const futureDate = toISODate(addMonthsClamped(baseDateObj, deltaMonths));
    const futureCompetence = shiftMonth(baseCompetence, deltaMonths);

    projected.push({
      installmentNumber: i,
      installmentsTotal: N,
      date: futureDate,
      billCompetence: futureCompetence,
      valueCents: installmentValueCents, // Valor exato da parcela (zero distorção de centavos)
      description,
      categoryId,
      scope,
      isTaxDeductible,
    });
  }

  return projected;
}
