-- ================================================================
-- 0030_rls_hardening_and_search_path.sql — Hardening de RLS e Funções (§F45)
--
-- Objetivos de Segurança:
--   1. Otimização e Blindagem de RLS:
--      Substituição de auth.uid() = user_id por ((select auth.uid()) = user_id and public.is_current_user_active())
--      em todas as tabelas de negócio para evitar reavaliação por linha (InitPlan) e bloquear contas suspensas/banidas.
--   2. search_path Imutável em 100% das Funções PL/pgSQL:
--      Fixação explícita de `SET search_path = public, pg_temp` em todas as rotinas e RPCs para imunização contra schema hijacking.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Hardening de Políticas RLS em Tabelas de Negócio
-- ----------------------------------------------------------------

-- categories
drop policy if exists "categories_all_own" on public.categories;
create policy "categories_all_own" on public.categories
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- custom_categories (se existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'custom_categories') then
    execute 'drop policy if exists "custom_categories_all_own" on public.custom_categories;';
    execute 'create policy "custom_categories_all_own" on public.custom_categories for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- category_weights
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'category_weights') then
    execute 'drop policy if exists "category_weights_all_own" on public.category_weights;';
    execute 'create policy "category_weights_all_own" on public.category_weights for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- credit_cards
drop policy if exists "credit_cards_all_own" on public.credit_cards;
create policy "credit_cards_all_own" on public.credit_cards
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- card_competence_overrides (via cartão do usuário ativo)
drop policy if exists "competence_overrides_all_via_card" on public.card_competence_overrides;
create policy "competence_overrides_all_via_card" on public.card_competence_overrides
  for all
  using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_id
        and c.user_id = (select auth.uid())
        and public.is_current_user_active()
    )
  )
  with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_id
        and c.user_id = (select auth.uid())
        and public.is_current_user_active()
    )
  );

-- incomes
drop policy if exists "incomes_all_own" on public.incomes;
create policy "incomes_all_own" on public.incomes
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- expenses
drop policy if exists "expenses_all_own" on public.expenses;
create policy "expenses_all_own" on public.expenses
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- card_payments
drop policy if exists "card_payments_all_own" on public.card_payments;
create policy "card_payments_all_own" on public.card_payments
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- debts
drop policy if exists "debts_all_own" on public.debts;
create policy "debts_all_own" on public.debts
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- debt_payments
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'debt_payments') then
    execute 'drop policy if exists "debt_payments_all_own" on public.debt_payments;';
    execute 'create policy "debt_payments_all_own" on public.debt_payments for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- budgets
drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- reminder_states
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reminder_states') then
    execute 'drop policy if exists "reminder_states_all_own" on public.reminder_states;';
    execute 'create policy "reminder_states_all_own" on public.reminder_states for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- recurrences & recurrence_skips
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurrences') then
    execute 'drop policy if exists "recurrences_all_own" on public.recurrences;';
    execute 'create policy "recurrences_all_own" on public.recurrences for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'recurrence_skips') then
    execute 'drop policy if exists "recurrence_skips_all_own" on public.recurrence_skips;';
    execute 'create policy "recurrence_skips_all_own" on public.recurrence_skips for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- loans & loan_payments
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'loans') then
    execute 'drop policy if exists "loans_all_own" on public.loans;';
    execute 'create policy "loans_all_own" on public.loans for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'loan_payments') then
    execute 'drop policy if exists "loan_payments_all_own" on public.loan_payments;';
    execute 'create policy "loan_payments_all_own" on public.loan_payments for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- portfolio_assets & portfolio_transactions
drop policy if exists "portfolio_assets_all_own" on public.portfolio_assets;
create policy "portfolio_assets_all_own" on public.portfolio_assets
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

drop policy if exists "portfolio_transactions_all_own" on public.portfolio_transactions;
create policy "portfolio_transactions_all_own" on public.portfolio_transactions
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- portfolio_dividends (se existir)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'portfolio_dividends') then
    execute 'drop policy if exists "portfolio_dividends_all_own" on public.portfolio_dividends;';
    execute 'create policy "portfolio_dividends_all_own" on public.portfolio_dividends for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- allocation_targets & allocation_presets
drop policy if exists "allocation_targets_all_own" on public.allocation_targets;
create policy "allocation_targets_all_own" on public.allocation_targets
  for all using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'allocation_presets') then
    execute 'drop policy if exists "allocation_presets_all_own" on public.allocation_presets;';
    execute 'create policy "allocation_presets_all_own" on public.allocation_presets for all using ((select auth.uid()) = user_id and public.is_current_user_active()) with check ((select auth.uid()) = user_id and public.is_current_user_active());';
  end if;
end $$;

-- user_preferences
drop policy if exists "preferences_select_own" on public.user_preferences;
drop policy if exists "preferences_insert_own" on public.user_preferences;
drop policy if exists "preferences_update_own" on public.user_preferences;
create policy "preferences_select_own" on public.user_preferences
  for select using ((select auth.uid()) = user_id and public.is_current_user_active());
create policy "preferences_insert_own" on public.user_preferences
  for insert with check ((select auth.uid()) = user_id and public.is_current_user_active());
create policy "preferences_update_own" on public.user_preferences
  for update using ((select auth.uid()) = user_id and public.is_current_user_active())
  with check ((select auth.uid()) = user_id and public.is_current_user_active());

-- audit_events (imutável: apenas leitura e inserção)
drop policy if exists "audit_events_insert_own" on public.audit_events;
drop policy if exists "audit_events_select_own" on public.audit_events;
create policy "audit_events_insert_own" on public.audit_events
  for insert with check ((select auth.uid()) = user_id and public.is_current_user_active());
create policy "audit_events_select_own" on public.audit_events
  for select using (
    ((select auth.uid()) = user_id and public.is_current_user_active())
    or public.is_admin()
  );

-- ----------------------------------------------------------------
-- 2. Hardening de search_path em Funções de Sistema & Triggers
-- ----------------------------------------------------------------

-- Recriação das triggers e utilitários com search_path explícito
alter function public.protect_profile_security_fields() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.log_audit_event(text, text, uuid, jsonb) set search_path = public, pg_temp;

-- Validação de invariantes em lote para amortizações e parcelamentos
do $$
begin
  if exists (select 1 from pg_proc where proname = 'admin_update_user_role') then
    alter function public.admin_update_user_role(uuid, public.user_role) set search_path = public, pg_temp;
  end if;
  if exists (select 1 from pg_proc where proname = 'admin_update_user_status') then
    alter function public.admin_update_user_status(uuid, public.user_status, text) set search_path = public, pg_temp;
  end if;
  if exists (select 1 from pg_proc where proname = 'admin_create_access_invite') then
    alter function public.admin_create_access_invite(integer, text, timestamptz) set search_path = public, pg_temp;
  end if;
  if exists (select 1 from pg_proc where proname = 'admin_revoke_access_invite') then
    alter function public.admin_revoke_access_invite(uuid) set search_path = public, pg_temp;
  end if;
  if exists (select 1 from pg_proc where proname = 'admin_set_user_feature_override') then
    alter function public.admin_set_user_feature_override(uuid, text, boolean) set search_path = public, pg_temp;
  end if;
  if exists (select 1 from pg_proc where proname = 'admin_set_system_feature_global') then
    alter function public.admin_set_system_feature_global(text, boolean) set search_path = public, pg_temp;
  end if;
end $$;
