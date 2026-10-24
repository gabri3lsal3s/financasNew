import { currentMonth, shiftMonth } from "@/lib/date";
import type {
  AllocationTarget,
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
 * estruturando ativos com metas equilibradas por classe (Renda Fixa, Ações, FIIs, Cripto)
 * e histórico recente de evolução patrimonial.
 */
export function generateMockInvestments(referenceMonth: string = currentMonth()): InvestmentsDataset {
  const monthMinus2 = shiftMonth(referenceMonth, -2);
  const monthMinus1 = shiftMonth(referenceMonth, -1);
  const nowIso = new Date().toISOString();

  // 1. Ativos de carteira diversificados
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
      notes: "Reserva de valor descentralizada",
      updated_at: nowIso,
    },
  ];

  // 2. Metas percentuais por classe (soma = 100%)
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
  ];

  // 3. Metas percentuais por ativo (soma = 100%)
  const allocationTargets: AllocationTarget[] = [
    {
      id: "tgt-demo-tesouro",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-tesouro",
      target_percentage: 25,
    },
    {
      id: "tgt-demo-cdb",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-cdb",
      target_percentage: 15,
    },
    {
      id: "tgt-demo-itub4",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-itub4",
      target_percentage: 15,
    },
    {
      id: "tgt-demo-vale3",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-vale3",
      target_percentage: 10,
    },
    {
      id: "tgt-demo-hglg11",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-hglg11",
      target_percentage: 15,
    },
    {
      id: "tgt-demo-kncr11",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-kncr11",
      target_percentage: 10,
    },
    {
      id: "tgt-demo-btc",
      user_id: DEMO_USER_ID,
      asset_id: "asset-demo-btc",
      target_percentage: 10,
    },
  ];

  // 4. Snapshots mensais (últimos 3 meses para curva patrimonial crescente)
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
    allocationTargets,
    snapshots,
    contributions,
    dividends,
  };
}
