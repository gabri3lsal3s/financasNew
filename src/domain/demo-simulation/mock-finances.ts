import { currentMonth, shiftMonth } from "@/lib/date";
import type {
  Budget,
  CardPayment,
  Category,
  CreditCard,
  Expense,
  FamilyConsolidationExpense,
  FamilyConsolidationMember,
  FamilyConsolidationResult,
  FamilyMemberWithProfile,
  Income,
  IncomeGoal,
  Debt,
  Loan,
  MyFamilyData,
  PublicShare,
} from "@/types";
import type { DailyFinancesDataset } from "./types";

export const DEMO_USER_ID = "demo-simulation-user";
export const DEMO_FAMILY_ID = "family-demo-simulada";
export const DEMO_PARTNER_USER_ID = "demo-partner-user";

/**
 * Formata com segurança uma data ISO YYYY-MM-DD baseada no mês YYYY-MM e no dia,
 * limitando o dia ao número real de dias do mês.
 */
export function formatIsoDate(month: string, day: number): string {
  const [year, monthNum] = month.split("-").map(Number);
  const maxDays = new Date(year ?? 2026, monthNum ?? 1, 0).getDate();
  const clampedDay = Math.min(Math.max(1, day), maxDays);
  return `${month}-${String(clampedDay).padStart(2, "0")}`;
}

/**
 * Gera os compartilhamentos públicos simulados (rachas com Pix e termômetros de metas coletivas).
 */
