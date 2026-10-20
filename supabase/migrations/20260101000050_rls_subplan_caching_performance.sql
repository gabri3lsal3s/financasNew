-- Migration: 20260101000050_rls_subplan_caching_performance.sql
-- FASE 3: Otimização de Banco de Dados Supabase — RLS Subplan Caching (InitPlan)
--
-- MOTIVAÇÃO E EXPLICAÇÃO TÉCNICA (POSTGRESQL QUERY PLANNER):
-- Quando uma política RLS utiliza chamadas diretas como `auth.uid() = user_id` ou
-- `public.get_user_module_access(auth.uid(), ...)`, o planejador do PostgreSQL
-- classifica a função `auth.uid()` como VOLÁTIL (lê contexto do JWT da transação).
-- Como resultado, `auth.uid()` é re-executada linha a linha durante o Table/Index Scan
-- de todo o heap. Sob concorrência de dezenas/centenas de conexões, isso satura a CPU.
--
-- Ao encapsular a invocação em uma subquery escalar estática:
--   ((select auth.uid()) = user_id)
-- o otimizador do Postgres percebe que a subquery não possui variáveis de correlação
-- com as colunas da tabela externa e a promove a um nó "InitPlan". O nó InitPlan é
-- avaliado exatamente UMA ÚNICA VEZ no início da execução da query, e seu resultado
-- escalar em memória é reutilizado em toda a filtragem de linhas.
--
-- Esta migração normaliza 100% das políticas ativas do sistema que ainda continham
-- referências não-escalares a auth.uid(), eliminando avaliações voláteis por linha.

-- ====================================================================
-- 1. PERFIS DE USUÁRIO (public.profiles)
-- ====================================================================

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ====================================================================
-- 2. COTAÇÕES E CACHE GLOBAL (public.asset_prices)
-- ====================================================================

drop policy if exists "asset_prices_select" on public.asset_prices;
create policy "asset_prices_select"
  on public.asset_prices
  for select
  using (user_id is null or user_id = (select auth.uid()));

drop policy if exists "asset_prices_insert_own" on public.asset_prices;
create policy "asset_prices_insert_own"
  on public.asset_prices
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "asset_prices_update_own" on public.asset_prices;
create policy "asset_prices_update_own"
  on public.asset_prices
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "asset_prices_delete_own" on public.asset_prices;
create policy "asset_prices_delete_own"
  on public.asset_prices
  for delete
  using (user_id = (select auth.uid()));

-- ====================================================================
-- 3. TRANSAÇÕES BÁSICAS, CHECKPOINTS E CARTÕES DE CRÉDITO
-- ====================================================================

-- Incomes
drop policy if exists "incomes_select_own" on public.incomes;
create policy "incomes_select_own"
  on public.incomes
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Expenses
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own"
  on public.expenses
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Cash Checkpoints
drop policy if exists "cash_checkpoints_select_own" on public.cash_checkpoints;
create policy "cash_checkpoints_select_own"
  on public.cash_checkpoints
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'transactions') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Credit Cards
drop policy if exists "credit_cards_select_own" on public.credit_cards;
create policy "credit_cards_select_own"
  on public.credit_cards
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Card Payments
drop policy if exists "card_payments_select_own" on public.card_payments;
create policy "card_payments_select_own"
  on public.card_payments
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Card Competence Overrides
drop policy if exists "competence_overrides_select_via_card" on public.card_competence_overrides;
create policy "competence_overrides_select_via_card"
  on public.card_competence_overrides
  for select
  using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_competence_overrides.card_id
        and c.user_id = (select auth.uid())
        and public.is_current_user_active()
        and public.get_user_module_access((select auth.uid()), 'cards') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
    )
  );

-- ====================================================================
-- 4. DÍVIDAS E EMPRÉSTIMOS (DEBTS & LOANS)
-- ====================================================================

-- Debts
drop policy if exists "debts_select_own" on public.debts;
create policy "debts_select_own"
  on public.debts
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'debts') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Loans
drop policy if exists "loans_select_own" on public.loans;
create policy "loans_select_own"
  on public.loans
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'debts') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- ====================================================================
-- 5. ORÇAMENTOS E METAS DE RECEITA (BUDGETS & INCOME GOALS)
-- ====================================================================

-- Budgets
drop policy if exists "budgets_select_own" on public.budgets;
create policy "budgets_select_own"
  on public.budgets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'budgets') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Income Goals
drop policy if exists "income_goals_select_own" on public.income_goals;
create policy "income_goals_select_own"
  on public.income_goals
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'budgets') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- ====================================================================
-- 6. INVESTIMENTOS, ATIVOS, TRANSAÇÕES, PROVENTOS E METAS
-- ====================================================================

-- Portfolio Assets
drop policy if exists "portfolio_assets_select_own" on public.portfolio_assets;
create policy "portfolio_assets_select_own"
  on public.portfolio_assets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Portfolio Transactions
