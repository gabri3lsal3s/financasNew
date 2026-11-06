-- ---------------------------------------------------------------------------
-- 20260101000076_create_families_and_multi_account_collaboration.sql
-- Módulo de Modo Família Colaborativo Multi-Contas & Consolidação Orçamentária
-- Criação de families, family_members, family_invites, family_settlements
-- e adição de family_id em expenses, incomes e categories com isolamento RLS.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Tabela de Famílias (public.families)
-- ===========================================================================
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  owner_id uuid not null references auth.users(id) on delete cascade,
  monthly_budget numeric(12, 2) check (monthly_budget is null or monthly_budget >= 0),
  split_rule text not null default 'equal' check (split_rule in ('equal', 'proportional')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- 2. Tabela de Membros da Família (public.family_members)
-- ===========================================================================
create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 80),
  pix_key text,
  pix_key_type text check (pix_key_type is null or pix_key_type in ('cpf', 'email', 'phone', 'random')),
  split_ratio numeric(5, 4) check (split_ratio is null or (split_ratio >= 0 and split_ratio <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_family_members_family_user unique (family_id, user_id),
  constraint uq_family_members_user unique (user_id)
);

-- ===========================================================================
-- 3. Tabela de Convites Familiares (public.family_invites)
-- ===========================================================================
create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_email text check (invited_email is null or length(trim(invited_email)) between 3 and 255),
  token text unique not null check (length(trim(token)) between 6 and 64),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz
);

-- ===========================================================================
-- 4. Tabela de Acertos Financeiros da Família (public.family_settlements)
-- ===========================================================================
create table if not exists public.family_settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  month char(7) not null check (month ~ '^\d{4}-\d{2}$'),
  payer_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  settled_at timestamptz not null default now(),
  payment_method text not null default 'pix' check (payment_method in ('pix', 'transfer', 'cash', 'other')),
  notes text check (notes is null or length(notes) <= 500),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);

-- ===========================================================================
-- 5. Expansão de Entidades Existentes com family_id
-- ===========================================================================
alter table public.expenses
  add column if not exists family_id uuid references public.families(id) on delete set null;

alter table public.incomes
  add column if not exists family_id uuid references public.families(id) on delete set null;

alter table public.categories
  add column if not exists family_id uuid references public.families(id) on delete set null;

-- ===========================================================================
-- 6. Triggers de Atualização Automática de updated_at
-- ===========================================================================
drop trigger if exists set_families_updated_at on public.families;
create trigger set_families_updated_at
  before update on public.families
  for each row execute function public.update_updated_at();

drop trigger if exists set_family_members_updated_at on public.family_members;
create trigger set_family_members_updated_at
  before update on public.family_members
  for each row execute function public.update_updated_at();

-- ===========================================================================
-- 7. Funções de Apoio de Segurança e Membresia (SECURITY DEFINER)
-- ===========================================================================
create or replace function public.is_family_member(p_family_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.is_family_admin(p_family_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = coalesce(p_user_id, auth.uid())
      and role in ('owner', 'admin')
  );
$$;

-- ===========================================================================
-- 8. Habilitação de Row Level Security (RLS)
-- ===========================================================================
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.family_settlements enable row level security;

-- ===========================================================================
-- 9. Políticas de Segurança RLS (InitPlan Subplan Caching Pattern)
-- ===========================================================================

-- 9.1 public.families
drop policy if exists "families_select" on public.families;
create policy "families_select"
  on public.families
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.is_family_member(id, (select auth.uid()))
  );

drop policy if exists "families_insert" on public.families;
create policy "families_insert"
  on public.families
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "families_update" on public.families;
create policy "families_update"
  on public.families
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.is_family_admin(id, (select auth.uid()))
  )
  with check (
    (select auth.uid()) = owner_id
    or public.is_family_admin(id, (select auth.uid()))
  );

drop policy if exists "families_delete" on public.families;
create policy "families_delete"
  on public.families
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- 9.2 public.family_members
drop policy if exists "family_members_select" on public.family_members;
create policy "family_members_select"
  on public.family_members
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_family_member(family_id, (select auth.uid()))
  );

drop policy if exists "family_members_insert" on public.family_members;
create policy "family_members_insert"
  on public.family_members
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    or public.is_family_admin(family_id, (select auth.uid()))
  );

drop policy if exists "family_members_update" on public.family_members;
create policy "family_members_update"
  on public.family_members
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_family_admin(family_id, (select auth.uid()))
  )
  with check (
    (select auth.uid()) = user_id
    or public.is_family_admin(family_id, (select auth.uid()))
  );

drop policy if exists "family_members_delete" on public.family_members;
create policy "family_members_delete"
  on public.family_members
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_family_admin(family_id, (select auth.uid()))
  );

-- 9.3 public.family_invites
drop policy if exists "family_invites_select" on public.family_invites;
create policy "family_invites_select"
  on public.family_invites
  for select
  to authenticated
  using (
    (select auth.uid()) = invited_by
    or (select auth.uid()) = accepted_by
    or public.is_family_member(family_id, (select auth.uid()))
    or (status = 'pending' and expires_at > now() and (select auth.uid()) is not null)
  );