export function generateMockPublicShares(
  referenceMonth: string = currentMonth(),
): PublicShare[] {
  return [
    // 1. Racha de despesas ativo com 4 participantes e 2 pagamentos já sinalizados via Pix
    {
      id: "share-demo-split-churrasco",
      user_id: DEMO_USER_ID,
      kind: "split",
      token: "demo-token-split-churrasco",
      created_at: `${formatIsoDate(referenceMonth, 12)}T19:30:00.000Z`,
      updated_at: `${formatIsoDate(referenceMonth, 13)}T12:00:00.000Z`,
      expires_at: null,
      is_revoked: false,
      payload: {
        title: "Churrasco de Confraternização",
        total_cents: 48000,
        date: formatIsoDate(referenceMonth, 12),
        people_count: 4,
        guest_share_cents: 12000,
        host_share_cents: 12000,
        remainder_policy: "host",
        host_name: "Você",
        host_city: "São Paulo",
        pix_key: "financeiro.demo@exemplo.com",
        pix_key_type: "email",
        pix_br_code:
          "00020126360014BR.GOV.BCB.PIX0114demo@exemplo.com5204000053039865406120.005802BR5904Voce6009Sao Paulo62070503***6304ABCD",
        expense_id: "exp-demo-ref-restaurante",
        category_id: "cat-demo-lazer",
        category_name: "Lazer & Assinaturas",
        category_icon: "lazer",
        is_completed: false,
        total_settled_cents: 12000,
        participants: [
          {
            id: "part-demo-host",
            name: "Você (Anfitrião)",
            share_cents: 12000,
            is_host: true,
            is_settled: true,
            settled_cents: 12000,
            settled_at: `${formatIsoDate(referenceMonth, 12)}T19:30:00.000Z`,
          },
          {
            id: "part-demo-mariana",
            name: "Mariana Costa",
            share_cents: 12000,
            is_host: false,
            is_settled: false,
            has_payment_signal: true,
            payment_signaled_at: `${formatIsoDate(referenceMonth, 13)}T10:15:00.000Z`,
          },
          {
            id: "part-demo-lucas",
            name: "Lucas Oliveira",
            share_cents: 12000,
            is_host: false,
            is_settled: false,
            has_payment_signal: true,
            payment_signaled_at: `${formatIsoDate(referenceMonth, 13)}T11:45:00.000Z`,
          },
          {
            id: "part-demo-beatriz",
            name: "Beatriz Souza",
            share_cents: 12000,
            is_host: false,
            is_settled: false,
            has_payment_signal: false,
          },
        ],
        payment_signals: [
          {
            id: "sig-demo-mariana",
            participant_id: "part-demo-mariana",
            participant_name: "Mariana Costa",
            amount_cents: 12000,
            status: "pending",
            created_at: `${formatIsoDate(referenceMonth, 13)}T10:15:00.000Z`,
          },
          {
            id: "sig-demo-lucas",
            participant_id: "part-demo-lucas",
            participant_name: "Lucas Oliveira",
            amount_cents: 12000,
            status: "pending",
            created_at: `${formatIsoDate(referenceMonth, 13)}T11:45:00.000Z`,
          },
        ],
      },
    },

    // 2. Meta pública coletiva com arrecadação em 75% e chave Pix mockada
    {
      id: "share-demo-goal-viagem",
      user_id: DEMO_USER_ID,
      kind: "goal_tracker",
      token: "demo-token-goal-viagem",
      created_at: `${formatIsoDate(referenceMonth, 1)}T09:00:00.000Z`,
      updated_at: `${formatIsoDate(referenceMonth, 15)}T18:00:00.000Z`,
      expires_at: null,
      is_revoked: false,
      payload: {
        title: "Viagem de Fim de Ano em Família",
        category_id: null,
        month: referenceMonth,
        target_cents: 800000,
        current_cents: 600000,
        deadline: formatIsoDate(referenceMonth, 28),
        organizer_name: "Você",
        organizer_city: "São Paulo",
        pix_key: "viagem.familia@exemplo.com",
        pix_key_type: "email",
        pix_br_code:
          "00020126360014BR.GOV.BCB.PIX0123viagem.familia@exemplo.com5204000053039865802BR5904Voce6009Sao Paulo62070503***6304E1F2",
        status: "active",
        notes: "Vaquinha para hospedagem e passagens da viagem de férias em família.",
        show_contributions_publicly: true,
        contributions: [
          {
            id: "contrib-demo-1",
            amount_cents: 300000,
            contributor_name: "Você",
            date: formatIsoDate(referenceMonth, 2),
          },
          {
            id: "contrib-demo-2",
            amount_cents: 200000,
            contributor_name: "Camila",
            date: formatIsoDate(referenceMonth, 8),
          },
          {
            id: "contrib-demo-3",
            amount_cents: 100000,
            contributor_name: "Mariana",
            date: formatIsoDate(referenceMonth, 14),
          },
        ],
      },
    },
  ];
}

/**
 * Gera a unidade familiar simulada com 2 membros e perfil completo.
 */
export function generateMockFamily(): MyFamilyData {
  const nowIso = new Date().toISOString();

  const currentMember: FamilyMemberWithProfile = {
    id: "mem-demo-1",
    family_id: DEMO_FAMILY_ID,
    user_id: DEMO_USER_ID,
    role: "owner",
    display_name: "Você",
    profile_name: "Gabriel Sales",
    profile_email: "gabriel@exemplo.com",
    pix_key: "financeiro.demo@exemplo.com",
    pix_key_type: "email",
    split_ratio: 0.5,
    share_all_portfolio: false,
    shared_asset_classes: ["Renda Fixa"],
    created_at: nowIso,
    updated_at: nowIso,
  };

  const partnerMember: FamilyMemberWithProfile = {
    id: "mem-demo-2",
    family_id: DEMO_FAMILY_ID,
    user_id: DEMO_PARTNER_USER_ID,
    role: "member",
    display_name: "Camila",
    profile_name: "Camila Santos",
    profile_email: "camila@exemplo.com",
    pix_key: "camila.demo@exemplo.com",
    pix_key_type: "email",
    split_ratio: 0.5,
    share_all_portfolio: false,
    shared_asset_classes: ["Renda Fixa"],
    created_at: nowIso,
    updated_at: nowIso,
  };

  return {
    family: {
      id: DEMO_FAMILY_ID,
      name: "Família Silva",
      owner_id: DEMO_USER_ID,
      monthly_budget: 6000,
      split_rule: "equal",
      created_at: nowIso,
      updated_at: nowIso,
    },
    members: [currentMember, partnerMember],
    currentMember,
    invites: [],
  };
}

