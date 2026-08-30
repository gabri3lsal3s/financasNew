-- ================================================================
-- 0041_saas_rls_and_rpc_hardening.sql — Hardening de RLS & Blindagem de RPCs (§Fase 76.2)
--
-- Objetivos de Segurança e Controle de Acesso:
--   1. Decomposição das Políticas RLS de 'FOR ALL' em Políticas Granulares (SELECT / INSERT / UPDATE / DELETE):
--      - SELECT: liberado para usuários ativos com nível de acesso 'read', 'write' ou 'admin';
--      - INSERT / UPDATE / DELETE: condicionados estritamente a can_current_user_write_module(modulo);
--   2. Blindagem de RPCs Transacionais no PostgreSQL:
--      - Validação de can_current_user_write() e can_current_user_write_module() em todas as RPCs compostas;
--      - Bloqueio definitivo de bypass de escrita via restore_backup, importações de extrato e aportes em lote.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Hardening de RLS: Módulo de Transações (incomes, expenses, cash_checkpoints)
-- ----------------------------------------------------------------

-- Incomes
drop policy if exists "incomes_all_own" on public.incomes;
drop policy if exists "incomes_select_own" on public.incomes;
drop policy if exists "incomes_insert_own" on public.incomes;
drop policy if exists "incomes_update_own" on public.incomes;
drop policy if exists "incomes_delete_own" on public.incomes;

create policy "incomes_select_own" on public.incomes
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "incomes_insert_own" on public.incomes
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "incomes_update_own" on public.incomes
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "incomes_delete_own" on public.incomes
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

-- Expenses
drop policy if exists "expenses_all_own" on public.expenses;
drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

create policy "expenses_select_own" on public.expenses
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "expenses_insert_own" on public.expenses
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "expenses_update_own" on public.expenses
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "expenses_delete_own" on public.expenses
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

-- Cash Checkpoints (Regime de Caixa / Transações)
drop policy if exists "cash_checkpoints_all_own" on public.cash_checkpoints;
drop policy if exists "cash_checkpoints_select_own" on public.cash_checkpoints;
drop policy if exists "cash_checkpoints_insert_own" on public.cash_checkpoints;
drop policy if exists "cash_checkpoints_update_own" on public.cash_checkpoints;
drop policy if exists "cash_checkpoints_delete_own" on public.cash_checkpoints;

create policy "cash_checkpoints_select_own" on public.cash_checkpoints
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "cash_checkpoints_insert_own" on public.cash_checkpoints
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "cash_checkpoints_update_own" on public.cash_checkpoints
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

create policy "cash_checkpoints_delete_own" on public.cash_checkpoints
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('transactions')
  );

-- ----------------------------------------------------------------
-- 2. Hardening de RLS: Módulo de Cartões (credit_cards, card_payments, overrides)
-- ----------------------------------------------------------------

-- Credit Cards
drop policy if exists "credit_cards_all_own" on public.credit_cards;
drop policy if exists "credit_cards_select_own" on public.credit_cards;
drop policy if exists "credit_cards_insert_own" on public.credit_cards;
drop policy if exists "credit_cards_update_own" on public.credit_cards;
drop policy if exists "credit_cards_delete_own" on public.credit_cards;

create policy "credit_cards_select_own" on public.credit_cards
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "credit_cards_insert_own" on public.credit_cards
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

create policy "credit_cards_update_own" on public.credit_cards
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

create policy "credit_cards_delete_own" on public.credit_cards
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

-- Card Payments
drop policy if exists "card_payments_all_own" on public.card_payments;
drop policy if exists "card_payments_select_own" on public.card_payments;
drop policy if exists "card_payments_insert_own" on public.card_payments;
drop policy if exists "card_payments_update_own" on public.card_payments;
drop policy if exists "card_payments_delete_own" on public.card_payments;

create policy "card_payments_select_own" on public.card_payments
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "card_payments_insert_own" on public.card_payments
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

