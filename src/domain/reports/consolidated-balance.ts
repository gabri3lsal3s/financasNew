/**
 * Motor de Balanço Patrimonial Pessoal e DRE Consolidada (§F42).
 *
 * Função pura que consolida:
 * - Ativos Totais (Investimentos + Caixa + Contas a Receber);
 * - Passivos Totais (Dívidas e Empréstimos a Pagar);
 * - Patrimônio Líquido Real;
 * - Índice de Endividamento / Alavancagem Pessoal;
 * - Demonstração do Resultado Pessoal (DRE) com Taxa Real de Poupança e Fluxo Líquido.
 */

export interface DebtBalanceItem {
  id: string;
  type: "payable" | "receivable";
  remainingAmountBRL: number;
  description: string;
}

export interface ConsolidatedBalanceInput {
  investmentsMarketValueBRL: number;
  investmentsTotalCostBRL: number;
  cashBalanceBRL: number;
  debts: readonly DebtBalanceItem[];
  monthlyIncomesBRL: number;
  monthlyExpensesBRL: number;
  monthlyContributionsBRL: number;
}

export interface PersonalDRE {
  grossIncomeBRL: number;
  totalExpensesBRL: number;
  operationalSavingsBRL: number;
  savingsRatePct: number;
  investedAporteBRL: number;
  netCashFlowBRL: number;
}

export interface ConsolidatedBalanceSheetResult {
  totalInvestmentsBRL: number;
  totalCostBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct: number;
  cashBalanceBRL: number;
  receivablesBRL: number;
  totalAssetsBRL: number;
  totalLiabilitiesBRL: number; // Pagáveis
  netWorthBRL: number; // Patrimônio Líquido
  debtToAssetRatioPct: number;
  dre: PersonalDRE;
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function divideSafe(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || isNaN(denominator) || !isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  const result = numerator / denominator;
  return isNaN(result) || !isFinite(result) ? fallback : result;
}

export function computeConsolidatedBalanceSheet(input: ConsolidatedBalanceInput): ConsolidatedBalanceSheetResult {
  const totalInvestmentsBRL = Math.max(0, input.investmentsMarketValueBRL);
  const totalCostBRL = Math.max(0, input.investmentsTotalCostBRL);
  const cashBalanceBRL = Math.max(0, input.cashBalanceBRL);

  const unrealizedPnlBRL = round2(totalInvestmentsBRL - totalCostBRL);
  const unrealizedPnlPct = totalCostBRL > 0 ? round2((unrealizedPnlBRL / totalCostBRL) * 100) : 0;

  let receivablesBRL = 0;
  let totalLiabilitiesBRL = 0;

  for (const debt of input.debts) {
    const val = Math.max(0, debt.remainingAmountBRL);
    if (debt.type === "receivable") {
      receivablesBRL = round2(receivablesBRL + val);
    } else {
      totalLiabilitiesBRL = round2(totalLiabilitiesBRL + val);
    }
  }

  const totalAssetsBRL = round2(totalInvestmentsBRL + cashBalanceBRL + receivablesBRL);
  const netWorthBRL = round2(totalAssetsBRL - totalLiabilitiesBRL);

  const debtToAssetRatioPct = round2(divideSafe(totalLiabilitiesBRL, totalAssetsBRL) * 100);

  // DRE Pessoal
  const grossIncomeBRL = Math.max(0, input.monthlyIncomesBRL);
  const totalExpensesBRL = Math.max(0, input.monthlyExpensesBRL);
  const operationalSavingsBRL = round2(grossIncomeBRL - totalExpensesBRL);
  const savingsRatePct = grossIncomeBRL > 0 ? round2(divideSafe(operationalSavingsBRL, grossIncomeBRL) * 100) : 0;
  const investedAporteBRL = Math.max(0, input.monthlyContributionsBRL);
  const netCashFlowBRL = round2(operationalSavingsBRL - investedAporteBRL);

  return {
    totalInvestmentsBRL,
    totalCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    cashBalanceBRL,
    receivablesBRL,
    totalAssetsBRL,
    totalLiabilitiesBRL,
    netWorthBRL,
    debtToAssetRatioPct,
    dre: {
      grossIncomeBRL,
      totalExpensesBRL,
      operationalSavingsBRL,
      savingsRatePct,
      investedAporteBRL,
      netCashFlowBRL,
    },
  };
}