/**
 * Gera a consolidação familiar simulada para o mês de referência,
 * com 2 membros e acerto de contas perfeitamente equilibrado (50% / 50%).
 */
export function generateMockFamilyConsolidation(
  referenceMonth: string = currentMonth(),
): FamilyConsolidationResult {
  const nowIso = new Date().toISOString();

  const expenses: FamilyConsolidationExpense[] = [
    {
      id: "fexp-demo-aluguel",
      description: "Aluguel & Condomínio",
      date: formatIsoDate(referenceMonth, 1),
      amount_cents: 180000,
      category_id: "cat-demo-moradia",
      category_name: "Moradia & Contas Básicas",
      category_icon: "moradia",
      category_color: "#3b82f6",
      user_id: DEMO_USER_ID,
      payer_name: "Você",
      is_own: true,
      created_at: `${formatIsoDate(referenceMonth, 1)}T10:00:00.000Z`,
    },
    {
      id: "fexp-demo-mercado",
      description: "Supermercado Mensal",
      date: formatIsoDate(referenceMonth, 5),
      amount_cents: 120000,
      category_id: "cat-demo-alimentacao",
      category_name: "Alimentação & Supermercado",
      category_icon: "alimentacao",
      category_color: "#10b981",
      user_id: DEMO_PARTNER_USER_ID,
      payer_name: "Camila",
      is_own: false,
      created_at: `${formatIsoDate(referenceMonth, 5)}T14:30:00.000Z`,
    },
    {
      id: "fexp-demo-energia",
      description: "Contas de Consumo & Energia",
      date: formatIsoDate(referenceMonth, 10),
      amount_cents: 60000,
      category_id: "cat-demo-moradia",
      category_name: "Moradia & Contas Básicas",
      category_icon: "moradia",
      category_color: "#3b82f6",
      user_id: DEMO_PARTNER_USER_ID,
      payer_name: "Camila",
      is_own: false,
      created_at: `${formatIsoDate(referenceMonth, 10)}T16:00:00.000Z`,
    },
  ];

  const members: FamilyConsolidationMember[] = [
    {
      user_id: DEMO_USER_ID,
      role: "owner",
      display_name: "Você",
      pix_key: "financeiro.demo@exemplo.com",
      pix_key_type: "email",
      split_ratio: 0.5,
      spent_cents: 180000,
      percentage_of_total: 50,
    },
    {
      user_id: DEMO_PARTNER_USER_ID,
      role: "member",
      display_name: "Camila",
      pix_key: "camila.demo@exemplo.com",
      pix_key_type: "email",
      split_ratio: 0.5,
      spent_cents: 180000,
      percentage_of_total: 50,
    },
  ];

  return {
    family: {
      id: DEMO_FAMILY_ID,
      name: "Família Silva",
      owner_id: DEMO_USER_ID,
      monthly_budget_cents: 600000,
      split_rule: "equal",
    },
    month: referenceMonth,
    monthly_ceiling_cents: 600000,
    total_spent_cents: 360000,
    total_income_cents: 930000,
    remaining_cents: 240000,
    spent_percentage: 60,
    members,
    expenses,
    is_settled: true,
    settlement: {
      id: "set-demo-ref",
      month: referenceMonth,
      payer_id: DEMO_PARTNER_USER_ID,
      payer_name: "Camila",
      receiver_id: DEMO_USER_ID,
      receiver_name: "Você",
      amount_cents: 0,
      settled_at: `${formatIsoDate(referenceMonth, 15)}T18:00:00.000Z`,
      payment_method: "pix",
      notes: "Contas perfeitamente equilibradas no mês (50% / 50%)",
      created_at: nowIso,
    },
    has_post_settlement_expenses: false,
  };
}

