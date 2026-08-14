-- ================================================================
-- 0002_rls.sql — Row Level Security (D4: multiusuário isolado)
-- Toda tabela com user_id: RLS auth.uid() = user_id.
-- Exceções:
--   • card_competence_overrides (sem user_id) → via cartão do dono;
--   • asset_prices → leitura global (NULL = cache) + escrita só do dono;
--   • audit_events → IMUTÁVEL (insert + select; sem update/delete).
-- ================================================================

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.credit_cards enable row level security;
alter table public.card_competence_overrides enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.card_payments enable row level security;
alter table public.debts enable row level security;
alter table public.budgets enable row level security;
alter table public.income_goals enable row level security;
alter table public.insight_feedback enable row level security;
alter table public.portfolio_assets enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.allocation_targets enable row level security;
alter table public.class_targets enable row level security;
alter table public.sector_targets enable row level security;
alter table public.asset_prices enable row level security;
alter table public.audit_events enable row level security;

-- ----------------------------------------------------------------
-- profiles — cada usuário vê/edita o próprio perfil
-- ----------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ----------------------------------------------------------------
-- user_preferences
-- ----------------------------------------------------------------
create policy "preferences_select_own" on public.user_preferences
  for select using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.user_preferences
  for insert with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- Tabelas user-scoped (todas as operações do dono)
-- ----------------------------------------------------------------
create policy "categories_all_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "credit_cards_all_own" on public.credit_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "incomes_all_own" on public.incomes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_all_own" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "card_payments_all_own" on public.card_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debts_all_own" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "income_goals_all_own" on public.income_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "insight_feedback_all_own" on public.insight_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "portfolio_assets_all_own" on public.portfolio_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "portfolio_transactions_all_own" on public.portfolio_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "allocation_targets_all_own" on public.allocation_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "class_targets_all_own" on public.class_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sector_targets_all_own" on public.sector_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- card_competence_overrides — sem user_id; acesso via cartão do dono
-- ----------------------------------------------------------------
create policy "competence_overrides_all_via_card" on public.card_competence_overrides
  for all
  using (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.credit_cards c
      where c.id = card_id and c.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- asset_prices — leitura global (cache) + escrita só do dono (FRAG-3)
-- O cache global (user_id NULL) é escrito pela edge function com
-- service role (bypassa RLS).
-- ----------------------------------------------------------------
create policy "asset_prices_select" on public.asset_prices
  for select using (user_id is null or user_id = auth.uid());
create policy "asset_prices_insert_own" on public.asset_prices
  for insert with check (user_id = auth.uid());
create policy "asset_prices_update_own" on public.asset_prices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "asset_prices_delete_own" on public.asset_prices
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------
-- audit_events — IMUTÁVEL (D2): insert + select; sem update/delete
-- ----------------------------------------------------------------
create policy "audit_events_select_own" on public.audit_events
  for select using (auth.uid() = user_id);
create policy "audit_events_insert_own" on public.audit_events
  for insert with check (auth.uid() = user_id);