drop policy if exists "portfolio_transactions_select_own" on public.portfolio_transactions;
create policy "portfolio_transactions_select_own"
  on public.portfolio_transactions
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Portfolio Snapshots
drop policy if exists "portfolio_snapshots_select_own" on public.portfolio_snapshots;
create policy "portfolio_snapshots_select_own"
  on public.portfolio_snapshots
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Portfolio Contributions
drop policy if exists "portfolio_contributions_select_own" on public.portfolio_contributions;
create policy "portfolio_contributions_select_own"
  on public.portfolio_contributions
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Portfolio Dividends
drop policy if exists "portfolio_dividends_select_own" on public.portfolio_dividends;
create policy "portfolio_dividends_select_own"
  on public.portfolio_dividends
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Allocation Targets
drop policy if exists "allocation_targets_select_own" on public.allocation_targets;
create policy "allocation_targets_select_own"
  on public.allocation_targets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Class Targets
drop policy if exists "class_targets_select_own" on public.class_targets;
create policy "class_targets_select_own"
  on public.class_targets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Sector Targets
drop policy if exists "sector_targets_select_own" on public.sector_targets;
create policy "sector_targets_select_own"
  on public.sector_targets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Allocation Presets
drop policy if exists "allocation_presets_select_own" on public.allocation_presets;
create policy "allocation_presets_select_own"
  on public.allocation_presets
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'investments') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- ====================================================================
-- 7. RECORRÊNCIAS, LEMBRETES E INSIGHTS
-- ====================================================================

-- Recurrences
drop policy if exists "recurrences_select_own" on public.recurrences;
create policy "recurrences_select_own"
  on public.recurrences
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Recurrence Skips
drop policy if exists "recurrence_skips_select_own" on public.recurrence_skips;
create policy "recurrence_skips_select_own"
  on public.recurrence_skips
  for select
  using (
    exists (
      select 1 from public.recurrences r
      where r.id = recurrence_skips.recurrence_id
        and r.user_id = (select auth.uid())
        and public.is_current_user_active()
        and public.get_user_module_access((select auth.uid()), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
    )
  );

-- Reminder States
drop policy if exists "reminder_states_select_own" on public.reminder_states;
create policy "reminder_states_select_own"
  on public.reminder_states
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'reminders') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- Insight Feedback
drop policy if exists "insight_feedback_select_own" on public.insight_feedback;
create policy "insight_feedback_select_own"
  on public.insight_feedback
  for select
  using (
    (select auth.uid()) = user_id
    and public.is_current_user_active()
    and public.get_user_module_access((select auth.uid()), 'insights') in ('read'::public.access_level, 'write'::public.access_level, 'admin'::public.access_level)
  );

-- ====================================================================
-- 8. GOVERNANÇA DE ACESSO, PLANOS E FEATURES
-- ====================================================================

-- Access Invites
drop policy if exists "Admins gerenciam convites" on public.access_invites;
create policy "Admins gerenciam convites"
  on public.access_invites
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());

-- Plans
drop policy if exists "Todos podem ler planos ativos" on public.plans;
create policy "Todos podem ler planos ativos"
  on public.plans
  for select
  using ((select auth.uid()) is not null);

drop policy if exists "Admins gerenciam planos" on public.plans;
create policy "Admins gerenciam planos"
  on public.plans
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());

-- System Features
drop policy if exists "Todos podem ler funcionalidades do sistema" on public.system_features;
create policy "Todos podem ler funcionalidades do sistema"
  on public.system_features
  for select
  using ((select auth.uid()) is not null and auth.role() = 'authenticated');

drop policy if exists "Admins editam funcionalidades do sistema" on public.system_features;
create policy "Admins editam funcionalidades do sistema"
  on public.system_features
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());

-- User Feature Overrides
drop policy if exists "Usuário lê seus próprios overrides" on public.user_feature_overrides;
create policy "Usuário lê seus próprios overrides"
  on public.user_feature_overrides
  for select
  using ((select auth.uid()) = user_id or ((select auth.uid()) is not null and public.is_admin()));

drop policy if exists "Admins gerenciam overrides de features" on public.user_feature_overrides;
create policy "Admins gerenciam overrides de features"
  on public.user_feature_overrides
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());

-- User Module Permissions
drop policy if exists "Usuário lê suas permissões modulares" on public.user_module_permissions;
create policy "Usuário lê suas permissões modulares"
  on public.user_module_permissions
  for select
  using ((select auth.uid()) = user_id or ((select auth.uid()) is not null and public.is_admin()));

drop policy if exists "Admins gerenciam permissões modulares" on public.user_module_permissions;
create policy "Admins gerenciam permissões modulares"
  on public.user_module_permissions
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());

-- User Subscriptions
drop policy if exists "Usuário lê sua própria assinatura" on public.user_subscriptions;
create policy "Usuário lê sua própria assinatura"
  on public.user_subscriptions
  for select
  using ((select auth.uid()) = user_id or ((select auth.uid()) is not null and public.is_admin()));

drop policy if exists "Admins gerenciam assinaturas" on public.user_subscriptions;
create policy "Admins gerenciam assinaturas"
  on public.user_subscriptions
  for all
  using ((select auth.uid()) is not null and public.is_admin())
  with check ((select auth.uid()) is not null and public.is_admin());