create policy "card_payments_update_own" on public.card_payments
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

create policy "card_payments_delete_own" on public.card_payments
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('cards')
  );

-- Card Competence Overrides
drop policy if exists "competence_overrides_all_via_card" on public.card_competence_overrides;
drop policy if exists "competence_overrides_select_via_card" on public.card_competence_overrides;
drop policy if exists "competence_overrides_insert_via_card" on public.card_competence_overrides;
drop policy if exists "competence_overrides_update_via_card" on public.card_competence_overrides;
drop policy if exists "competence_overrides_delete_via_card" on public.card_competence_overrides;

create policy "competence_overrides_select_via_card" on public.card_competence_overrides
  for select using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.is_current_user_active()
        and public.get_user_module_access(auth.uid(), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
    )
  );

create policy "competence_overrides_insert_via_card" on public.card_competence_overrides
  for insert with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.can_current_user_write_module('cards')
    )
  );

create policy "competence_overrides_update_via_card" on public.card_competence_overrides
  for update using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.can_current_user_write_module('cards')
    )
  ) with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.can_current_user_write_module('cards')
    )
  );

create policy "competence_overrides_delete_via_card" on public.card_competence_overrides
  for delete using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.can_current_user_write_module('cards')
    )
  );

-- ----------------------------------------------------------------
-- 3. Hardening de RLS: Módulo de Dívidas & Empréstimos (debts, loans)
-- ----------------------------------------------------------------

-- Debts
drop policy if exists "debts_all_own" on public.debts;
drop policy if exists "debts_select_own" on public.debts;
drop policy if exists "debts_insert_own" on public.debts;
drop policy if exists "debts_update_own" on public.debts;
drop policy if exists "debts_delete_own" on public.debts;

create policy "debts_select_own" on public.debts
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'debts') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "debts_insert_own" on public.debts
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

create policy "debts_update_own" on public.debts
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

create policy "debts_delete_own" on public.debts
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

-- Loans
drop policy if exists "loans_owner_all" on public.loans;
drop policy if exists "loans_select_own" on public.loans;
drop policy if exists "loans_insert_own" on public.loans;
drop policy if exists "loans_update_own" on public.loans;
drop policy if exists "loans_delete_own" on public.loans;

create policy "loans_select_own" on public.loans
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'debts') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "loans_insert_own" on public.loans
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

create policy "loans_update_own" on public.loans
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

create policy "loans_delete_own" on public.loans
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('debts')
  );

-- ----------------------------------------------------------------
-- 4. Hardening de RLS: Módulo de Orçamentos (budgets, income_goals)
-- ----------------------------------------------------------------

-- Budgets
drop policy if exists "budgets_all_own" on public.budgets;
drop policy if exists "budgets_select_own" on public.budgets;
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;
drop policy if exists "budgets_delete_own" on public.budgets;

create policy "budgets_select_own" on public.budgets
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'budgets') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "budgets_insert_own" on public.budgets
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

create policy "budgets_update_own" on public.budgets
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

create policy "budgets_delete_own" on public.budgets
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

-- Income Goals
drop policy if exists "income_goals_all_own" on public.income_goals;
drop policy if exists "income_goals_select_own" on public.income_goals;
drop policy if exists "income_goals_insert_own" on public.income_goals;
drop policy if exists "income_goals_update_own" on public.income_goals;
drop policy if exists "income_goals_delete_own" on public.income_goals;

create policy "income_goals_select_own" on public.income_goals
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'budgets') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "income_goals_insert_own" on public.income_goals
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

create policy "income_goals_update_own" on public.income_goals
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

create policy "income_goals_delete_own" on public.income_goals
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('budgets')
  );

-- ----------------------------------------------------------------
-- 5. Hardening de RLS: Módulo de Investimentos (portfolio_assets, transactions, etc.)
-- ----------------------------------------------------------------