/**
 * Gera um dataset puro e em memória para a simulação de finanças diárias,
 * ancorando dinamicamente receitas, despesas, cartões e orçamentos no mês de referência.
 */
export function generateMockFinances(referenceMonth: string = currentMonth()): DailyFinancesDataset {
  const prevMonth = shiftMonth(referenceMonth, -1);
  const nowIso = new Date().toISOString();

  // 1. Categorias canônicas
  const categories: Category[] = [
    {
      id: "cat-demo-alimentacao",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Alimentação & Supermercado",
      icon: "alimentacao",
      color: "#10b981",
      is_reserved: false,
      is_active: true,
      is_family: true,
    },
    {
      id: "cat-demo-moradia",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Moradia & Contas Básicas",
      icon: "moradia",
      color: "#3b82f6",
      is_reserved: false,
      is_active: true,
      is_family: true,
    },
    {
      id: "cat-demo-transporte",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Transporte & Mobilidade",
      icon: "transporte",
      color: "#f59e0b",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-lazer",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Lazer & Assinaturas",
      icon: "lazer",
      color: "#8b5cf6",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-saude",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Saúde & Cuidados",
      icon: "saude",
      color: "#ef4444",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-educacao",
      user_id: DEMO_USER_ID,
      type: "expense",
      name: "Educação & Livros",
      icon: "educacao",
      color: "#06b6d4",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-salario",
      user_id: DEMO_USER_ID,
      type: "income",
      name: "Salário & Proventos",
      icon: "salario",
      color: "#10b981",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-freela",
      user_id: DEMO_USER_ID,
      type: "income",
      name: "Freelance & Consultoria",
      icon: "compras",
      color: "#3b82f6",
      is_reserved: false,
      is_active: true,
    },
    {
      id: "cat-demo-rendimentos",
      user_id: DEMO_USER_ID,
      type: "income",
      name: "Rendimentos de Aplicações",
      icon: "investimentos",
      color: "#8b5cf6",
      is_reserved: false,
      is_active: true,
    },
  ];

  // 2. Cartões de crédito
  const cards: CreditCard[] = [
    {
      id: "card-demo-black",
      user_id: DEMO_USER_ID,
      name: "Mastercard Black Principal",
      brand: "mastercard",
      credit_limit: 15000,
      closing_day: 25,
      due_day: 5,
      color: "#1e1e24",
      is_active: true,
    },
  ];

  // 3. Receitas dinâmicas (mês atual e anterior)
  const incomes: Income[] = [
    // Mês anterior
    {
      id: "inc-demo-prev-salario",
      user_id: DEMO_USER_ID,
      value: 7500,
      date: formatIsoDate(prevMonth, 5),
      category_id: "cat-demo-salario",
      receive_type: "pix",
      description: "Salário Mensal — Empresa Principal",
      report_weight: 1,
      source_ref: null,
      created_at: nowIso,
    },
    {
      id: "inc-demo-prev-freela",
      user_id: DEMO_USER_ID,
      value: 1200,
      date: formatIsoDate(prevMonth, 18),
      category_id: "cat-demo-freela",
      receive_type: "pix",
      description: "Consultoria UI/UX — Projeto Mobile",
      report_weight: 1,
      source_ref: null,
      created_at: nowIso,
    },
    // Mês de referência
    {
      id: "inc-demo-ref-salario",
      user_id: DEMO_USER_ID,
      value: 7500,
      date: formatIsoDate(referenceMonth, 5),
      category_id: "cat-demo-salario",
      receive_type: "pix",
      description: "Salário Mensal — Empresa Principal",
      report_weight: 1,
      source_ref: null,
      created_at: nowIso,
    },
    {
      id: "inc-demo-ref-freela",
      user_id: DEMO_USER_ID,
      value: 1800,
      date: formatIsoDate(referenceMonth, 15),
      category_id: "cat-demo-freela",
      receive_type: "pix",
      description: "Desenvolvimento Frontend — Squad B2B",
      report_weight: 1,
      source_ref: null,
      created_at: nowIso,
    },
    {
      id: "inc-demo-ref-rendimentos",
      user_id: DEMO_USER_ID,
      value: 285.4,
      date: formatIsoDate(referenceMonth, 22),
      category_id: "cat-demo-rendimentos",
      receive_type: "transfer",
      description: "Rendimento Automático — Tesouro & CDB",
      report_weight: 1,
      source_ref: null,
      created_at: nowIso,
    },
  ];

  // 4. Despesas dinâmicas (mês anterior e atual)
  const expenses: Expense[] = [
    // --- Mês Anterior ---
    {
      id: "exp-demo-prev-moradia",
      user_id: DEMO_USER_ID,
      value: 2400,
      date: formatIsoDate(prevMonth, 1),
      category_id: "cat-demo-moradia",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 2400,
      description: "Aluguel & Taxa de Condomínio",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-prev-mercado",
      user_id: DEMO_USER_ID,
      value: 580.4,
      date: formatIsoDate(prevMonth, 6),
      category_id: "cat-demo-alimentacao",
      payment_method: "debit",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 580.4,
      description: "Supermercado do Mês",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-prev-curso-p1",
      user_id: DEMO_USER_ID,
      value: 250,
      date: formatIsoDate(prevMonth, 8),
      category_id: "cat-demo-educacao",
      payment_method: "credit_card",
      card_id: "card-demo-black",
      installments_total: 6,
      installment_number: 1,
      installment_group_id: "inst-demo-curso",
      bill_competence: prevMonth,
      report_weight: 1,
      base_amount: 250,
      description: "Curso de Arquitetura de Software",
      charge_kind: "regular",
      created_at: nowIso,
    },

    // --- Mês de Referência ---
    {
      id: "exp-demo-ref-moradia",
      user_id: DEMO_USER_ID,
      value: 2400,
      date: formatIsoDate(referenceMonth, 1),
      category_id: "cat-demo-moradia",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 2400,
      description: "Aluguel & Taxa de Condomínio",
      charge_kind: "regular",
      is_family: true,
      family_id: DEMO_FAMILY_ID,
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-mercado",
      user_id: DEMO_USER_ID,
      value: 620.5,
      date: formatIsoDate(referenceMonth, 4),
      category_id: "cat-demo-alimentacao",
      payment_method: "debit",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 620.5,
      description: "Supermercado Semanal",
      charge_kind: "regular",
      is_family: true,
      family_id: DEMO_FAMILY_ID,
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-energia",
      user_id: DEMO_USER_ID,
      value: 215.3,
      date: formatIsoDate(referenceMonth, 10),
      category_id: "cat-demo-moradia",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 215.3,
      description: "Conta de Energia Elétrica",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-combustivel",
      user_id: DEMO_USER_ID,
      value: 240,
      date: formatIsoDate(referenceMonth, 12),
      category_id: "cat-demo-transporte",
      payment_method: "credit_card",
      card_id: "card-demo-black",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: referenceMonth,
      report_weight: 1,
      base_amount: 240,
      description: "Posto de Combustível",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-restaurante",
      user_id: DEMO_USER_ID,
      value: 185,
      date: formatIsoDate(referenceMonth, 15),
      category_id: "cat-demo-lazer",
      payment_method: "credit_card",
      card_id: "card-demo-black",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: referenceMonth,
      report_weight: 1,
      base_amount: 185,
      description: "Restaurante e Convivência",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-farmacia",
      user_id: DEMO_USER_ID,
      value: 135.8,
      date: formatIsoDate(referenceMonth, 18),
      category_id: "cat-demo-saude",
      payment_method: "debit",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 135.8,
      description: "Farmácia e Medicamentos",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-curso-p2",
      user_id: DEMO_USER_ID,
      value: 250,
      date: formatIsoDate(referenceMonth, 8),
      category_id: "cat-demo-educacao",
      payment_method: "credit_card",
      card_id: "card-demo-black",
      installments_total: 6,
      installment_number: 2,
      installment_group_id: "inst-demo-curso",
      bill_competence: referenceMonth,
      report_weight: 1,
      base_amount: 250,
      description: "Curso de Arquitetura de Software",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-feira",
      user_id: DEMO_USER_ID,
      value: 95.4,
      date: formatIsoDate(referenceMonth, 21),
      category_id: "cat-demo-alimentacao",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 95.4,
      description: "Feira de Hortifrúti",
      charge_kind: "regular",
      created_at: nowIso,
    },
    {
      id: "exp-demo-ref-internet",
      user_id: DEMO_USER_ID,
      value: 129.9,
      date: formatIsoDate(referenceMonth, 23),
      category_id: "cat-demo-moradia",
      payment_method: "pix",
      card_id: null,
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: null,
      report_weight: 1,
      base_amount: 129.9,
      description: "Internet Fibra Residencial",
      charge_kind: "regular",
      created_at: nowIso,
    },
  ];

  // 5. Orçamentos do mês corrente
  const budgets: Budget[] = [
    {
      id: "bud-demo-alimentacao",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-alimentacao",
      month: referenceMonth,
      limit: 1500,
    },
    {
      id: "bud-demo-moradia",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-moradia",
      month: referenceMonth,
      limit: 3000,
    },
    {
      id: "bud-demo-transporte",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-transporte",
      month: referenceMonth,
      limit: 600,
    },
    {
      id: "bud-demo-lazer",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-lazer",
      month: referenceMonth,
      limit: 500,
    },
    {
      id: "bud-demo-saude",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-saude",
      month: referenceMonth,
      limit: 400,
    },
    {
      id: "bud-demo-educacao",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-educacao",
      month: referenceMonth,
      limit: 500,
    },
  ];

  // 5. Pagamentos e faturas de cartão simuladas
  const cardPayments: CardPayment[] = [
    {
      id: "pay-demo-black-prev",
      user_id: DEMO_USER_ID,
      card_id: "card-demo-black",
      competence_month: prevMonth,
      amount: 250,
      date: formatIsoDate(referenceMonth, 5),
      note: "Pagamento fatura anterior",
      is_refund: false,
    },
  ];

  const publicShares = generateMockPublicShares(referenceMonth);
  const family = generateMockFamily();
  const familyConsolidation = generateMockFamilyConsolidation(referenceMonth);
  const debts = generateMockDebts(referenceMonth);
  const loans = generateMockLoans(referenceMonth);
  const incomeGoals = generateMockIncomeGoals(referenceMonth);

  return {
    referenceMonth,
    previousMonth: prevMonth,
    categories,
    expenses,
    incomes,
    cards,
    budgets,
    cardPayments,
    publicShares,
    family,
    familyConsolidation,
    debts,
    loans,
    incomeGoals,
  };
}

