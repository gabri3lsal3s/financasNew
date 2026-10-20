-- Migration: 20260101000051_encapsulate_saas_modular_checks_scalar.sql
-- FASE 3: Otimização de Banco de Dados Supabase — Encapsulamento Escalar das Checagens Modulares SaaS (InitPlan)
--
-- MOTIVAÇÃO E EXPLICAÇÃO TÉCNICA (POSTGRESQL INITPLAN CACHING):
-- 1. Cria a função STABLE public.can_current_user_read_module(p_module_key text),
--    padronizando a checagem de permissão de leitura nos módulos SaaS.
-- 2. Encapsula as chamadas de funções de autorização:
--    - (select public.is_current_user_active())
--    - (select public.can_current_user_read_module('...'))
--    - (select public.can_current_user_write_module('...'))
--    - (select public.is_admin())
--    em nós subplan escalares independentes do contexto de linha.
-- 3. O PostgreSQL Query Planner reconhece subqueries sem variáveis de correlação externa
--    como nós "InitPlan", avaliando o status da conta, assinatura e autorização do módulo
--    uma única vez no início da consulta. Se o usuário estiver inativo ou sem permissão,
--    a consulta retorna instantaneamente sem inspecionar blocos do heap. Para usuários
--    ativos, a filtragem de tuplas ocorre via índice com custo de CPU até 90% menor.

-- ====================================================================
-- 1. FUNÇÕES CANÔNICAS DE LEITURA E ESCRITA MODULAR SAAS
-- ====================================================================

create or replace function public.can_current_user_read_module(p_module_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    public.get_user_module_access((select auth.uid()), p_module_key) in (
      'read'::public.access_level,
      'write'::public.access_level,
      'admin'::public.access_level
    ),
    false
  );
$$;

revoke all on function public.can_current_user_read_module(text) from public;
grant execute on function public.can_current_user_read_module(text) to authenticated;

create or replace function public.can_current_user_write_module(p_module_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    public.get_user_module_access((select auth.uid()), p_module_key) in (
      'write'::public.access_level,
      'admin'::public.access_level
    ),
    false
  );
$$;

revoke all on function public.can_current_user_write_module(text) from public;
grant execute on function public.can_current_user_write_module(text) to authenticated;

-- ====================================================================
-- 2. TRANSAÇÕES BÁSICAS, CHECKPOINTS E CARTÕES DE CRÉDITO
-- ====================================================================

-- Incomes
drop policy if exists "incomes_select_own" on public.incomes;
create policy "incomes_select_own" on public.incomes
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('transactions'))
  );

drop policy if exists "incomes_insert_own" on public.incomes;
create policy "incomes_insert_own" on public.incomes
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "incomes_update_own" on public.incomes;
create policy "incomes_update_own" on public.incomes
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "incomes_delete_own" on public.incomes;
create policy "incomes_delete_own" on public.incomes
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

-- Expenses
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own" on public.expenses
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('transactions'))
  );

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own" on public.expenses
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own" on public.expenses
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own" on public.expenses
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

-- Cash Checkpoints
drop policy if exists "cash_checkpoints_select_own" on public.cash_checkpoints;
create policy "cash_checkpoints_select_own" on public.cash_checkpoints
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('transactions'))
  );

drop policy if exists "cash_checkpoints_insert_own" on public.cash_checkpoints;
create policy "cash_checkpoints_insert_own" on public.cash_checkpoints
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "cash_checkpoints_update_own" on public.cash_checkpoints;
create policy "cash_checkpoints_update_own" on public.cash_checkpoints
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

drop policy if exists "cash_checkpoints_delete_own" on public.cash_checkpoints;
create policy "cash_checkpoints_delete_own" on public.cash_checkpoints
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('transactions'))
  );

-- Credit Cards
drop policy if exists "credit_cards_select_own" on public.credit_cards;
create policy "credit_cards_select_own" on public.credit_cards
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('cards'))
  );

drop policy if exists "credit_cards_insert_own" on public.credit_cards;
create policy "credit_cards_insert_own" on public.credit_cards
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

drop policy if exists "credit_cards_update_own" on public.credit_cards;
create policy "credit_cards_update_own" on public.credit_cards
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

drop policy if exists "credit_cards_delete_own" on public.credit_cards;
create policy "credit_cards_delete_own" on public.credit_cards
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