-- Portfolio Assets
drop policy if exists "portfolio_assets_all_own" on public.portfolio_assets;
drop policy if exists "portfolio_assets_select_own" on public.portfolio_assets;
drop policy if exists "portfolio_assets_insert_own" on public.portfolio_assets;
drop policy if exists "portfolio_assets_update_own" on public.portfolio_assets;
drop policy if exists "portfolio_assets_delete_own" on public.portfolio_assets;

create policy "portfolio_assets_select_own" on public.portfolio_assets
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "portfolio_assets_insert_own" on public.portfolio_assets
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

create policy "portfolio_assets_update_own" on public.portfolio_assets
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

create policy "portfolio_assets_delete_own" on public.portfolio_assets
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

-- Portfolio Transactions
drop policy if exists "portfolio_transactions_all_own" on public.portfolio_transactions;
drop policy if exists "portfolio_transactions_select_own" on public.portfolio_transactions;
drop policy if exists "portfolio_transactions_insert_own" on public.portfolio_transactions;
drop policy if exists "portfolio_transactions_update_own" on public.portfolio_transactions;
drop policy if exists "portfolio_transactions_delete_own" on public.portfolio_transactions;

create policy "portfolio_transactions_select_own" on public.portfolio_transactions
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

create policy "portfolio_transactions_insert_own" on public.portfolio_transactions
  for insert with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

create policy "portfolio_transactions_update_own" on public.portfolio_transactions
  for update using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

create policy "portfolio_transactions_delete_own" on public.portfolio_transactions
  for delete using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

-- Portfolio Snapshots, Contributions, Dividends & Targets
drop policy if exists "portfolio_snapshots_all_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_own" on public.portfolio_snapshots
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "portfolio_snapshots_write_own" on public.portfolio_snapshots
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

drop policy if exists "portfolio_contributions_all_own" on public.portfolio_contributions;
create policy "portfolio_contributions_select_own" on public.portfolio_contributions
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "portfolio_contributions_write_own" on public.portfolio_contributions
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

drop policy if exists "portfolio_dividends_all_own" on public.portfolio_dividends;
create policy "portfolio_dividends_select_own" on public.portfolio_dividends
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "portfolio_dividends_write_own" on public.portfolio_dividends
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

drop policy if exists "allocation_targets_all_own" on public.allocation_targets;
create policy "allocation_targets_select_own" on public.allocation_targets
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "allocation_targets_write_own" on public.allocation_targets
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

drop policy if exists "group_targets_all_own" on public.group_targets;
create policy "group_targets_select_own" on public.group_targets
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "group_targets_write_own" on public.group_targets
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

drop policy if exists "allocation_presets_all_own" on public.allocation_presets;
create policy "allocation_presets_select_own" on public.allocation_presets
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "allocation_presets_write_own" on public.allocation_presets
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('investments')
  );

-- ----------------------------------------------------------------
-- 6. Hardening de RLS: Módulo de Lembretes & Recorrências (recurrences, skips, reminders)
-- ----------------------------------------------------------------

-- Recurrences
drop policy if exists "recurrences_all_own" on public.recurrences;
create policy "recurrences_select_own" on public.recurrences
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "recurrences_write_own" on public.recurrences
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('reminders')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('reminders')
  );

-- Recurrence Skips
drop policy if exists "recurrence_skips_all_own" on public.recurrence_skips;
create policy "recurrence_skips_select_own" on public.recurrence_skips
  for select using (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and public.is_current_user_active()
        and public.get_user_module_access(auth.uid(), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
    )
  );
create policy "recurrence_skips_write_own" on public.recurrence_skips
  for all using (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and public.can_current_user_write_module('reminders')
    )
  ) with check (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and public.can_current_user_write_module('reminders')
    )
  );

-- Reminder States
drop policy if exists "reminder_states_all_own" on public.reminder_states;
create policy "reminder_states_select_own" on public.reminder_states
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "reminder_states_write_own" on public.reminder_states
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('reminders')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('reminders')
  );