/**
 * Gera contratos de crédito e financiamentos simulados (Price e SAC) para o micro-tour de Contas & Dívidas.
 */
export function generateMockLoans(
  referenceMonth: string = currentMonth(),
): Loan[] {
  const startDateImobiliario = `${shiftMonth(referenceMonth, -14)}-10`;
  const startDateVeiculo = `${shiftMonth(referenceMonth, -10)}-15`;

  return [
    {
      id: "loan-demo-imobiliario",
      user_id: DEMO_USER_ID,
      name: "Financiamento Imobiliário Residencial",
      loan_type: "financing",
      principal_amount: 280000,
      interest_rate_monthly: 0.79,
      amortization_system: "sac",
      total_installments: 360,
      start_date: startDateImobiliario,
      installment_group_id: "inst-loan-imobiliario",
      created_at: `${startDateImobiliario}T10:00:00.000Z`,
    },
    {
      id: "loan-demo-veiculo",
      user_id: DEMO_USER_ID,
      name: "Financiamento Veicular - Honda Civic",
      loan_type: "financing",
      principal_amount: 48000,
      interest_rate_monthly: 1.25,
      amortization_system: "price",
      total_installments: 48,
      start_date: startDateVeiculo,
      installment_group_id: "inst-loan-veiculo",
      created_at: `${startDateVeiculo}T14:30:00.000Z`,
    },
  ];
}

