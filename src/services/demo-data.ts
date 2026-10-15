import { getSupabase } from "@/data/client";
import { currentUserId } from "@/data/session";
import { resolveQuery } from "@/data/query";
import { currentMonth, shiftMonth } from "@/lib/date";
import { AppError, classifyError } from "@/services/errors";
import type { Category, CreditCard, PaymentMethod } from "@/types";

export const DEMO_TAG = "[Exemplo]";

/** Verifica se um texto ou nome pertence aos dados de demonstração. */
export function isDemoItem(text?: string | null): boolean {
  return Boolean(text && text.includes(DEMO_TAG));
}

export interface DemoLoadSummary {
  categories: number;
  cards: number;
  incomes: number;
  expenses: number;
  budgets: number;
  assets: number;
}

export interface DemoClearSummary {
  expenses: number;
  incomes: number;
  cards: number;
  budgets: number;
  assets: number;
}

/**
 * Cria ou recupera uma categoria para os lançamentos de demonstração.
 */
async function ensureCategory(
  userId: string,
  existingCategories: Category[],
  name: string,
  type: "expense" | "income",
  icon: string,
  color: string,
): Promise<Category> {
  const found = existingCategories.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type);
  if (found) return found;

  const { data, error } = await resolveQuery<Category>(
    getSupabase()
      .from("categories")
      .insert({
        name,
        type,
        icon,
        color,
        user_id: userId,
        is_active: true,
        is_reserved: false,
      })
      .select()
      .single(),
  );

  if (error || !data) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }
  return data;
}

/**
 * Injeta um pacote completo e realista de dados de demonstração para o usuário ativo.
 * Cobre 2 competências (mês anterior e mês atual) para permitir visualização rica de
 * relatórios, DRE, orçamentos, faturas de cartão e gráficos.
 */
