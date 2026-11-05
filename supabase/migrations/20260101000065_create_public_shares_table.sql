-- ---------------------------------------------------------------------------
-- 20260101000065_create_public_shares_table.sql
-- Módulo de compartilhamento público e crescimento orgânico (Áxis Finance)
-- Tabela public_shares para links de racha de contas, orçamento familiar e metas
-- ---------------------------------------------------------------------------

-- 1. Criação da tabela de compartilhamento público
create table if not exists public.public_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('split', 'family_budget', 'goal_tracker')),
  token text unique not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '30 days'),
  is_revoked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. Habilitação de Row Level Security (RLS)
alter table public.public_shares enable row level security;

-- 3. Políticas de Segurança RLS
-- Select: o proprietário autenticado pode visualizar todos os seus compartilhamentos.
-- Visitantes públicos (anon ou authenticated) podem visualizar apenas compartilhamentos válidos (não revogados e não expirados).
drop policy if exists "public_shares_select" on public.public_shares;
create policy "public_shares_select"
  on public.public_shares
  for select
  to anon, authenticated
  using (
    ((select auth.uid()) = user_id)
    or (
      is_revoked = false
      and (expires_at is null or expires_at > now())
    )
  );

-- Inserção: restrita ao usuário autenticado para si mesmo
drop policy if exists "public_shares_insert" on public.public_shares;
create policy "public_shares_insert"
  on public.public_shares
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Atualização: apenas o proprietário autenticado pode alterar (revogação ou atualização de payload)
drop policy if exists "public_shares_update" on public.public_shares;
create policy "public_shares_update"
  on public.public_shares
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Exclusão: apenas o proprietário autenticado pode excluir
drop policy if exists "public_shares_delete" on public.public_shares;
create policy "public_shares_delete"
  on public.public_shares
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Trigger automático de atualização de updated_at
drop trigger if exists set_public_shares_updated_at on public.public_shares;
create trigger set_public_shares_updated_at
  before update on public.public_shares
  for each row execute function public.update_updated_at();

-- 5. Índices de alta performance
create index if not exists idx_public_shares_user_id
  on public.public_shares (user_id, created_at desc);

create index if not exists idx_public_shares_token_lookup
  on public.public_shares (token);

-- 6. Privilégios PostgREST
grant select on public.public_shares to anon, authenticated;
grant insert, update, delete on public.public_shares to authenticated;
grant select, insert, update, delete on public.public_shares to service_role;