/**
 * Gera dívidas, contas a pagar, a receber e parcelas de contratos simuladas para o tour de Contas & Dívidas.
 */
export function generateMockDebts(
  referenceMonth: string = currentMonth(),
): Debt[] {
  const prevMonth = shiftMonth(referenceMonth, -1);
  const prevMonth2 = shiftMonth(referenceMonth, -2);
  const nextMonth = shiftMonth(referenceMonth, 1);
  const nowIso = `${formatIsoDate(referenceMonth, 1)}T08:00:00.000Z`;

  return [
    // ---------------------------------------------------------
    // 1. Contas a Pagar (payable)
    // ---------------------------------------------------------
    // Urgente / Vencendo hoje ou atrasada (status crítico / semáforo de vencimento)
    {
      id: "debt-demo-enel",
      user_id: DEMO_USER_ID,
      name: "Energia Elétrica (Enel)",
      type: "payable",
      amount: 185.5,
      due_date: formatIsoDate(referenceMonth, 3),
      paid_at: null,
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
    // Deste mês (ordinária)
    {
      id: "debt-demo-internet",
      user_id: DEMO_USER_ID,
      name: "Internet Fibra Residencial",
      type: "payable",
      amount: 129.9,
      due_date: formatIsoDate(referenceMonth, 22),
      paid_at: null,
      expense_id: "exp-demo-ref-internet",
      installment_group_id: null,
      created_at: nowIso,
    },
    // Parcela de Financiamento Imobiliário deste mês (vinculada ao contrato)
    {
      id: "debt-demo-imob-mes",
      user_id: DEMO_USER_ID,
      name: "Financiamento Imobiliário (Parcela 15/360)",
      type: "payable",
      amount: 2130,
      due_date: formatIsoDate(referenceMonth, 10),
      paid_at: null,
      expense_id: null,
      installment_group_id: "inst-loan-imobiliario",
      created_at: nowIso,
    },
    // Parcela de Financiamento Veicular deste mês (vinculada ao contrato)
    {
      id: "debt-demo-veic-mes",
      user_id: DEMO_USER_ID,
      name: "Financiamento Veicular (Parcela 11/48)",
      type: "payable",
      amount: 1342.5,
      due_date: formatIsoDate(referenceMonth, 15),
      paid_at: null,
      expense_id: null,
      installment_group_id: "inst-loan-veiculo",
      created_at: nowIso,
    },
    // Próximo mês: Manutenção Preventiva
    {
      id: "debt-demo-manutencao-futura",
      user_id: DEMO_USER_ID,
      name: "Manutenção Preventiva Automotiva",
      type: "payable",
      amount: 420,
      due_date: formatIsoDate(nextMonth, 12),
      paid_at: null,
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
    // Histórico de Quitadas: Condomínio quitado no início do mês
    {
      id: "debt-demo-condominio-quitado",
      user_id: DEMO_USER_ID,
      name: "Taxa de Condomínio Residencial",
      type: "payable",
      amount: 650,
      due_date: formatIsoDate(referenceMonth, 5),
      paid_at: formatIsoDate(referenceMonth, 5),
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
    // Parcelas de Financiamentos quitadas nos meses anteriores (para calcular progresso de quitação nos LoanCards)
    {
      id: "debt-demo-imob-p13",
      user_id: DEMO_USER_ID,
      name: "Financiamento Imobiliário (Parcela 13/360)",
      type: "payable",
      amount: 2150,
      due_date: formatIsoDate(prevMonth2, 10),
      paid_at: formatIsoDate(prevMonth2, 10),
      expense_id: null,
      installment_group_id: "inst-loan-imobiliario",
      created_at: nowIso,
    },
    {
      id: "debt-demo-imob-p14",
      user_id: DEMO_USER_ID,
      name: "Financiamento Imobiliário (Parcela 14/360)",
      type: "payable",
      amount: 2140,
      due_date: formatIsoDate(prevMonth, 10),
      paid_at: formatIsoDate(prevMonth, 10),
      expense_id: null,
      installment_group_id: "inst-loan-imobiliario",
      created_at: nowIso,
    },
    {
      id: "debt-demo-veic-p9",
      user_id: DEMO_USER_ID,
      name: "Financiamento Veicular (Parcela 9/48)",
      type: "payable",
      amount: 1342.5,
      due_date: formatIsoDate(prevMonth2, 15),
      paid_at: formatIsoDate(prevMonth2, 15),
      expense_id: null,
      installment_group_id: "inst-loan-veiculo",
      created_at: nowIso,
    },
    {
      id: "debt-demo-veic-p10",
      user_id: DEMO_USER_ID,
      name: "Financiamento Veicular (Parcela 10/48)",
      type: "payable",
      amount: 1342.5,
      due_date: formatIsoDate(prevMonth, 15),
      paid_at: formatIsoDate(prevMonth, 15),
      expense_id: null,
      installment_group_id: "inst-loan-veiculo",
      created_at: nowIso,
    },

    // ---------------------------------------------------------
    // 2. Contas a Receber (receivable)
    // ---------------------------------------------------------
    // Deste mês: Consultoria e Racha
    {
      id: "debt-demo-rec-consultoria",
      user_id: DEMO_USER_ID,
      name: "Consultoria de TI & Suporte Técnico",
      type: "receivable",
      amount: 1450,
      due_date: formatIsoDate(referenceMonth, 18),
      paid_at: null,
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
    {
      id: "debt-demo-rec-racha-lucas",
      user_id: DEMO_USER_ID,
      name: "Racha Churrasco (Lucas Oliveira)",
      type: "receivable",
      amount: 120,
      due_date: formatIsoDate(referenceMonth, 20),
      paid_at: null,
      expense_id: "exp-demo-ref-restaurante",
      installment_group_id: null,
      created_at: nowIso,
    },
    // Próximo mês: Venda de equipamento usado
    {
      id: "debt-demo-rec-venda-futura",
      user_id: DEMO_USER_ID,
      name: "Venda Monitor Ultrawide (Parcela 2/2)",
      type: "receivable",
      amount: 350,
      due_date: formatIsoDate(nextMonth, 5),
      paid_at: null,
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
    // Histórico de Quitadas (recebida)
    {
      id: "debt-demo-rec-reembolso-quitado",
      user_id: DEMO_USER_ID,
      name: "Reembolso Despesas Corporativas",
      type: "receivable",
      amount: 280,
      due_date: formatIsoDate(referenceMonth, 4),
      paid_at: formatIsoDate(referenceMonth, 4),
      expense_id: null,
      installment_group_id: null,
      created_at: nowIso,
    },
  ];
}

/**
 * Gera metas de renda simuladas para as categorias de receita.
 */
export function generateMockIncomeGoals(
  referenceMonth: string = currentMonth(),
): IncomeGoal[] {
  return [
    {
      id: "goal-demo-salario",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-salario",
      month: referenceMonth,
      expected: 8500,
    },
    {
      id: "goal-demo-rendimentos",
      user_id: DEMO_USER_ID,
      category_id: "cat-demo-rendimentos",
      month: referenceMonth,
      expected: 500,
    },
  ];
}