-- ----------------------------------------------------------------
-- 7. Hardening de RLS: Módulo de Insights (insight_feedback)
-- ----------------------------------------------------------------
drop policy if exists "insight_feedback_all_own" on public.insight_feedback;
create policy "insight_feedback_select_own" on public.insight_feedback
  for select using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access(auth.uid(), 'insights') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );
create policy "insight_feedback_write_own" on public.insight_feedback
  for all using (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('insights')
  ) with check (
    (select auth.uid()) = user_id
    and public.can_current_user_write_module('insights')
  );

-- ----------------------------------------------------------------
-- 8. Hardening de RPCs Transacionais no PostgreSQL
-- ----------------------------------------------------------------

-- 8.1 restore_backup: exige permissão geral de escrita ativa
create or replace function public.restore_backup(p_backup jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_data jsonb := p_backup -> 'data';
  v_counts jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write() then
    raise exception 'Acesso negado: sua conta está em modo somente-leitura ou seu período de teste encerrou.';
  end if;

  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'Backup inválido: campo "data" ausente ou malformado';
  end if;

  -- 1) Apaga os dados atuais do usuário
  delete from public.portfolio_transactions pt
    using public.portfolio_assets a
    where pt.asset_id = a.id and a.user_id = v_uid;
  delete from public.allocation_targets t
    using public.portfolio_assets a
    where t.asset_id = a.id and a.user_id = v_uid;
  delete from public.card_competence_overrides o
    using public.credit_cards c
    where o.card_id = c.id and c.user_id = v_uid;
  delete from public.card_payments cp
    using public.credit_cards c
    where cp.card_id = c.id and c.user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.incomes where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.income_goals where user_id = v_uid;
  delete from public.insight_feedback where user_id = v_uid;
  delete from public.reminder_states where user_id = v_uid;
  delete from public.asset_prices where user_id = v_uid;
  delete from public.portfolio_assets where user_id = v_uid;
  delete from public.credit_cards where user_id = v_uid;
  delete from public.categories where user_id = v_uid;
  delete from public.user_preferences where user_id = v_uid;

  -- 2) Insere dados dos pais
  insert into public.categories (id, user_id, type, name, icon, color, is_reserved, is_active)
  select id, v_uid, type, name, icon, color, is_reserved, is_active
  from jsonb_populate_recordset(null::public.categories, coalesce(v_data -> 'categories', '[]'::jsonb));

  insert into public.credit_cards (id, user_id, name, brand, credit_limit, closing_day, due_day, color, is_active)
  select id, v_uid, name, brand, credit_limit, closing_day, due_day, color, is_active
  from jsonb_populate_recordset(null::public.credit_cards, coalesce(v_data -> 'credit_cards', '[]'::jsonb));

  insert into public.portfolio_assets (id, user_id, ticker, asset_class, currency)
  select id, v_uid, ticker, asset_class, currency
  from jsonb_populate_recordset(null::public.portfolio_assets, coalesce(v_data -> 'portfolio_assets', '[]'::jsonb));

  insert into public.user_preferences (user_id, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis)
  select v_uid, theme, reminders_enabled, reminder_days_before_debt, reminder_days_before_bill, report_weights_enabled, max_sector_acoes, max_sector_fiis
  from jsonb_populate_recordset(null::public.user_preferences, coalesce(v_data -> 'user_preferences', '[]'::jsonb));

  -- 3) Insere filhos com validação estrita de posse
  insert into public.card_competence_overrides (id, card_id, month, closing_day, due_day)
  select o.id, o.card_id, o.month, o.closing_day, o.due_day
  from jsonb_populate_recordset(null::public.card_competence_overrides, coalesce(v_data -> 'card_competence_overrides', '[]'::jsonb)) o
  join public.credit_cards c on c.id = o.card_id
  where c.user_id = v_uid;

  insert into public.incomes (id, user_id, value, date, category_id, receive_type, description, report_weight, source_ref, created_at)
  select i.id, v_uid, i.value, i.date, i.category_id, i.receive_type, i.description, i.report_weight, i.source_ref, i.created_at
  from jsonb_populate_recordset(null::public.incomes, coalesce(v_data -> 'incomes', '[]'::jsonb)) i
  join public.categories cat on cat.id = i.category_id
  where cat.user_id = v_uid;

  insert into public.expenses (id, user_id, value, date, category_id, payment_method, card_id, installments_total, installment_number, installment_group_id, bill_competence, report_weight, base_amount, description, created_at)
  select e.id, v_uid, e.value, e.date, e.category_id, e.payment_method, e.card_id, e.installments_total, e.installment_number, e.installment_group_id, e.bill_competence, e.report_weight, e.base_amount, e.description, e.created_at
  from jsonb_populate_recordset(null::public.expenses, coalesce(v_data -> 'expenses', '[]'::jsonb)) e
  join public.categories cat on cat.id = e.category_id
  left join public.credit_cards cc on cc.id = e.card_id
  where cat.user_id = v_uid and (e.card_id is null or cc.user_id = v_uid);

  insert into public.debts (id, user_id, name, type, amount, due_date, paid_at, expense_id, installment_group_id, created_at)
  select d.id, v_uid, d.name, d.type, d.amount, d.due_date, d.paid_at, d.expense_id, d.installment_group_id, d.created_at
  from jsonb_populate_recordset(null::public.debts, coalesce(v_data -> 'debts', '[]'::jsonb)) d;

  insert into public.card_payments (id, user_id, card_id, competence_month, amount, date, note, is_refund)
  select cp.id, v_uid, cp.card_id, cp.competence_month, cp.amount, cp.date, cp.note, cp.is_refund
  from jsonb_populate_recordset(null::public.card_payments, coalesce(v_data -> 'card_payments', '[]'::jsonb)) cp
  join public.credit_cards cc on cc.id = cp.card_id
  where cc.user_id = v_uid;

  insert into public.budgets (id, user_id, category_id, month, "limit")
  select b.id, v_uid, b.category_id, b.month, b."limit"
  from jsonb_populate_recordset(null::public.budgets, coalesce(v_data -> 'budgets', '[]'::jsonb)) b
  join public.categories cat on cat.id = b.category_id
  where cat.user_id = v_uid;

  insert into public.income_goals (id, user_id, category_id, month, expected)
  select ig.id, v_uid, ig.category_id, ig.month, ig.expected
  from jsonb_populate_recordset(null::public.income_goals, coalesce(v_data -> 'income_goals', '[]'::jsonb)) ig
  join public.categories cat on cat.id = ig.category_id
  where cat.user_id = v_uid;

  insert into public.insight_feedback (id, user_id, occurrence_key, decision, created_at)
  select id, v_uid, occurrence_key, decision, created_at
  from jsonb_populate_recordset(null::public.insight_feedback, coalesce(v_data -> 'insight_feedback', '[]'::jsonb));

  insert into public.reminder_states (id, user_id, occurrence_key, kind, snooze_until, created_at, updated_at)
  select id, v_uid, occurrence_key, kind, snooze_until, created_at, updated_at
  from jsonb_populate_recordset(null::public.reminder_states, coalesce(v_data -> 'reminder_states', '[]'::jsonb));

  insert into public.portfolio_transactions (id, user_id, asset_id, type, date, quantity, price, total)
  select pt.id, v_uid, pt.asset_id, pt.type, pt.date, pt.quantity, pt.price, pt.total
  from jsonb_populate_recordset(null::public.portfolio_transactions, coalesce(v_data -> 'portfolio_transactions', '[]'::jsonb)) pt
  join public.portfolio_assets pa on pa.id = pt.asset_id
  where pa.user_id = v_uid;

  insert into public.allocation_targets (id, user_id, asset_id, target_percentage)
  select alt.id, v_uid, alt.asset_id, alt.target_percentage
  from jsonb_populate_recordset(null::public.allocation_targets, coalesce(v_data -> 'allocation_targets', '[]'::jsonb)) alt
  join public.portfolio_assets pa on pa.id = alt.asset_id
  where pa.user_id = v_uid;

  select jsonb_build_object(
    'categories', (select count(*) from public.categories where user_id = v_uid),
    'credit_cards', (select count(*) from public.credit_cards where user_id = v_uid),
    'incomes', (select count(*) from public.incomes where user_id = v_uid),
    'expenses', (select count(*) from public.expenses where user_id = v_uid),
    'debts', (select count(*) from public.debts where user_id = v_uid),
    'portfolio_assets', (select count(*) from public.portfolio_assets where user_id = v_uid)
  ) into v_counts;

  return jsonb_build_object('success', true, 'counts', v_counts);