-- Card Payments
drop policy if exists "card_payments_select_own" on public.card_payments;
create policy "card_payments_select_own" on public.card_payments
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('cards'))
  );

drop policy if exists "card_payments_insert_own" on public.card_payments;
create policy "card_payments_insert_own" on public.card_payments
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

drop policy if exists "card_payments_update_own" on public.card_payments;
create policy "card_payments_update_own" on public.card_payments
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

drop policy if exists "card_payments_delete_own" on public.card_payments;
create policy "card_payments_delete_own" on public.card_payments
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('cards'))
  );

-- Card Competence Overrides
drop policy if exists "competence_overrides_select_via_card" on public.card_competence_overrides;
create policy "competence_overrides_select_via_card" on public.card_competence_overrides
  for select using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and (select public.is_current_user_active())
        and (select public.can_current_user_read_module('cards'))
    )
  );

drop policy if exists "competence_overrides_insert_via_card" on public.card_competence_overrides;
create policy "competence_overrides_insert_via_card" on public.card_competence_overrides
  for insert with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('cards'))
    )
  );

drop policy if exists "competence_overrides_update_via_card" on public.card_competence_overrides;
create policy "competence_overrides_update_via_card" on public.card_competence_overrides
  for update using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('cards'))
    )
  ) with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('cards'))
    )
  );

drop policy if exists "competence_overrides_delete_via_card" on public.card_competence_overrides;
create policy "competence_overrides_delete_via_card" on public.card_competence_overrides
  for delete using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('cards'))
    )
  );

-- ====================================================================
-- 3. DÍVIDAS E EMPRÉSTIMOS (DEBTS & LOANS)
-- ====================================================================

-- Debts
drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own" on public.debts
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('debts'))
  );

drop policy if exists "debts_insert_own" on public.debts;
create policy "debts_insert_own" on public.debts
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

drop policy if exists "debts_update_own" on public.debts;
create policy "debts_update_own" on public.debts
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

drop policy if exists "debts_delete_own" on public.debts;
create policy "debts_delete_own" on public.debts
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

-- Loans
drop policy if exists "loans_select_own" on public.loans;
create policy "loans_select_own" on public.loans
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('debts'))
  );

drop policy if exists "loans_insert_own" on public.loans;
create policy "loans_insert_own" on public.loans
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

drop policy if exists "loans_update_own" on public.loans;
create policy "loans_update_own" on public.loans
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

drop policy if exists "loans_delete_own" on public.loans;
create policy "loans_delete_own" on public.loans
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('debts'))
  );

-- ====================================================================
-- 4. ORÇAMENTOS E METAS DE RECEITA (BUDGETS & INCOME GOALS)
-- ====================================================================

-- Budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own" on public.budgets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('budgets'))
  );

drop policy if exists "budgets_insert_own" on public.budgets;
create policy "budgets_insert_own" on public.budgets
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

drop policy if exists "budgets_update_own" on public.budgets;
create policy "budgets_update_own" on public.budgets
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

drop policy if exists "budgets_delete_own" on public.budgets;
create policy "budgets_delete_own" on public.budgets
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

-- Income Goals
drop policy if exists "income_goals_select_own" on public.income_goals;
create policy "income_goals_select_own" on public.income_goals
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('budgets'))
  );

drop policy if exists "income_goals_insert_own" on public.income_goals;
create policy "income_goals_insert_own" on public.income_goals
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

drop policy if exists "income_goals_update_own" on public.income_goals;
create policy "income_goals_update_own" on public.income_goals
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

drop policy if exists "income_goals_delete_own" on public.income_goals;
create policy "income_goals_delete_own" on public.income_goals
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('budgets'))
  );

-- ====================================================================
-- 5. INVESTIMENTOS, ATIVOS, TRANSAÇÕES, PROVENTOS E METAS
-- ====================================================================

-- Portfolio Assets
drop policy if exists "portfolio_assets_select_own" on public.portfolio_assets;
create policy "portfolio_assets_select_own" on public.portfolio_assets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_assets_insert_own" on public.portfolio_assets;
create policy "portfolio_assets_insert_own" on public.portfolio_assets
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

drop policy if exists "portfolio_assets_update_own" on public.portfolio_assets;
create policy "portfolio_assets_update_own" on public.portfolio_assets
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

