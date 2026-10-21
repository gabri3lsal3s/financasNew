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
  category?: "debt" | "loan" | "financing" | "invoice" | "other" | string;
}

export interface ConsolidatedBalanceInput {
  investmentsMarketValueBRL: number;
  investmentsTotalCostBRL: number;
  cashBalanceBRL: number;
  debts: readonly DebtBalanceItem[];
  /** Total de faturas de cartão de crédito em aberto (passivo circulante). */
  creditCardInvoicesBRL?: number;
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
  /** Dívidas, financiamentos e empréstimos a pagar. */
  debtsPayableBRL: number;
  /** Faturas de cartão de crédito em aberto. */
  creditCardInvoicesBRL: number;
  /** Passivo Total: Dívidas + Faturas de Cartão. */
  totalLiabilitiesBRL: number;
  /** Patrimônio Líquido Real: Ativos Totais (-) Passivos Totais. */
  netWorthBRL: number;
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
  const totalInvestmentsBRL = Math.max(0, Number.isFinite(input.investmentsMarketValueBRL) ? input.investmentsMarketValueBRL : 0);
  const totalCostBRL = Math.max(0, Number.isFinite(input.investmentsTotalCostBRL) ? input.investmentsTotalCostBRL : 0);
  const cashBalanceBRL = Math.max(0, Number.isFinite(input.cashBalanceBRL) ? input.cashBalanceBRL : 0);

  const unrealizedPnlBRL = round2(totalInvestmentsBRL - totalCostBRL);
  const unrealizedPnlPct = totalCostBRL > 0 ? round2((unrealizedPnlBRL / totalCostBRL) * 100) : 0;

  let receivablesBRL = 0;
  let debtsPayableBRL = 0;
  let invoicesFromDebtsBRL = 0;

  for (const debt of input.debts) {
    const val = Math.max(0, Number.isFinite(debt.remainingAmountBRL) ? debt.remainingAmountBRL : 0);
    if (debt.type === "receivable") {
      receivablesBRL = round2(receivablesBRL + val);
    } else if (debt.category === "invoice") {
      invoicesFromDebtsBRL = round2(invoicesFromDebtsBRL + val);
    } else {
      debtsPayableBRL = round2(debtsPayableBRL + val);
    }
  }

  const directInvoicesBRL = Math.max(0, Number.isFinite(input.creditCardInvoicesBRL ?? 0) ? (input.creditCardInvoicesBRL ?? 0) : 0);
  const creditCardInvoicesBRL = round2(directInvoicesBRL + invoicesFromDebtsBRL);
  const totalLiabilitiesBRL = round2(debtsPayableBRL + creditCardInvoicesBRL);

  const totalAssetsBRL = round2(totalInvestmentsBRL + cashBalanceBRL + receivablesBRL);
  const netWorthBRL = round2(totalAssetsBRL - totalLiabilitiesBRL);

  const debtToAssetRatioPct = round2(divideSafe(totalLiabilitiesBRL, totalAssetsBRL) * 100);

  // DRE Pessoal
  const grossIncomeBRL = Math.max(0, Number.isFinite(input.monthlyIncomesBRL) ? input.monthlyIncomesBRL : 0);
  const totalExpensesBRL = Math.max(0, Number.isFinite(input.monthlyExpensesBRL) ? input.monthlyExpensesBRL : 0);
  const operationalSavingsBRL = round2(grossIncomeBRL - totalExpensesBRL);
  const savingsRatePct = grossIncomeBRL > 0 ? round2(divideSafe(operationalSavingsBRL, grossIncomeBRL) * 100) : 0;
  const investedAporteBRL = Math.max(0, Number.isFinite(input.monthlyContributionsBRL) ? input.monthlyContributionsBRL : 0);
  const netCashFlowBRL = round2(operationalSavingsBRL - investedAporteBRL);

  return {
    totalInvestmentsBRL,
    totalCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    cashBalanceBRL,
    receivablesBRL,
    totalAssetsBRL,
    debtsPayableBRL,
    creditCardInvoicesBRL,
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