end;
$$;

-- 8.2 execute_portfolio_batch_aporte: exige escrita no módulo 'investments'
create or replace function public.execute_portfolio_batch_aporte(
  p_date date,
  p_total_amount integer,
  p_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_asset_id uuid;
  v_quantity numeric;
  v_price integer;
  v_total integer;
  v_current_qty numeric;
  v_current_pm integer;
  v_new_qty numeric;
  v_new_pm integer;
  v_sum_items integer := 0;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('investments') then
    raise exception 'Acesso negado: permissão de escrita em Investimentos requerida.';
  end if;

  if p_date is null or p_total_amount is null or p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Parâmetros inválidos para aporte em lote';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_asset_id := (v_item->>'asset_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'price')::integer;
    v_total := (v_item->>'total')::integer;

    if v_quantity <= 0 or v_price < 0 or v_total < 0 then
      raise exception 'Item de aporte com valor ou quantidade inválida: %', v_item;
    end if;

    v_sum_items := v_sum_items + v_total;

    select quantity, average_price into v_current_qty, v_current_pm
      from public.portfolio_assets
     where id = v_asset_id and user_id = v_user_id
       for update;

    if not found then
      raise exception 'Ativo não encontrado ou não pertence ao usuário: %', v_asset_id;
    end if;

    v_new_qty := v_current_qty + v_quantity;
    if v_new_qty > 0 then
      v_new_pm := round(((v_current_qty * v_current_pm) + (v_quantity * v_price)) / v_new_qty);
    else
      v_new_pm := v_current_pm;
    end if;

    update public.portfolio_assets
       set quantity = v_new_qty,
           average_price = v_new_pm,
           updated_at = now()
     where id = v_asset_id and user_id = v_user_id;

    insert into public.portfolio_transactions (
      user_id,
      asset_id,
      type,
      date,
      quantity,
      price,
      total
    ) values (
      v_user_id,
      v_asset_id,
      'buy',
      p_date,
      v_quantity,
      v_price,
      v_total
    );
  end loop;

  insert into public.portfolio_contributions (
    user_id,
    date,
    amount,
    notes
  ) values (
    v_user_id,
    p_date,
    p_total_amount,
    'Aporte em lote inteligente via Calculadora de Aporte'
  );

  insert into public.audit_events (
    user_id,
    entity_type,
    entity_id,
    action,
    payload
  ) values (
    v_user_id,
    'portfolio',
    v_user_id::text,
    'execute_batch_aporte',
    jsonb_build_object(
      'date', p_date,
      'total_amount', p_total_amount,
      'items_count', jsonb_array_length(p_items)
    )
  );

  return true;
