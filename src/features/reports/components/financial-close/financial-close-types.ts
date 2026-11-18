export interface FinancialDREData {
  grossIncomeCents: number;
  totalExpensesCents: number;
  operationalSavingsCents: number;
  savingsRatePct: number;
  investedAporteCents: number;
  netCashFlowCents: number;
  /** Valor bruto (sem ponderação) de receitas — exibido quando pesos estão ativos. */
  grossIncomeBrutoCents?: number;
  /** Valor bruto (sem ponderação) de despesas — exibido quando pesos estão ativos. */
  totalExpensesBrutoCents?: number;
}

export interface FinancialReportCategoryItem {
  name: string;
  brutoCents?: number;
  ponderadoCents?: number;
  totalCents: number;
  pct: number;
  /** Limite orçado para o período (em centavos), quando configurado. */
  budgetLimitCents?: number | null;
  /** Desvio percentual (+15 para 15% acima, -10 para 10% abaixo). */
  variancePct?: number | null;
}

export interface FinancialReportPaymentMethodItem {
  method: string;
  label: string;
  brutoCents?: number;
  ponderadoCents?: number;
  totalCents: number;
  pct: number;
}

export interface FinancialReportPaidInvoiceItem {
  cardName: string;
  competenceMonth: string;
  amountCents: number;
  date: string;
}

export interface FinancialReportHouseholdSummary {
  familyTitle: string;
  monthlyCeilingCents: number;
  totalSpentCents: number;
  spentPercentage: number;
  userContributionCents: number;
  userPercentageOfTotal: number;
}
