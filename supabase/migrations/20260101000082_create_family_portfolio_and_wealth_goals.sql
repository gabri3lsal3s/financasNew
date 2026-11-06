-- ---------------------------------------------------------------------------
-- 20260101000082_create_family_portfolio_and_wealth_goals.sql
-- Ampliação Patrimonial do Modo Família (Plano 03.1):
-- 1. Compartilhamento Seletivo de Ativos de Investimento (portfolio_assets)
-- 2. Tabela de Metas Patrimoniais da Família (family_wealth_goals) com RLS Hermético
-- ---------------------------------------------------------------------------

-- 1. Expansão da tabela de ativos de investimento
alter table public.portfolio_assets
  add column if not exists is_family boolean not null default false,
  add column if not exists family_id uuid references public.families(id) on delete set null,
  add column if not exists family_share_mode text not null default 'full'
    check (family_share_mode in ('full', 'percentage')),
  add column if not exists family_share_percentage integer not null default 100
    check (family_share_percentage between 1 and 100);

create index if not exists idx_portfolio_assets_family
  on public.portfolio_assets(family_id, is_family)
  where is_family = true;

-- 2. Tabela de Metas Patrimoniais Coletivas da Família
create table if not exists public.family_wealth_goals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  target_date date,
  goal_type text not null check (
    goal_type in ('emergency_reserve', 'wealth_accumulation', 'passive_income', 'acquisition')
  ),
  monthly_passive_income_target_cents bigint default null,
  linked_asset_classes text[] default null,
  notes text check (notes is null or length(notes) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_wealth_goals_family
  on public.family_wealth_goals(family_id);

-- 3. Habilitação de RLS
alter table public.family_wealth_goals enable row level security;

-- 4. Políticas de Segurança RLS (Zero Data Bleed)
drop policy if exists "family_wealth_goals_select" on public.family_wealth_goals;
create policy "family_wealth_goals_select"
  on public.family_wealth_goals
  for select
  to authenticated
  using (
    public.is_family_member(family_id, (select auth.uid()))
  );

drop policy if exists "family_wealth_goals_insert" on public.family_wealth_goals;
create policy "family_wealth_goals_insert"
  on public.family_wealth_goals
  for insert
  to authenticated
  with check (
    public.is_family_member(family_id, (select auth.uid()))
    and (select auth.uid()) = created_by
  );

drop policy if exists "family_wealth_goals_update" on public.family_wealth_goals;
create policy "family_wealth_goals_update"
  on public.family_wealth_goals
  for update
  to authenticated
  using (
    public.is_family_member(family_id, (select auth.uid()))
  )
  with check (
    public.is_family_member(family_id, (select auth.uid()))
  );

drop policy if exists "family_wealth_goals_delete" on public.family_wealth_goals;
create policy "family_wealth_goals_delete"
  on public.family_wealth_goals
  for delete
  to authenticated
  using (
    public.is_family_admin(family_id, (select auth.uid()))
    or (select auth.uid()) = created_by
  );

-- 5. Trigger de updated_at automático
drop trigger if exists set_family_wealth_goals_updated_at on public.family_wealth_goals;
create trigger set_family_wealth_goals_updated_at
  before update on public.family_wealth_goals
  for each row execute function public.update_updated_at();