end;
$$;

-- 8.3 import_statement_expenses: exige escrita no módulo 'cards'
create or replace function public.import_statement_expenses(
  p_card_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count integer := 0;
  v_category_id uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') then
    raise exception 'Acesso negado: permissão de escrita em Cartões de Crédito requerida.';
  end if;

  -- Valida posse do cartão
  if not exists (select 1 from public.credit_cards where id = p_card_id and user_id = v_user_id) then
    raise exception 'Cartão de crédito não encontrado ou não pertence ao usuário: %', p_card_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := (v_item->>'category_id')::uuid;

    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id) then
      raise exception 'Categoria não encontrada ou não pertence ao usuário: %', v_category_id;
    end if;

    insert into public.expenses (
      user_id,
      value,
      date,
      category_id,
      payment_method,
      card_id,
      installments_total,
      installment_number,
      bill_competence,
      description,
      statement_hash,
      imported_from_statement
    ) values (
      v_user_id,
      (v_item->>'value')::integer,
      (v_item->>'date')::date,
      v_category_id,
      'credit_card',
      p_card_id,
      coalesce((v_item->>'installments_total')::integer, 1),
      coalesce((v_item->>'installment_number')::integer, 1),
      v_item->>'bill_competence',
      v_item->>'description',
      v_item->>'statement_hash',
      true
    );

    v_inserted_count := v_inserted_count + 1;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'expenses', p_card_id::text, 'import_statement',
    jsonb_build_object('card_id', p_card_id, 'imported_count', v_inserted_count)
  );

  return v_inserted_count;
