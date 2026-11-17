import { currentMonth, shiftMonth } from "@/lib/date";
import type {
  GroupTarget,
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioSnapshot,
  PortfolioTransaction,
} from "@/types";
import { DEMO_USER_ID, formatIsoDate } from "./mock-finances";
import type { InvestmentsDataset } from "./types";

/**
 * Gera um dataset puro e em memória para a simulação de investimentos e rebalanceamento,
 * estruturando ativos com metas por classe, setores opcionais escopados, notas de convicção (0–10)
 * e status operacionais de governança.
 */
export function generateMockInvestments(referenceMonth: string = currentMonth()): InvestmentsDataset {
  const monthMinus2 = shiftMonth(referenceMonth, -2);
  const monthMinus1 = shiftMonth(referenceMonth, -1);
  const nowIso = new Date().toISOString();

  // 1. Ativos de carteira diversificados com governança por Nota (0–10) e Status
  const assets: PortfolioAsset[] = [
    {
      id: "asset-demo-tesouro",
      user_id: DEMO_USER_ID,
      ticker: "Tesouro Selic 2029",
      asset_class: "Renda Fixa",
      sector: "Títulos Públicos",
      currency: "BRL",
      quantity: 14,
      average_price: 1510.5,
      score: 9,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 12,
      thesis_summary: "Reserva soberana pós-fixada com liquidez D+0 e menor risco de crédito.",
      fixed_income_metadata: {
        rate_type: "selic",
        rate_value: 100,
        base_date: formatIsoDate(shiftMonth(referenceMonth, -6), 1),
        is_tax_exempt: false,
      },
      notes: "Reserva de emergência e oportunidade",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-cdb",
      user_id: DEMO_USER_ID,
      ticker: "CDB 110% CDI Inter",
      asset_class: "Renda Fixa",
      sector: "Bancário Privado",
      currency: "BRL",
      quantity: 9500,
      average_price: 1.0,
      score: 7,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 6,
      thesis_summary: "Liquidez diária com prêmio de 10% acima do CDI e cobertura FGC.",
      fixed_income_metadata: {
        rate_type: "cdi",
        rate_value: 110,
        base_date: formatIsoDate(shiftMonth(referenceMonth, -3), 1),
        is_tax_exempt: false,
      },
      notes: "Liquidez diária para projetos de médio prazo",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-itub4",
      user_id: DEMO_USER_ID,
      ticker: "ITUB4",
      asset_class: "Ações Brasil",
      sector: "Financeiro",
      currency: "BRL",
      quantity: 380,
      average_price: 31.8,
      accumulated_dividends: 420.5,
      estimated_monthly_dividend_per_share: 0.28,
      score: 9,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 6,
      thesis_summary: "ROE líder entre grandes bancos, eficiência operacional e dividendos recorrentes.",
      notes: "Banco consolidado de dividendos perenes",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-vale3",
      user_id: DEMO_USER_ID,
      ticker: "VALE3",
      asset_class: "Ações Brasil",
      sector: "Materiais Básicos",
      currency: "BRL",
      quantity: 110,
      average_price: 64.2,
      accumulated_dividends: 310.2,
      estimated_monthly_dividend_per_share: 0.65,
      score: 4,
      allocation_status: "quarantine",
      last_reviewed_at: nowIso,
      review_frequency_months: 3,
      thesis_summary: "Em revisão devido à desaceleração do ciclo siderúrgico chinês; aportes congelados.",
      notes: "Exportadora com forte geração de caixa",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-hglg11",
      user_id: DEMO_USER_ID,
      ticker: "HGLG11",
      asset_class: "FIIs",
      sector: "Logística",
      currency: "BRL",
      quantity: 90,
      average_price: 162.0,
      accumulated_dividends: 890.0,
      estimated_monthly_dividend_per_share: 1.1,
      score: 8,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 6,
      thesis_summary: "Ativos logísticos triple-A em raios estratégicos e vacância controlada.",
      notes: "Galpões logísticos de alto padrão",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-kncr11",
      user_id: DEMO_USER_ID,
      ticker: "KNCR11",
      asset_class: "FIIs",
      sector: "Papel e Crédito",
      currency: "BRL",
      quantity: 140,
      average_price: 102.5,
      accumulated_dividends: 1150.0,
      estimated_monthly_dividend_per_share: 1.05,
      score: 7,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 6,
      thesis_summary: "CRIs high grade pós-fixados protegidos contra alta de juros.",
      notes: "Crédito imobiliário atrelado ao CDI",
      updated_at: nowIso,
    },
    {
      id: "asset-demo-btc",
      user_id: DEMO_USER_ID,
      ticker: "BTC",
      asset_class: "Cripto",
      sector: "Ativos Digitais",
      currency: "BRL",
      quantity: 0.045,
      average_price: 335000.0,
      score: 8,
      allocation_status: "active",
      last_reviewed_at: nowIso,
      review_frequency_months: 6,
      thesis_summary: "Escassez programada e reserva descentralizada de longo prazo.",
      notes: "Reserva de valor descentralizada",
      updated_at: nowIso,
    },
  ];

  // 2. Metas percentuais por classe (soma = 100%) e setores opcionais escopados em FIIs
  const groupTargets: GroupTarget[] = [
    {
      id: "grp-demo-renda-fixa",
      user_id: DEMO_USER_ID,
      group_type: "class",
      name: "Renda Fixa",
      target_percentage: 40,
    },
    {
      id: "grp-demo-acoes-br",
      user_id: DEMO_USER_ID,
      group_type: "class",
      name: "Ações Brasil",
      target_percentage: 25,
    },
    {
      id: "grp-demo-fiis",
      user_id: DEMO_USER_ID,
      group_type: "class",
      name: "FIIs",
      target_percentage: 25,
    },
    {
      id: "grp-demo-cripto",
      user_id: DEMO_USER_ID,
      group_type: "class",
      name: "Cripto",
      target_percentage: 10,
    },
    {
      id: "grp-demo-fii-logistica",
      user_id: DEMO_USER_ID,
      group_type: "sector",
      class_name: "FIIs",
      name: "Logística",
      target_percentage: 60,
    },
    {
      id: "grp-demo-fii-papel",
      user_id: DEMO_USER_ID,
      group_type: "sector",
      class_name: "FIIs",
      name: "Papel e Crédito",
      target_percentage: 40,
    },
  ];

  // 3. Snapshots mensais (últimos 3 meses para curva patrimonial crescente)
  const snapshots: PortfolioSnapshot[] = [
    {
      id: "snap-demo-m2",
      user_id: DEMO_USER_ID,
      month: monthMinus2,
      total_value: 81200,
      total_cost: 77500,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: "snap-demo-m1",
      user_id: DEMO_USER_ID,
      month: monthMinus1,
      total_value: 84650,
      total_cost: 80000,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: "snap-demo-m0",
      user_id: DEMO_USER_ID,
      month: referenceMonth,
      total_value: 88920,
      total_cost: 82500,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  // 5. Aportes recentes
  const contributions: PortfolioContribution[] = [
    {
      id: "contrib-demo-m1",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-tesouro",
      date: formatIsoDate(monthMinus1, 10),
      amount: 2500,
      notes: "Aporte mensal planejado",
      created_at: nowIso,
    },
    {
      id: "contrib-demo-m0",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-hglg11",
      date: formatIsoDate(referenceMonth, 10),
      amount: 2500,
      notes: "Rebalanceamento orientado pelo motor",
      created_at: nowIso,
    },
  ];

  // 6. Proventos e rendimentos no mês de referência
  const dividends: PortfolioDividend[] = [
    {
      id: "div-demo-hglg11",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-hglg11",
      ticker: "HGLG11",
      date: formatIsoDate(referenceMonth, 15),
      amount: 99.0,
      notes: "Rendimento mensal FII Logístico",
      created_at: nowIso,
    },
    {
      id: "div-demo-kncr11",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-kncr11",
      ticker: "KNCR11",
      date: formatIsoDate(referenceMonth, 15),
      amount: 147.0,
      notes: "Rendimento mensal FII Papel",
      created_at: nowIso,
    },
  ];

  // 7. Transações históricas de aquisição para o ledger da carteira
  const transactions: PortfolioTransaction[] = assets.map((a) => ({
    id: `tx-demo-${a.id}`,
    user_id: DEMO_USER_ID,
    asset_id: a.id,
    type: "buy",
    date: formatIsoDate(shiftMonth(referenceMonth, -3), 15),
    quantity: a.quantity,
    price: a.average_price,
    total: Math.round(a.quantity * a.average_price * 100) / 100,
  }));

  return {
    referenceMonth,
    assets,
    transactions,
    groupTargets,
    snapshots,
    contributions,
    dividends,
  };
}
