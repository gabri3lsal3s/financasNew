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

if (legacyKey.includes('COLE_AQUI') || legacyUrl.includes('seu-projeto-legado')) {
  console.error('\n[ATENCAO] O arquivo .env.migration ainda contem textos de exemplo.')
  process.exit(1)
}

const legacyClient = createClient(legacyUrl, legacyKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const newClient = createClient(newUrl, newKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Função auxiliar para buscar todas as linhas (com paginação automática > 1000)
async function fetchAllRows(client, table, queryModifier = (q) => q) {
  let allRows = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    let q = client.from(table).select('*')
    q = queryModifier(q)
    q = q.range(offset, offset + pageSize - 1)
    const { data, error } = await q
    if (error) {
      // Se a tabela não existir, retorna array vazio sem quebrar
      if (error.code === '42P01') return []
      throw new Error(`Erro ao ler tabela ${table}: ${error.message}`)
    }
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return allRows
}

// Função auxiliar para upsert em lotes (otimizado e resiliente)
async function batchUpsert(client, table, rows, options = {}) {
  if (!rows || rows.length === 0) return 0
  const chunkSize = 100
  let count = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await client.from(table).upsert(chunk, options)
    if (error) {
      console.warn(` [!] Aviso no lote da tabela ${table} (${i + 1}-${i + chunk.length}): ${error.message}. Tentando registro a registro...`)
      for (const row of chunk) {
        const { error: singleErr } = await client.from(table).upsert(row, options)
        if (singleErr) console.error(`   [!] Falha no registro (${table} id=${row.id}):`, singleErr.message)
        else count++
      }
    } else {
      count += chunk.length
    }
  }
  return count
}

// Mapeador de métodos de pagamento válidos no schema novo
function mapPaymentMethod(legacyMethod, cardId) {
  const m = String(legacyMethod || '').toLowerCase()
  if (m === 'credit' || m === 'credit_card' || m === 'cartao' || m === 'cartao_credito') {
    return cardId ? 'credit_card' : 'other'
  }
  if (m === 'cash' || m === 'dinheiro' || m === 'especie') return 'cash'
  if (m === 'debit' || m === 'debito' || m === 'cartao_debito') return 'debit'
  if (m === 'pix') return 'pix'
  if (m === 'transfer' || m === 'transferencia' || m === 'ted' || m === 'doc') return 'transfer'
  return cardId ? 'credit_card' : 'other'
}

// Mapeador de tipo de recebimento válido no schema novo
function mapReceiveType(legacyType) {
  const t = String(legacyType || '').toLowerCase()
  if (t === 'cash' || t === 'dinheiro') return 'cash'
  if (t === 'pix') return 'pix'
  if (t === 'transfer' || t === 'ted' || t === 'doc') return 'transfer'
  return 'other'
}

async function runMigration() {
  console.log('===========================================================')
  console.log('   INICIANDO MIGRACAO DE DADOS: FINANCASAPP -> FINANCASNEW ')
  console.log(`   Data de Corte: ${startDate}`)
  console.log('===========================================================\n')

  // Mapas de tradução de IDs Legado -> Novo
  const userIdMap = new Map() // legacyUserId -> newUserId
  const categoryIdMap = new Map() // legacyCatId -> newCatId
  const cardIdMap = new Map() // legacyCardId -> newCardId
  let defaultUserId = null

  // -------------------------------------------------------------
  // 1. USUARIOS & PROFILES
  // -------------------------------------------------------------
  console.log('[1/8] Sincronizando Usuarios (Auth), Perfis e Preferencias...')

  // 1.1 Listar auth.users do novo banco
  const { data: newAuthData, error: newAuthErr } = await newClient.auth.admin.listUsers({ perPage: 1000 })
  if (newAuthErr) throw new Error(`Falha ao listar usuarios do banco novo: ${newAuthErr.message}`)
  const existingNewUsers = newAuthData.users || []

  // 1.2 Listar auth.users do legado
  let legacyAuthUsers = []
  try {
    const { data: authData, error: authErr } = await legacyClient.auth.admin.listUsers({ perPage: 1000 })
    if (!authErr) legacyAuthUsers = authData.users || []
  } catch {
    console.warn(' [!] Nao foi possivel listar auth.users diretamente do legado')
  }

  // 1.3 Listar profiles do legado
  const legacyProfiles = await fetchAllRows(legacyClient, 'profiles')
  console.log(` -> Encontrados ${legacyProfiles.length} perfis no legado e ${existingNewUsers.length} usuarios no banco destino.`)

  for (const prof of legacyProfiles) {
    const authUser = legacyAuthUsers.find((u) => u.id === prof.id)
    const email = (prof.email || authUser?.email || `user_${prof.id.slice(0, 8)}@financasnew.app`).toLowerCase().trim()
    const name = prof.full_name || prof.name || email.split('@')[0] || 'Usuario'

    // Verificar se já existe no banco destino pelo Email ou pelo ID
    const matchByEmail = existingNewUsers.find((u) => (u.email || '').toLowerCase().trim() === email)
    const matchById = existingNewUsers.find((u) => u.id === prof.id)

    let finalUserId

    if (matchByEmail) {
      finalUserId = matchByEmail.id
      console.log(` [✓] Usuario existente por email (${email}): [Legado ${prof.id}] -> [Novo ${finalUserId}]`)
    } else if (matchById) {
      finalUserId = matchById.id
      console.log(` [✓] Usuario existente por ID: ${finalUserId}`)
    } else {
      // Criar novo usuario no Auth com o mesmo ID
      const { data: createdUser, error: createAuthErr } = await newClient.auth.admin.createUser({
        id: prof.id,
        email,
        email_confirm: true,
        user_metadata: authUser?.user_metadata || { name },
      })

      if (createAuthErr) {
        console.warn(` [!] Aviso ao criar auth.user ${prof.id} (${email}): ${createAuthErr.message}`)
        const fallback = existingNewUsers.find((u) => (u.email || '').toLowerCase().trim() === email)
        finalUserId = fallback ? fallback.id : prof.id
      } else {
        finalUserId = createdUser.user.id
        console.log(` [+] Novo usuario criado no Auth: ${finalUserId} (${email})`)
      }
    }

    userIdMap.set(prof.id, finalUserId)
    if (!defaultUserId) defaultUserId = finalUserId

    // Upsert profile
    const { error: pErr } = await newClient.from('profiles').upsert({
      id: finalUserId,
      name,
      email,
      created_at: prof.created_at || new Date().toISOString(),
    })
    if (pErr) console.error(` [!] Erro ao salvar profile ${finalUserId}:`, pErr.message)

    // Upsert preferences
    const { error: prefErr } = await newClient.from('user_preferences').upsert({
      user_id: finalUserId,
      theme: 'dark',
      reminders_enabled: true,
      reminder_days_before_debt: 3,
      reminder_days_before_bill: 3,
      report_weights_enabled: true,
      max_sector_acoes: 30,
      max_sector_fiis: 30,
    })
    if (prefErr) console.error(` [!] Erro ao salvar preferences ${finalUserId}:`, prefErr.message)
  }

  // Se nenhum defaultUserId foi encontrado, usar o primeiro do novo banco
  if (!defaultUserId && existingNewUsers.length > 0) {
    defaultUserId = existingNewUsers[0].id
  }

  console.log(` -> Usuario principal padrao definido: ${defaultUserId}`)

  function getTargetUserId(legacyUserId) {
    if (!legacyUserId) return defaultUserId
    return userIdMap.get(legacyUserId) || defaultUserId
  }

  // -------------------------------------------------------------
  // 2. CATEGORIAS (DESPESAS E RECEITAS)
  // -------------------------------------------------------------
  console.log('\n[2/8] Migrando Categorias (Unificacao + Estorno)...')
  const expCats = await fetchAllRows(legacyClient, 'categories')
  const incCats = await fetchAllRows(legacyClient, 'income_categories')

  const legacyCategories = [
    ...expCats.map((c) => ({
      id: c.id,
      user_id: getTargetUserId(c.user_id),
      type: 'expense',
      name: c.name,
      icon: c.icon || 'tag',
      color: c.color || '#64748b',
      is_reserved: false,
      is_active: true,
    })),
    ...incCats.map((c) => ({
      id: c.id,
      user_id: getTargetUserId(c.user_id),
      type: 'income',
      name: c.name,
      icon: c.icon || 'wallet',
      color: c.color || '#10b981',
      is_reserved: false,
      is_active: true,
    })),
  ]

  console.log(` -> Processando ${legacyCategories.length} categorias...`)
  for (const cat of legacyCategories) {
    const { data: inserted, error: cErr } = await newClient
      .from('categories')
      .upsert(cat, { onConflict: 'user_id,type,name' })
      .select('id')
      .single()

    if (cErr) {
      const { data: existingCat } = await newClient
        .from('categories')
        .select('id')
        .eq('user_id', cat.user_id)
        .eq('type', cat.type)
        .eq('name', cat.name)
        .maybeSingle()

      if (existingCat) {
        categoryIdMap.set(cat.id, existingCat.id)
      } else {
        console.error(` [!] Erro ao salvar categoria "${cat.name}":`, cErr.message)
        categoryIdMap.set(cat.id, cat.id)
      }
    } else if (inserted) {
      categoryIdMap.set(cat.id, inserted.id)
    } else {
      categoryIdMap.set(cat.id, cat.id)
    }
  }

  // Criar categoria reservada 'Estorno' para cada usuario ativo
  for (const [, targetUid] of userIdMap) {
    const { data: refundCat } = await newClient
      .from('categories')
      .upsert(
        {
          user_id: targetUid,
          type: 'income',
          name: 'Estorno',
          icon: 'rotate-ccw',
          color: '#38bdf8',
          is_reserved: true,
          is_active: true,
        },
        { onConflict: 'user_id,type,name' }
      )
      .select('id')
      .single()

    if (refundCat) {
      categoryIdMap.set(`refund_${targetUid}`, refundCat.id)
    }
  }

  function getTargetCategoryId(legacyCatId) {
    if (!legacyCatId) return null
    return categoryIdMap.get(legacyCatId) || legacyCatId
  }

  // -------------------------------------------------------------
  // 3. CARTOES DE CREDITO E CICLOS
  // -------------------------------------------------------------
  console.log('\n[3/8] Migrando Cartoes de Credito e Ciclos de Fatura...')
  const cards = await fetchAllRows(legacyClient, 'credit_cards')
  console.log(` -> Inserindo ${cards.length} cartoes...`)
  for (const card of cards) {
    const targetUid = getTargetUserId(card.user_id)
    const { data: insertedCard, error: cardErr } = await newClient
      .from('credit_cards')
      .upsert(
        {
          id: card.id,
          user_id: targetUid,
          name: card.name || 'Cartao',
          brand: card.brand || null,
          credit_limit: Number(card.limit_total || card.credit_limit || 0),
          closing_day: Math.max(1, Math.min(31, Number(card.closing_day || 1))),
          due_day: Math.max(1, Math.min(31, Number(card.due_day || 10))),
          color: card.color || '#6366f1',
          is_active: card.is_active ?? true,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .single()

    if (cardErr) {
      console.error(` [!] Erro ao salvar cartao "${card.name}":`, cardErr.message)
      cardIdMap.set(card.id, card.id)
    } else {
      cardIdMap.set(card.id, insertedCard?.id || card.id)
    }
  }

  const cycles = await fetchAllRows(legacyClient, 'credit_card_monthly_cycles')
  console.log(` -> Inserindo ${cycles.length} overrides de ciclo...`)
  const cyclesToInsert = cycles.map((cycle) => ({
    id: cycle.id,
    card_id: cardIdMap.get(cycle.credit_card_id) || cycle.credit_card_id,
    month: cycle.competence,
    closing_day: Math.max(1, Math.min(31, Number(cycle.closing_day))),
    due_day: Math.max(1, Math.min(31, Number(cycle.due_day))),
  }))
  await batchUpsert(newClient, 'card_competence_overrides', cyclesToInsert, { onConflict: 'card_id,month' })

  // -------------------------------------------------------------
  // 4. PAGAMENTOS DE FATURA (CARD PAYMENTS)
  // -------------------------------------------------------------
  console.log('\n[4/8] Migrando Pagamentos de Fatura...')
  const cardPayments = await fetchAllRows(legacyClient, 'credit_card_bill_payments', (q) =>
    q.gte('payment_date', startDate)
  )
  const paymentsToInsert = []
  for (const p of cardPayments) {
    const isRefund = Number(p.amount) < 0 || String(p.note || '').includes('[REFUND]')
    const amt = Math.abs(Number(p.amount || 0))
    if (amt <= 0) continue

    paymentsToInsert.push({
      id: p.id,
      user_id: getTargetUserId(p.user_id),
      card_id: cardIdMap.get(p.credit_card_id) || p.credit_card_id,
      competence_month: p.bill_competence,
      amount: amt,
      date: p.payment_date,
      note: p.note || null,
      is_refund: isRefund,
    })
  }
  const savedPayments = await batchUpsert(newClient, 'card_payments', paymentsToInsert, { onConflict: 'id' })
  console.log(` -> Inseridos ${savedPayments} pagamentos de fatura.`)

  // -------------------------------------------------------------
  // 5. DESPESAS (EXPENSES)
  // -------------------------------------------------------------
  console.log('\n[5/8] Migrando Despesas e Validando Invariantes...')
  const expenses = await fetchAllRows(legacyClient, 'expenses', (q) => q.gte('date', startDate))
  const expensesToInsert = []

  for (const e of expenses) {
    const val = Number(e.amount || e.value || 0)
    if (val <= 0) continue

    const weight = e.report_weight !== null && e.report_weight !== undefined ? Number(e.report_weight) : 1.0
    const baseAmt = weight > 0 ? Number((val / weight).toFixed(2)) : val
    const totalInst = Number(e.installment_total || e.installments_total || 1)
    const numInst = Number(e.installment_number || 1)
    let groupId = e.installment_group_id

    if (totalInst > 1 && !groupId) {
      groupId = randomUUID()
    } else if (totalInst <= 1) {
      groupId = null
    }

    const legacyCard = e.credit_card_id || e.card_id || null
    const targetCardId = legacyCard ? (cardIdMap.get(legacyCard) || legacyCard) : null
    const paymentMethod = mapPaymentMethod(e.payment_method, targetCardId)
    const targetUid = getTargetUserId(e.user_id)
    const targetCatId = getTargetCategoryId(e.category_id)

    expensesToInsert.push({
      id: e.id,
      user_id: targetUid,
      value: val,
      date: e.date,
      category_id: targetCatId,
      payment_method: paymentMethod,
      card_id: paymentMethod === 'credit_card' ? targetCardId : null,
      installments_total: totalInst,
      installment_number: Math.min(numInst, totalInst),
      installment_group_id: totalInst > 1 ? (groupId || randomUUID()) : null,
      bill_competence: e.bill_competence || null,
      report_weight: Math.max(0, Math.min(1, weight)),
      base_amount: baseAmt,
      description: e.description || null,
      created_at: e.created_at || new Date().toISOString(),
    })
  }

  const savedExpenses = await batchUpsert(newClient, 'expenses', expensesToInsert, { onConflict: 'id' })
  console.log(` -> Inseridas ${savedExpenses} de ${expensesToInsert.length} despesas.`)

  // -------------------------------------------------------------
  // 6. RECEITAS (INCOMES)
  // -------------------------------------------------------------
  console.log('\n[6/8] Migrando Receitas...')
  const incomes = await fetchAllRows(legacyClient, 'incomes', (q) => q.gte('date', startDate))
  const incomesToInsert = []

  for (const inc of incomes) {
    const val = Number(inc.amount || inc.value || 0)
    if (val <= 0) continue

    const weight = inc.report_weight !== null && inc.report_weight !== undefined ? Number(inc.report_weight) : 1.0
    const receiveType = mapReceiveType(inc.receive_type || inc.type)
    const targetUid = getTargetUserId(inc.user_id)
    const legacyCat = inc.income_category_id || inc.category_id
    const targetCatId = getTargetCategoryId(legacyCat)

    incomesToInsert.push({
      id: inc.id,
      user_id: targetUid,
      value: val,
      date: inc.date,
      category_id: targetCatId,
      receive_type: receiveType,
      description: inc.description || null,
      report_weight: Math.max(0, Math.min(1, weight)),
      created_at: inc.created_at || new Date().toISOString(),
    })
  }

  const savedIncomes = await batchUpsert(newClient, 'incomes', incomesToInsert, { onConflict: 'id' })
  console.log(` -> Inseridas ${savedIncomes} de ${incomesToInsert.length} receitas.`)

  // -------------------------------------------------------------
  // 7. DIVIDAS (DEBTS)
  // -------------------------------------------------------------
  console.log('\n[7/8] Migrando Dividas...')
  const debts = await fetchAllRows(legacyClient, 'debts')
  const debtsToInsert = []

  for (const d of debts) {
    const isPaid = d.status === 'paid'
    const type = d.type === 'receivable' ? 'receivable' : 'payable'
    const amt = Math.abs(Number(d.amount || 0))
    const targetUid = getTargetUserId(d.user_id)

    debtsToInsert.push({
      id: d.id,
      user_id: targetUid,
      name: d.name || 'Divida',
      type,
      amount: amt,
      due_date: d.due_date,
      paid_at: isPaid ? (d.due_date ? `${d.due_date}T12:00:00Z` : d.created_at || new Date().toISOString()) : null,
      expense_id: d.expense_id || null,
      installment_group_id: null,
      created_at: d.created_at || new Date().toISOString(),
    })
  }

  const savedDebts = await batchUpsert(newClient, 'debts', debtsToInsert, { onConflict: 'id' })
  console.log(` -> Inseridas ${savedDebts} dividas.`)

  // -------------------------------------------------------------
  // 8. ORCAMENTOS E METAS
  // -------------------------------------------------------------
  console.log('\n[8/8] Migrando Orcamentos e Metas de Renda...')
  const limits = await fetchAllRows(legacyClient, 'expense_category_month_limits')
  const budgetsToInsert = []

  for (const l of limits) {
    const limitVal = Number(l.limit_amount || l.limit || 0)
    if (limitVal <= 0) continue

    const targetUid = getTargetUserId(l.user_id)
    const targetCatId = getTargetCategoryId(l.category_id)

    budgetsToInsert.push({
      id: l.id,
      user_id: targetUid,
      category_id: targetCatId,
      month: l.month,
      limit: limitVal,
    })
  }
  const savedBudgets = await batchUpsert(newClient, 'budgets', budgetsToInsert, { onConflict: 'category_id,month' })

  const expectations = await fetchAllRows(legacyClient, 'income_category_month_expectations')
  const goalsToInsert = []

  for (const exp of expectations) {
    const expVal = Number(exp.expectation_amount || exp.expected || 0)
    if (expVal <= 0) continue

    const targetUid = getTargetUserId(exp.user_id)
    const legacyCat = exp.income_category_id || exp.category_id
    const targetCatId = getTargetCategoryId(legacyCat)

    goalsToInsert.push({
      id: exp.id,
      user_id: targetUid,
      category_id: targetCatId,
      month: exp.month,
      expected: expVal,
    })
  }
  const savedGoals = await batchUpsert(newClient, 'income_goals', goalsToInsert, { onConflict: 'category_id,month' })
  console.log(` -> Inseridos ${savedBudgets} orcamentos e ${savedGoals} metas de renda.`)

  console.log('\n===========================================================')
  console.log('   MIGRACAO CONCLUIDA COM SUCESSO!                        ')
  console.log('   Execute agora os Sanity Checks SQL (docs/DATA_MIGRATION_GUIDE.md)')
  console.log('===========================================================')
}

runMigration().catch((err) => {
  console.error('\n[X] FALHA CRITICA NA EXECUCAO DA MIGRACAO:', err.message || err)
  if (String(err).includes('fetch failed')) {
    console.error('\nPossiveis causas para "fetch failed":')
    console.error('1. O projeto Supabase antigo pode estar pausado (Paused) no plano gratuito. Acesse https://supabase.com/dashboard/project/roynkajkdheoharcpiyj e clique em "Restore Project" se estiver pausado.')
    console.error('2. A URL ou a chave de API (service_role) podem conter espacos extras ou caracteres incorretos.')
  }
  process.exit(1)
})
