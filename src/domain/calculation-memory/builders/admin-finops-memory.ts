import {
  calculateAccountVariableCostCents,
  type ConfirmedPaymentInput,
  type FinOpsSummaryResult,
  type calculateFinOpsOverview,
} from "@/domain/admin";

interface FinOpsAggregates {
  params: {
    period_month: string;
    configured: boolean;
    asaas_pix_fee_cents: number;
    asaas_card_percent_bps: number;
    ai_receipt_unit_cost_cents: number;
    ai_batch_unit_cost_cents: number;
    fixed_infra_cents: number;
  };
  payments: {
    payments_count: number;
    gross_revenue_cents: number;
    pix_count: number;
    pix_revenue_cents: number;
    card_count: number;
    card_revenue_cents: number;
    other_count: number;
  };
  ai_quotas: {
    total_receipt_calls: number;
    total_batch_calls: number;
  };
}

type OverviewInput = Parameters<typeof calculateFinOpsOverview>[0];

export function buildAdminFinOpsInput(snapshot: FinOpsAggregates): OverviewInput {
  const { params, payments, ai_quotas: quotas } = snapshot;
  const receiptCallsMonth = quotas.total_receipt_calls;
  const batchCallsMonth = quotas.total_batch_calls;
  const hasAiUsage = receiptCallsMonth > 0 || batchCallsMonth > 0;
  const hasPayments = payments.payments_count > 0;
  const hasEstimatedFees = payments.pix_count > 0 || payments.card_count > 0;

  let confidence: OverviewInput["params"]["confidence"] = "measured";
  if (!params.configured && !hasPayments && !hasAiUsage) {
    confidence = "no_data";
  } else if (!params.configured || payments.other_count > 0) {
    confidence = "partial";
  } else if (hasEstimatedFees || hasAiUsage) {
    confidence = "estimated";
  }

  // A RPC só fornece totais por meio de pagamento. O Pix tem taxa por
  // cobrança e o percentual do cartão é arredondado uma vez sobre o total.
  const paymentGroups: ConfirmedPaymentInput[] = [];
  if (payments.pix_count > 0) {
    paymentGroups.push({
      paymentMethod: "pix",
      amountCents: payments.pix_revenue_cents,
      explicitFeeCents: params.asaas_pix_fee_cents * payments.pix_count,
    });
  }
  if (payments.card_count > 0) {
    paymentGroups.push({ paymentMethod: "card", amountCents: payments.card_revenue_cents });
  }
  if (payments.other_count > 0) {
    paymentGroups.push({
      paymentMethod: "unknown",
      amountCents: payments.gross_revenue_cents - payments.pix_revenue_cents - payments.card_revenue_cents,
    });
  }

  return {
    params: {
      periodMonth: params.period_month,
      asaasPixFeeCents: params.configured ? params.asaas_pix_fee_cents : null,
      asaasCardPercentBps: params.configured ? params.asaas_card_percent_bps : null,
      aiReceiptUnitCostCents: params.configured ? params.ai_receipt_unit_cost_cents : null,
      aiBatchUnitCostCents: params.configured ? params.ai_batch_unit_cost_cents : null,
      fixedInfraCents: params.configured ? params.fixed_infra_cents : null,
      confidence,
    },
    // O agregado serve ao total mensal. A RPC não fornece MRR nem rateio por usuário.
    subscriptions: [],
    payments: paymentGroups,
    accounts: hasAiUsage ? [{ userId: "agregado-mensal", receiptCallsMonth, batchCallsMonth }] : [],
  };
}

interface AdminFinOpsEquation {
  title: string;
  formula: string;
  description: string;
  items: { label: string; cents: number; sign: "+" | "-"; hint?: string }[];
  totalLabel: string;
  totalCents: number;
}

export function buildAdminFinOpsMemory(
  input: OverviewInput,
  result: FinOpsSummaryResult,
): Record<"gateway" | "netRevenue" | "ai" | "operatingResult", AdminFinOpsEquation> {
  const revenue = { label: "Receita bruta", cents: result.grossRevenueCents, sign: "+" } as const;
  const fees = { label: "Taxas do gateway", cents: result.gatewayFeesCents, sign: "-" } as const;
  const ai = { label: "Custo variável de IA", cents: result.aiVariableCostCents, sign: "-" } as const;
  const fixed = { label: "Custo fixo", cents: result.fixedInfraCents, sign: "-" } as const;
  const pixFees = input.payments.find((payment) => payment.paymentMethod === "pix")?.explicitFeeCents ?? 0;
  const { receiptCallsMonth = 0, batchCallsMonth = 0 } = input.accounts[0] ?? {};
  const receiptCost = calculateAccountVariableCostCents(
    { receiptCallsMonth, batchCallsMonth: 0 },
    input.params,
  );

  return {
    gateway: {
      title: "Taxas do gateway",
      formula: "Taxa Pix × cobranças Pix + percentual do cartão × receita de cartão",
      description: "Aplica os parâmetros do mês. Taxas de outros meios de pagamento ficam de fora.",
      items: [
        { label: "Taxas Pix", cents: pixFees, sign: "+" },
        { label: "Taxas de cartão", cents: result.gatewayFeesCents - pixFees, sign: "+" },
      ],
      totalLabel: "Taxas do gateway",
      totalCents: result.gatewayFeesCents,
    },
    netRevenue: {
      title: "Receita líquida",
      formula: "Receita bruta - taxas do gateway",
      description: "Usa os pagamentos processados no mês e as taxas calculadas para Pix e cartão.",
      items: [revenue, fees],
      totalLabel: "Receita líquida",
      totalCents: result.netRevenueCents,
    },
    ai: {
      title: "Custo variável de IA",
      formula: "Chamadas de comprovantes × custo unitário + chamadas em lote × custo unitário",
      description: "Usa os contadores de cotas do mês. Redefinições reduzem os contadores usados na estimativa.",
      items: [
        { label: "Comprovantes", cents: receiptCost, sign: "+", hint: `${receiptCallsMonth} chamadas` },
        { label: "Processamento em lote", cents: result.aiVariableCostCents - receiptCost, sign: "+", hint: `${batchCallsMonth} chamadas` },
      ],
      totalLabel: "Custo variável de IA",
      totalCents: result.aiVariableCostCents,
    },
    operatingResult: {
      title: "Resultado operacional estimado",
      formula: "Receita bruta - taxas do gateway - custo variável de IA - custo fixo",
      description: "Deduz os custos informados ou calculados para o mês. Custos sem parâmetro ficam de fora.",
      items: [revenue, fees, ai, fixed],
      totalLabel: "Resultado operacional",
      totalCents: result.estimatedNetProfitCents,
    },
  };
}