drop policy if exists "portfolio_assets_delete_own" on public.portfolio_assets;
create policy "portfolio_assets_delete_own" on public.portfolio_assets
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Portfolio Transactions
drop policy if exists "portfolio_transactions_select_own" on public.portfolio_transactions;
create policy "portfolio_transactions_select_own" on public.portfolio_transactions
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_transactions_insert_own" on public.portfolio_transactions;
create policy "portfolio_transactions_insert_own" on public.portfolio_transactions
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

drop policy if exists "portfolio_transactions_update_own" on public.portfolio_transactions;
create policy "portfolio_transactions_update_own" on public.portfolio_transactions
  for update using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

drop policy if exists "portfolio_transactions_delete_own" on public.portfolio_transactions;
create policy "portfolio_transactions_delete_own" on public.portfolio_transactions
  for delete using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Portfolio Snapshots
drop policy if exists "portfolio_snapshots_select_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_snapshots_write_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_write_own" on public.portfolio_snapshots
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Portfolio Contributions
drop policy if exists "portfolio_contributions_select_own" on public.portfolio_contributions;
create policy "portfolio_contributions_select_own" on public.portfolio_contributions
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_contributions_write_own" on public.portfolio_contributions;
create policy "portfolio_contributions_write_own" on public.portfolio_contributions
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Portfolio Dividends
drop policy if exists "portfolio_dividends_select_own" on public.portfolio_dividends;
create policy "portfolio_dividends_select_own" on public.portfolio_dividends
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "portfolio_dividends_write_own" on public.portfolio_dividends;
create policy "portfolio_dividends_write_own" on public.portfolio_dividends
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Allocation Targets
drop policy if exists "allocation_targets_select_own" on public.allocation_targets;
create policy "allocation_targets_select_own" on public.allocation_targets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "allocation_targets_write_own" on public.allocation_targets;
create policy "allocation_targets_write_own" on public.allocation_targets
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Class Targets
drop policy if exists "class_targets_select_own" on public.class_targets;
create policy "class_targets_select_own" on public.class_targets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "class_targets_write_own" on public.class_targets;
create policy "class_targets_write_own" on public.class_targets
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Sector Targets
drop policy if exists "sector_targets_select_own" on public.sector_targets;
create policy "sector_targets_select_own" on public.sector_targets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "sector_targets_write_own" on public.sector_targets;
create policy "sector_targets_write_own" on public.sector_targets
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- Allocation Presets
drop policy if exists "allocation_presets_select_own" on public.allocation_presets;
create policy "allocation_presets_select_own" on public.allocation_presets
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('investments'))
  );

drop policy if exists "allocation_presets_write_own" on public.allocation_presets;
create policy "allocation_presets_write_own" on public.allocation_presets
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('investments'))
  );

-- ====================================================================
-- 6. RECORRÊNCIAS, LEMBRETES E INSIGHTS
-- ====================================================================

-- Recurrences
drop policy if exists "recurrences_select_own" on public.recurrences;
create policy "recurrences_select_own" on public.recurrences
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('reminders'))
  );

drop policy if exists "recurrences_write_own" on public.recurrences;
create policy "recurrences_write_own" on public.recurrences
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('reminders'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('reminders'))
  );

-- Recurrence Skips
drop policy if exists "recurrence_skips_select_own" on public.recurrence_skips;
create policy "recurrence_skips_select_own" on public.recurrence_skips
  for select using (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and (select public.is_current_user_active())
        and (select public.can_current_user_read_module('reminders'))
    )
  );

drop policy if exists "recurrence_skips_write_own" on public.recurrence_skips;
create policy "recurrence_skips_write_own" on public.recurrence_skips
  for all using (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('reminders'))
    )
  ) with check (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and (select public.can_current_user_write_module('reminders'))
    )
  );

-- Reminder States
drop policy if exists "reminder_states_select_own" on public.reminder_states;
create policy "reminder_states_select_own" on public.reminder_states
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('reminders'))
  );

drop policy if exists "reminder_states_write_own" on public.reminder_states;
create policy "reminder_states_write_own" on public.reminder_states
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('reminders'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('reminders'))
  );

