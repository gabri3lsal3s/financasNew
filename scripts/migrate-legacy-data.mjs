#!/usr/bin/env node
/**
 * Script de Migração de Dados (ETL)
 * FinançasAPP (Legado) -> FinançasNew (Novo)
 *
 * Execução:
 *   node --env-file=.env.migration scripts/migrate-legacy-data.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const legacyUrl = process.env.LEGACY_SUPABASE_URL
const legacyKey = process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY
const newUrl = process.env.NEW_SUPABASE_URL
const newKey = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY
const startDate = process.env.MIGRATION_START_DATE || '2026-01-01'

if (!legacyUrl || !legacyKey || !newUrl || !newKey) {
  console.error('ERRO: Defina LEGACY_SUPABASE_URL, LEGACY_SUPABASE_SERVICE_ROLE_KEY, NEW_SUPABASE_URL e NEW_SUPABASE_SERVICE_ROLE_KEY no .env.migration')
  process.exit(1)
}

const legacyClient = createClient(legacyUrl, legacyKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const newClient = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function runMigration() {
  console.log('===========================================================')
  console.log('   INICIANDO MIGRACAO DE DADOS: FINANCASAPP -> FINANCASNEW ')
  console.log(`   Data de Corte: ${startDate}`)
  console.log('===========================================================\n')

  // 1. USUARIOS & PROFILES
  console.log('[1/8] Migrando Perfis e Preferencias...')
  const { data: legacyProfiles, error: profErr } = await legacyClient
    .from('profiles')
    .select('*')

  if (profErr) throw new Error(`Falha ao ler perfis legados: ${profErr.message}`)

  console.log(` -> Encontrados ${legacyProfiles?.length || 0} perfis.`)

  for (const prof of legacyProfiles || []) {
    const { error: pErr } = await newClient.from('profiles').upsert({
      id: prof.id,
      name: prof.full_name || prof.email?.split('@')[0] || 'Usuario',
      email: prof.email,
      created_at: prof.created_at || new Date().toISOString(),
    })
    if (pErr) console.error(` [!] Erro ao salvar profile ${prof.id}:`, pErr.message)

    const { error: prefErr } = await newClient.from('user_preferences').upsert({
      user_id: prof.id,
      theme: 'dark',
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 3,
      report_weights_enabled: true,
      max_sector_acoes: 30,
      max_sector_fiis: 30,
    })
    if (prefErr) console.error(` [!] Erro ao salvar preferences ${prof.id}:`, prefErr.message)
  }

  // 2. CATEGORIAS (DESPESAS E RECEITAS)
  console.log('\n[2/8] Migrando Categorias (Unificacao + Estorno)...')
  const { data: expCats } = await legacyClient.from('categories').select('*')
  const { data: incCats } = await legacyClient.from('income_categories').select('*')

  const unifiedCategories = [
    ...(expCats || []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      type: 'expense',
      name: c.name,
      icon: c.icon || 'tag',
      color: c.color || '#64748b',
      is_reserved: false,
      is_active: true,
      created_at: c.created_at,
    })),
    ...(incCats || []).map((c) => ({
      id: c.id,
      user_id: c.user_id,
      type: 'income',
      name: c.name,
      icon: c.icon || 'wallet',
      color: c.color || '#10b981',
      is_reserved: false,
      is_active: true,
      created_at: c.created_at,
    })),
  ]

  console.log(` -> Inserindo ${unifiedCategories.length} categorias unificadas...`)
  for (const cat of unifiedCategories) {
    const { error: cErr } = await newClient.from('categories').upsert(cat)
    if (cErr) console.error(` [!] Erro ao salvar categoria ${cat.name}:`, cErr.message)
  }

  // Criar categoria reservada 'Estorno' para cada usuario
  for (const prof of legacyProfiles || []) {
    await newClient.from('categories').upsert(
      {
        user_id: prof.id,
        type: 'income',
        name: 'Estorno',
        icon: 'rotate-ccw',
        color: '#38bdf8',
        is_reserved: true,
        is_active: true,
      },
      { onConflict: 'user_id,type,name' }
    )
  }

  // 3. CARTOES DE CREDITO E CICLOS
  console.log('\n[3/8] Migrando Cartoes de Credito e Ciclos de Fatura...')
  const { data: cards } = await legacyClient.from('credit_cards').select('*')
  console.log(` -> Inserindo ${cards?.length || 0} cartoes...`)
  for (const card of cards || []) {
    const { error: cardErr } = await newClient.from('credit_cards').upsert({
      id: card.id,
      user_id: card.user_id,
      name: card.name,
      brand: card.brand || null,
      credit_limit: Number(card.limit_total || card.credit_limit || 0),
      closing_day: Number(card.closing_day || 1),
      due_day: Number(card.due_day || 10),
      color: card.color || '#6366f1',
      is_active: card.is_active ?? true,
      created_at: card.created_at,
    })
    if (cardErr) console.error(` [!] Erro ao salvar cartao ${card.name}:`, cardErr.message)
  }

  const { data: cycles } = await legacyClient.from('credit_card_monthly_cycles').select('*')
  console.log(` -> Inserindo ${cycles?.length || 0} overrides de ciclo...`)
  for (const cycle of cycles || []) {
    const { error: cyErr } = await newClient.from('card_competence_overrides').upsert({
      id: cycle.id,
      card_id: cycle.credit_card_id,
      month: cycle.competence,
      closing_day: Number(cycle.closing_day),
      due_day: Number(cycle.due_day),
      created_at: cycle.created_at,
    })
    if (cyErr) console.error(` [!] Erro ao salvar ciclo ${cycle.id}:`, cyErr.message)
  }

  // 4. PAGAMENTOS DE FATURA (CARD PAYMENTS)
  console.log('\n[4/8] Migrando Pagamentos de Fatura...')
  const { data: cardPayments } = await legacyClient.from('credit_card_bill_payments').select('*')
  let countPayments = 0
  for (const p of cardPayments || []) {
    if (p.payment_date < startDate) continue
    const isRefund = Number(p.amount) < 0 || String(p.note || '').includes('[REFUND]')
    const { error: pErr } = await newClient.from('card_payments').upsert({
      id: p.id,
      user_id: p.user_id,
      card_id: p.credit_card_id,
      competence_month: p.bill_competence,
      amount: Math.abs(Number(p.amount || 0)),
      date: p.payment_date,
      note: p.note || null,
      is_refund: isRefund,
      created_at: p.created_at,
    })
    if (pErr) console.error(` [!] Erro ao salvar pagamento ${p.id}:`, pErr.message)
    else countPayments++
  }
  console.log(` -> Inseridos ${countPayments} pagamentos de fatura.`)

  // 5. DESPESAS (EXPENSES)
  console.log('\n[5/8] Migrando Despesas e Validando Invariantes...')
  const { data: expenses } = await legacyClient
    .from('expenses')
    .select('*')
    .gte('date', startDate)

  let countExpenses = 0
  for (const e of expenses || []) {
    const val = Number(e.amount || 0)
    const weight = e.report_weight !== null && e.report_weight !== undefined ? Number(e.report_weight) : 1.0
    const baseAmt = weight > 0 ? Number((val / weight).toFixed(2)) : val
    const totalInst = Number(e.installment_total || 1)
    const numInst = Number(e.installment_number || 1)
    let groupId = e.installment_group_id

    if (totalInst > 1 && !groupId) {
      groupId = randomUUID()
    } else if (totalInst <= 1) {
      groupId = null
    }

    const { error: expErr } = await newClient.from('expenses').upsert({
      id: e.id,
      user_id: e.user_id,
      value: val,
      date: e.date,
      category_id: e.category_id,
      payment_method: e.payment_method || (e.credit_card_id ? 'credit_card' : 'cash'),
      card_id: e.credit_card_id || null,
      installments_total: totalInst,
      installment_number: numInst,
      installment_group_id: groupId,
      bill_competence: e.bill_competence || null,
      report_weight: weight,
      base_amount: baseAmt,
      description: e.description || null,
      created_at: e.created_at,
    })
    if (expErr) console.error(` [!] Erro ao salvar despesa ${e.id}:`, expErr.message)
    else countExpenses++
  }
  console.log(` -> Inseridas ${countExpenses} despesas.`)

  // 6. RECEITAS (INCOMES)
  console.log('\n[6/8] Migrando Receitas...')
  const { data: incomes } = await legacyClient
    .from('incomes')
    .select('*')
    .gte('date', startDate)

  let countIncomes = 0
  for (const inc of incomes || []) {
    const val = Number(inc.amount || 0)
    const weight = inc.report_weight !== null && inc.report_weight !== undefined ? Number(inc.report_weight) : 1.0
    const { error: incErr } = await newClient.from('incomes').upsert({
      id: inc.id,
      user_id: inc.user_id,
      value: val,
      date: inc.date,
      category_id: inc.income_category_id,
      receive_type: inc.type || 'other',
      description: inc.description || null,
      report_weight: weight,
      created_at: inc.created_at,
    })
    if (incErr) console.error(` [!] Erro ao salvar receita ${inc.id}:`, incErr.message)
    else countIncomes++
  }
  console.log(` -> Inseridas ${countIncomes} receitas.`)

  // 7. DIVIDAS (DEBTS)
  console.log('\n[7/8] Migrando Dividas...')
  const { data: debts } = await legacyClient.from('debts').select('*')
  let countDebts = 0
  for (const d of debts || []) {
    const isPaid = d.status === 'paid'
    const { error: debtErr } = await newClient.from('debts').upsert({
      id: d.id,
      user_id: d.user_id,
      name: d.name,
      type: d.type,
      amount: Number(d.amount || 0),
      due_date: d.due_date,
      paid_at: isPaid ? (d.due_date ? `${d.due_date}T12:00:00Z` : d.created_at) : null,
      expense_id: d.expense_id || null,
      installment_group_id: null,
      created_at: d.created_at,
    })
    if (debtErr) console.error(` [!] Erro ao salvar divida ${d.id}:`, debtErr.message)
    else countDebts++
  }
  console.log(` -> Inseridas ${countDebts} dividas.`)

  // 8. ORCAMENTOS E METAS
  console.log('\n[8/8] Migrando Orcamentos e Metas de Renda...')
  const { data: limits } = await legacyClient.from('expense_category_month_limits').select('*')
  let countBudgets = 0
  for (const l of limits || []) {
    if (!l.limit_amount || Number(l.limit_amount) <= 0) continue
    const { error: bErr } = await newClient.from('budgets').upsert(
      {
        id: l.id,
        user_id: l.user_id,
        category_id: l.category_id,
        month: l.month,
        limit: Number(l.limit_amount),
        created_at: l.created_at,
      },
      { onConflict: 'category_id,month' }
    )
    if (bErr) console.error(` [!] Erro ao salvar orcamento ${l.id}:`, bErr.message)
    else countBudgets++
  }

  const { data: expectations } = await legacyClient.from('income_category_month_expectations').select('*')
  let countGoals = 0
  for (const exp of expectations || []) {
    if (!exp.expectation_amount || Number(exp.expectation_amount) <= 0) continue
    const { error: gErr } = await newClient.from('income_goals').upsert(
      {
        id: exp.id,
        user_id: exp.user_id,
        category_id: exp.income_category_id,
        month: exp.month,
        expected: Number(exp.expectation_amount),
        created_at: exp.created_at,
      },
      { onConflict: 'category_id,month' }
    )
    if (gErr) console.error(` [!] Erro ao salvar meta ${exp.id}:`, gErr.message)
    else countGoals++
  }
  console.log(` -> Inseridos ${countBudgets} orcamentos e ${countGoals} metas de renda.`)

  console.log('\n===========================================================')
  console.log('   MIGRACAO CONCLUIDA COM SUCESSO!                        ')
  console.log('   Execute agora os Sanity Checks SQL (docs/DATA_MIGRATION_GUIDE.md)')
  console.log('===========================================================')
}

runMigration().catch((err) => {
  console.error('\n[X] FALHA CRITICA NA EXECUCAO DA MIGRACAO:', err)
  process.exit(1)
})