end;
$$;

-- 8.4 import_bank_transactions: exige escrita no módulo 'transactions'
create or replace function public.import_bank_transactions(
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_count integer := 0;
  v_category_id uuid;
  v_type text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: permissão de escrita em Transações requerida.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_category_id := (v_item->>'category_id')::uuid;
    v_type := v_item->>'type';

    if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id) then
      raise exception 'Categoria não encontrada ou não pertence ao usuário: %', v_category_id;
    end if;

    if v_type = 'income' then
      insert into public.incomes (
        user_id,
        value,
        date,
        category_id,
        receive_type,
        description,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        (v_item->>'value')::integer,
        (v_item->>'date')::date,
        v_category_id,
        coalesce(v_item->>'receive_type', 'pix')::public.receive_type,
        v_item->>'description',
        v_item->>'statement_hash',
        true
      );
      v_inserted_count := v_inserted_count + 1;
    elsif v_type = 'expense' then
      insert into public.expenses (
        user_id,
        value,
        date,
        category_id,
        payment_method,
        installments_total,
        installment_number,
        description,
        statement_hash,
        imported_from_statement
      ) values (
        v_user_id,
        (v_item->>'value')::integer,
        (v_item->>'date')::date,
        v_category_id,
        coalesce(v_item->>'payment_method', 'pix')::public.payment_method,
        1,
        1,
        v_item->>'description',
        v_item->>'statement_hash',
        true
      );
      v_inserted_count := v_inserted_count + 1;
    end if;
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id, 'transactions', v_user_id::text, 'import_bank_statement',
    jsonb_build_object('imported_count', v_inserted_count)
  );

  return v_inserted_count;
end;
$$;

