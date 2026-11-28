import type { SubscriptionTier } from "@/types/subscription";

export type FinOpsConfidence = "measured" | "estimated" | "partial" | "no_data";

export interface FinOpsMonthlyParams {
  periodMonth: string;
  asaasPixFeeCents: number | null;
  asaasCardPercentBps: number | null;
  aiReceiptUnitCostCents: number | null;
  aiBatchUnitCostCents: number | null;
  fixedInfraCents: number | null;
  confidence: FinOpsConfidence;
}

export interface SubscriptionRevenueInput {
  userId: string;
  tier: SubscriptionTier;
  status: string;
  monthlyPriceCents?: number | null;
  annualPriceCents?: number | null;
  amountCents?: number | null;
}

export interface ConfirmedPaymentInput {
  userId?: string;
  amountCents: number;
  paymentMethod?: "pix" | "card" | "boleto" | "unknown" | null;
  explicitFeeCents?: number | null;
}

export interface NetRevenueResult {
  grossRevenueCents: number;
  gatewayFeesCents: number;
  netRevenueCents: number;
  isEstimated: boolean;
}

export interface AccountCostInput {
  userId: string;
  receiptCallsMonth: number;
  batchCallsMonth: number;
  grossRevenueCents?: number;
  gatewayFeesCents?: number;
}

export interface AccountMarginResult {
  userId: string;
  grossRevenueCents: number;
  gatewayFeesCents: number;
  aiVariableCostCents: number;
  allocatedFixedCostCents: number;
  totalCostCents: number;
  netProfitCents: number;
  marginBps: number | null;
}

export interface FinOpsSummaryResult {
  periodMonth: string;
  confidence: FinOpsConfidence;
  isEstimated: boolean;
  activeAccountsCount: number;
  estimatedMrrCents: number;
  grossRevenueCents: number;
  gatewayFeesCents: number;
  netRevenueCents: number;
  aiVariableCostCents: number;
  fixedInfraCents: number;
  allocatedFixedInfraCents: number;
  totalCostCents: number;
  estimatedNetProfitCents: number;
  marginBps: number | null;
  accountMargins: AccountMarginResult[];
}