drop policy if exists "family_invites_insert" on public.family_invites;
create policy "family_invites_insert"
  on public.family_invites
  for insert
  to authenticated
  with check (
    (select auth.uid()) = invited_by
    and (
      (select auth.uid()) is not null
      or public.is_family_admin(family_id, (select auth.uid()))
    )
  );

drop policy if exists "family_invites_update" on public.family_invites;
create policy "family_invites_update"
  on public.family_invites
  for update
  to authenticated
  using (
    (select auth.uid()) = invited_by
    or public.is_family_admin(family_id, (select auth.uid()))
    or (status = 'pending' and expires_at > now() and (select auth.uid()) is not null)
  )
  with check (
    (select auth.uid()) = invited_by
    or public.is_family_admin(family_id, (select auth.uid()))
    or (status in ('accepted', 'pending') and (select auth.uid()) is not null)
  );

drop policy if exists "family_invites_delete" on public.family_invites;
create policy "family_invites_delete"
  on public.family_invites
  for delete
  to authenticated
  using (
    (select auth.uid()) = invited_by
    or public.is_family_admin(family_id, (select auth.uid()))
  );

-- 9.4 public.family_settlements
drop policy if exists "family_settlements_select" on public.family_settlements;
create policy "family_settlements_select"
  on public.family_settlements
  for select
  to authenticated
  using (
    (select auth.uid()) = created_by
    or (select auth.uid()) = payer_id
    or (select auth.uid()) = receiver_id
    or public.is_family_member(family_id, (select auth.uid()))
  );

drop policy if exists "family_settlements_insert" on public.family_settlements;
create policy "family_settlements_insert"
  on public.family_settlements
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and public.is_family_member(family_id, (select auth.uid()))
  );

drop policy if exists "family_settlements_update" on public.family_settlements;
create policy "family_settlements_update"
  on public.family_settlements
  for update
  to authenticated
  using (
    (select auth.uid()) = created_by
    or public.is_family_admin(family_id, (select auth.uid()))
  )
  with check (
    (select auth.uid()) = created_by
    or public.is_family_admin(family_id, (select auth.uid()))
  );

drop policy if exists "family_settlements_delete" on public.family_settlements;
create policy "family_settlements_delete"
  on public.family_settlements
  for delete
  to authenticated
  using (
    (select auth.uid()) = created_by
    or public.is_family_admin(family_id, (select auth.uid()))
  );

-- 9.5 Atualização da Policy de Categorias para Compartilhamento Familiar
drop policy if exists "categories_all_own" on public.categories;
drop policy if exists "categories_select" on public.categories;
drop policy if exists "categories_insert" on public.categories;
drop policy if exists "categories_update" on public.categories;
drop policy if exists "categories_delete" on public.categories;

create policy "categories_select"
  on public.categories
  for select
  to authenticated
  using (
    (
      (select auth.uid()) = user_id
      or (
        is_family
        and family_id is not null
        and public.is_family_member(family_id, (select auth.uid()))
      )
    )
    and (select public.is_current_user_active())
  );

create policy "categories_insert"
  on public.categories
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

create policy "categories_update"
  on public.categories
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  )
  with check (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

create policy "categories_delete"
  on public.categories
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select public.is_current_user_active())
  );

-- ===========================================================================
-- 10. Índices de Alta Performance
-- ===========================================================================
create index if not exists idx_families_owner_id
  on public.families (owner_id);

create index if not exists idx_family_members_family_id
  on public.family_members (family_id);

create index if not exists idx_family_members_user_id
  on public.family_members (user_id);

create index if not exists idx_family_invites_token
  on public.family_invites (token);

create index if not exists idx_family_invites_family_id
  on public.family_invites (family_id);

create index if not exists idx_family_invites_invited_by
  on public.family_invites (invited_by);

create index if not exists idx_family_settlements_family_month
  on public.family_settlements (family_id, month desc);

create index if not exists idx_family_settlements_payer
  on public.family_settlements (payer_id);

create index if not exists idx_family_settlements_receiver
  on public.family_settlements (receiver_id);

create index if not exists idx_expenses_family_id
  on public.expenses (family_id)
  where family_id is not null;

create index if not exists idx_expenses_family_date
  on public.expenses (family_id, date desc)
  where is_family = true and family_id is not null;

create index if not exists idx_incomes_family_id
  on public.incomes (family_id)
  where family_id is not null;

create index if not exists idx_categories_family_id
  on public.categories (family_id)
  where family_id is not null;

-- ===========================================================================
-- 11. Concessão de Privilégios PostgREST
-- ===========================================================================
grant select, insert, update, delete on public.families to authenticated, service_role;
grant select, insert, update, delete on public.family_members to authenticated, service_role;
grant select, insert, update, delete on public.family_invites to authenticated, service_role;
grant select, insert, update, delete on public.family_settlements to authenticated, service_role;

grant execute on function public.is_family_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_family_admin(uuid, uuid) to authenticated, service_role;