export async function loadDemoData(): Promise<DemoLoadSummary> {
  const userId = await currentUserId();
  const supabase = getSupabase();

  // 1. Busca categorias existentes
  const { data: existingCatsData, error: catError } = await resolveQuery<Category[]>(
    supabase.from("categories").select("*"),
  );
  if (catError) {
    const classified = classifyError(catError);
    throw new AppError(classified.kind, classified.message, catError);
  }
  const existingCats = existingCatsData ?? [];

  // Categorias essenciais
  const catAlimentacao = await ensureCategory(userId, existingCats, "Alimentação", "expense", "utensils", "#f97316");
  const catMoradia = await ensureCategory(userId, existingCats, "Moradia", "expense", "home", "#3b82f6");
  const catTransporte = await ensureCategory(userId, existingCats, "Transporte", "expense", "car", "#10b981");
  const catLazer = await ensureCategory(userId, existingCats, "Lazer", "expense", "coffee", "#8b5cf6");
  const catSalario = await ensureCategory(userId, existingCats, "Salário", "income", "briefcase", "#22c55e");

  // 2. Cria Cartão de Crédito Demonstrativo
  const { data: cardData, error: cardError } = await resolveQuery<CreditCard>(
    supabase
      .from("credit_cards")
      .insert({
        user_id: userId,
        name: `${DEMO_TAG} Cartão Platinum`,
        brand: "mastercard",
        credit_limit: 8000,
        closing_day: 15,
        due_day: 25,
        is_active: true,
        color: null,
      })
      .select()
      .single(),
  );
  if (cardError || !cardData) {
    const classified = classifyError(cardError);
    throw new AppError(classified.kind, classified.message, cardError);
  }
  const demoCardId = cardData.id;

  const currMonth = currentMonth();
  const prevMonth = shiftMonth(currMonth, -1);
  const nextMonth = shiftMonth(currMonth, 1);
  const nextMonth2 = shiftMonth(currMonth, 2);

  // 3. Injeta Receitas (Mês Anterior e Mês Atual)
  const incomesToInsert = [
    {
      user_id: userId,
      description: `${DEMO_TAG} Salário Mensal`,
      value: 5500,
      date: `${prevMonth}-05`,
      category_id: catSalario.id,
      report_weight: 1,
      receive_type: "pix" as const,
      source_ref: null,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Salário Mensal`,
      value: 5500,
      date: `${currMonth}-05`,
      category_id: catSalario.id,
      report_weight: 1,
      receive_type: "pix" as const,
      source_ref: null,
    },
  ];

  const { error: incError } = await supabase.from("incomes").insert(incomesToInsert);
  if (incError) {
    const classified = classifyError(incError);
    throw new AppError(classified.kind, classified.message, incError);
  }

  // 4. Injeta Despesas (Mês Anterior e Mês Atual)
  const rawExpenses = [
    // Mês Anterior
    {
      user_id: userId,
      description: `${DEMO_TAG} Aluguel do Apartamento`,
      value: 1800,
      date: `${prevMonth}-10`,
      category_id: catMoradia.id,
      payment_method: "pix",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Supermercado Mensal`,
      value: 950,
      date: `${prevMonth}-12`,
      category_id: catAlimentacao.id,
      payment_method: "debit",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Combustível Posto`,
      value: 240,
      date: `${prevMonth}-16`,
      category_id: catTransporte.id,
      payment_method: "debit",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Jantar e Lazer`,
      value: 380,
      date: `${prevMonth}-20`,
      category_id: catLazer.id,
      payment_method: "pix",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },

    // Mês Atual - Despesas em Conta
    {
      user_id: userId,
      description: `${DEMO_TAG} Aluguel do Apartamento`,
      value: 1800,
      date: `${currMonth}-10`,
      category_id: catMoradia.id,
      payment_method: "pix",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Supermercado Semanal`,
      value: 420,
      date: `${currMonth}-11`,
      category_id: catAlimentacao.id,
      payment_method: "debit",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Energia e Água`,
      value: 220,
      date: `${currMonth}-14`,
      category_id: catMoradia.id,
      payment_method: "boleto",
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },

    // Mês Atual - Fatura de Cartão
    {
      user_id: userId,
      description: `${DEMO_TAG} Assinatura de Streaming`,
      value: 55.9,
      date: `${currMonth}-08`,
      category_id: catLazer.id,
      payment_method: "credit",
      card_id: demoCardId,
      bill_competence: currMonth,
      report_weight: 1,
      installments_total: 1,
      installment_number: 1,
    },
    // Parcelamento 1/3, 2/3 e 3/3
    {
      user_id: userId,
      description: `${DEMO_TAG} Tênis de Corrida (Parcela 1/3)`,
      value: 120,
      date: `${currMonth}-09`,
      category_id: catLazer.id,
      payment_method: "credit",
      card_id: demoCardId,
      bill_competence: currMonth,
      report_weight: 1,
      installments_total: 3,
      installment_number: 1,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Tênis de Corrida (Parcela 2/3)`,
      value: 120,
      date: `${nextMonth}-09`,
      category_id: catLazer.id,
      payment_method: "credit",
      card_id: demoCardId,
      bill_competence: nextMonth,
      report_weight: 1,
      installments_total: 3,
      installment_number: 2,
    },
    {
      user_id: userId,
      description: `${DEMO_TAG} Tênis de Corrida (Parcela 3/3)`,
      value: 120,
      date: `${nextMonth2}-09`,
      category_id: catLazer.id,
      payment_method: "credit",
      card_id: demoCardId,
      bill_competence: nextMonth2,
      report_weight: 1,
      installments_total: 3,
      installment_number: 3,
    },
  ];

  const expensesToInsert = rawExpenses.map((e) => ({
    user_id: userId,
    description: e.description,
    value: e.value,
    date: e.date,
    category_id: e.category_id,
    payment_method: e.payment_method as PaymentMethod,
    card_id: e.card_id ?? null,
    bill_competence: e.bill_competence ?? null,
    report_weight: e.report_weight ?? 1,
    installments_total: e.installments_total ?? 1,
    installment_number: e.installment_number ?? 1,
    installment_group_id: null,
    base_amount: e.value,
  }));

  const { error: expError } = await supabase.from("expenses").insert(expensesToInsert);
  if (expError) {
    const classified = classifyError(expError);
    throw new AppError(classified.kind, classified.message, expError);
  }

  // 5. Injeta Orçamentos para o mês atual
  const budgetsToInsert = [
    {
      user_id: userId,
      category_id: catAlimentacao.id,
      month: currMonth,
      limit: 1200,
    },
    {
      user_id: userId,
      category_id: catLazer.id,
      month: currMonth,
      limit: 600,
    },
  ];
  const { error: budError } = await supabase.from("budgets").upsert(budgetsToInsert, { onConflict: "user_id,category_id,month" });
  if (budError) {
    const classified = classifyError(budError);
    throw new AppError(classified.kind, classified.message, budError);
  }

  // 6. Injeta Ativo Simulado de Renda Fixa em Investimentos
  const { error: assetError } = await supabase.from("portfolio_assets").insert({
    user_id: userId,
    ticker: "CDB-DI",
    asset_class: "fixed_income",
    currency: "BRL",
    quantity: 5000,
    average_price: 1,
    notes: `${DEMO_TAG} CDB 100% CDI Liquidez Diária`,
  });
  if (assetError) {
    const classified = classifyError(assetError);
    throw new AppError(classified.kind, classified.message, assetError);
  }

  // Aporte financeiro em contribuições para bater com a DRE
  await supabase.from("portfolio_contributions").insert({
    user_id: userId,
    asset_id: null,
    amount: 5000,
    date: `${prevMonth}-15`,
    notes: `${DEMO_TAG} Aporte Inicial Simulado`,
  });

  return {
    categories: 5,
    cards: 1,
    incomes: incomesToInsert.length,
    expenses: expensesToInsert.length,
    budgets: budgetsToInsert.length,
    assets: 1,
  };
}

/**
 * Remove cirurgicamente todos os dados identificados pela tag `[Exemplo]`,
 * preservando integralmente qualquer lançamento ou dado real cadastrado pelo usuário.
 */
export async function clearDemoData(): Promise<DemoClearSummary> {
  const userId = await currentUserId();
  const supabase = getSupabase();

  // 1. Exclui despesas de demonstração
  const { data: expDeleted } = await supabase
    .from("expenses")
    .delete()
    .eq("user_id", userId)
    .ilike("description", `%${DEMO_TAG}%`)
    .select("id");

  // 2. Exclui receitas de demonstração
  const { data: incDeleted } = await supabase
    .from("incomes")
    .delete()
    .eq("user_id", userId)
    .ilike("description", `%${DEMO_TAG}%`)
    .select("id");

  // 3. Exclui cartões de demonstração
  const { data: cardsDeleted } = await supabase
    .from("credit_cards")
    .delete()
    .eq("user_id", userId)
    .ilike("name", `%${DEMO_TAG}%`)
    .select("id");

  // 4. Exclui ativos de investimento de demonstração
  const { data: assetsDeleted } = await supabase
    .from("portfolio_assets")
    .delete()
    .eq("user_id", userId)
    .ilike("name", `%${DEMO_TAG}%`)
    .select("id");

  // 5. Exclui contribuições de demonstração
  await supabase
    .from("portfolio_contributions")
    .delete()
    .eq("user_id", userId)
    .ilike("notes", `%${DEMO_TAG}%`);

  return {
    expenses: expDeleted?.length ?? 0,
    incomes: incDeleted?.length ?? 0,
    cards: cardsDeleted?.length ?? 0,
    budgets: 0,
    assets: assetsDeleted?.length ?? 0,
  };
}