function toNonNegativeInt(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

/**
 * Calcula o MRR estimado normalizado em centavos a partir das assinaturas ativas.
 * Planos anuais são divididos por 12; `trial`, `lifetime` e `read_only` são excluídos.
 */
export function calculateEstimatedMrrCents(
  subscriptions: readonly SubscriptionRevenueInput[],
): number {
  let totalMrrCents = 0;

  for (const subscription of subscriptions) {
    if (subscription.status !== "active") {
      continue;
    }
    if (
      subscription.tier === "trial" ||
      subscription.tier === "lifetime" ||
      subscription.tier === "read_only"
    ) {
      continue;
    }

    if (subscription.tier === "pro_annual") {
      const annualCents = toNonNegativeInt(
        subscription.annualPriceCents ?? subscription.amountCents,
      );
      if (annualCents > 0) {
        totalMrrCents += Math.round(annualCents / 12);
      } else {
        totalMrrCents += toNonNegativeInt(subscription.monthlyPriceCents);
      }
      continue;
    }

    if (subscription.tier === "pro_monthly") {
      totalMrrCents += toNonNegativeInt(
        subscription.monthlyPriceCents ?? subscription.amountCents,
      );
    }
  }

  return totalMrrCents;
}

/**
 * Calcula receita bruta, taxas de gateway e receita líquida em centavos
 * a partir de pagamentos confirmados.
 */
export function calculateNetRevenueCents(
  payments: readonly ConfirmedPaymentInput[],
  params: Pick<FinOpsMonthlyParams, "asaasPixFeeCents" | "asaasCardPercentBps">,
): NetRevenueResult {
  let grossRevenueCents = 0;
  let gatewayFeesCents = 0;
  let isEstimated = false;

  for (const payment of payments) {
    const amount = toNonNegativeInt(payment.amountCents);
    grossRevenueCents += amount;

    if (payment.explicitFeeCents != null && Number.isFinite(payment.explicitFeeCents)) {
      gatewayFeesCents += toNonNegativeInt(payment.explicitFeeCents);
      continue;
    }

    isEstimated = true;

    if (payment.paymentMethod === "pix") {
      gatewayFeesCents += toNonNegativeInt(params.asaasPixFeeCents);
    } else if (payment.paymentMethod === "card") {
      const bps = toNonNegativeInt(params.asaasCardPercentBps);
      gatewayFeesCents += Math.round((amount * bps) / 10_000);
    }
  }

  return {
    grossRevenueCents,
    gatewayFeesCents,
    netRevenueCents: grossRevenueCents - gatewayFeesCents,
    isEstimated,
  };
}

/**
 * Calcula o custo variável de IA em centavos para uma conta no mês.
 */
export function calculateAccountVariableCostCents(
  account: Pick<AccountCostInput, "receiptCallsMonth" | "batchCallsMonth">,
  params: Pick<FinOpsMonthlyParams, "aiReceiptUnitCostCents" | "aiBatchUnitCostCents">,
): number {
  const receiptCalls = toNonNegativeInt(account.receiptCallsMonth);
  const batchCalls = toNonNegativeInt(account.batchCallsMonth);
  const receiptUnitCost = toNonNegativeInt(params.aiReceiptUnitCostCents);
  const batchUnitCost = toNonNegativeInt(params.aiBatchUnitCostCents);

  return receiptCalls * receiptUnitCost + batchCalls * batchUnitCost;
}

/**
 * Consolida a visão FinOps mensal com rateio determinístico do custo fixo em centavos
 * e margem por conta.
 */
export function calculateFinOpsOverview(input: {
  params: FinOpsMonthlyParams;
  subscriptions: readonly SubscriptionRevenueInput[];
  payments: readonly ConfirmedPaymentInput[];
  accounts: readonly AccountCostInput[];
}): FinOpsSummaryResult {
  const { params, subscriptions, payments, accounts } = input;

  const estimatedMrrCents = calculateEstimatedMrrCents(subscriptions);
  const revenue = calculateNetRevenueCents(payments, {
    asaasPixFeeCents: params.asaasPixFeeCents,
    asaasCardPercentBps: params.asaasCardPercentBps,
  });

  const fixedInfraCents = toNonNegativeInt(params.fixedInfraCents);
  const accountCount = accounts.length;
  const sortedAccounts = [...accounts].sort((left, right) =>
    left.userId.localeCompare(right.userId),
  );

  const baseFixedShareCents = accountCount > 0 ? Math.trunc(fixedInfraCents / accountCount) : 0;
  const remainderFixedCents = accountCount > 0 ? fixedInfraCents % accountCount : 0;

  let aiVariableCostCents = 0;
  let allocatedFixedInfraCents = 0;

  const accountMargins: AccountMarginResult[] = sortedAccounts.map((account, index) => {
    const variableCost = calculateAccountVariableCostCents(account, params);
    const allocatedFixed =
      accountCount > 0 ? baseFixedShareCents + (index < remainderFixedCents ? 1 : 0) : 0;
    const gross = toNonNegativeInt(account.grossRevenueCents);
    const fees = toNonNegativeInt(account.gatewayFeesCents);
    const totalCost = fees + variableCost + allocatedFixed;
    const netProfit = gross - totalCost;
    const marginBps = gross > 0 ? Math.round((netProfit * 10_000) / gross) : null;

    aiVariableCostCents += variableCost;
    allocatedFixedInfraCents += allocatedFixed;

    return {
      userId: account.userId,
      grossRevenueCents: gross,
      gatewayFeesCents: fees,
      aiVariableCostCents: variableCost,
      allocatedFixedCostCents: allocatedFixed,
      totalCostCents: totalCost,
      netProfitCents: netProfit,
      marginBps,
    };
  });

  const totalCostCents = revenue.gatewayFeesCents + aiVariableCostCents + fixedInfraCents;
  const estimatedNetProfitCents = revenue.grossRevenueCents - totalCostCents;
  const marginBps =
    revenue.grossRevenueCents > 0
      ? Math.round((estimatedNetProfitCents * 10_000) / revenue.grossRevenueCents)
      : null;

  const hasAnyParamMissing =
    params.asaasPixFeeCents == null ||
    params.asaasCardPercentBps == null ||
    params.aiReceiptUnitCostCents == null ||
    params.aiBatchUnitCostCents == null ||
    params.fixedInfraCents == null;

  return {
    periodMonth: params.periodMonth,
    confidence: params.confidence,
    isEstimated: revenue.isEstimated || hasAnyParamMissing || params.confidence !== "measured",
    activeAccountsCount: accountCount,
    estimatedMrrCents,
    grossRevenueCents: revenue.grossRevenueCents,
    gatewayFeesCents: revenue.gatewayFeesCents,
    netRevenueCents: revenue.netRevenueCents,
    aiVariableCostCents,
    fixedInfraCents,
    allocatedFixedInfraCents,
    totalCostCents,
    estimatedNetProfitCents,
    marginBps,
    accountMargins,
  };
}
