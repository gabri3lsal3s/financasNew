/**
 * Motor puro de simulação comparativa de quitação de dívidas:
 * Método Avalanche (maior taxa de juros primeiro) vs Bola de Neve (menor saldo primeiro).
 *
 * Cálculos 100% em centavos inteiros e funções puras (AGENTS.md §3).
 */

export type DebtPayoffStrategy = "avalanche" | "snowball";

export interface SimulatorDebtInput {
  id: string;
  name: string;
  balanceCents: number;
  monthlyRatePercent: number; // ex: 2.5 para 2,5% ao mês
  minPaymentCents: number;
}

export interface DebtPayoffMilestone {
  debtId: string;
  debtName: string;
  paidOffMonth: number;
  totalInterestPaidCents: number;
  totalPaidCents: number;
}

export interface MonthlyPayoffSnapshot {
  month: number;
  totalRemainingBalanceCents: number;
  totalPaidThisMonthCents: number;
  totalInterestThisMonthCents: number;
  debtsRemainingCount: number;
}

export interface StrategySimulationResult {
  strategy: DebtPayoffStrategy;
  totalMonths: number;
  totalInterestCents: number;
  totalPaidCents: number;
  milestones: DebtPayoffMilestone[];
  monthlySnapshots: MonthlyPayoffSnapshot[];
  isFullyPaid: boolean;
}

export interface DebtComparisonResult {
  avalanche: StrategySimulationResult;
  snowball: StrategySimulationResult;
  interestSavedWithAvalancheCents: number;
  monthsDifference: number; // positivo se avalanche terminar antes
  recommendedStrategy: DebtPayoffStrategy;
}

interface WorkingDebt {
  id: string;
  name: string;
  balanceCents: number;
  monthlyRatePercent: number;
  minPaymentCents: number;
  accumulatedInterestCents: number;
  accumulatedPaidCents: number;
  isPaid: boolean;
  paidOffMonth: number | null;
}

const MAX_SIMULATION_MONTHS = 360; // 30 anos de trava de segurança

/**
 * Executa a simulação de quitação de dívidas para uma estratégia específica.
 */