-- 8.5 refinance_credit_card_bill: exige escrita nos módulos 'cards' e 'debts'
create or replace function public.refinance_credit_card_bill(
  p_card_id uuid,
  p_competence_month text,
  p_refinance_amount integer,
  p_installments_total integer,
  p_installments jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_card_name text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('cards') or not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: permissão de escrita em Cartões e Dívidas requerida.';
  end if;

  select name into v_card_name
    from public.credit_cards
   where id = p_card_id and user_id = v_user_id;

  if not found then
    raise exception 'Cartão de crédito não encontrado ou não pertence ao usuário';
  end if;

  -- 1) Registra o pagamento com valor do refinanciamento
  insert into public.card_payments (
    user_id,
    card_id,
    competence_month,
    amount,
    date,
    note
  ) values (
    v_user_id,
    p_card_id,
    p_competence_month,
    p_refinance_amount,
    current_date,
    coalesce(p_note, 'Refinanciamento de fatura em ' || p_installments_total || 'x')
  );

  -- 2) Cria as parcelas em debts
  for v_item in select * from jsonb_array_elements(p_installments)
  loop
    insert into public.debts (
      user_id,
      name,
      type,
      amount,
      due_date,
      installment_group_id
    ) values (
      v_user_id,
      'Parcelamento Fatura ' || v_card_name || ' (' || (v_item->>'installment_number') || '/' || p_installments_total || ')',
      'payable',
      (v_item->>'value')::integer,
      (v_item->>'date')::date,
      v_group_id
    );
  end loop;

  insert into public.audit_events (user_id, entity_type, entity_id, action, payload)
  values (
    v_user_id,
    'card_payments',
    p_card_id::text,
    'refinance_bill',
    jsonb_build_object(
      'competence_month', p_competence_month,
      'refinance_amount', p_refinance_amount,
      'installments_total', p_installments_total,
      'group_id', v_group_id
    )
  );

  return v_group_id;
end;
$$;

-- 8.6 create_expense_with_debt: exige escrita em 'transactions' e 'debts'
create or replace function public.create_expense_with_debt(
  p_expense jsonb,
  p_debt jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_expense_id uuid;
  v_debt_id uuid := null;
  v_category_id uuid := (p_expense->>'category_id')::uuid;
  v_card_id uuid := (p_expense->>'card_id')::uuid;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_current_user_active() then
    raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
  end if;

  if not public.can_current_user_write_module('transactions') then
    raise exception 'Acesso negado: permissão de escrita em Transações requerida.';
  end if;

  if p_debt is not null and not public.can_current_user_write_module('debts') then
    raise exception 'Acesso negado: permissão de escrita em Dívidas requerida.';
  end if;

  if not exists (select 1 from public.categories where id = v_category_id and user_id = v_user_id) then
    raise exception 'Categoria não encontrada ou não pertence ao usuário: %', v_category_id;
  end if;

  if v_card_id is not null and not exists (select 1 from public.credit_cards where id = v_card_id and user_id = v_user_id) then
    raise exception 'Cartão não encontrado ou não pertence ao usuário: %', v_card_id;
  end if;

  insert into public.expenses (
    user_id,
    value,
    date,
    category_id,
    payment_method,
    card_id,
    installments_total,
    installment_number,
    installment_group_id,
    bill_competence,
    report_weight,
    base_amount,
    description,
    charge_kind
  ) values (
    v_user_id,
    (p_expense->>'value')::integer,
    (p_expense->>'date')::date,
    v_category_id,
    (p_expense->>'payment_method')::public.payment_method,
    v_card_id,
    coalesce((p_expense->>'installments_total')::integer, 1),
    coalesce((p_expense->>'installment_number')::integer, 1),
    (p_expense->>'installment_group_id')::uuid,
    p_expense->>'bill_competence',
    coalesce((p_expense->>'report_weight')::numeric, 1.0),
    coalesce((p_expense->>'base_amount')::integer, (p_expense->>'value')::integer),
    p_expense->>'description',
    coalesce(p_expense->>'charge_kind', 'regular')::public.charge_kind
  )
  returning id into v_expense_id;

  if p_debt is not null then
    insert into public.debts (
      user_id,
      name,
      type,
      amount,
      due_date,
      expense_id,
      installment_group_id,
      charge_kind
    ) values (
      v_user_id,
      p_debt->>'name',
      (p_debt->>'type')::public.debt_type,
      (p_debt->>'amount')::integer,
      (p_debt->>'due_date')::date,
      v_expense_id,
      (p_debt->>'installment_group_id')::uuid,
      coalesce(p_debt->>'charge_kind', 'regular')::public.charge_kind
    )
    returning id into v_debt_id;
  end if;

  return jsonb_build_object(
    'expense_id', v_expense_id,
    'debt_id', v_debt_id
  );
end;
$$;