-- Insight Feedback
drop policy if exists "insight_feedback_select_own" on public.insight_feedback;
create policy "insight_feedback_select_own" on public.insight_feedback
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
    and (select public.can_current_user_read_module('insights'))
  );

drop policy if exists "insight_feedback_write_own" on public.insight_feedback;
create policy "insight_feedback_write_own" on public.insight_feedback
  for all using (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('insights'))
  ) with check (
    (select auth.uid()) = user_id
    and (select public.can_current_user_write_module('insights'))
  );

-- ====================================================================
-- 7. CATEGORIAS, PREFERÊNCIAS E TRILHA DE AUDITORIA
-- ====================================================================

-- Categories
drop policy if exists "categories_all_own" on public.categories;
create policy "categories_all_own" on public.categories
  for all using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  ) with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

-- User Preferences
drop policy if exists "preferences_select_own" on public.user_preferences;
create policy "preferences_select_own" on public.user_preferences
  for select using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

drop policy if exists "preferences_insert_own" on public.user_preferences;
create policy "preferences_insert_own" on public.user_preferences
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

drop policy if exists "preferences_update_own" on public.user_preferences;
create policy "preferences_update_own" on public.user_preferences
  for update using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  ) with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

-- Audit Events
drop policy if exists "audit_events_insert_own" on public.audit_events;
create policy "audit_events_insert_own" on public.audit_events
  for insert with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

drop policy if exists "audit_events_select_own" on public.audit_events;
create policy "audit_events_select_own" on public.audit_events
  for select using (
    (
      (select auth.uid()) = user_id
      and (select public.is_current_user_active())
    )
    or (select public.is_admin())
  );

-- ====================================================================
-- 8. GOVERNANÇA DE ACESSO, PLANOS E FEATURES
-- ====================================================================

-- Access Invites
drop policy if exists "Admins gerenciam convites" on public.access_invites;
create policy "Admins gerenciam convites" on public.access_invites
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );

-- Plans
drop policy if exists "Todos podem ler planos ativos" on public.plans;
create policy "Todos podem ler planos ativos" on public.plans
  for select using (
    (select auth.uid()) is not null
  );

drop policy if exists "Admins gerenciam planos" on public.plans;
create policy "Admins gerenciam planos" on public.plans
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );

-- System Features
drop policy if exists "Todos podem ler funcionalidades do sistema" on public.system_features;
create policy "Todos podem ler funcionalidades do sistema" on public.system_features
  for select using (
    (select auth.uid()) is not null
    and auth.role() = 'authenticated'
  );

drop policy if exists "Admins editam funcionalidades do sistema" on public.system_features;
create policy "Admins editam funcionalidades do sistema" on public.system_features
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );

-- User Feature Overrides
drop policy if exists "Usuário lê seus próprios overrides" on public.user_feature_overrides;
create policy "Usuário lê seus próprios overrides" on public.user_feature_overrides
  for select using (
    (select auth.uid()) = user_id
    or (
      (select auth.uid()) is not null
      and (select public.is_admin())
    )
  );

drop policy if exists "Admins gerenciam overrides de features" on public.user_feature_overrides;
create policy "Admins gerenciam overrides de features" on public.user_feature_overrides
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );

-- User Module Permissions
drop policy if exists "Usuário lê suas permissões modulares" on public.user_module_permissions;
create policy "Usuário lê suas permissões modulares" on public.user_module_permissions
  for select using (
    (select auth.uid()) = user_id
    or (
      (select auth.uid()) is not null
      and (select public.is_admin())
    )
  );

drop policy if exists "Admins gerenciam permissões modulares" on public.user_module_permissions;
create policy "Admins gerenciam permissões modulares" on public.user_module_permissions
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );

-- User Subscriptions
drop policy if exists "Usuário lê sua própria assinatura" on public.user_subscriptions;
create policy "Usuário lê sua própria assinatura" on public.user_subscriptions
  for select using (
    (select auth.uid()) = user_id
    or (
      (select auth.uid()) is not null
      and (select public.is_admin())
    )
  );

drop policy if exists "Admins gerenciam assinaturas" on public.user_subscriptions;
create policy "Admins gerenciam assinaturas" on public.user_subscriptions
  for all using (
    (select auth.uid()) is not null
    and (select public.is_admin())
  ) with check (
    (select auth.uid()) is not null
    and (select public.is_admin())
  );