export function simulateDebtPayoff(
  debts: readonly SimulatorDebtInput[],
  extraMonthlyBudgetCents: number,
  strategy: DebtPayoffStrategy,
): StrategySimulationResult {
  const validDebts = debts.filter((d) => d.balanceCents > 0);
  if (validDebts.length === 0) {
    return {
      strategy,
      totalMonths: 0,
      totalInterestCents: 0,
      totalPaidCents: 0,
      milestones: [],
      monthlySnapshots: [],
      isFullyPaid: true,
    };
  }

  const workingDebts: WorkingDebt[] = validDebts.map((d) => ({
    id: d.id,
    name: d.name,
    balanceCents: Math.round(d.balanceCents),
    monthlyRatePercent: Math.max(0, d.monthlyRatePercent),
    minPaymentCents: Math.max(0, Math.round(d.minPaymentCents)),
    accumulatedInterestCents: 0,
    accumulatedPaidCents: 0,
    isPaid: false,
    paidOffMonth: null,
  }));

  const initialTotalMinPayment = workingDebts.reduce((sum, d) => sum + d.minPaymentCents, 0);
  const totalMonthlyBudget = initialTotalMinPayment + Math.max(0, Math.round(extraMonthlyBudgetCents));

  const milestones: DebtPayoffMilestone[] = [];
  const monthlySnapshots: MonthlyPayoffSnapshot[] = [];

  let month = 0;
  let allPaid = false;

  while (month < MAX_SIMULATION_MONTHS && !allPaid) {
    month++;
    let monthInterest = 0;
    let monthPaid = 0;

    // 1. Aplicação de juros do mês sobre o saldo devedor de cada dívida ativa
    for (const debt of workingDebts) {
      if (!debt.isPaid && debt.balanceCents > 0) {
        const rate = debt.monthlyRatePercent / 100;
        const interest = Math.round(debt.balanceCents * rate);
        debt.balanceCents += interest;
        debt.accumulatedInterestCents += interest;
        monthInterest += interest;
      }
    }

    // 2. Pagamento das parcelas mínimas de cada dívida ativa
    let budgetRemaining = totalMonthlyBudget;

    for (const debt of workingDebts) {
      if (!debt.isPaid && debt.balanceCents > 0) {
        const payment = Math.min(debt.balanceCents, debt.minPaymentCents, budgetRemaining);
        debt.balanceCents -= payment;
        debt.accumulatedPaidCents += payment;
        monthPaid += payment;
        budgetRemaining -= payment;

        if (debt.balanceCents === 0) {
          debt.isPaid = true;
          debt.paidOffMonth = month;
          milestones.push({
            debtId: debt.id,
            debtName: debt.name,
            paidOffMonth: month,
            totalInterestPaidCents: debt.accumulatedInterestCents,
            totalPaidCents: debt.accumulatedPaidCents,
          });
        }
      }
    }

    // 3. Destinação do orçamento restante (extra + parcelas mínimas de dívidas já quitadas)
    // Ordena as dívidas ainda pendentes conforme a estratégia escolhida
    while (budgetRemaining > 0) {
      const activeDebts = workingDebts.filter((d) => !d.isPaid && d.balanceCents > 0);
      if (activeDebts.length === 0) break;

      activeDebts.sort((a, b) => {
        if (strategy === "avalanche") {
          // Maior taxa de juros primeiro; desempate por menor saldo
          if (b.monthlyRatePercent !== a.monthlyRatePercent) {
            return b.monthlyRatePercent - a.monthlyRatePercent;
          }
          return a.balanceCents - b.balanceCents;
        } else {
          // Menor saldo primeiro; desempate por maior taxa de juros
          if (a.balanceCents !== b.balanceCents) {
            return a.balanceCents - b.balanceCents;
          }
          return b.monthlyRatePercent - a.monthlyRatePercent;
        }
      });

      const targetDebt = activeDebts[0];
      if (!targetDebt) break;

      const extraPayment = Math.min(targetDebt.balanceCents, budgetRemaining);
      targetDebt.balanceCents -= extraPayment;
      targetDebt.accumulatedPaidCents += extraPayment;
      monthPaid += extraPayment;
      budgetRemaining -= extraPayment;

      if (targetDebt.balanceCents === 0) {
        targetDebt.isPaid = true;
        targetDebt.paidOffMonth = month;
        milestones.push({
          debtId: targetDebt.id,
          debtName: targetDebt.name,
          paidOffMonth: month,
          totalInterestPaidCents: targetDebt.accumulatedInterestCents,
          totalPaidCents: targetDebt.accumulatedPaidCents,
        });
      }
    }

    const totalRemaining = workingDebts.reduce((sum, d) => sum + (d.isPaid ? 0 : d.balanceCents), 0);
    const activeCount = workingDebts.filter((d) => !d.isPaid).length;

    monthlySnapshots.push({
      month,
      totalRemainingBalanceCents: totalRemaining,
      totalPaidThisMonthCents: monthPaid,
      totalInterestThisMonthCents: monthInterest,
      debtsRemainingCount: activeCount,
    });

    if (activeCount === 0) {
      allPaid = true;
    }
  }

  const totalInterestCents = workingDebts.reduce((sum, d) => sum + d.accumulatedInterestCents, 0);
  const totalPaidCents = workingDebts.reduce((sum, d) => sum + d.accumulatedPaidCents, 0);

  return {
    strategy,
    totalMonths: allPaid ? month : MAX_SIMULATION_MONTHS,
    totalInterestCents,
    totalPaidCents,
    milestones,
    monthlySnapshots,
    isFullyPaid: allPaid,
  };
}

/**
 * Compara simultaneamente as estratégias Avalanche e Bola de Neve para o mesmo conjunto de dívidas.
 */
export function compareDebtStrategies(
  debts: readonly SimulatorDebtInput[],
  extraMonthlyBudgetCents: number,
): DebtComparisonResult {
  const avalanche = simulateDebtPayoff(debts, extraMonthlyBudgetCents, "avalanche");
  const snowball = simulateDebtPayoff(debts, extraMonthlyBudgetCents, "snowball");

  const interestSavedWithAvalancheCents = Math.max(0, snowball.totalInterestCents - avalanche.totalInterestCents);
  const monthsDifference = snowball.totalMonths - avalanche.totalMonths;

  // Se economiza juros de forma relevante (> R$ 100,00 ou > 5%), a recomendação matemática é avalanche.
  // Caso contrário, bola de neve pode ser recomendada pelo ganho comportamental imediato.
  const recommendedStrategy: DebtPayoffStrategy =
    interestSavedWithAvalancheCents >= 10000 || monthsDifference > 0 ? "avalanche" : "snowball";

  return {
    avalanche,
    snowball,
    interestSavedWithAvalancheCents,
    monthsDifference,
    recommendedStrategy,
  };
}
